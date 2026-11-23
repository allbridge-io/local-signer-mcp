import { readFileSync } from 'node:fs';
import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { PACKAGE_VERSION } from './version.js';

export interface ManagedMcpSession {
  readonly sessionId: string | undefined;
  handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
  close(): Promise<void>;
  onClose?: () => Promise<void> | void;
}

export type CreateMcpSession = () => Promise<ManagedMcpSession>;

export interface StreamableHttpServerOptions {
  readonly maxSessions?: number;
  readonly sessionIdleTtlMs?: number;
}

export interface StreamableHttpTlsOptions {
  readonly certPath: string;
  readonly keyPath: string;
  readonly passphrase?: string | null;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (res.headersSent) {
    return;
  }

  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (body.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function createLocalSignerSession(server: McpServer): Promise<ManagedMcpSession> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  let closed = false;

  return {
    sessionId: transport.sessionId,
    async handleRequest(req, res, parsedBody) {
      await transport.handleRequest(req as IncomingMessage, res, parsedBody);
    },
    async close() {
      if (closed) {
        return;
      }

      closed = true;
      await transport.close();
      await server.close();
    },
  };
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isLoopbackHost(hostname: string | undefined): boolean {
  return hostname !== undefined && LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

/** The host name of a Host header without the port, unwrapping IPv6 brackets. */
export function hostnameOf(hostHeader: string | undefined): string | undefined {
  if (!hostHeader) {
    return undefined;
  }
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(hostHeader);
  if (bracketed) {
    return bracketed[1];
  }
  return hostHeader.replace(/:\d+$/, '');
}

export async function startStreamableHttpServer(
  createSession: CreateMcpSession,
  host: string,
  port: number,
  _options: StreamableHttpServerOptions = {},
  tlsOptions?: StreamableHttpTlsOptions,
): Promise<HttpServer> {
  const requestListener = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // DNS rebinding: a web page can resolve its own domain to 127.0.0.1 and reach this port, but its
    // requests still carry that domain in Host. On a loopback bind, accept loopback host names only.
    if (isLoopbackHost(host) && !isLoopbackHost(hostnameOf(req.headers.host))) {
      writeJson(res, 403, {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Forbidden: the Host header must be a loopback address.' },
        id: null,
      });
      return;
    }

    if (req.url === '/health') {
      writeJson(res, 200, { status: 'ok', server: 'local-signer-mcp', version: PACKAGE_VERSION });
      return;
    }

    if (req.url !== '/mcp' && req.url !== '/') {
      writeJson(res, 404, {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Not found',
        },
        id: null,
      });
      return;
    }

    if (req.method === 'GET') {
      writeJson(res, 405, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed. Use POST for MCP requests.',
        },
        id: null,
      });
      return;
    }

    if (req.method === 'DELETE') {
      writeJson(res, 405, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed. Stateless mode - no sessions to delete.',
        },
        id: null,
      });
      return;
    }

    if (req.method !== 'POST') {
      writeJson(res, 405, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed.',
        },
        id: null,
      });
      return;
    }

    let parsedBody: unknown;
    try {
      parsedBody = await readRequestBody(req);
    } catch (error) {
      writeJson(res, 400, {
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: error instanceof Error ? error.message : 'Invalid JSON body',
        },
        id: null,
      });
      return;
    }

    const session = await createSession();
    let closed = false;

    const cleanup = async (): Promise<void> => {
      if (closed) {
        return;
      }

      closed = true;
      try {
        await session.close();
      } catch {
        // Cleanup only.
      }
    };

    res.on('close', () => {
      void cleanup();
    });

    await session.handleRequest(req, res, parsedBody);
  };

  const server = tlsOptions
    ? createHttpsServer(
        {
          cert: readFileSync(tlsOptions.certPath),
          key: readFileSync(tlsOptions.keyPath),
          passphrase: tlsOptions.passphrase ?? undefined,
        },
        requestListener,
      )
    : createHttpServer(requestListener);

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
  });

  return server;
}

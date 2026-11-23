#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerLocalSignerTools } from './tools.js';
import { config } from './config.js';
import { createLocalSignerSession, startStreamableHttpServer } from './http-server.js';

function createServer(): McpServer {
  const server = new McpServer({
    name: 'local-signer-mcp',
    version: '0.2.0'
  });

  registerLocalSignerTools(server);
  return server;
}

async function main(): Promise<void> {
  if (config.LOCAL_SIGNER_TRANSPORT === 'streamable-http') {
    if ((config.LOCAL_SIGNER_TLS_CERT_PATH && !config.LOCAL_SIGNER_TLS_KEY_PATH) || (!config.LOCAL_SIGNER_TLS_CERT_PATH && config.LOCAL_SIGNER_TLS_KEY_PATH)) {
      throw new Error('LOCAL_SIGNER_TLS_CERT_PATH and LOCAL_SIGNER_TLS_KEY_PATH must both be set for HTTPS mode.');
    }

    const tlsOptions =
      config.LOCAL_SIGNER_TLS_CERT_PATH && config.LOCAL_SIGNER_TLS_KEY_PATH
        ? {
            certPath: config.LOCAL_SIGNER_TLS_CERT_PATH,
            keyPath: config.LOCAL_SIGNER_TLS_KEY_PATH,
            passphrase: config.LOCAL_SIGNER_TLS_PASSPHRASE,
          }
        : undefined;

    await startStreamableHttpServer(async () => {
      return createLocalSignerSession(createServer());
    }, config.LOCAL_SIGNER_HOST, config.LOCAL_SIGNER_PORT, {}, tlsOptions);
    return;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});

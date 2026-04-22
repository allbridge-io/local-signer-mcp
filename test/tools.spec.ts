import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { registerLocalSignerTools } from '../src/tools.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  structuredContent: Record<string, unknown>;
  content: Array<{ type: 'text'; text: string }>;
}>;

class FakeMcpServer {
  readonly handlers = new Map<string, ToolHandler>();

  registerTool(_name: string, _definition: unknown, handler: unknown): void {
    this.handlers.set(_name, handler as ToolHandler);
  }

  getHandler(name: string): ToolHandler {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Tool ${name} is not registered.`);
    }
    return handler;
  }
}

describe('registerLocalSignerTools', () => {
  let server: FakeMcpServer;
  const dependencies = {
    broadcastSignedTransactionByFamily: jest.fn(),
    getAccounts: jest.fn(),
    getWalletCapabilities: jest.fn(),
    hasAnyConfiguredWallet: jest.fn(),
    signAndBroadcastByFamily: jest.fn(),
    signTransactionByFamily: jest.fn(),
  };

  beforeEach(() => {
    server = new FakeMcpServer();
    jest.resetAllMocks();

    registerLocalSignerTools(server as unknown as McpServer, dependencies);
  });

  test('get_wallet_capabilities returns empty state when no wallet is configured', async () => {
    dependencies.hasAnyConfiguredWallet.mockReturnValue(false);
    dependencies.getWalletCapabilities.mockReturnValue([]);

    const result = await server.getHandler('get_wallet_capabilities')({});

    expect(result.structuredContent).toEqual({
      available: false,
      wallets: [],
    });
  });

  test('get_accounts returns configured accounts', async () => {
    dependencies.getAccounts.mockReturnValue([
      {
        address: '0xsender',
        chainFamily: 'EVM',
        walletType: 'local_private_key',
      },
    ]);

    const result = await server.getHandler('get_accounts')({});

    expect(result.structuredContent).toEqual({
      accounts: [
        {
          address: '0xsender',
          chainFamily: 'EVM',
          walletType: 'local_private_key',
        },
      ],
    });
  });

  test('sign_transaction routes the request by chain family', async () => {
    dependencies.signTransactionByFamily.mockResolvedValue({
      chainFamily: 'EVM',
      walletAddress: '0xsender',
      signedTransaction: {
        chainFamily: 'EVM',
        signedTransaction: '0xsigned',
      },
    });

    const result = await server.getHandler('sign_transaction')({
      chainFamily: 'EVM',
      chainId: 11155111,
      to: '0xbridge',
    });

    expect(result.structuredContent).toEqual({
      chainFamily: 'EVM',
      walletAddress: '0xsender',
      signedTransaction: {
        chainFamily: 'EVM',
        signedTransaction: '0xsigned',
      },
    });
  });

  test('broadcast_transaction returns the broadcast result', async () => {
    dependencies.broadcastSignedTransactionByFamily.mockResolvedValue({
      chainFamily: 'SOLANA',
      txHash: '0xtx',
      receipt: null,
    });

    const result = await server.getHandler('broadcast_transaction')({
      chainFamily: 'SOLANA',
      signedTransactionHex: 'abcdef',
    });

    expect(result.structuredContent).toEqual({
      chainFamily: 'SOLANA',
      txHash: '0xtx',
      receipt: null,
    });
  });

  test('sign_and_broadcast_transaction returns both sign and broadcast results', async () => {
    dependencies.signAndBroadcastByFamily.mockResolvedValue({
      signResult: {
        chainFamily: 'TRX',
        walletAddress: 'Tsender',
        signedTransaction: {
          chainFamily: 'TRX',
          signedTransaction: { signature: ['sig'] },
        },
      },
      broadcastResult: {
        chainFamily: 'TRX',
        txHash: '0xtx',
        receipt: null,
      },
    });

    const result = await server.getHandler('sign_and_broadcast_transaction')({
      chainFamily: 'TRX',
      rawTransaction: {},
    });

    expect(result.structuredContent).toEqual({
      signResult: {
        chainFamily: 'TRX',
        walletAddress: 'Tsender',
        signedTransaction: {
          chainFamily: 'TRX',
          signedTransaction: { signature: ['sig'] },
        },
      },
      broadcastResult: {
        chainFamily: 'TRX',
        txHash: '0xtx',
        receipt: null,
      },
    });
  });
});

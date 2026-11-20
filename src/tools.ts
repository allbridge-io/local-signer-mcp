import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  broadcastSignedTransactionByFamily,
  getAccounts,
  getWalletCapabilities,
  hasAnyConfiguredWallet,
  signAndBroadcastByFamily,
  signTransactionByFamily,
} from './chain-execution.js';
import { formatJson } from './utils.js';

const evmUnsignedTransactionSchema = z.object({
  chainFamily: z.literal('EVM'),
  chainId: z.number().int().positive(),
  chainSymbol: z.string().trim().min(1).optional(),
  walletId: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1),
  data: z.string().optional(),
  value: z.string().optional(),
  from: z.string().optional(),
  nonce: z.number().int().nonnegative().optional(),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
  maxFeePerGas: z.string().optional(),
  maxPriorityFeePerGas: z.string().optional(),
  type: z.number().int().optional(),
});

const solanaUnsignedTransactionSchema = z.object({
  chainFamily: z.literal('SOLANA'),
  walletId: z.string().trim().min(1).optional(),
  serializedTransactionHex: z.string().trim().min(1),
});

const tronUnsignedTransactionSchema = z.object({
  chainFamily: z.literal('TRX'),
  walletId: z.string().trim().min(1).optional(),
  rawTransaction: z.record(z.unknown()),
});

const stxUnsignedTransactionSchema = z.object({
  chainFamily: z.literal('STX'),
  walletId: z.string().trim().min(1).optional(),
  serializedTransactionHex: z.string().trim().min(1),
});

const srbUnsignedTransactionSchema = z.object({
  chainFamily: z.literal('SRB'),
  walletId: z.string().trim().min(1).optional(),
  serializedTransactionXdr: z.string().trim().min(1),
});

const unsignedTransactionSchema = z.discriminatedUnion('chainFamily', [
  evmUnsignedTransactionSchema,
  solanaUnsignedTransactionSchema,
  tronUnsignedTransactionSchema,
  stxUnsignedTransactionSchema,
  srbUnsignedTransactionSchema,
]);

const mcpUnsignedTransactionSchema = z.object({
  chainFamily: z.enum(['EVM', 'SOLANA', 'TRX', 'STX', 'SRB']).describe('Target chain family for the unsigned transaction.'),
  walletId: z.string().trim().min(1).optional().describe('Optional wallet selector when multiple wallets are configured for the same family.'),
  chainId: z.number().int().positive().optional().describe('EVM chain ID, required for EVM transactions.'),
  chainSymbol: z.string().trim().min(1).optional().describe('Optional EVM chain symbol or alias.'),
  to: z.string().trim().min(1).optional().describe('Destination address or contract. Required for EVM transactions.'),
  data: z.string().optional().describe('Transaction calldata hex for EVM transactions.'),
  value: z.string().optional().describe('Transaction value, usually in wei hex for EVM transactions.'),
  from: z.string().optional().describe('Sender address for EVM transactions when the wallet must be selected by address.'),
  nonce: z.number().int().nonnegative().optional().describe('Optional nonce override for EVM transactions.'),
  gasLimit: z.string().optional().describe('Optional gas limit override for EVM transactions.'),
  gasPrice: z.string().optional().describe('Optional legacy gas price override for EVM transactions.'),
  maxFeePerGas: z.string().optional().describe('Optional EIP-1559 max fee per gas override.'),
  maxPriorityFeePerGas: z.string().optional().describe('Optional EIP-1559 max priority fee override.'),
  type: z.number().int().optional().describe('Optional transaction type override for EVM transactions.'),
  serializedTransactionHex: z.string().trim().min(1).optional().describe('Serialized Solana or Stacks transaction hex payload.'),
  rawTransaction: z.record(z.unknown()).optional().describe('Raw Tron transaction payload.'),
  serializedTransactionXdr: z.string().trim().min(1).optional().describe('Serialized Soroban / Stellar transaction XDR.'),
});

const mcpSignedTransactionSchema = z.object({
  chainFamily: z.enum(['EVM', 'SOLANA', 'TRX', 'STX', 'SRB']).describe('Target chain family for the signed transaction.'),
  walletId: z.string().trim().min(1).optional().describe('Optional wallet selector when multiple wallets are configured for the same family.'),
  chainId: z.number().int().positive().optional().describe('EVM chain ID, required for EVM signed transactions.'),
  chainSymbol: z.string().trim().min(1).optional().describe('Optional EVM chain symbol or alias.'),
  signedTransaction: z.string().trim().min(1).optional().describe('Signed EVM transaction hex or Tron signed transaction object.'),
  signedTransactionHex: z.string().trim().min(1).optional().describe('Signed Solana or Stacks transaction hex payload.'),
  signedTransactionXdr: z.string().trim().min(1).optional().describe('Signed Soroban / Stellar transaction XDR.'),
});

const evmSignedTransactionSchema = z.object({
  chainFamily: z.literal('EVM'),
  chainId: z.number().int().positive(),
  chainSymbol: z.string().trim().min(1).optional(),
  walletId: z.string().trim().min(1).optional(),
  signedTransaction: z.string().trim().min(1),
});

const solanaSignedTransactionSchema = z.object({
  chainFamily: z.literal('SOLANA'),
  walletId: z.string().trim().min(1).optional(),
  signedTransactionHex: z.string().trim().min(1),
});

const tronSignedTransactionSchema = z.object({
  chainFamily: z.literal('TRX'),
  walletId: z.string().trim().min(1).optional(),
  signedTransaction: z.record(z.unknown()),
});

const stxSignedTransactionSchema = z.object({
  chainFamily: z.literal('STX'),
  walletId: z.string().trim().min(1).optional(),
  signedTransactionHex: z.string().trim().min(1),
});

const srbSignedTransactionSchema = z.object({
  chainFamily: z.literal('SRB'),
  walletId: z.string().trim().min(1).optional(),
  signedTransactionXdr: z.string().trim().min(1),
});

const signedTransactionSchema = z.discriminatedUnion('chainFamily', [
  evmSignedTransactionSchema,
  solanaSignedTransactionSchema,
  tronSignedTransactionSchema,
  stxSignedTransactionSchema,
  srbSignedTransactionSchema,
]);

type LocalSignerDependencies = {
  hasAnyConfiguredWallet: typeof hasAnyConfiguredWallet;
  getWalletCapabilities: typeof getWalletCapabilities;
  getAccounts: typeof getAccounts;
  signTransactionByFamily: typeof signTransactionByFamily;
  broadcastSignedTransactionByFamily: typeof broadcastSignedTransactionByFamily;
  signAndBroadcastByFamily: typeof signAndBroadcastByFamily;
};

const defaultDependencies: LocalSignerDependencies = {
  hasAnyConfiguredWallet,
  getWalletCapabilities,
  getAccounts,
  signTransactionByFamily,
  broadcastSignedTransactionByFamily,
  signAndBroadcastByFamily,
};

export function registerLocalSignerTools(
  server: McpServer,
  dependencies: LocalSignerDependencies = defaultDependencies,
): void {
  function textResult(structuredContent: Record<string, unknown>) {
    return {
      content: [{ type: 'text' as const, text: formatJson(structuredContent) }],
      structuredContent,
    };
  }

  server.registerTool(
    'get_wallet_capabilities',
    {
      title: 'Get Wallet Capabilities',
      description: 'Return the locally configured wallet capabilities for this signer server.',
      inputSchema: {},
    },
    async () => {
      const wallets = dependencies.getWalletCapabilities();
      return textResult({
        available: dependencies.hasAnyConfiguredWallet(),
        wallets,
      });
    },
  );

  server.registerTool(
    'get_accounts',
    {
      title: 'Get Accounts',
      description: 'Return locally configured account addresses.',
      inputSchema: {},
    },
    async () => {
      return textResult({
        accounts: dependencies.getAccounts(),
      });
    },
  );

  server.registerTool(
    'sign_transaction',
    {
      title: 'Sign Transaction',
      description: 'Sign an unsigned transaction with the configured local wallet for the selected chain family. Use walletId or from when multiple wallets exist for the same EVM chain.',
      inputSchema: { ...mcpUnsignedTransactionSchema.shape },
    },
    async (parsed) => {
      const result = await dependencies.signTransactionByFamily(parsed as unknown as Parameters<typeof dependencies.signTransactionByFamily>[0]);
      return textResult(result);
    },
  );

  server.registerTool(
    'broadcast_transaction',
    {
      title: 'Broadcast Transaction',
      description: 'Broadcast a signed transaction with the configured local wallet infrastructure for the selected chain family. For EVM, walletId selects the matching broadcast RPC when configured.',
      inputSchema: { ...mcpSignedTransactionSchema.shape },
    },
    async (parsed) => {
      return textResult(
        await dependencies.broadcastSignedTransactionByFamily(parsed as unknown as Parameters<typeof dependencies.broadcastSignedTransactionByFamily>[0]),
      );
    },
  );

  server.registerTool(
    'sign_and_broadcast_transaction',
    {
      title: 'Sign And Broadcast Transaction',
      description: 'Sign an unsigned transaction with the configured local wallet and broadcast it. Use walletId or from when multiple EVM wallets are configured.',
      inputSchema: { ...mcpUnsignedTransactionSchema.shape },
    },
    async (parsed) => {
      return textResult(await dependencies.signAndBroadcastByFamily(parsed as unknown as Parameters<typeof dependencies.signAndBroadcastByFamily>[0]));
    },
  );
}

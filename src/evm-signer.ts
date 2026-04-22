import {
  JsonRpcProvider,
  TransactionResponse,
  Wallet,
  type PreparedTransactionRequest,
  type TransactionLike,
} from 'ethers';

import { config } from './config.js';
import type { SignedEvmTransaction, UnsignedEvmTransaction } from './types.js';

export class EvmSignerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvmSignerError';
  }
}

export type EvmWalletContext = {
  walletId: string;
  scope: string;
  chainId?: number;
  chainSymbol?: string;
  privateKey: string;
  rpcUrl: string;
  address: string;
};

type EvmWalletSelector = {
  walletId?: string;
  from?: string | null;
  chainId?: number;
  chainSymbol?: string;
};

type SlotWalletDefinition = {
  walletId: string;
  privateKey?: string | null;
  rpcUrl?: string | null;
  chainId?: number;
  chainSymbol?: string;
};

function normalizeString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizePrivateKey(value: string | undefined): string | null {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  return normalized.startsWith('0x') ? normalized : `0x${normalized}`;
}

function normalizeScope(value: string | number | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed.toUpperCase();
}

function normalizeAddress(value: string | undefined | null): string | null {
  const normalized = normalizeString(value ?? undefined);
  return normalized ? normalized.toLowerCase() : null;
}

function scopeToMetadata(scope: string): { chainId?: number; chainSymbol?: string } {
  if (scope === 'DEFAULT') {
    return {};
  }

  if (/^\d+$/.test(scope)) {
    return { chainId: Number(scope) };
  }

  return { chainSymbol: scope };
}

function collectLegacyScopes(): string[] {
  const scopes = new Set<string>();

  if (config.LOCAL_SIGNER_EVM_PRIVATE_KEY && config.LOCAL_SIGNER_EVM_RPC_URL) {
    scopes.add('DEFAULT');
  }

  for (const key of Object.keys(process.env)) {
    if (key.startsWith('LOCAL_SIGNER_EVM_PRIVATE_KEY_')) {
      scopes.add(key.slice('LOCAL_SIGNER_EVM_PRIVATE_KEY_'.length).toUpperCase());
    }

    if (key.startsWith('LOCAL_SIGNER_EVM_RPC_URL_')) {
      scopes.add(key.slice('LOCAL_SIGNER_EVM_RPC_URL_'.length).toUpperCase());
    }
  }

  return Array.from(scopes).sort((left, right) => {
    if (left === 'DEFAULT') {
      return -1;
    }
    if (right === 'DEFAULT') {
      return 1;
    }
    return left.localeCompare(right);
  });
}

function getScopedEnvValue(baseName: string, scope: string): string | null {
  if (scope === 'DEFAULT') {
    return normalizeString(process.env[baseName]) ?? null;
  }

  return normalizeString(process.env[`${baseName}_${scope}`]) ?? null;
}

function resolveLegacyContextByScope(scope: string): EvmWalletContext | null {
  try {
    const privateKey = scope === 'DEFAULT'
      ? config.LOCAL_SIGNER_EVM_PRIVATE_KEY
      : normalizePrivateKey(process.env[`LOCAL_SIGNER_EVM_PRIVATE_KEY_${scope}`]);
    const rpcUrl = scope === 'DEFAULT'
      ? config.LOCAL_SIGNER_EVM_RPC_URL
      : getScopedEnvValue('LOCAL_SIGNER_EVM_RPC_URL', scope);

    if (!privateKey || !rpcUrl) {
      return null;
    }

    const address = new Wallet(privateKey).address;
    if (!address) {
      return null;
    }

    return {
      walletId: scope,
      scope,
      privateKey,
      rpcUrl,
      address,
      ...scopeToMetadata(scope),
    };
  } catch {
    return null;
  }
}

function collectSlotDefinitions(): SlotWalletDefinition[] {
  const slots = new Map<string, SlotWalletDefinition>();
  const pattern = /^LOCAL_SIGNER_EVM_WALLET_(.+?)_(PRIVATE_KEY|RPC_URL|CHAIN_ID|CHAIN_SYMBOL)$/;

  for (const [key, rawValue] of Object.entries(process.env)) {
    const match = key.match(pattern);
    if (!match) {
      continue;
    }

    const rawWalletId = match[1];
    const field = match[2];
    if (!rawWalletId || !field) {
      continue;
    }
    const walletId = rawWalletId.toUpperCase();
    const current = slots.get(walletId) ?? { walletId };
    const normalizedValue = normalizeString(rawValue) ?? null;

    switch (field) {
      case 'PRIVATE_KEY':
        current.privateKey = normalizePrivateKey(rawValue);
        break;
      case 'RPC_URL':
        current.rpcUrl = normalizedValue;
        break;
      case 'CHAIN_ID':
        if (normalizedValue && /^\d+$/.test(normalizedValue)) {
          current.chainId = Number(normalizedValue);
        }
        break;
      case 'CHAIN_SYMBOL':
        current.chainSymbol = normalizedValue?.toUpperCase() ?? undefined;
        break;
      default:
        break;
    }

    slots.set(walletId, current);
  }

  return Array.from(slots.values());
}

function resolveSlotContext(slot: SlotWalletDefinition): EvmWalletContext | null {
  try {
    if (!slot.privateKey || !slot.rpcUrl) {
      return null;
    }

    const address = new Wallet(slot.privateKey).address;
    if (!address) {
      return null;
    }

    return {
      walletId: slot.walletId,
      scope: slot.walletId,
      privateKey: slot.privateKey,
      rpcUrl: slot.rpcUrl,
      address,
      ...(slot.chainId ? { chainId: slot.chainId } : {}),
      ...(slot.chainSymbol ? { chainSymbol: slot.chainSymbol } : {}),
    };
  } catch {
    return null;
  }
}

function collectContexts(): EvmWalletContext[] {
  const wallets: EvmWalletContext[] = [];

  for (const scope of collectLegacyScopes()) {
    const context = resolveLegacyContextByScope(scope);
    if (context) {
      wallets.push(context);
    }
  }

  for (const slot of collectSlotDefinitions()) {
    const context = resolveSlotContext(slot);
    if (context) {
      wallets.push(context);
    }
  }

  return wallets.sort((left, right) => left.walletId.localeCompare(right.walletId));
}

export function getConfiguredEvmWallets(): EvmWalletContext[] {
  return collectContexts();
}

function matchesChainSelector(context: EvmWalletContext, selector?: EvmWalletSelector): boolean {
  if (!selector) {
    return true;
  }

  if (selector.chainId !== undefined && context.chainId !== undefined && context.chainId !== selector.chainId) {
    return false;
  }

  if (selector.chainSymbol && context.chainSymbol && normalizeScope(context.chainSymbol) !== normalizeScope(selector.chainSymbol)) {
    return false;
  }

  return true;
}

function describeContext(context: EvmWalletContext): string {
  const parts = [
    `walletId=${context.walletId}`,
    `address=${context.address}`,
  ];

  if (context.chainSymbol) {
    parts.push(`chainSymbol=${context.chainSymbol}`);
  }

  if (context.chainId !== undefined) {
    parts.push(`chainId=${context.chainId}`);
  }

  return parts.join(', ');
}

function listContexts(contexts: EvmWalletContext[]): string {
  return contexts.map(describeContext).join('; ');
}

function selectContext(selector?: EvmWalletSelector): EvmWalletContext | null {
  const wallets = collectContexts();
  if (wallets.length === 0) {
    return null;
  }

  if (!selector) {
    return wallets.length === 1 ? wallets[0] ?? null : null;
  }

  if (selector.walletId) {
    const walletId = normalizeScope(selector.walletId);
    const matched = wallets.find((context) => normalizeScope(context.walletId) === walletId);
    if (!matched) {
      return null;
    }

    if (!matchesChainSelector(matched, selector)) {
      return null;
    }

    if (selector.from && normalizeAddress(matched.address) !== normalizeAddress(selector.from)) {
      return null;
    }

    return matched;
  }

  const chainMatches = wallets.filter((context) => matchesChainSelector(context, selector));

  if (selector.from) {
    const from = normalizeAddress(selector.from);
    const matchesByAddress = chainMatches.filter((context) => normalizeAddress(context.address) === from);
    if (matchesByAddress.length === 1) {
      return matchesByAddress[0] ?? null;
    }

    return null;
  }

  if (chainMatches.length === 1) {
    return chainMatches[0] ?? null;
  }

  if (chainMatches.length > 1) {
    return null;
  }

  const genericMatches = wallets.filter((context) => context.chainId === undefined && context.chainSymbol === undefined);
  if (genericMatches.length === 1) {
    return genericMatches[0] ?? null;
  }

  return null;
}

export function selectEvmWalletContext(selector?: EvmWalletSelector): EvmWalletContext | null {
  return selectContext(selector);
}

function resolveContext(selector?: EvmWalletSelector): EvmWalletContext {
  const wallets = collectContexts();
  const context = selectContext(selector);
  if (context) {
    return context;
  }

  if (wallets.length === 0) {
    throw new EvmSignerError('No EVM wallets are configured.');
  }

  if (selector?.walletId) {
    throw new EvmSignerError(`No configured EVM wallet matches walletId ${selector.walletId}. Available wallets: ${listContexts(wallets)}.`);
  }

  if (selector?.from) {
    throw new EvmSignerError(`No configured EVM wallet matches from address ${selector.from}. Available wallets: ${listContexts(wallets)}.`);
  }

  if (selector?.chainId !== undefined || selector?.chainSymbol) {
    const chainLabel = selector.chainSymbol ? `chainSymbol ${selector.chainSymbol}` : `chainId ${selector.chainId}`;
    throw new EvmSignerError(`Ambiguous EVM wallet selection for ${chainLabel}. Provide from or walletId. Available wallets: ${listContexts(wallets)}.`);
  }

  throw new EvmSignerError(`Ambiguous EVM wallet selection. Provide from or walletId. Available wallets: ${listContexts(wallets)}.`);
}

function getRpcUrl(selector?: EvmWalletSelector): string {
  const context = selector ? resolveContext(selector) : selectContext();
  if (context) {
    return context.rpcUrl;
  }

  if (config.LOCAL_SIGNER_EVM_RPC_URL) {
    return config.LOCAL_SIGNER_EVM_RPC_URL;
  }

  throw new EvmSignerError('LOCAL_SIGNER_EVM_RPC_URL is not configured.');
}

export function hasLocalEvmWallet(): boolean {
  return getConfiguredEvmWallets().length > 0;
}

export function getLocalEvmWalletAddress(selector?: EvmWalletSelector): string | null {
  const context = selector ? selectContext(selector) : (getConfiguredEvmWallets().length === 1 ? getConfiguredEvmWallets()[0] : null);
  return context ? context.address : null;
}

function getWallet(transaction: UnsignedEvmTransaction): Wallet {
  const context = resolveContext(transaction);
  return new Wallet(context.privateKey, new JsonRpcProvider(context.rpcUrl));
}

function getProvider(selector?: EvmWalletSelector): JsonRpcProvider {
  return new JsonRpcProvider(getRpcUrl(selector));
}

function parseBigIntHexOrDecimal(value: string | null | undefined): bigint | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  if (normalized === '') {
    return null;
  }

  return BigInt(normalized);
}

export async function buildPreparedTransaction(
  transaction: UnsignedEvmTransaction,
): Promise<PreparedTransactionRequest> {
  const wallet = getWallet(transaction);
  const provider = getProvider(transaction);
  const feeData = await provider.getFeeData();
  const nonce = transaction.nonce ?? await wallet.getNonce();
  const prepared: PreparedTransactionRequest = {
    chainId: BigInt(transaction.chainId),
    to: transaction.to,
    data: transaction.data ?? '0x',
    value: parseBigIntHexOrDecimal(transaction.value) ?? 0n,
    nonce,
    type: transaction.type ?? undefined,
  };

  const gasPrice = parseBigIntHexOrDecimal(transaction.gasPrice);
  const maxFeePerGas = parseBigIntHexOrDecimal(transaction.maxFeePerGas);
  const maxPriorityFeePerGas = parseBigIntHexOrDecimal(transaction.maxPriorityFeePerGas);
  const gasLimit = parseBigIntHexOrDecimal(transaction.gasLimit);

  if (gasPrice !== null) {
    prepared.gasPrice = gasPrice;
  } else if (maxFeePerGas !== null || maxPriorityFeePerGas !== null) {
    prepared.maxFeePerGas = maxFeePerGas ?? feeData.maxFeePerGas ?? undefined;
    prepared.maxPriorityFeePerGas = maxPriorityFeePerGas ?? feeData.maxPriorityFeePerGas ?? undefined;
    prepared.type = transaction.type ?? 2;
  } else if (feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null) {
    prepared.maxFeePerGas = feeData.maxFeePerGas;
    prepared.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    prepared.type = transaction.type ?? 2;
  } else if (feeData.gasPrice !== null) {
    prepared.gasPrice = feeData.gasPrice;
    prepared.type = transaction.type ?? 0;
  }

  if (gasLimit !== null) {
    prepared.gasLimit = gasLimit;
  } else {
    prepared.gasLimit = await wallet.estimateGas(prepared);
  }

  return prepared;
}

export async function signTransaction(
  transaction: UnsignedEvmTransaction,
): Promise<{
  from: string;
  walletId: string;
  nonce: number;
  chainId: number;
  chainSymbol?: string;
  signedTransaction: string;
  preparedTransaction: PreparedTransactionRequest;
}> {
  const wallet = getWallet(transaction);
  const prepared = await buildPreparedTransaction(transaction);
  const signedTransaction = await wallet.signTransaction(prepared as TransactionLike<string>);
  const nonce = transaction.nonce ?? prepared.nonce ?? 0;

  return {
    from: wallet.address,
    walletId: resolveContext(transaction).walletId,
    nonce,
    chainId: transaction.chainId,
    ...(transaction.chainSymbol ? { chainSymbol: transaction.chainSymbol } : {}),
    signedTransaction,
    preparedTransaction: prepared,
  };
}

export async function broadcastTransaction(
  signedTransaction: SignedEvmTransaction,
): Promise<{
  txHash: string;
  receipt: {
    blockNumber: number;
    status: number | null;
    gasUsed: string;
  } | null;
}> {
  const provider = getProvider({
    walletId: signedTransaction.walletId,
    chainId: signedTransaction.chainId,
    chainSymbol: signedTransaction.chainSymbol,
  });
  const response: TransactionResponse = await provider.broadcastTransaction(signedTransaction.signedTransaction);
  const receipt = await response.wait();

  return {
    txHash: response.hash,
    receipt: receipt
      ? {
          blockNumber: receipt.blockNumber,
          status: receipt.status,
          gasUsed: receipt.gasUsed.toString(),
        }
      : null,
  };
}

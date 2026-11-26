import { BytesReader, TransactionSigner, broadcastTransaction, createSingleSigSpendingCondition, deserializeTransaction, fetchNonce, privateKeyToPublic } from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET, type StacksNetwork } from '@stacks/network';
import { getAddressFromPublicKey } from '@stacks/transactions';
import { Connection, Keypair as SolanaKeypair, SystemProgram, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { Keypair as StellarKeypair, TransactionBuilder, rpc as SorobanRpc, type Transaction as StellarTransaction } from '@stellar/stellar-sdk';
import { TronWeb } from 'tronweb';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction as SuiTransaction } from '@mysten/sui/transactions';

import { config } from './config.js';
import type {
  AccountSummary,
  ChainFamily,
  SignedEvmTransaction,
  SignedTransaction,
  UnsignedTransaction,
  WalletCapability,
} from './types.js';
import {
  broadcastTransaction as broadcastEvmTransaction,
  getConfiguredEvmWallets,
  signTransaction as signEvmTransaction,
} from './evm-signer.js';
import {
  collectWalletSlotIds,
  selectWalletById,
} from './wallet-registry.js';

type BroadcastResult = {
  chainFamily: ChainFamily;
  txHash: string;
  receipt: Record<string, unknown> | null;
};

type SignResult = {
  chainFamily: ChainFamily;
  walletId: string;
  walletAddress: string;
  chainId?: number;
  chainSymbol?: string;
  signedTransaction: SignedTransaction;
};

type LocalWalletContext = {
  walletId: string;
  privateKey: string;
  rpcUrl: string;
  address: string;
};

type SorobanWalletContext = LocalWalletContext & {
  networkPassphrase: string;
};

type ResolvedStacksNetwork = {
  network: StacksNetwork;
  networkLabel: 'mainnet' | 'testnet';
};

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
}

function sortWalletContexts<T extends { walletId: string }>(wallets: T[]): T[] {
  return wallets.sort((left, right) => left.walletId.localeCompare(right.walletId));
}

function describeWalletContexts(wallets: Array<{ walletId: string; address?: string }>): string {
  return wallets.map((wallet) => `walletId=${wallet.walletId}${wallet.address ? `, address=${wallet.address}` : ''}`).join('; ');
}

function resolveConfiguredWallet<T extends { walletId: string }>(
  wallets: T[],
  familyLabel: string,
  walletId?: string | null,
): T {
  const selected = selectWalletById(wallets, walletId ?? null);
  if (selected) {
    return selected;
  }

  if (wallets.length === 0) {
    throw new Error(`No ${familyLabel} wallets are configured.`);
  }

  if (walletId) {
    throw new Error(`No configured ${familyLabel} wallet matches walletId ${walletId}. Available wallets: ${describeWalletContexts(wallets as unknown as Array<{ walletId: string; address?: string }>) }.`);
  }

  throw new Error(`Ambiguous ${familyLabel} wallet selection. Provide walletId. Available wallets: ${describeWalletContexts(wallets as unknown as Array<{ walletId: string; address?: string }>) }.`);
}

function readScopedEnvValue(baseName: string, walletId: string, suffix: string): string | null {
  const value = process.env[`${baseName}_${walletId}_${suffix}`];
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function createSolanaWalletContext(walletId: string, privateKey: string | null | undefined, rpcUrl: string | null | undefined): LocalWalletContext | null {
  if (!privateKey || !rpcUrl) {
    return null;
  }

  try {
    const keypair = SolanaKeypair.fromSecretKey(bs58.decode(privateKey));
    const address = keypair.publicKey.toBase58();
    if (!address) {
      return null;
    }

    return {
      walletId,
      privateKey,
      rpcUrl,
      address,
    };
  } catch {
    return null;
  }
}

function createTronWalletContext(walletId: string, privateKey: string | null | undefined, rpcUrl: string | null | undefined): LocalWalletContext | null {
  if (!privateKey || !rpcUrl) {
    return null;
  }

  try {
    const tronWeb = new TronWeb(rpcUrl, rpcUrl, rpcUrl, privateKey);
    const address = tronWeb.address.fromPrivateKey(privateKey);
    if (!address) {
      return null;
    }

    return {
      walletId,
      privateKey,
      rpcUrl,
      address,
    };
  } catch {
    return null;
  }
}

function createStacksWalletContext(walletId: string, privateKey: string | null | undefined, rpcUrl: string | null | undefined): LocalWalletContext | null {
  if (!privateKey || !rpcUrl) {
    return null;
  }

  try {
    const isTestnet = rpcUrl.includes('testnet');
    const network: StacksNetwork = isTestnet
      ? { ...STACKS_TESTNET, client: { baseUrl: rpcUrl } }
      : { ...STACKS_MAINNET, client: { baseUrl: rpcUrl } };
    const publicKey = privateKeyToPublic(privateKey);
    const address = getAddressFromPublicKey(publicKey, network);
    if (!address) {
      return null;
    }

    return {
      walletId,
      privateKey,
      rpcUrl,
      address,
    };
  } catch {
    return null;
  }
}

function createSorobanWalletContext(
  walletId: string,
  privateKey: string | null | undefined,
  rpcUrl: string | null | undefined,
  networkPassphrase: string | null | undefined,
): SorobanWalletContext | null {
  if (!privateKey || !rpcUrl || !networkPassphrase) {
    return null;
  }

  try {
    const address = StellarKeypair.fromSecret(privateKey).publicKey();
    if (!address) {
      return null;
    }

    return {
      walletId,
      privateKey,
      rpcUrl,
      networkPassphrase,
      address,
    };
  } catch {
    return null;
  }
}

/** A Sui key is either a `suiprivkey1…` string or a 32-byte Ed25519 secret key in hex. */
function suiKeypairFromPrivateKey(privateKey: string): Ed25519Keypair {
  const value = privateKey.trim();
  if (value.startsWith('suiprivkey')) {
    return Ed25519Keypair.fromSecretKey(value);
  }
  const bytes = Buffer.from(normalizeHex(value), 'hex');
  if (bytes.length !== 32) {
    throw new Error('Expected a suiprivkey string or a 32-byte hex Ed25519 secret key.');
  }
  return Ed25519Keypair.fromSecretKey(bytes);
}

function createSuiWalletContext(walletId: string, privateKey: string | null | undefined, rpcUrl: string | null | undefined): LocalWalletContext | null {
  if (!privateKey || !rpcUrl) {
    return null;
  }

  try {
    return {
      walletId,
      privateKey,
      rpcUrl,
      address: suiKeypairFromPrivateKey(privateKey).toSuiAddress(),
    };
  } catch {
    return null;
  }
}

function collectWalletContexts<T extends { walletId: string }>(
  defaultWalletId: string,
  defaultPrivateKey: string | null,
  defaultRpcUrl: string | null,
  slotPrefix: string,
  buildContext: (walletId: string, privateKey: string, rpcUrl: string) => T | null,
): T[] {
  const wallets: T[] = [];
  const defaultContext = buildContext(defaultWalletId, defaultPrivateKey ?? '', defaultRpcUrl ?? '');
  if (defaultPrivateKey && defaultRpcUrl && defaultContext) {
    wallets.push(defaultContext);
  }

  for (const walletId of collectWalletSlotIds(slotPrefix)) {
    const privateKey = readScopedEnvValue(slotPrefix.slice(0, -1), walletId, 'PRIVATE_KEY');
    const rpcUrl = readScopedEnvValue(slotPrefix.slice(0, -1), walletId, 'RPC_URL');
    if (!privateKey || !rpcUrl) {
      continue;
    }

    const context = buildContext(walletId, privateKey, rpcUrl);
    if (context) {
      wallets.push(context);
    }
  }

  return sortWalletContexts(wallets);
}

function collectSolanaWallets(): LocalWalletContext[] {
  return collectWalletContexts(
    'SOLANA_DEFAULT',
    config.LOCAL_SIGNER_SOL_PRIVATE_KEY,
    config.LOCAL_SIGNER_SOL_RPC_URL,
    'LOCAL_SIGNER_SOL_WALLET_',
    createSolanaWalletContext,
  );
}

function collectTronWallets(): LocalWalletContext[] {
  return collectWalletContexts(
    'TRX_DEFAULT',
    config.LOCAL_SIGNER_TRX_PRIVATE_KEY,
    config.LOCAL_SIGNER_TRX_RPC_URL,
    'LOCAL_SIGNER_TRX_WALLET_',
    createTronWalletContext,
  );
}

function collectStacksWallets(): LocalWalletContext[] {
  return collectWalletContexts(
    'STX_DEFAULT',
    config.LOCAL_SIGNER_STX_PRIVATE_KEY,
    config.LOCAL_SIGNER_STX_RPC_URL,
    'LOCAL_SIGNER_STX_WALLET_',
    createStacksWalletContext,
  );
}

function collectSorobanWallets(): SorobanWalletContext[] {
  const wallets: SorobanWalletContext[] = [];
  const defaultContext = createSorobanWalletContext(
    'SRB_DEFAULT',
    config.LOCAL_SIGNER_SRB_PRIVATE_KEY,
    config.LOCAL_SIGNER_SRB_RPC_URL,
    config.LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE,
  );
  if (defaultContext) {
    wallets.push(defaultContext);
  }

  for (const walletId of collectWalletSlotIds('LOCAL_SIGNER_SRB_WALLET_')) {
    const privateKey = readScopedEnvValue('LOCAL_SIGNER_SRB_WALLET', walletId, 'PRIVATE_KEY');
    const rpcUrl = readScopedEnvValue('LOCAL_SIGNER_SRB_WALLET', walletId, 'RPC_URL');
    const passphrase = readScopedEnvValue('LOCAL_SIGNER_SRB_WALLET', walletId, 'NETWORK_PASSPHRASE')
      ?? config.LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE;
    const context = createSorobanWalletContext(walletId, privateKey, rpcUrl, passphrase);
    if (context) {
      wallets.push(context);
    }
  }

  return sortWalletContexts(wallets);
}

function collectSuiWallets(): LocalWalletContext[] {
  return collectWalletContexts(
    'SUI_DEFAULT',
    config.LOCAL_SIGNER_SUI_PRIVATE_KEY,
    config.LOCAL_SIGNER_SUI_RPC_URL,
    'LOCAL_SIGNER_SUI_WALLET_',
    createSuiWalletContext,
  );
}

function getEvmWallets(): ReturnType<typeof getConfiguredEvmWallets> {
  return getConfiguredEvmWallets();
}

function getSolanaWalletContext(walletId?: string | null): LocalWalletContext {
  return resolveConfiguredWallet(collectSolanaWallets(), 'Solana', walletId);
}

function getTronWalletContext(walletId?: string | null): LocalWalletContext {
  return resolveConfiguredWallet(collectTronWallets(), 'Tron', walletId);
}

function getStacksWalletContext(walletId?: string | null): LocalWalletContext {
  return resolveConfiguredWallet(collectStacksWallets(), 'Stacks', walletId);
}

function getSorobanWalletContext(walletId?: string | null): SorobanWalletContext {
  return resolveConfiguredWallet(collectSorobanWallets(), 'Soroban', walletId);
}

function getSuiWalletContext(walletId?: string | null): LocalWalletContext {
  return resolveConfiguredWallet(collectSuiWallets(), 'Sui', walletId);
}

/** Sui full nodes serve gRPC-web only (JSON-RPC was shut down): the RPC URL is the node base URL. */
function getSuiClientForContext(context: LocalWalletContext): SuiGrpcClient {
  return new SuiGrpcClient({
    network: context.rpcUrl.includes('testnet') ? 'testnet' : 'mainnet',
    baseUrl: context.rpcUrl.replace(/\/+$/, ''),
  });
}

function getWalletCapabilityEntries(): WalletCapability[] {
  const wallets: WalletCapability[] = [];

  for (const wallet of getEvmWallets()) {
    wallets.push({
      walletType: 'local_private_key',
      chainFamily: 'EVM',
      walletId: wallet.walletId,
      supportsSign: true,
      supportsBroadcast: true,
      supportsSignAndBroadcast: true,
      defaultAddress: wallet.address,
      ...(wallet.chainSymbol ? { chainSymbol: wallet.chainSymbol } : {}),
      ...(wallet.chainId ? { chainId: wallet.chainId } : {}),
    });
  }

  for (const wallet of collectSolanaWallets()) {
    wallets.push({
      walletType: 'local_private_key',
      chainFamily: 'SOLANA',
      walletId: wallet.walletId,
      supportsSign: true,
      supportsBroadcast: true,
      supportsSignAndBroadcast: true,
      defaultAddress: wallet.address,
    });
  }

  for (const wallet of collectTronWallets()) {
    wallets.push({
      walletType: 'local_private_key',
      chainFamily: 'TRX',
      walletId: wallet.walletId,
      supportsSign: true,
      supportsBroadcast: true,
      supportsSignAndBroadcast: true,
      defaultAddress: wallet.address,
    });
  }

  for (const wallet of collectStacksWallets()) {
    wallets.push({
      walletType: 'local_private_key',
      chainFamily: 'STX',
      walletId: wallet.walletId,
      supportsSign: true,
      supportsBroadcast: true,
      supportsSignAndBroadcast: true,
      defaultAddress: wallet.address,
    });
  }

  for (const wallet of collectSorobanWallets()) {
    wallets.push({
      walletType: 'local_private_key',
      chainFamily: 'SRB',
      walletId: wallet.walletId,
      supportsSign: true,
      supportsBroadcast: true,
      supportsSignAndBroadcast: true,
      defaultAddress: wallet.address,
    });
  }

  for (const wallet of collectSuiWallets()) {
    wallets.push({
      walletType: 'local_private_key',
      chainFamily: 'SUI',
      walletId: wallet.walletId,
      supportsSign: true,
      supportsBroadcast: true,
      supportsSignAndBroadcast: true,
      defaultAddress: wallet.address,
    });
  }

  return wallets;
}

export function hasAnyConfiguredWallet(): boolean {
  return getWalletCapabilityEntries().length > 0;
}

export function getWalletCapabilities(): WalletCapability[] {
  return getWalletCapabilityEntries();
}

export function getAccounts(): AccountSummary[] {
  return getWalletCapabilityEntries().map((wallet) => ({
    address: wallet.defaultAddress,
    chainFamily: wallet.chainFamily,
    walletId: wallet.walletId,
    walletType: wallet.walletType,
    ...(wallet.chainSymbol ? { chainSymbol: wallet.chainSymbol } : {}),
    ...(wallet.chainId ? { chainId: wallet.chainId } : {}),
  }));
}

function normalizeStacksNetworkId(networkId: unknown): number | null {
  if (typeof networkId === 'number' && Number.isInteger(networkId) && networkId > 0) {
    return networkId;
  }

  if (typeof networkId !== 'string') {
    return null;
  }

  const trimmed = networkId.trim();
  if (trimmed === '') {
    return null;
  }

  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 16);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  if (trimmed.toLowerCase() === 'mainnet') {
    return STACKS_MAINNET.chainId;
  }

  if (trimmed.toLowerCase() === 'testnet') {
    return STACKS_TESTNET.chainId;
  }

  return null;
}

function describeStacksExpectedPrefix(networkLabel: ResolvedStacksNetwork['networkLabel']): string {
  return networkLabel === 'mainnet' ? 'SP/SM' : 'ST/SN';
}

function validateStacksAddressForNetwork(
  address: string,
  context: LocalWalletContext,
  resolvedNetwork: ResolvedStacksNetwork,
): void {
  const normalizedAddress = address.trim().toUpperCase();
  const expectedPrefixes = resolvedNetwork.networkLabel === 'mainnet'
    ? ['SP', 'SM']
    : ['ST', 'SN'];
  const addressPrefix = normalizedAddress.slice(0, 2);

  if (!expectedPrefixes.includes(addressPrefix)) {
    throw new Error(
      `Stacks wallet/network mismatch for walletId ${context.walletId}: address ${address} does not match ${resolvedNetwork.networkLabel} network at ${context.rpcUrl}. Expected prefix ${describeStacksExpectedPrefix(resolvedNetwork.networkLabel)}.`,
    );
  }
}

async function resolveStacksNetworkForRpcUrl(rpcUrl: string): Promise<ResolvedStacksNetwork> {
  const infoUrl = new URL('/v2/info', rpcUrl.endsWith('/') ? rpcUrl : `${rpcUrl}/`).toString();
  const response = await fetch(infoUrl, {
    signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(5000)
      : undefined,
  });

  if (!response.ok) {
    throw new Error(`Unable to validate Stacks RPC network from ${infoUrl}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const rawNetworkId = payload.network_id ?? payload.networkId ?? payload.chain_id ?? payload.chainId;
  const networkId = normalizeStacksNetworkId(rawNetworkId);

  if (networkId === STACKS_MAINNET.chainId) {
    return {
      networkLabel: 'mainnet',
      network: { ...STACKS_MAINNET, client: { baseUrl: rpcUrl } },
    };
  }

  if (networkId === STACKS_TESTNET.chainId) {
    return {
      networkLabel: 'testnet',
      network: { ...STACKS_TESTNET, client: { baseUrl: rpcUrl } },
    };
  }

  throw new Error(
    `Unsupported Stacks network reported by ${infoUrl}: ${String(rawNetworkId)}. Only mainnet and testnet are supported.`,
  );
}

function getTronWebForContext(context: LocalWalletContext): TronWeb {
  return new TronWeb(context.rpcUrl, context.rpcUrl, context.rpcUrl, context.privateKey);
}

function getSorobanClientForContext(context: SorobanWalletContext) {
  return new SorobanRpc.Server(context.rpcUrl);
}

const SOLANA_ADVANCE_NONCE_INSTRUCTION = 4;

function isUnsignedSolanaTransaction(transaction: VersionedTransaction): boolean {
  return transaction.signatures.every((signature) => signature.every((byte) => byte === 0));
}

function usesDurableNonce(transaction: VersionedTransaction): boolean {
  const [first] = transaction.message.compiledInstructions;
  if (!first) {
    return false;
  }
  const programId = transaction.message.staticAccountKeys[first.programIdIndex];
  return Boolean(programId?.equals(SystemProgram.programId))
    && Buffer.from(first.data).readUInt32LE(0) === SOLANA_ADVANCE_NONCE_INSTRUCTION;
}

/**
 * A Solana blockhash expires about a minute after the transaction is built. When nobody has signed
 * the transaction yet and it does not use a durable nonce, replace the blockhash with a fresh one so
 * a transaction built earlier (for example in an execution job) still lands.
 */
async function refreshSolanaBlockhash(transaction: VersionedTransaction, rpcUrl: string): Promise<void> {
  if (!isUnsignedSolanaTransaction(transaction) || usesDurableNonce(transaction)) {
    return;
  }
  const { blockhash } = await new Connection(rpcUrl, 'confirmed').getLatestBlockhash();
  transaction.message.recentBlockhash = blockhash;
}

const TRON_MIN_REMAINING_MS = 120_000;

/**
 * Tron transactions expire 60 seconds after they are built. Extend an unsigned transaction that has
 * less than two minutes left, so a transaction built earlier can still be signed and broadcast.
 */
async function extendTronExpiration(tronWeb: TronWeb, rawTransaction: Record<string, unknown>): Promise<Record<string, unknown>> {
  const signature = rawTransaction.signature;
  const rawData = rawTransaction.raw_data as { expiration?: number } | undefined;
  if ((Array.isArray(signature) && signature.length > 0) || typeof rawData?.expiration !== 'number') {
    return rawTransaction;
  }

  const shortfallMs = Date.now() + TRON_MIN_REMAINING_MS - rawData.expiration;
  if (shortfallMs <= 0) {
    return rawTransaction;
  }

  return await tronWeb.transactionBuilder.extendExpiration(rawTransaction as never, Math.ceil(shortfallMs / 1000)) as unknown as Record<string, unknown>;
}

function buildEvmResult(result: Awaited<ReturnType<typeof signEvmTransaction>>): SignResult {
  return {
    chainFamily: 'EVM',
    walletId: result.walletId,
    walletAddress: result.from,
    ...(result.chainId ? { chainId: result.chainId } : {}),
    ...(result.chainSymbol ? { chainSymbol: result.chainSymbol } : {}),
    signedTransaction: {
      chainFamily: 'EVM',
      chainId: result.chainId,
      walletId: result.walletId,
      ...(result.chainSymbol ? { chainSymbol: result.chainSymbol } : {}),
      signedTransaction: result.signedTransaction,
    },
  };
}

export async function signTransactionByFamily(input: UnsignedTransaction): Promise<SignResult> {
  switch (input.chainFamily) {
    case 'EVM':
      return buildEvmResult(await signEvmTransaction(input));
    case 'SOLANA': {
      const context = getSolanaWalletContext(input.walletId);
      const keypair = SolanaKeypair.fromSecretKey(bs58.decode(context.privateKey));
      const transaction = VersionedTransaction.deserialize(Buffer.from(normalizeHex(input.serializedTransactionHex), 'hex'));
      await refreshSolanaBlockhash(transaction, context.rpcUrl);
      transaction.sign([keypair]);

      return {
        chainFamily: 'SOLANA',
        walletId: context.walletId,
        walletAddress: keypair.publicKey.toBase58(),
        signedTransaction: {
          chainFamily: 'SOLANA',
          walletId: context.walletId,
          signedTransactionHex: Buffer.from(transaction.serialize()).toString('hex'),
        },
      };
    }
    case 'TRX': {
      const context = getTronWalletContext(input.walletId);
      const tronWeb = getTronWebForContext(context);
      const rawTransaction = await extendTronExpiration(tronWeb, input.rawTransaction);
      const signedTransaction = await tronWeb.trx.sign(rawTransaction as never);
      const signedTransactionResult = signedTransaction as string | { signature?: unknown };
      if (typeof signedTransactionResult === 'string' || !signedTransactionResult.signature) {
        throw new Error('Transaction was not signed properly.');
      }

      return {
        chainFamily: 'TRX',
        walletId: context.walletId,
        walletAddress: context.address,
        signedTransaction: {
          chainFamily: 'TRX',
          walletId: context.walletId,
          signedTransaction: signedTransaction as Record<string, unknown>,
        },
      };
    }
    case 'STX': {
      const context = getStacksWalletContext(input.walletId);
      const resolvedNetwork = await resolveStacksNetworkForRpcUrl(context.rpcUrl);
      const tx = deserializeTransaction(new BytesReader(Buffer.from(normalizeHex(input.serializedTransactionHex), 'hex')));
      const transactionSigner = new TransactionSigner(tx);
      const realPublicKey = privateKeyToPublic(context.privateKey);
      const address = getAddressFromPublicKey(realPublicKey, resolvedNetwork.network);

      validateStacksAddressForNetwork(address, context, resolvedNetwork);

      if (context.address !== address) {
        throw new Error(
          `Stacks wallet/network mismatch for walletId ${context.walletId}: registry address ${context.address} does not match the address derived from the resolved RPC network ${address}.`,
        );
      }

      const realNonce = await fetchNonce({ address, network: resolvedNetwork.network });
      const origin = tx.auth.spendingCondition;
      tx.auth.spendingCondition = createSingleSigSpendingCondition(
        origin.hashMode as never,
        realPublicKey,
        realNonce,
        origin.fee,
      );

      transactionSigner.signOrigin(context.privateKey);

      return {
        chainFamily: 'STX',
        walletId: context.walletId,
        walletAddress: address,
        signedTransaction: {
          chainFamily: 'STX',
          walletId: context.walletId,
          signedTransactionHex: tx.serialize(),
        },
      };
    }
    case 'SRB': {
      const context = getSorobanWalletContext(input.walletId);
      const keypair = StellarKeypair.fromSecret(context.privateKey);
      const transaction = TransactionBuilder.fromXDR(input.serializedTransactionXdr, context.networkPassphrase) as StellarTransaction;
      transaction.sign(keypair);

      return {
        chainFamily: 'SRB',
        walletId: context.walletId,
        walletAddress: keypair.publicKey(),
        signedTransaction: {
          chainFamily: 'SRB',
          walletId: context.walletId,
          signedTransactionXdr: transaction.toXDR(),
        },
      };
    }
    case 'SUI': {
      const context = getSuiWalletContext(input.walletId);
      const keypair = suiKeypairFromPrivateKey(context.privateKey);
      const transaction = SuiTransaction.from(input.serializedTransaction);
      // The transaction comes unbuilt: building it with the client resolves gas and coins against the chain.
      const signed = await transaction.sign({ signer: keypair, client: getSuiClientForContext(context) });

      return {
        chainFamily: 'SUI',
        walletId: context.walletId,
        walletAddress: keypair.toSuiAddress(),
        signedTransaction: {
          chainFamily: 'SUI',
          walletId: context.walletId,
          signedTransaction: {
            bytesBase64: signed.bytes,
            signature: signed.signature,
          },
        },
      };
    }
    default:
      throw new Error(`Unsupported chain family ${(input as { chainFamily: string }).chainFamily}.`);
  }
}

async function broadcastEvmSignedTransaction(signedTransaction: SignedTransaction & { chainFamily: 'EVM' }): Promise<BroadcastResult> {
  const broadcast = await broadcastEvmTransaction(signedTransaction);
  return {
    chainFamily: 'EVM',
    txHash: broadcast.txHash,
    receipt: broadcast.receipt,
  };
}

async function broadcastSolanaSignedTransaction(signedTransactionHex: string, walletId?: string | null): Promise<BroadcastResult> {
  const context = getSolanaWalletContext(walletId);
  const connection = new Connection(context.rpcUrl, 'confirmed');
  const transaction = VersionedTransaction.deserialize(Buffer.from(normalizeHex(signedTransactionHex), 'hex'));
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(signature, 'confirmed');

  return {
    chainFamily: 'SOLANA',
    txHash: signature,
    receipt: null,
  };
}

async function broadcastTronSignedTransaction(
  signedTransaction: Record<string, unknown>,
  walletId?: string | null,
): Promise<BroadcastResult> {
  const context = getTronWalletContext(walletId);
  const tronWeb = getTronWebForContext(context);
  const response = await tronWeb.trx.sendRawTransaction(signedTransaction as never);
  const result = response as { txid?: string; txID?: string; result?: boolean; code?: string; message?: string };
  if (result.result === false) {
    const message = result.message ? Buffer.from(result.message, 'hex').toString('utf8') : '';
    throw new Error(`Tron node rejected the transaction: ${result.code ?? 'UNKNOWN'} ${message}`.trim());
  }
  const txHash = result.txid ?? result.txID ?? '';

  return {
    chainFamily: 'TRX',
    txHash,
    receipt: { response },
  };
}

async function broadcastStacksSignedTransaction(signedTransactionHex: string, walletId?: string | null): Promise<BroadcastResult> {
  const context = getStacksWalletContext(walletId);
  const resolvedNetwork = await resolveStacksNetworkForRpcUrl(context.rpcUrl);
  validateStacksAddressForNetwork(context.address, context, resolvedNetwork);
  const tx = deserializeTransaction(new BytesReader(Buffer.from(normalizeHex(signedTransactionHex), 'hex')));
  const response = await broadcastTransaction({ transaction: tx, network: resolvedNetwork.network });
  // The node answers a rejection with { error, reason } instead of an HTTP error.
  if ('error' in response) {
    const reason = 'reason' in response ? ` (${String(response.reason)})` : '';
    throw new Error(`Stacks node rejected the transaction: ${String(response.error)}${reason}`);
  }

  return {
    chainFamily: 'STX',
    txHash: response.txid,
    receipt: response as unknown as Record<string, unknown>,
  };
}

async function broadcastSorobanSignedTransaction(signedTransactionXdr: string, walletId?: string | null): Promise<BroadcastResult> {
  const context = getSorobanWalletContext(walletId);
  const server = getSorobanClientForContext(context);
  const transaction = TransactionBuilder.fromXDR(signedTransactionXdr, context.networkPassphrase) as StellarTransaction;
  const sent = await server.sendTransaction(transaction);
  if (sent.status === 'ERROR' || sent.status === 'TRY_AGAIN_LATER') {
    throw new Error(`Stellar rejected the transaction (${sent.status}): ${JSON.stringify(sent.errorResult ?? sent)}`);
  }

  return {
    chainFamily: 'SRB',
    txHash: sent.hash,
    receipt: sent as unknown as Record<string, unknown>,
  };
}

async function broadcastSuiSignedTransaction(
  signedTransaction: { bytesBase64: string; signature: string },
  walletId?: string | null,
): Promise<BroadcastResult> {
  const client = getSuiClientForContext(getSuiWalletContext(walletId));
  const result = await client.executeTransaction({
    transaction: Buffer.from(signedTransaction.bytesBase64, 'base64'),
    signatures: [signedTransaction.signature],
  });
  const transaction = result.Transaction ?? result.FailedTransaction;
  if (result.$kind === 'FailedTransaction') {
    throw new Error(`Sui transaction ${transaction.digest} failed: ${JSON.stringify(transaction.status.error)}`);
  }

  return {
    chainFamily: 'SUI',
    txHash: transaction.digest,
    receipt: { status: transaction.status, epoch: transaction.epoch },
  };
}

export async function broadcastSignedTransactionByFamily(signedTransaction: SignedTransaction): Promise<BroadcastResult> {
  switch (signedTransaction.chainFamily) {
    case 'EVM':
      return broadcastEvmSignedTransaction(signedTransaction as SignedEvmTransaction);
    case 'SOLANA':
      return broadcastSolanaSignedTransaction(signedTransaction.signedTransactionHex, signedTransaction.walletId);
    case 'TRX':
      return broadcastTronSignedTransaction(signedTransaction.signedTransaction, signedTransaction.walletId);
    case 'STX':
      return broadcastStacksSignedTransaction(signedTransaction.signedTransactionHex, signedTransaction.walletId);
    case 'SRB':
      return broadcastSorobanSignedTransaction(signedTransaction.signedTransactionXdr, signedTransaction.walletId);
    case 'SUI':
      return broadcastSuiSignedTransaction(signedTransaction.signedTransaction, signedTransaction.walletId);
    default:
      throw new Error(`Unsupported chain family ${(signedTransaction as { chainFamily: string }).chainFamily}.`);
  }
}

export async function signAndBroadcastByFamily(input: UnsignedTransaction): Promise<{
  signResult: SignResult;
  broadcastResult: BroadcastResult;
}> {
  const signResult = await signTransactionByFamily(input);
  const broadcastResult = await broadcastSignedTransactionByFamily(signResult.signedTransaction);

  return {
    signResult,
    broadcastResult,
  };
}

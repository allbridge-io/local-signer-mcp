export type ChainFamily = 'EVM' | 'SOLANA' | 'TRX' | 'STX' | 'SRB';

export interface UnsignedEvmTransaction {
  chainFamily: 'EVM';
  chainId: number;
  chainSymbol?: string;
  walletId?: string;
  to: string;
  data?: string | null;
  value?: string | null;
  from?: string | null;
  nonce?: number | null;
  gasLimit?: string | null;
  gasPrice?: string | null;
  maxFeePerGas?: string | null;
  maxPriorityFeePerGas?: string | null;
  type?: number | null;
}

export interface UnsignedSolanaTransaction {
  chainFamily: 'SOLANA';
  walletId?: string;
  serializedTransactionHex: string;
}

export interface UnsignedTronTransaction {
  chainFamily: 'TRX';
  walletId?: string;
  rawTransaction: Record<string, unknown>;
}

export interface UnsignedStacksTransaction {
  chainFamily: 'STX';
  walletId?: string;
  serializedTransactionHex: string;
}

export interface UnsignedSorobanTransaction {
  chainFamily: 'SRB';
  walletId?: string;
  serializedTransactionXdr: string;
}

export type UnsignedTransaction =
  | UnsignedEvmTransaction
  | UnsignedSolanaTransaction
  | UnsignedTronTransaction
  | UnsignedStacksTransaction
  | UnsignedSorobanTransaction;

export interface SignedEvmTransaction {
  chainFamily: 'EVM';
  chainId: number;
  chainSymbol?: string;
  walletId?: string;
  signedTransaction: string;
}

export interface SignedSolanaTransaction {
  chainFamily: 'SOLANA';
  walletId?: string;
  signedTransactionHex: string;
}

export interface SignedTronTransaction {
  chainFamily: 'TRX';
  walletId?: string;
  signedTransaction: Record<string, unknown>;
}

export interface SignedStacksTransaction {
  chainFamily: 'STX';
  walletId?: string;
  signedTransactionHex: string;
}

export interface SignedSorobanTransaction {
  chainFamily: 'SRB';
  walletId?: string;
  signedTransactionXdr: string;
}

export type SignedTransaction =
  | SignedEvmTransaction
  | SignedSolanaTransaction
  | SignedTronTransaction
  | SignedStacksTransaction
  | SignedSorobanTransaction;

export interface WalletCapability {
  walletType: 'local_private_key';
  chainFamily: ChainFamily;
  walletId: string;
  chainSymbol?: string;
  chainId?: number;
  supportsSign: true;
  supportsBroadcast: true;
  supportsSignAndBroadcast: true;
  defaultAddress: string;
}

export interface AccountSummary {
  address: string;
  chainFamily: ChainFamily;
  walletId: string;
  chainSymbol?: string;
  chainId?: number;
  walletType: 'local_private_key';
}

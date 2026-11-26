export type ChainFamily = 'EVM' | 'SOLANA' | 'TRX' | 'STX' | 'SRB' | 'SUI';

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

/** A Sui `Transaction` serialized with `toJSON()` (built at signing time) or base64 transaction bytes. */
export interface UnsignedSuiTransaction {
  chainFamily: 'SUI';
  walletId?: string;
  serializedTransaction: string;
}

export type UnsignedTransaction =
  | UnsignedEvmTransaction
  | UnsignedSolanaTransaction
  | UnsignedTronTransaction
  | UnsignedStacksTransaction
  | UnsignedSorobanTransaction
  | UnsignedSuiTransaction;

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

export interface SignedSuiTransaction {
  chainFamily: 'SUI';
  walletId?: string;
  signedTransaction: {
    bytesBase64: string;
    signature: string;
  };
}

export type SignedTransaction =
  | SignedEvmTransaction
  | SignedSolanaTransaction
  | SignedTronTransaction
  | SignedStacksTransaction
  | SignedSorobanTransaction
  | SignedSuiTransaction;

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

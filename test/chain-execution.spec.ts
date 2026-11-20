import { beforeAll, afterAll, describe, expect, jest, test } from '@jest/globals';

jest.mock('bs58', () => ({
  default: {
    decode: (value: string) => Buffer.from(value),
  },
}));

const deserializedSolanaTransactions: Array<{ message: { recentBlockhash: string } }> = [];

jest.mock('@solana/web3.js', () => {
  const connectionInstances: Array<{ rpcUrl: string; sendRawTransaction: jest.Mock; confirmTransaction: jest.Mock }> = [];
  return {
    Connection: jest.fn().mockImplementation((rpcUrl: string) => {
      const instance = {
        rpcUrl,
        sendRawTransaction: jest.fn(async () => 'solana-tx'),
        confirmTransaction: jest.fn(async () => undefined),
        getLatestBlockhash: jest.fn(async () => ({ blockhash: 'fresh-blockhash', lastValidBlockHeight: 1 })),
      };
      connectionInstances.push(instance);
      return instance;
    }),
    Keypair: {
      fromSecretKey: jest.fn((secretKey: Buffer) => {
        const decoded = secretKey.toString('utf8');
        if (decoded.includes('broken-sol')) {
          throw new Error('invalid solana key');
        }

        return {
          publicKey: {
            toBase58: () => `solana-${decoded}`,
          },
        };
      }),
    },
    SystemProgram: {
      programId: { equals: (other: unknown) => other === 'system-program' },
    },
    VersionedTransaction: {
      deserialize: jest.fn((bytes: Buffer) => {
        const partiallySigned = bytes.toString('hex').startsWith('ff');
        const transaction = {
          signatures: [partiallySigned ? new Uint8Array(64).fill(1) : new Uint8Array(64)],
          message: { recentBlockhash: 'old-blockhash', compiledInstructions: [], staticAccountKeys: [] },
          sign: jest.fn(),
          serialize: jest.fn(() => Buffer.from('signed-solan', 'utf8')),
        };
        deserializedSolanaTransactions.push(transaction);
        return transaction;
      }),
    },
    __connectionInstances: connectionInstances,
  };
});

jest.unstable_mockModule('tronweb', () => ({
  TronWeb: jest.fn().mockImplementation((rpcUrl: string, _fullNode: string, _solidityNode: string, privateKey?: string) => ({
    rpcUrl,
    address: {
      fromPrivateKey: (value: string) => (value.includes('broken-trx') ? undefined : `tron-${value}`),
    },
    trx: {
      sign: jest.fn(async (rawTransaction: Record<string, unknown>) => ({
        ...rawTransaction,
        signature: ['sig'],
      })),
      sendRawTransaction: jest.fn(async (signed: Record<string, unknown>) => (
        (signed.raw_data as { reject?: boolean } | undefined)?.reject
          ? { result: false, code: 'TRANSACTION_EXPIRATION_ERROR', message: Buffer.from('expired').toString('hex') }
          : { txid: 'tron-tx' }
      )),
    },
    transactionBuilder: {
      extendExpiration: jest.fn(async (transaction: { raw_data: { expiration: number } }, seconds: number) => ({
        ...transaction,
        raw_data: { ...transaction.raw_data, expiration: transaction.raw_data.expiration + seconds * 1000 },
        txID: 'extended',
      })),
    },
    privateKey,
  })),
}));

jest.unstable_mockModule('@stellar/stellar-sdk', () => ({
  Keypair: {
    fromSecret: jest.fn((secret: string) => {
      if (secret.includes('broken-srb')) {
        throw new Error('invalid soroban key');
      }

      return {
        publicKey: () => `srb-${secret}`,
      };
    }),
  },
  TransactionBuilder: {
    fromXDR: jest.fn(() => ({
      sign: jest.fn(),
      toXDR: () => 'signed-xdr',
    })),
  },
  rpc: {
    Server: jest.fn().mockImplementation((rpcUrl: string) => ({
      rpcUrl,
      sendTransaction: jest.fn(async () => ({ hash: 'srb-tx' })),
    })),
  },
}));

jest.mock('@stacks/network', () => ({
  STACKS_MAINNET: { client: { baseUrl: 'https://stacks.mainnet' }, chainId: 1 },
  STACKS_TESTNET: { client: { baseUrl: 'https://stacks.testnet' }, chainId: 2147483648 },
}));

jest.mock('@stacks/transactions', () => ({
  BytesReader: jest.fn(),
  TransactionSigner: jest.fn().mockImplementation(() => ({
    signOrigin: jest.fn(),
  })),
  broadcastTransaction: jest.fn(async () => ({ txid: 'stx-tx' })),
  createSingleSigSpendingCondition: jest.fn(() => ({})),
  deserializeTransaction: jest.fn(() => ({
    auth: {
      spendingCondition: {
        hashMode: 0,
        fee: 0,
      },
    },
    serialize: () => 'serialized-stx',
  })),
  fetchNonce: jest.fn(async () => 1),
  getAddressFromPublicKey: jest.fn((publicKey: Buffer, network: { chainId?: number }) =>
    network.chainId === 1 ? `SP-pub-${publicKey.toString('utf8')}` : `ST-pub-${publicKey.toString('utf8')}`,
  ),
  privateKeyToPublic: jest.fn((privateKey: string) => {
    if (privateKey.includes('broken-stx')) {
      throw new Error('invalid stacks key');
    }

    return Buffer.from(`pub-${privateKey}`);
  }),
}));

jest.mock('../src/evm-signer.js', () => ({
  broadcastTransaction: jest.fn(),
  getConfiguredEvmWallets: jest.fn(() => ([
    {
      walletId: 'EVM_DEFAULT',
      address: '0xevm-default',
      chainId: 1,
      chainSymbol: 'ETH',
    },
  ])),
  signTransaction: jest.fn(),
}));

type ChainExecutionModule = typeof import('../src/chain-execution.js');
const sharedEnv: Record<string, string | undefined> = {
  LOCAL_SIGNER_SOL_PRIVATE_KEY: '11111111111111111111111111111111',
  LOCAL_SIGNER_SOL_RPC_URL: 'http://sol.default',
  LOCAL_SIGNER_SOL_WALLET_ALPHA_PRIVATE_KEY: '22222222222222222222222222222222',
  LOCAL_SIGNER_SOL_WALLET_ALPHA_RPC_URL: 'http://sol.alpha',
  LOCAL_SIGNER_TRX_PRIVATE_KEY: '1111111111111111111111111111111111111111111111111111111111111111',
  LOCAL_SIGNER_TRX_RPC_URL: 'http://trx.default',
  LOCAL_SIGNER_TRX_WALLET_BETA_PRIVATE_KEY: '2222222222222222222222222222222222222222222222222222222222222222',
  LOCAL_SIGNER_TRX_WALLET_BETA_RPC_URL: 'http://trx.beta',
  LOCAL_SIGNER_STX_PRIVATE_KEY: 'stx-default',
  LOCAL_SIGNER_STX_RPC_URL: 'http://stx.testnet',
  LOCAL_SIGNER_STX_WALLET_DELTA_PRIVATE_KEY: 'stx-delta',
  LOCAL_SIGNER_STX_WALLET_DELTA_RPC_URL: 'http://stx.testnet',
  LOCAL_SIGNER_SRB_PRIVATE_KEY: 'srb-default',
  LOCAL_SIGNER_SRB_RPC_URL: 'http://srb.default',
  LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE: 'passphrase-default',
  LOCAL_SIGNER_SRB_WALLET_EPSILON_PRIVATE_KEY: 'srb-epsilon',
  LOCAL_SIGNER_SRB_WALLET_EPSILON_RPC_URL: 'http://srb.epsilon',
  LOCAL_SIGNER_SRB_WALLET_EPSILON_NETWORK_PASSPHRASE: 'passphrase-epsilon',
};

let restoreSharedEnv: (() => void) | null = null;
let moduleUnderTest: ChainExecutionModule;

function setFetchMock(fetchImpl: typeof fetch): () => void {
  const previous = globalThis.fetch;
  globalThis.fetch = fetchImpl;

  return () => {
    globalThis.fetch = previous;
  };
}

function setEnv(entries: Record<string, string | undefined>): Record<string, string | undefined> {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(entries)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return previous;
}

function restoreEnv(previous: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('chain execution wallet registry', () => {
  beforeAll(async () => {
    restoreSharedEnv = (() => {
      const previous: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(sharedEnv)) {
        previous[key] = process.env[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }

      return () => {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        }
      };
    })();
    moduleUnderTest = await import('../src/chain-execution.js');
  });

  afterAll(() => {
    restoreSharedEnv?.();
  });

  test('exposes configured wallets across all supported chain families', () => {
    const walletIds = moduleUnderTest.getWalletCapabilities().map((wallet) => `${wallet.chainFamily}:${wallet.walletId}`).sort();

    expect(walletIds).toEqual(expect.arrayContaining([
      'SRB:EPSILON',
      'SRB:SRB_DEFAULT',
      'SOLANA:ALPHA',
      'SOLANA:SOLANA_DEFAULT',
      'STX:DELTA',
      'STX:STX_DEFAULT',
      'TRX:BETA',
      'TRX:TRX_DEFAULT',
    ]));
    expect(walletIds).toHaveLength(8);

    const accounts = moduleUnderTest.getAccounts().map((account) => `${account.chainFamily}:${account.walletId}`).sort();
    expect(accounts).toEqual(walletIds);
  });

  test('skips broken wallets across all family registries', () => {
    const previousEnv = setEnv({
      LOCAL_SIGNER_SOL_WALLET_BROKEN_PRIVATE_KEY: 'broken-sol',
      LOCAL_SIGNER_SOL_WALLET_BROKEN_RPC_URL: 'http://sol.broken',
      LOCAL_SIGNER_TRX_WALLET_BROKEN_PRIVATE_KEY: 'broken-trx',
      LOCAL_SIGNER_TRX_WALLET_BROKEN_RPC_URL: 'http://trx.broken',
              LOCAL_SIGNER_STX_WALLET_BROKEN_PRIVATE_KEY: 'broken-stx',
      LOCAL_SIGNER_STX_WALLET_BROKEN_RPC_URL: 'http://stx.broken',
      LOCAL_SIGNER_SRB_WALLET_BROKEN_PRIVATE_KEY: 'broken-srb',
      LOCAL_SIGNER_SRB_WALLET_BROKEN_RPC_URL: 'http://srb.broken',
      LOCAL_SIGNER_SRB_WALLET_BROKEN_NETWORK_PASSPHRASE: 'broken-passphrase',
            });

    try {
      const walletIds = moduleUnderTest.getWalletCapabilities().map((wallet) => `${wallet.chainFamily}:${wallet.walletId}`);
      const accountIds = moduleUnderTest.getAccounts().map((account) => `${account.chainFamily}:${account.walletId}`);

      expect(walletIds).not.toContain('SOLANA:BROKEN');
      expect(walletIds).not.toContain('TRX:BROKEN');
      expect(walletIds).not.toContain('STX:BROKEN');
      expect(walletIds).not.toContain('SRB:BROKEN');
      expect(accountIds).not.toContain('SOLANA:BROKEN');
      expect(accountIds).not.toContain('TRX:BROKEN');
      expect(accountIds).not.toContain('STX:BROKEN');
      expect(accountIds).not.toContain('SRB:BROKEN');
    } finally {
      restoreEnv(previousEnv);
    }
  });

  test('signs and broadcasts supported family payloads', async () => {
    const restoreFetch = setFetchMock(jest.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/v2/info');
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ network_id: 'testnet' }),
      } as Response;
    }) as unknown as typeof fetch);

    try {
      const solanaSigned = await moduleUnderTest.signTransactionByFamily({
        chainFamily: 'SOLANA',
        walletId: 'ALPHA',
        serializedTransactionHex: 'aabbcc',
      });
      expect(solanaSigned.walletId).toBe('ALPHA');
      expect(solanaSigned.signedTransaction.chainFamily).toBe('SOLANA');
      expect((await moduleUnderTest.broadcastSignedTransactionByFamily(solanaSigned.signedTransaction)).txHash).toBe('solana-tx');

      const stacksSigned = await moduleUnderTest.signTransactionByFamily({
        chainFamily: 'STX',
        walletId: 'DELTA',
        serializedTransactionHex: 'aabbcc',
      });
      expect(stacksSigned.walletId).toBe('DELTA');
      expect(stacksSigned.signedTransaction.chainFamily).toBe('STX');
      expect((await moduleUnderTest.broadcastSignedTransactionByFamily(stacksSigned.signedTransaction)).txHash).toBe('stx-tx');
    } finally {
      restoreFetch();
    }
  });

  test('refreshes the blockhash of an unsigned Solana transaction before signing', async () => {
    await moduleUnderTest.signTransactionByFamily({ chainFamily: 'SOLANA', walletId: 'ALPHA', serializedTransactionHex: 'aabbcc' });
    expect(deserializedSolanaTransactions.at(-1)?.message.recentBlockhash).toBe('fresh-blockhash');

    await moduleUnderTest.signTransactionByFamily({ chainFamily: 'SOLANA', walletId: 'ALPHA', serializedTransactionHex: 'ffaabb' });
    expect(deserializedSolanaTransactions.at(-1)?.message.recentBlockhash).toBe('old-blockhash');
  });

  test('extends a Tron transaction that is about to expire and surfaces node rejections', async () => {
    const expiringSoon = { raw_data: { expiration: Date.now() + 5_000 }, txID: 'original' };
    const signed = await moduleUnderTest.signTransactionByFamily({ chainFamily: 'TRX', walletId: 'BETA', rawTransaction: expiringSoon });
    const signedTransaction = signed.signedTransaction as { signedTransaction: { txID: string; raw_data: { expiration: number } } };
    expect(signedTransaction.signedTransaction.txID).toBe('extended');
    expect(signedTransaction.signedTransaction.raw_data.expiration).toBeGreaterThanOrEqual(Date.now() + 119_000);

    const fresh = { raw_data: { expiration: Date.now() + 600_000 }, txID: 'original' };
    const untouched = await moduleUnderTest.signTransactionByFamily({ chainFamily: 'TRX', walletId: 'BETA', rawTransaction: fresh });
    expect((untouched.signedTransaction as { signedTransaction: { txID: string } }).signedTransaction.txID).toBe('original');

    await expect(moduleUnderTest.broadcastSignedTransactionByFamily({
      chainFamily: 'TRX',
      walletId: 'BETA',
      signedTransaction: { raw_data: { reject: true }, signature: ['sig'] },
    })).rejects.toThrow('TRANSACTION_EXPIRATION_ERROR expired');
  });
});

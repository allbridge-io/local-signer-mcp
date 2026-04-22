import { beforeAll, afterAll, describe, expect, jest, test } from '@jest/globals';

jest.mock('bs58', () => ({
  default: {
    decode: (value: string) => Buffer.from(value),
  },
}));

jest.mock('@solana/web3.js', () => {
  const connectionInstances: Array<{ rpcUrl: string; sendRawTransaction: jest.Mock; confirmTransaction: jest.Mock }> = [];
  return {
    Connection: jest.fn().mockImplementation((rpcUrl: string) => {
      const instance = {
        rpcUrl,
        sendRawTransaction: jest.fn(async () => 'solana-tx'),
        confirmTransaction: jest.fn(async () => undefined),
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
    VersionedTransaction: {
      deserialize: jest.fn(() => ({
        sign: jest.fn(),
        serialize: jest.fn(() => Buffer.from('signed-solan', 'utf8')),
      })),
    },
    __connectionInstances: connectionInstances,
  };
});

jest.mock('tronweb', () => ({
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
      sendRawTransaction: jest.fn(async () => ({ txid: 'tron-tx' })),
    },
    privateKey,
  })),
}));

jest.mock('algosdk', () => ({
  __esModule: true,
  default: {
    secretKeyToMnemonic: (secretKey: Buffer) => {
      const decoded = secretKey.toString('utf8');
      if (decoded.includes('broken-alg')) {
        throw new Error('invalid algorand key');
      }

      return `mnemonic-${decoded}`;
    },
    mnemonicToSecretKey: (mnemonic: string) => ({
      addr: {
        toString: () => `alg-${mnemonic}`,
      },
      sk: new Uint8Array([1, 2, 3]),
    }),
    decodeUnsignedTransaction: jest.fn(() => ({
      group: null,
      signTxn: () => Buffer.from('signed-alg', 'utf8'),
    })),
    assignGroupID: jest.fn(),
    Algodv2: jest.fn().mockImplementation(() => ({
      sendRawTransaction: jest.fn(() => ({
        do: async () => ({ txid: 'alg-tx' }),
      })),
    })),
  },
}));

jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: {
    fromSecretKey: jest.fn((secretKey: string) => {
      if (secretKey.includes('broken-sui')) {
        throw new Error('invalid sui key');
      }

      return {
        toSuiAddress: () => `sui-${secretKey}`,
      };
    }),
  },
}));

jest.mock('@mysten/sui/client', () => ({
  SuiClient: jest.fn().mockImplementation((options: { url: string }) => ({
    url: options.url,
    executeTransactionBlock: jest.fn(async () => ({
      digest: 'sui-tx',
    })),
  })),
}));

jest.mock('@mysten/sui/transactions', () => ({
  Transaction: {
    from: jest.fn(() => ({
      sign: jest.fn(async () => ({
        bytes: 'bytes-base64',
        signature: 'signature',
      })),
    })),
  },
}));

jest.mock('@stellar/stellar-sdk', () => ({
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

const ALGORAND_FAKE_SECRET_KEY = Buffer.from('algorand-test-fixture', 'utf8').toString('hex');

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
  LOCAL_SIGNER_ALG_PRIVATE_KEY: ALGORAND_FAKE_SECRET_KEY,
  LOCAL_SIGNER_ALG_RPC_URL: 'http://alg.default',
  LOCAL_SIGNER_ALG_WALLET_GAMMA_PRIVATE_KEY: ALGORAND_FAKE_SECRET_KEY,
  LOCAL_SIGNER_ALG_WALLET_GAMMA_RPC_URL: 'http://alg.gamma',
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
  LOCAL_SIGNER_SUI_PRIVATE_KEY: 'suiprivkey1qqacl7h6wzqgsq409c4ndcmqhmd4a0hu99qx22tzetnp9xtrft44v5q2swx',
  LOCAL_SIGNER_SUI_RPC_URL: 'http://sui.default',
  LOCAL_SIGNER_SUI_WALLET_ZETA_PRIVATE_KEY: 'suiprivkey1qz3k2q69ervkg0t0tmyu24a58d9mn6nshlku5jf44sw46yvzjqhwsff0chl',
  LOCAL_SIGNER_SUI_WALLET_ZETA_RPC_URL: 'http://sui.zeta',
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
      'ALG:ALG_DEFAULT',
      'ALG:GAMMA',
      'SRB:EPSILON',
      'SRB:SRB_DEFAULT',
      'SOLANA:ALPHA',
      'SOLANA:SOLANA_DEFAULT',
      'STX:DELTA',
      'STX:STX_DEFAULT',
      'SUI:SUI_DEFAULT',
      'SUI:ZETA',
      'TRX:BETA',
      'TRX:TRX_DEFAULT',
    ]));
    expect(walletIds).toHaveLength(12);

    const accounts = moduleUnderTest.getAccounts().map((account) => `${account.chainFamily}:${account.walletId}`).sort();
    expect(accounts).toEqual(walletIds);
  });

  test('skips broken wallets across all family registries', () => {
    const previousEnv = setEnv({
      LOCAL_SIGNER_SOL_WALLET_BROKEN_PRIVATE_KEY: 'broken-sol',
      LOCAL_SIGNER_SOL_WALLET_BROKEN_RPC_URL: 'http://sol.broken',
      LOCAL_SIGNER_TRX_WALLET_BROKEN_PRIVATE_KEY: 'broken-trx',
      LOCAL_SIGNER_TRX_WALLET_BROKEN_RPC_URL: 'http://trx.broken',
      LOCAL_SIGNER_ALG_WALLET_BROKEN_PRIVATE_KEY: 'broken-alg',
      LOCAL_SIGNER_ALG_WALLET_BROKEN_RPC_URL: 'http://alg.broken',
      LOCAL_SIGNER_STX_WALLET_BROKEN_PRIVATE_KEY: 'broken-stx',
      LOCAL_SIGNER_STX_WALLET_BROKEN_RPC_URL: 'http://stx.broken',
      LOCAL_SIGNER_SRB_WALLET_BROKEN_PRIVATE_KEY: 'broken-srb',
      LOCAL_SIGNER_SRB_WALLET_BROKEN_RPC_URL: 'http://srb.broken',
      LOCAL_SIGNER_SRB_WALLET_BROKEN_NETWORK_PASSPHRASE: 'broken-passphrase',
      LOCAL_SIGNER_SUI_WALLET_BROKEN_PRIVATE_KEY: 'broken-sui',
      LOCAL_SIGNER_SUI_WALLET_BROKEN_RPC_URL: 'http://sui.broken',
    });

    try {
      const walletIds = moduleUnderTest.getWalletCapabilities().map((wallet) => `${wallet.chainFamily}:${wallet.walletId}`);
      const accountIds = moduleUnderTest.getAccounts().map((account) => `${account.chainFamily}:${account.walletId}`);

      expect(walletIds).not.toContain('SOLANA:BROKEN');
      expect(walletIds).not.toContain('TRX:BROKEN');
      expect(walletIds).not.toContain('ALG:BROKEN');
      expect(walletIds).not.toContain('STX:BROKEN');
      expect(walletIds).not.toContain('SRB:BROKEN');
      expect(walletIds).not.toContain('SUI:BROKEN');
      expect(accountIds).not.toContain('SOLANA:BROKEN');
      expect(accountIds).not.toContain('TRX:BROKEN');
      expect(accountIds).not.toContain('ALG:BROKEN');
      expect(accountIds).not.toContain('STX:BROKEN');
      expect(accountIds).not.toContain('SRB:BROKEN');
      expect(accountIds).not.toContain('SUI:BROKEN');
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

});

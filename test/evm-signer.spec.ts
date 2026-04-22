import { beforeAll, afterAll, describe, expect, jest, test } from '@jest/globals';

type EvmSignerModule = typeof import('../src/evm-signer.js');

function createEthersMock() {
  class MockJsonRpcProvider {
    readonly rpcUrl: string;
    readonly getFeeData: jest.Mock;
    readonly broadcastTransaction: jest.Mock;

    constructor(rpcUrl: string) {
      this.rpcUrl = rpcUrl;
      this.getFeeData = jest.fn(async () => ({
        maxFeePerGas: 2000n,
        maxPriorityFeePerGas: 100n,
        gasPrice: null,
      }));
      this.broadcastTransaction = jest.fn(async (signedTransaction: string) => ({
        hash: `hash-${signedTransaction.slice(0, 10)}`,
        wait: jest.fn(async () => ({
          blockNumber: 123,
          status: 1,
          gasUsed: 21000n,
        })),
      }));
    }
  }

  class MockWallet {
    readonly privateKey: string;
    readonly address: string;
    readonly provider: MockJsonRpcProvider | null;
    readonly getNonce: jest.Mock;
    readonly estimateGas: jest.Mock;
    readonly signTransaction: jest.Mock;

    constructor(privateKey: string, provider?: MockJsonRpcProvider | null) {
      if (privateKey.includes('bad-key')) {
        throw new Error('invalid evm private key');
      }

      this.privateKey = privateKey;
      this.address = `0x${privateKey.replace(/^0x/, '').slice(-40)}`;
      this.provider = provider ?? null;
      this.getNonce = jest.fn(async () => 77);
      this.estimateGas = jest.fn(async () => 21000n);
      this.signTransaction = jest.fn(async (prepared: { to?: string }) => `signed-${this.address}-${prepared.to ?? 'unknown'}`);
    }
  }

  return {
    JsonRpcProvider: jest.fn((rpcUrl: string) => new MockJsonRpcProvider(rpcUrl)),
    Wallet: jest.fn((privateKey: string, provider?: MockJsonRpcProvider | null) => new MockWallet(privateKey, provider)),
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

const sharedEnv: Record<string, string | undefined> = {
  LOCAL_SIGNER_EVM_PRIVATE_KEY: '0x1111111111111111111111111111111111111111111111111111111111111111',
  LOCAL_SIGNER_EVM_RPC_URL: 'https://default.example',
  LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB: '0x2222222222222222222222222222222222222222222222222222222222222222',
  LOCAL_SIGNER_EVM_RPC_URL_ARB: 'https://arb.example',
  LOCAL_SIGNER_EVM_WALLET_PRIMARY_PRIVATE_KEY: '0x3333333333333333333333333333333333333333333333333333333333333333',
  LOCAL_SIGNER_EVM_WALLET_PRIMARY_RPC_URL: 'https://wallet.example',
  LOCAL_SIGNER_EVM_WALLET_PRIMARY_CHAIN_SYMBOL: 'ARB',
  LOCAL_SIGNER_EVM_WALLET_SECONDARY_PRIVATE_KEY: '0x4444444444444444444444444444444444444444444444444444444444444444',
  LOCAL_SIGNER_EVM_WALLET_SECONDARY_RPC_URL: 'https://wallet-2.example',
  LOCAL_SIGNER_EVM_WALLET_SECONDARY_CHAIN_SYMBOL: 'ARB',
};

let restoreSharedEnv: (() => void) | null = null;
let moduleUnderTest: EvmSignerModule;

describe('evm signer wallet registry', () => {
  beforeAll(async () => {
    await jest.unstable_mockModule('ethers', () => createEthersMock());
    const previousEnv = setEnv(sharedEnv);
    restoreSharedEnv = () => restoreEnv(previousEnv);
    moduleUnderTest = await import('../src/evm-signer.js');
  });

  afterAll(() => {
    restoreSharedEnv?.();
  });

  test('exposes multiple wallets across legacy, scoped, and slot-based envs', () => {
    const wallets = moduleUnderTest.getConfiguredEvmWallets();

    expect(wallets.map((wallet) => wallet.walletId)).toEqual([
      'ARB',
      'DEFAULT',
      'PRIMARY',
      'SECONDARY',
    ]);
    expect(wallets.map((wallet) => wallet.address)).toHaveLength(4);
  });

  test('selects a wallet by walletId before using chain-scoped fallback', () => {
    expect(moduleUnderTest.selectEvmWalletContext({
      walletId: 'SECONDARY',
      chainSymbol: 'ARB',
    })?.walletId).toBe('SECONDARY');
  });

  test('selects a wallet by from address when multiple wallets share a chain', () => {
    const wallets = moduleUnderTest.getConfiguredEvmWallets();
    const target = wallets.find((wallet) => wallet.walletId === 'PRIMARY');
    expect(target).toBeDefined();

    expect(moduleUnderTest.selectEvmWalletContext({
      chainSymbol: 'ARB',
      from: target?.address,
    })?.walletId).toBe('PRIMARY');
  });

  test('returns null when multiple wallets match the same chain and no selector is provided', () => {
    expect(moduleUnderTest.selectEvmWalletContext({
      chainSymbol: 'ARB',
    })).toBeNull();
  });

  test('skips malformed EVM wallets from the registry', () => {
    const previousEnv = setEnv({
      LOCAL_SIGNER_EVM_WALLET_BROKEN_PRIVATE_KEY: 'bad-key',
      LOCAL_SIGNER_EVM_WALLET_BROKEN_RPC_URL: 'https://broken.example',
      LOCAL_SIGNER_EVM_WALLET_BROKEN_CHAIN_SYMBOL: 'ARB',
    });

    try {
      const wallets = moduleUnderTest.getConfiguredEvmWallets().map((wallet) => wallet.walletId);
      expect(wallets).not.toContain('BROKEN');
      expect(moduleUnderTest.selectEvmWalletContext({ walletId: 'BROKEN' })).toBeNull();
    } finally {
      restoreEnv(previousEnv);
    }
  });

  test('signs and broadcasts an EVM payload with the selected wallet', async () => {
    const signed = await moduleUnderTest.signTransaction({
      chainFamily: 'EVM',
      chainId: 42161,
      chainSymbol: 'ARB',
      walletId: 'PRIMARY',
      to: '0x9999999999999999999999999999999999999999',
      value: '0x10',
      data: '0x1234',
      gasLimit: '21000',
      type: 2,
    });

    expect(signed.walletId).toBe('PRIMARY');
    expect(signed.from).toBe('0x3333333333333333333333333333333333333333');
    expect(signed.signedTransaction).toContain('signed-0x3333333333333333333333333333333333333333-0x9999999999999999999999999999999999999999');

    const broadcast = await moduleUnderTest.broadcastTransaction({
      chainFamily: 'EVM',
      chainId: 42161,
      chainSymbol: 'ARB',
      walletId: 'PRIMARY',
      signedTransaction: signed.signedTransaction,
    });

    expect(broadcast.txHash).toBe('hash-signed-0x3');
    expect(broadcast.receipt).toEqual({
      blockNumber: 123,
      status: 1,
      gasUsed: '21000',
    });
  });

});

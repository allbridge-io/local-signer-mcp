import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';

const executeTransaction = jest.fn(async () => ({
  $kind: 'Transaction',
  Transaction: { digest: 'sui-digest', status: { success: true, error: null }, epoch: '900' },
}));
const clientOptions: unknown[] = [];

jest.unstable_mockModule('@mysten/sui/grpc', () => ({
  SuiGrpcClient: jest.fn().mockImplementation((options: unknown) => {
    clientOptions.push(options);
    return { executeTransaction };
  }),
}));

// Fixed test key, not a real wallet.
const SECRET = '9f3b1c5d7e2a4f6081b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7';
const keypair = Ed25519Keypair.fromSecretKey(Buffer.from(SECRET, 'hex'));
const address = keypair.toSuiAddress();

const env: Record<string, string> = {
  LOCAL_SIGNER_SUI_PRIVATE_KEY: SECRET,
  LOCAL_SIGNER_SUI_RPC_URL: 'https://fullnode.mainnet.sui.io/',
  LOCAL_SIGNER_SUI_WALLET_BECH_PRIVATE_KEY: new Ed25519Keypair().getSecretKey(),
  LOCAL_SIGNER_SUI_WALLET_BECH_RPC_URL: 'https://fullnode.testnet.sui.io',
  LOCAL_SIGNER_SUI_WALLET_BROKEN_PRIVATE_KEY: 'not-a-key',
  LOCAL_SIGNER_SUI_WALLET_BROKEN_RPC_URL: 'https://fullnode.mainnet.sui.io',
};
const previous: Record<string, string | undefined> = {};
let chainExecution: typeof import('../src/chain-execution.js');

/** A transaction with sender, gas and inputs set, so building it needs no RPC. */
function builtOfflineTransaction(): string {
  const tx = new Transaction();
  tx.setSender(address);
  tx.setGasPrice(1000);
  tx.setGasBudget(2_000_000);
  tx.setGasPayment([{ objectId: `0x${'1'.repeat(64)}`, version: '7', digest: '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi' }]);
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(10_000_000_000n)]);
  tx.transferObjects([coin], tx.pure.address(`0x${'2'.repeat(64)}`));
  return JSON.stringify(JSON.parse(JSON.stringify(tx.getData(), (_key, value) => (typeof value === 'bigint' ? value.toString() : value))));
}

describe('Sui wallets', () => {
  beforeAll(async () => {
    for (const [key, value] of Object.entries(env)) {
      previous[key] = process.env[key];
      process.env[key] = value;
    }
    chainExecution = await import('../src/chain-execution.js');
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test('derives addresses from hex and suiprivkey keys and skips invalid ones', () => {
    const sui = chainExecution.getAccounts().filter((account) => account.chainFamily === 'SUI');

    expect(sui.map((account) => account.walletId).sort()).toEqual(['BECH', 'SUI_DEFAULT']);
    expect(sui.find((account) => account.walletId === 'SUI_DEFAULT')?.address).toBe(address);
  });

  test('signs a serialized transaction and broadcasts it through gRPC', async () => {
    const signed = await chainExecution.signTransactionByFamily({ chainFamily: 'SUI', walletId: 'SUI_DEFAULT', serializedTransaction: builtOfflineTransaction() });

    expect(signed).toMatchObject({ chainFamily: 'SUI', walletId: 'SUI_DEFAULT', walletAddress: address });
    const payload = signed.signedTransaction as { chainFamily: 'SUI'; signedTransaction: { bytesBase64: string; signature: string } };
    await expect(keypair.getPublicKey().verifyTransaction(fromBase64(payload.signedTransaction.bytesBase64), payload.signedTransaction.signature)).resolves.toBe(true);

    const broadcast = await chainExecution.broadcastSignedTransactionByFamily(payload);
    expect(broadcast).toEqual({ chainFamily: 'SUI', txHash: 'sui-digest', receipt: { status: { success: true, error: null }, epoch: '900' } });
    expect(executeTransaction).toHaveBeenCalledWith({
      transaction: Buffer.from(payload.signedTransaction.bytesBase64, 'base64'),
      signatures: [payload.signedTransaction.signature],
    });
    expect(clientOptions).toContainEqual({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io' });
  });

  test('throws when the transaction fails on chain', async () => {
    executeTransaction.mockResolvedValueOnce({
      $kind: 'FailedTransaction',
      FailedTransaction: { digest: 'failed-digest', status: { success: false, error: { message: 'InsufficientGas' } }, epoch: '900' },
    } as never);

    await expect(chainExecution.broadcastSignedTransactionByFamily({
      chainFamily: 'SUI',
      walletId: 'SUI_DEFAULT',
      signedTransaction: { bytesBase64: 'AAAA', signature: 'AQID' },
    })).rejects.toThrow('Sui transaction failed-digest failed');
  });
});

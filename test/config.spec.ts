import { afterEach, describe, expect, jest, test } from '@jest/globals';

function snapshotEnv(keys: string[]): Record<string, string | undefined> {
  const previous: Record<string, string | undefined> = {};
  for (const key of keys) {
    previous[key] = process.env[key];
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

describe('config', () => {
  const keys = [
    'LOCAL_SIGNER_TRANSPORT',
    'LOCAL_SIGNER_HOST',
    'LOCAL_SIGNER_PORT',
    'LOCAL_SIGNER_TLS_CERT_PATH',
    'LOCAL_SIGNER_TLS_KEY_PATH',
    'LOCAL_SIGNER_TLS_PASSPHRASE',
    'LOCAL_SIGNER_EVM_PRIVATE_KEY',
    'LOCAL_SIGNER_EVM_RPC_URL',
    'LOCAL_SIGNER_SOL_PRIVATE_KEY',
    'LOCAL_SIGNER_TRX_PRIVATE_KEY',
    'LOCAL_SIGNER_STX_PRIVATE_KEY',
    'LOCAL_SIGNER_SRB_PRIVATE_KEY',
  ];

  afterEach(() => {
    jest.resetModules();
  });

  test('exposes tls settings for remote https mode', async () => {
    const previous = snapshotEnv(keys);
    try {
      process.env.LOCAL_SIGNER_TRANSPORT = 'streamable-http';
      process.env.LOCAL_SIGNER_TLS_CERT_PATH = '/tmp/cert.pem';
      process.env.LOCAL_SIGNER_TLS_KEY_PATH = '/tmp/key.pem';
      process.env.LOCAL_SIGNER_TLS_PASSPHRASE = 'secret';

      const { config } = await import('../src/config.js');

      expect(config.LOCAL_SIGNER_TRANSPORT).toBe('streamable-http');
      expect(config.LOCAL_SIGNER_TLS_CERT_PATH).toBe('/tmp/cert.pem');
      expect(config.LOCAL_SIGNER_TLS_KEY_PATH).toBe('/tmp/key.pem');
      expect(config.LOCAL_SIGNER_TLS_PASSPHRASE).toBe('secret');
    } finally {
      restoreEnv(previous);
    }
  });

  test('defaults to stdio when transport is not remote', async () => {
    const previous = snapshotEnv(keys);
    try {
      delete process.env.LOCAL_SIGNER_TRANSPORT;
      delete process.env.LOCAL_SIGNER_TLS_CERT_PATH;
      delete process.env.LOCAL_SIGNER_TLS_KEY_PATH;
      delete process.env.LOCAL_SIGNER_TLS_PASSPHRASE;

      const { config } = await import('../src/config.js');

      expect(config.LOCAL_SIGNER_TRANSPORT).toBe('stdio');
      expect(config.LOCAL_SIGNER_TLS_CERT_PATH).toBeNull();
      expect(config.LOCAL_SIGNER_TLS_KEY_PATH).toBeNull();
      expect(config.LOCAL_SIGNER_TLS_PASSPHRASE).toBeNull();
    } finally {
      restoreEnv(previous);
    }
  });
});

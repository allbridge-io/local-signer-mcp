import 'dotenv/config';

function normalizePrivateKey(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

function normalizeString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export const config = {
  get LOCAL_SIGNER_TRANSPORT() {
    const value = normalizeString(process.env.LOCAL_SIGNER_TRANSPORT);
    return value === 'streamable-http' ? value : 'stdio';
  },
  get LOCAL_SIGNER_HOST() {
    return normalizeString(process.env.LOCAL_SIGNER_HOST) ?? '127.0.0.1';
  },
  get LOCAL_SIGNER_PORT() {
    const value = normalizeString(process.env.LOCAL_SIGNER_PORT);
    if (value) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    const port = normalizeString(process.env.PORT);
    if (port) {
      const parsed = Number(port);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return 3333;
  },
  get LOCAL_SIGNER_TLS_CERT_PATH() {
    return normalizeString(process.env.LOCAL_SIGNER_TLS_CERT_PATH);
  },
  get LOCAL_SIGNER_TLS_KEY_PATH() {
    return normalizeString(process.env.LOCAL_SIGNER_TLS_KEY_PATH);
  },
  get LOCAL_SIGNER_TLS_PASSPHRASE() {
    return normalizeString(process.env.LOCAL_SIGNER_TLS_PASSPHRASE);
  },
  get LOCAL_SIGNER_EVM_PRIVATE_KEY() {
    return normalizePrivateKey(process.env.LOCAL_SIGNER_EVM_PRIVATE_KEY);
  },
  get LOCAL_SIGNER_EVM_RPC_URL() {
    return normalizeString(process.env.LOCAL_SIGNER_EVM_RPC_URL);
  },
  get LOCAL_SIGNER_SOL_PRIVATE_KEY() {
    return normalizeString(process.env.LOCAL_SIGNER_SOL_PRIVATE_KEY);
  },
  get LOCAL_SIGNER_SOL_RPC_URL() {
    return normalizeString(process.env.LOCAL_SIGNER_SOL_RPC_URL);
  },
  get LOCAL_SIGNER_TRX_PRIVATE_KEY() {
    return normalizeString(process.env.LOCAL_SIGNER_TRX_PRIVATE_KEY);
  },
  get LOCAL_SIGNER_TRX_RPC_URL() {
    return normalizeString(process.env.LOCAL_SIGNER_TRX_RPC_URL);
  },
  get LOCAL_SIGNER_STX_PRIVATE_KEY() {
    return normalizeString(process.env.LOCAL_SIGNER_STX_PRIVATE_KEY);
  },
  get LOCAL_SIGNER_STX_RPC_URL() {
    return normalizeString(process.env.LOCAL_SIGNER_STX_RPC_URL);
  },
  get LOCAL_SIGNER_SRB_PRIVATE_KEY() {
    return normalizeString(process.env.LOCAL_SIGNER_SRB_PRIVATE_KEY);
  },
  get LOCAL_SIGNER_SRB_RPC_URL() {
    return normalizeString(process.env.LOCAL_SIGNER_SRB_RPC_URL);
  },
  get LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE() {
    return normalizeString(process.env.LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE);
  },
  get LOCAL_SIGNER_SUI_PRIVATE_KEY() {
    return normalizeString(process.env.LOCAL_SIGNER_SUI_PRIVATE_KEY);
  },
  get LOCAL_SIGNER_SUI_RPC_URL() {
    return normalizeString(process.env.LOCAL_SIGNER_SUI_RPC_URL);
  },
};

# Usage

## Purpose

`local-signer-mcp` is a localhost-oriented signing and broadcast service.

It supports both:

- `stdio` for local clients
- `streamable-http` for remote MCP clients that need a connector URL

If the remote client requires `https`, configure TLS for the HTTP transport and expose the server through a trusted certificate or proxy.

It is responsible for:

- exposing available local accounts
- signing transactions for supported chain families
- broadcasting signed transactions for supported chain families
- combining signing and broadcasting in one call

It does not know anything about bridge route selection or protocol-specific business logic.

## Recommended Integration Model

1. An orchestration service creates an execution job
2. The client selects the next transaction step
3. The client sends that unsigned transaction to `local-signer-mcp`
4. `local-signer-mcp` signs or signs-and-broadcasts the transaction
5. The orchestration service continues the workflow

If more than one wallet exists for a family, set `walletId` on the transaction payload. For EVM, `from` is also supported as an additional selector.

## Tool Summary

### `get_wallet_capabilities`

Returns whether a local wallet is configured and which capabilities are available.

### `get_accounts`

Returns configured local account addresses.

### `sign_transaction`

Signs an unsigned transaction and returns the signed payload and the prepared transaction fields used for signing.

For EVM, the signer resolves credentials in this order:

1. `walletId` on the transaction, if provided
2. `from` on the transaction, if provided
3. `LOCAL_SIGNER_EVM_WALLET_<walletId>_PRIVATE_KEY` / `LOCAL_SIGNER_EVM_WALLET_<walletId>_RPC_URL`
4. `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainSymbol>` / `LOCAL_SIGNER_EVM_RPC_URL_<chainSymbol>`
5. `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainId>` / `LOCAL_SIGNER_EVM_RPC_URL_<chainId>`
6. `LOCAL_SIGNER_EVM_PRIVATE_KEY` / `LOCAL_SIGNER_EVM_RPC_URL`

When multiple wallets exist for the same EVM chain, set `walletId` or `from` explicitly. If the signer cannot choose a single wallet deterministically, it fails instead of guessing.
For Solana, Tron, Algorand, Stacks, Soroban / Stellar, and Sui, set `walletId` explicitly when more than one wallet is configured for that family.

### `broadcast_transaction`

Broadcasts an already signed transaction.

### `sign_and_broadcast_transaction`

Signs an unsigned transaction and immediately broadcasts it.

## Remote Transport

For remote MCP connectors, start the signer in HTTP mode. If you need an `https://` URL, provide TLS files:

```bash
LOCAL_SIGNER_TRANSPORT=streamable-http \
LOCAL_SIGNER_HOST=127.0.0.1 \
LOCAL_SIGNER_PORT=3333 \
LOCAL_SIGNER_TLS_CERT_PATH=/absolute/path/to/cert.pem \
LOCAL_SIGNER_TLS_KEY_PATH=/absolute/path/to/key.pem \
pnpm start
```

## Environment Patterns

Non-EVM families use the same slot-based naming pattern for multiple wallets:

- `LOCAL_SIGNER_SOL_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_SOL_WALLET_<walletId>_RPC_URL`
- `LOCAL_SIGNER_TRX_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_TRX_WALLET_<walletId>_RPC_URL`
- `LOCAL_SIGNER_ALG_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_ALG_WALLET_<walletId>_RPC_URL`
- `LOCAL_SIGNER_STX_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_STX_WALLET_<walletId>_RPC_URL`
  - the signer probes the selected RPC via `/v2/info` and fails fast if the resolved mainnet/testnet network does not match the wallet address
- `LOCAL_SIGNER_SRB_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_SRB_WALLET_<walletId>_RPC_URL`
- `LOCAL_SIGNER_SRB_WALLET_<walletId>_NETWORK_PASSPHRASE`
- `LOCAL_SIGNER_SUI_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_SUI_WALLET_<walletId>_RPC_URL`

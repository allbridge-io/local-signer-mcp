# Usage

## Purpose

`local-signer-mcp` is a localhost-oriented signing and broadcast service.

It supports both:

- `stdio` for local clients
- `streamable-http` for clients on the same machine that can only connect by URL

HTTP mode has no authentication: anyone who can reach the port can sign with your keys. Keep it on `127.0.0.1` (the default) and never expose it to a network or a remote connector. If a local client requires `https`, configure TLS for the HTTP transport.

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

Signs an unsigned transaction. Returns `chainFamily`, `walletId`, `walletAddress`, `chainId` and `chainSymbol` (EVM), and `signedTransaction`: the signed payload in the input shape of `broadcast_transaction`.

EVM wallet choice (see the README "Wallet Selection" section for the sources):

1. `walletId` on the transaction wins, if given; it must still match the chain and `from`.
2. Otherwise the signer keeps the wallets whose chain matches the transaction (`chainId`, `chainSymbol`); a wallet without a chain, such as the default pair, matches every chain.
3. It narrows them by `from`, if given.
4. It prefers a wallet configured for the transaction's chain over one without a chain, so a per-chain key wins over the default pair.
5. It fails unless exactly one wallet remains.

For Solana, Tron, Stacks, and Soroban / Stellar, set `walletId` explicitly when more than one wallet is configured for that family.

### `broadcast_transaction`

Broadcasts an already signed transaction: pass the `signedTransaction` object from `sign_transaction` unchanged. The payload by family:

| `chainFamily` | Signed field |
|---------------|--------------|
| `EVM` | `signedTransaction` (hex string), plus `chainId` and optional `chainSymbol` |
| `TRX` | `signedTransaction` (signed transaction object) |
| `SOLANA`, `STX` | `signedTransactionHex` |
| `SRB` | `signedTransactionXdr` |

Returns `chainFamily`, `txHash` and `receipt` (`null` for Solana). EVM waits for the receipt and Solana for confirmation; Tron, Stacks and Stellar return once the node accepts the transaction, and a rejection by the node fails the call.

### `sign_and_broadcast_transaction`

Signs an unsigned transaction and immediately broadcasts it. Returns `{ signResult, broadcastResult }` with the shapes above. Steps of an `allbridge-mcp` execution job carry their `transaction` in exactly this input shape.

Before signing, an unsigned Solana transaction gets a fresh blockhash and an unsigned Tron transaction with less than two minutes left is extended, so transactions built earlier in a job still land. A Tron broadcast the node rejects fails with the node's error code.

## HTTP Transport

For a local client that needs a URL, start the signer in HTTP mode. It accepts loopback `Host` headers only while bound to a loopback address, which blocks DNS rebinding from web pages. If you need an `https://` URL, provide TLS files (both, or the server does not start; `LOCAL_SIGNER_TLS_PASSPHRASE` unlocks an encrypted key):

```bash
LOCAL_SIGNER_TRANSPORT=streamable-http \
LOCAL_SIGNER_HOST=127.0.0.1 \
LOCAL_SIGNER_PORT=3333 \
LOCAL_SIGNER_TLS_CERT_PATH=/absolute/path/to/cert.pem \
LOCAL_SIGNER_TLS_KEY_PATH=/absolute/path/to/key.pem \
pnpm start
```

## Environment Patterns

EVM wallets:

- `LOCAL_SIGNER_EVM_PRIVATE_KEY` / `LOCAL_SIGNER_EVM_RPC_URL` — default pair, walletId `DEFAULT`
- `LOCAL_SIGNER_EVM_PRIVATE_KEY_<CHAIN>` / `LOCAL_SIGNER_EVM_RPC_URL_<CHAIN>` — one chain, walletId `<CHAIN>` (an upper-case chain symbol or a chain id); both are required
- `LOCAL_SIGNER_EVM_WALLET_<ID>_PRIVATE_KEY` / `_RPC_URL`, optional `_CHAIN_ID` / `_CHAIN_SYMBOL` — slots, walletId `<ID>`

Non-EVM families use slots for multiple wallets; both the key and the RPC are required. The default keys have the wallet ids `SOLANA_DEFAULT`, `TRX_DEFAULT`, `STX_DEFAULT` and `SRB_DEFAULT`. Write wallet ids in upper case:

- `LOCAL_SIGNER_SOL_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_SOL_WALLET_<walletId>_RPC_URL`
- `LOCAL_SIGNER_TRX_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_TRX_WALLET_<walletId>_RPC_URL`
- `LOCAL_SIGNER_STX_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_STX_WALLET_<walletId>_RPC_URL`
  - the signer probes the selected RPC via `/v2/info` and fails fast if the resolved mainnet/testnet network does not match the wallet address
- `LOCAL_SIGNER_SRB_WALLET_<walletId>_PRIVATE_KEY`
- `LOCAL_SIGNER_SRB_WALLET_<walletId>_RPC_URL`
- `LOCAL_SIGNER_SRB_WALLET_<walletId>_NETWORK_PASSPHRASE` (optional, falls back to `LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE`)

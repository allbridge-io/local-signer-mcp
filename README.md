# Local Signer MCP

`local-signer-mcp` is the local execution layer for transaction signing and broadcast.

It signs fully formed unsigned transactions for supported chain families and can optionally submit the signed payload. It does not plan bridge routes, quote transfers, or encode Allbridge protocol business logic.

- Repository: [github.com/allbridge-io/local-signer-mcp](https://github.com/allbridge-io/local-signer-mcp)
- Docker image: [allbridge/local-signer-mcp](https://hub.docker.com/repository/docker/allbridge/local-signer-mcp/tags?name=latest)
- End-to-end usage guide: [`docs/usage.md`](./docs/usage.md)
- Pairs with: [`allbridge-mcp`](https://github.com/allbridge-io/allbridge-mcp)

## What It Does

- Exposes configured local accounts to MCP clients
- Signs unsigned transactions for supported chain families
- Broadcasts signed transactions for supported chain families
- Supports one-step sign-and-broadcast
- Keeps wallet selection explicit when more than one account is configured

Supported chain families:

- EVM
- Solana
- Tron
- Stacks
- Soroban / Stellar

Transactions built by [`allbridge-mcp`](https://github.com/allbridge-io/allbridge-mcp) execution jobs are passed to the signer as is.

Unsigned Solana and Tron transactions are kept fresh at signing time: the signer replaces the Solana blockhash (unless the transaction is already partially signed or uses a durable nonce) and extends a Tron transaction that has less than two minutes left, so a transaction built a few minutes earlier still lands.

## Capability Boundary

`local-signer-mcp` owns signing and local wallet execution only.

It does not:

- discover routes
- quote bridge transfers
- build Allbridge execution jobs
- answer integration-documentation questions
- decide which bridge path a user should take

Those responsibilities belong to [`allbridge-mcp`](https://github.com/allbridge-io/allbridge-mcp) or another orchestration layer.

## Requirements

- Node.js 22.12+
- `pnpm`
- One or more private keys and RPC URLs configured through environment variables
- Optional: Docker, if you prefer a containerized local process

## Quick Start

```bash
pnpm install
pnpm build
pnpm start
```

The default transport is `stdio`, which is the right mode for local MCP clients such as Claude Desktop, Claude Code, Cursor, Windsurf, Continue, Zed, and Cline.

Minimal Claude Code registration:

```bash
claude mcp add local-signer \
  --env LOCAL_SIGNER_EVM_PRIVATE_KEY=<private-key> \
  --env LOCAL_SIGNER_EVM_RPC_URL=<rpc-url> \
  -- /absolute/path/to/node /absolute/path/to/local-signer-mcp/dist/index.js
```

More client recipes live in [`docs/client-integrations.md`](./docs/client-integrations.md).

## Configuration

Copy [`.env.example`](./.env.example) to `.env` for local development, or pass the same variables through the MCP client `env` block.

Common variables:

| Variable | Purpose |
|----------|---------|
| `LOCAL_SIGNER_TRANSPORT` | `stdio` or `streamable-http`; defaults to `stdio` |
| `LOCAL_SIGNER_HOST` | HTTP bind host when using `streamable-http` |
| `LOCAL_SIGNER_PORT` | HTTP bind port when using `streamable-http` |
| `LOCAL_SIGNER_TLS_CERT_PATH` | Optional TLS certificate path for HTTPS mode |
| `LOCAL_SIGNER_TLS_KEY_PATH` | Optional TLS private key path for HTTPS mode |
| `LOCAL_SIGNER_EVM_PRIVATE_KEY` | Default EVM private key |
| `LOCAL_SIGNER_EVM_RPC_URL` | Default EVM JSON-RPC URL |
| `LOCAL_SIGNER_SOL_PRIVATE_KEY` | Default Solana private key encoded as base58 |
| `LOCAL_SIGNER_SOL_RPC_URL` | Default Solana RPC URL |
| `LOCAL_SIGNER_TRX_PRIVATE_KEY` | Default Tron private key |
| `LOCAL_SIGNER_TRX_RPC_URL` | Default Tron full node URL |
| `LOCAL_SIGNER_STX_PRIVATE_KEY` | Default Stacks private key |
| `LOCAL_SIGNER_STX_RPC_URL` | Default Stacks node URL |
| `LOCAL_SIGNER_SRB_PRIVATE_KEY` | Default Soroban / Stellar secret key |
| `LOCAL_SIGNER_SRB_RPC_URL` | Default Soroban RPC URL |
| `LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE` | Soroban / Stellar network passphrase |

For multiple wallets, use wallet slots:

```env
LOCAL_SIGNER_EVM_WALLET_main_PRIVATE_KEY=<private-key>
LOCAL_SIGNER_EVM_WALLET_main_RPC_URL=<rpc-url>
LOCAL_SIGNER_EVM_WALLET_main_CHAIN_ID=1
LOCAL_SIGNER_EVM_WALLET_main_CHAIN_SYMBOL=ETH
```

Each non-EVM family follows the same slot shape:

```env
LOCAL_SIGNER_SOL_WALLET_main_PRIVATE_KEY=<private-key>
LOCAL_SIGNER_SOL_WALLET_main_RPC_URL=<rpc-url>
```

Do not commit `.env` files or private keys.

## Transport Modes

| Mode | Best for | Notes |
|------|----------|-------|
| `stdio` | Local MCP clients | No URL, no TLS, no network exposure |
| `streamable-http` | Remote MCP connectors or trusted proxy setups | Use TLS or a trusted edge if a client requires `https://` |

HTTP mode is unauthenticated. Bind it to `127.0.0.1` unless you intentionally expose it through a trusted tunnel or reverse proxy.

## Tools

- `get_wallet_capabilities`
- `get_accounts`
- `sign_transaction`
- `broadcast_transaction`
- `sign_and_broadcast_transaction`

Each tool returns structured output so agents can recover from missing wallet configuration, unsupported chain families, invalid payloads, or broadcast failures without guessing.

## Wallet Selection

When more than one wallet exists for a family, pass `walletId` explicitly.

For EVM, the signer resolves credentials in this order:

1. `walletId` on the transaction, if provided
2. `from` on the transaction, if provided
3. `LOCAL_SIGNER_EVM_WALLET_<walletId>_PRIVATE_KEY` / `LOCAL_SIGNER_EVM_WALLET_<walletId>_RPC_URL`
4. `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainSymbol>` / `LOCAL_SIGNER_EVM_RPC_URL_<chainSymbol>`
5. `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainId>` / `LOCAL_SIGNER_EVM_RPC_URL_<chainId>`
6. `LOCAL_SIGNER_EVM_PRIVATE_KEY` / `LOCAL_SIGNER_EVM_RPC_URL`

If the signer cannot choose a single wallet deterministically, it fails instead of guessing.

## Pairing With Allbridge MCP

The recommended split is:

1. `allbridge-mcp` plans the route and returns an execution job.
2. The client forwards the unsigned step to `local-signer-mcp`.
3. `local-signer-mcp` signs or signs-and-broadcasts the payload.
4. `allbridge-mcp` or the client tracks the transfer by source-chain transaction hash.

## Run

Development:

```bash
pnpm start:dev
```

Inspect locally:

```bash
pnpm inspect
```

Docker:

```bash
docker build -t local-signer-mcp .
docker run -i --rm \
  --env-file /absolute/path/to/local-signer.env \
  local-signer-mcp
```

Or pull the published image: `allbridge/local-signer-mcp:latest`.

## Documentation

- Documentation index: [`docs/README.md`](./docs/README.md)
- Usage guide: [`docs/usage.md`](./docs/usage.md)
- Client integration recipes: [`docs/client-integrations.md`](./docs/client-integrations.md)
- Runnable examples: [`examples/`](./examples)
- Agent skill note: [`SKILL.md`](./SKILL.md)

## Verification

```bash
pnpm build
pnpm test
```

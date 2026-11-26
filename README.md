# Local Signer MCP

`local-signer-mcp` is the local execution layer for transaction signing and broadcast.

It signs fully formed unsigned transactions for supported chain families and can optionally submit the signed payload. It does not plan bridge routes, quote transfers, or encode Allbridge protocol business logic.

- Repository: [github.com/allbridge-io/local-signer-mcp](https://github.com/allbridge-io/local-signer-mcp)
- npm: [`@allbridge/local-signer-mcp`](https://www.npmjs.com/package/@allbridge/local-signer-mcp) (`npx -y @allbridge/local-signer-mcp@1.1.0`)
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
- Sui

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
- `pnpm`, only to build from source (`npx` needs Node alone)
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

### Run with npx

The package ships a `local-signer-mcp` binary. Pin an exact version: this process holds private keys, so it should never pick up a new release on its own.

```bash
claude mcp add local-signer \
  --env LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB=<private-key> \
  --env LOCAL_SIGNER_EVM_RPC_URL_ARB=<rpc-url> \
  -- npx -y @allbridge/local-signer-mcp@1.1.0
```

```json
{
  "mcpServers": {
    "local-signer": {
      "command": "npx",
      "args": ["-y", "@allbridge/local-signer-mcp@1.1.0"],
      "env": { "LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB": "<private-key>", "LOCAL_SIGNER_EVM_RPC_URL_ARB": "<rpc-url>" }
    }
  }
}
```

More client recipes live in [`docs/client-integrations.md`](./docs/client-integrations.md).

## Configuration

Copy [`.env.example`](./.env.example) to `.env` for local development, or pass the same variables through the MCP client `env` block.

Common variables:

| Variable | Purpose |
|----------|---------|
| `LOCAL_SIGNER_TRANSPORT` | `stdio` or `streamable-http`; defaults to `stdio` |
| `LOCAL_SIGNER_HOST` | HTTP bind host when using `streamable-http`; defaults to `127.0.0.1` |
| `LOCAL_SIGNER_PORT` | HTTP bind port when using `streamable-http`; defaults to `3333` (`PORT` is a fallback) |
| `LOCAL_SIGNER_TLS_CERT_PATH` | Optional TLS certificate path for HTTPS mode (set together with the key) |
| `LOCAL_SIGNER_TLS_KEY_PATH` | Optional TLS private key path for HTTPS mode |
| `LOCAL_SIGNER_TLS_PASSPHRASE` | Optional passphrase of the TLS private key |
| `LOCAL_SIGNER_EVM_PRIVATE_KEY_<CHAIN>` | EVM private key for one chain (see [Wallet Selection](#wallet-selection)) |
| `LOCAL_SIGNER_EVM_RPC_URL_<CHAIN>` | EVM JSON-RPC URL for that chain; required with the key |
| `LOCAL_SIGNER_EVM_PRIVATE_KEY` | Default EVM private key, for chains without their own key |
| `LOCAL_SIGNER_EVM_RPC_URL` | Default EVM JSON-RPC URL, used only with the default key |
| `LOCAL_SIGNER_SOL_PRIVATE_KEY` | Default Solana private key encoded as base58 |
| `LOCAL_SIGNER_SOL_RPC_URL` | Default Solana RPC URL |
| `LOCAL_SIGNER_TRX_PRIVATE_KEY` | Default Tron private key |
| `LOCAL_SIGNER_TRX_RPC_URL` | Default Tron full node URL |
| `LOCAL_SIGNER_STX_PRIVATE_KEY` | Default Stacks private key |
| `LOCAL_SIGNER_STX_RPC_URL` | Default Stacks node URL |
| `LOCAL_SIGNER_SRB_PRIVATE_KEY` | Default Soroban / Stellar secret key |
| `LOCAL_SIGNER_SRB_RPC_URL` | Default Soroban RPC URL |
| `LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE` | Soroban / Stellar network passphrase |
| `LOCAL_SIGNER_SUI_PRIVATE_KEY` | Default Sui Ed25519 key: a `suiprivkey1…` string or a 32-byte hex secret key |
| `LOCAL_SIGNER_SUI_RPC_URL` | Default Sui full node: the gRPC-web base URL, such as `https://fullnode.mainnet.sui.io` (Sui nodes no longer serve JSON-RPC) |

For several wallets on one family, use wallet slots. The slot id becomes the `walletId`; write it, like the `<CHAIN>` suffixes, in upper case:

```env
LOCAL_SIGNER_EVM_WALLET_MAIN_PRIVATE_KEY=<private-key>
LOCAL_SIGNER_EVM_WALLET_MAIN_RPC_URL=<rpc-url>
LOCAL_SIGNER_EVM_WALLET_MAIN_CHAIN_ID=1
LOCAL_SIGNER_EVM_WALLET_MAIN_CHAIN_SYMBOL=ETH
```

Non-EVM slots take a private key and an RPC URL, both required (Stellar also accepts `_NETWORK_PASSPHRASE`, falling back to `LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE`):

```env
LOCAL_SIGNER_SOL_WALLET_MAIN_PRIVATE_KEY=<private-key>
LOCAL_SIGNER_SOL_WALLET_MAIN_RPC_URL=<rpc-url>
```

Wallet ids of the default keys: `DEFAULT` (EVM), `SOLANA_DEFAULT`, `TRX_DEFAULT`, `STX_DEFAULT`, `SRB_DEFAULT`, `SUI_DEFAULT`; a per-chain EVM key has the chain as its id (`ARB`). `get_accounts` lists them all.

`.env` is read from the working directory of the process, which for `npx` or a client launch is the client's directory, not the package's: pass the variables through the client `env` block instead. Do not commit `.env` files or private keys.

## Transport Modes

| Mode | Best for | Notes |
|------|----------|-------|
| `stdio` | Local MCP clients | No URL, no TLS, no network exposure |
| `streamable-http` | Clients on this machine that can only connect by URL | Use TLS if a client requires `https://` |

HTTP mode has no authentication: anyone who can reach the port can sign and broadcast with your keys. Keep the default `127.0.0.1` bind and never expose it to a network or a remote connector. On a loopback bind the server also rejects requests whose `Host` header is not a loopback name, which blocks DNS rebinding from web pages.

## Tools

- `get_wallet_capabilities`
- `get_accounts`
- `sign_transaction`
- `broadcast_transaction`
- `sign_and_broadcast_transaction`

Successful calls return `structuredContent`. Failures return a tool error whose message names the problem; when no wallet matches, it lists the configured wallets.

`broadcast_transaction` and `sign_and_broadcast_transaction` wait for the EVM receipt, the Solana confirmation and the Sui execution effects (a failed Sui transaction fails the call). Tron, Stacks and Stellar return right after the node accepts the transaction, so check confirmation another way (for a transfer, `allbridge-mcp` `get_transfer_status`) before a step that depends on it.

## Wallet Selection

EVM wallets come from three sources:

- the default pair `LOCAL_SIGNER_EVM_PRIVATE_KEY` + `LOCAL_SIGNER_EVM_RPC_URL` (walletId `DEFAULT`, serves every chain);
- per-chain pairs `LOCAL_SIGNER_EVM_PRIVATE_KEY_<CHAIN>` + `LOCAL_SIGNER_EVM_RPC_URL_<CHAIN>`. Both are required, and a per-chain key never uses the default RPC. `<CHAIN>` is an upper-case Allbridge chain symbol (`ETH`, `ARB`, `BAS`) or a numeric chain id, and becomes the walletId;
- slots `LOCAL_SIGNER_EVM_WALLET_<ID>_PRIVATE_KEY` / `_RPC_URL`, with optional `_CHAIN_ID` / `_CHAIN_SYMBOL`.

For each transaction the signer:

1. uses the wallet named by `walletId`, if given (it must still match the chain and `from`);
2. otherwise keeps the wallets whose chain matches the transaction (`chainId`, `chainSymbol`); a wallet without a chain matches every chain;
3. narrows them by `from`, if given;
4. prefers a wallet configured for the transaction's chain over one without a chain, so a per-chain key wins over the default pair;
5. fails unless exactly one wallet remains, instead of guessing.

Send `chainSymbol` with EVM transactions (`allbridge-mcp` jobs do). A symbol-scoped wallet such as `ARB` cannot be told apart from other chains by a bare `chainId`, so a transaction without `chainSymbol` may match it or end up ambiguous. When several wallets serve the same chain, pass `walletId`.

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


## Releasing

CI (`.github/workflows/ci.yml`) runs lint, tests and the build on every pull request and on every push to `master`. On a push to `master` it publishes `@allbridge/local-signer-mcp` to npm when the `version` in `package.json` is not on npm yet, then tags `v<version>` and creates a GitHub release.

To release, bump `version` in the pull request ([semver](https://semver.org): a patch for fixes, a minor for backward-compatible features, a major for breaking changes). Merging a pull request without a version bump publishes nothing.

Publishing uses npm trusted publishing (GitHub OIDC), so there is no npm token in the repository. One-time setup:

1. Publish the first version by hand from an account with access to the `@allbridge` organization: `npm publish --access public`.
2. On npmjs.com, open the package settings and add a trusted publisher: GitHub Actions, organization `allbridge-io`, repository `local-signer-mcp`, workflow `ci.yml`, environment `npm-registry`.
3. Create the `npm-registry` environment in the GitHub repository settings (optionally restricted to `master`).

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

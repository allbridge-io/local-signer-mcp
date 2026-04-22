# Local Signer MCP

`local-signer-mcp` is the local execution layer for transaction signing and broadcast.
It signs and submits fully formed unsigned transactions for supported chain families, but it does not know anything about bridge routes, quotes, or protocol-specific business logic.

Supported chain families:

- EVM
- Solana
- Tron
- Algorand
- Stacks
- Soroban / Stellar
- Sui

## What It Is For

Use `local-signer-mcp` when a workflow already has an unsigned transaction and needs one of these actions:

- sign locally
- broadcast a signed payload
- sign and broadcast in one step
- expose configured local accounts to an MCP client

This server is intentionally local-first. Private keys stay on the user’s machine unless the user explicitly decides to expose the HTTP transport behind a trusted proxy.

## Transport Modes

`local-signer-mcp` is supported in two launch shapes:

| Mode | Best for | Notes |
|------|----------|------|
| `stdio` | Claude Desktop, Claude Code, Cursor, Windsurf, Continue, Zed, Cline, and other local MCP clients | No URL, no TLS, no network exposure |
| `streamable-http` | Remote MCP connectors, hosted environments, or local tunneling/proxy setups | Use TLS if the client requires `https://` |

Default mode is `stdio`.

## Client Integration Patterns

### Which transport to use

- Use `stdio` when the MCP client can launch a local process on the same machine.
- Use `streamable-http` when the client only accepts a URL or runs outside the machine that holds the keys.
- Add TLS only when the client requires `https://`; otherwise keep the transport local and unexposed.

### Client matrix

| Client | Recommended mode | Config surface |
|--------|------------------|----------------|
| Claude Desktop | `stdio` | `Settings -> Developer -> Local MCP servers -> Edit Config` |
| Claude Code | `stdio` | `claude mcp add ...` |
| Cursor | `stdio` | `.cursor/mcp.json` or `~/.cursor/mcp.json` |
| Windsurf | `stdio` | `~/.codeium/windsurf/mcp_config.json` |
| Continue | `stdio` | `~/.continue/config.json` |
| Zed | `stdio` | `~/.config/zed/settings.json` |
| Cline | `stdio` | MCP settings JSON in the extension UI |
| Remote connector / hosted agent | `streamable-http` | URL-based MCP connector |

### Integration recipes

#### Claude Desktop

In Claude Desktop:

1. Open `Settings`
2. Go to `Developer`
3. Open `Local MCP servers`
4. Click `Edit Config`
5. Add `mcpServers` as a top-level key

Do not replace existing config. If the file already contains `preferences` or other keys, keep them and add `mcpServers` alongside them.
`mcpServers` is a registry, so you add one sibling entry per MCP server. If you already have other servers configured, keep them and add `local-signer` as an additional entry.
If the config already contains other MCP servers, do not overwrite them. Add one new `local-signer` entry next to the existing entries.
The editor opens the correct platform-specific config file for the desktop app, so you do not need to guess a filesystem path.

Field meanings:

- `mcpServers`: registry of local MCP servers
- `local-signer`: one server entry inside that registry
- `command`: executable to launch
- `args`: command-line arguments passed to the executable
- `env`: environment variables for the signer process

Node runtime guidance:

- use the exact Node binary that matches your local environment
- if you manage Node with `nvm`, `asdf`, or `volta`, prefer the absolute path to the selected binary instead of bare `node`
- on GUI clients, an explicit path is safer because the app may not inherit your shell PATH
- after selecting the desired version, run `which node` and use that absolute path in the config
- if you switch Node versions, update the `command` path to the new binary

Example of a minimal config file:

```json
{
  "mcpServers": {
    "local-signer": {
      "command": "/full/path/to/node",
      "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY": "0xyourprivatekey",
        "LOCAL_SIGNER_EVM_RPC_URL": "https://your-rpc.example"
      }
    }
  }
}
```

Example of merging into an existing file that already has `preferences`:

```json
{
  "preferences": {
    "quickEntryShortcut": "off"
  },
  "mcpServers": {
    "local-signer": {
      "command": "/full/path/to/node",
      "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY": "0xyourprivatekey",
        "LOCAL_SIGNER_EVM_RPC_URL": "https://your-rpc.example"
      }
    }
  }
}
```

#### Claude Code

Use the local CLI registration path:

```bash
claude mcp add local-signer \
  --env LOCAL_SIGNER_EVM_PRIVATE_KEY=0xyourprivatekey \
  --env LOCAL_SIGNER_EVM_RPC_URL=https://your-rpc.example \
  -- /full/path/to/node /absolute/path/to/local-signer-mcp/dist/index.js
```

#### Cursor

Use a project-level or user-level `mcp.json`:

```json
{
  "mcpServers": {
    "local-signer": {
      "command": "/full/path/to/node",
      "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
      "cwd": "/absolute/path/to/local-signer-mcp",
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY": "0xyourprivatekey",
        "LOCAL_SIGNER_EVM_RPC_URL": "https://your-rpc.example"
      }
    }
  }
}
```

#### Windsurf

Use the same command-based local transport:

```json
{
  "mcpServers": {
    "local-signer": {
      "command": "/full/path/to/node",
      "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY": "0xyourprivatekey",
        "LOCAL_SIGNER_EVM_RPC_URL": "https://your-rpc.example"
      }
    }
  }
}
```

#### Continue

Use the user config with a command-based entry:

```json
{
  "mcpServers": [
    {
      "name": "local-signer",
      "command": "/full/path/to/node",
      "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY": "0xyourprivatekey",
        "LOCAL_SIGNER_EVM_RPC_URL": "https://your-rpc.example"
      }
    }
  ]
}
```

#### Zed

Use a local command with environment variables:

```json
{
  "context_servers": {
    "local-signer": {
      "command": {
        "path": "/full/path/to/node",
        "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
        "env": {
          "LOCAL_SIGNER_EVM_PRIVATE_KEY": "0xyourprivatekey",
          "LOCAL_SIGNER_EVM_RPC_URL": "https://your-rpc.example"
        }
      }
    }
  }
}
```

#### Cline

Use the MCP settings UI and paste a standard local command config:

```json
{
  "mcpServers": {
    "local-signer": {
      "command": "/full/path/to/node",
      "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY": "0xyourprivatekey",
        "LOCAL_SIGNER_EVM_RPC_URL": "https://your-rpc.example"
      }
    }
  }
}
```

#### Remote connector / hosted agent

Use HTTP mode only when the client cannot launch a local process:

```json
{
  "mcpServers": {
    "local-signer": {
      "url": "https://your-signer.example.com/mcp"
    }
  }
}
```

If the client requires `https://`, terminate TLS at the proxy or provide TLS files to the signer process as described below.

### Local MCP clients

Use a command-based config when the client can launch a local process. This is the preferred setup for:

- Claude Desktop
- Claude Code
- Cursor
- Windsurf
- Continue
- Zed
- Cline
- other MCP clients that support local process launch

The repo includes editable examples:

- Claude Code: [`examples/claude-code.md`](./examples/claude-code.md)
- Cursor: [`examples/cursor.mcp.json`](./examples/cursor.mcp.json)

### Remote connectors

Use `streamable-http` only when the client requires a URL. If the client insists on `https://`, add TLS to the HTTP transport or place the signer behind a trusted proxy that terminates TLS.

For Claude Desktop, use the local config file for stdio mode. Use the built-in connector UI only when you are intentionally connecting to a remote `https://` endpoint.

### Agent handoff model

The recommended split is:

1. `allbridge-mcp` plans the route and returns an execution job.
2. `local-signer-mcp` signs the unsigned step locally.
3. `allbridge-mcp` or the client broadcasts the signed payload, depending on the flow.

## Features

- Exposes the configured local accounts for supported chain families
- Signs unsigned transactions for supported chain families
- Broadcasts signed transactions for supported chain families
- Supports one-step sign-and-broadcast

## Tools

- `get_wallet_capabilities`
- `get_accounts`
- `sign_transaction`
- `broadcast_transaction`
- `sign_and_broadcast_transaction`

## Wallet Selection Model

Each supported family uses the same wallet registry pattern:

- pass `walletId` when more than one wallet exists for a family
- if only one wallet is configured for a family, it can be selected automatically
- EVM also supports `from` as an additional selector
- EVM keeps chain-symbol, chain-id, and wallet-slot fallbacks for compatibility

### EVM selection order

For EVM, the signer resolves credentials in this order:

1. `walletId` on the transaction, if provided
2. `from` on the transaction, if provided
3. `LOCAL_SIGNER_EVM_WALLET_<walletId>_PRIVATE_KEY` / `LOCAL_SIGNER_EVM_WALLET_<walletId>_RPC_URL`
4. `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainSymbol>` / `LOCAL_SIGNER_EVM_RPC_URL_<chainSymbol>`
5. `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainId>` / `LOCAL_SIGNER_EVM_RPC_URL_<chainId>`
6. `LOCAL_SIGNER_EVM_PRIVATE_KEY` / `LOCAL_SIGNER_EVM_RPC_URL`

When multiple wallets exist for the same EVM chain, set `walletId` or `from` explicitly. If the signer cannot choose a single wallet deterministically, it fails instead of guessing.

For Solana, Tron, Algorand, Stacks, Soroban / Stellar, and Sui, set `walletId` explicitly when more than one wallet is configured for that family.

## Configuration

Copy [`.env.example`](./.env.example) to `.env` if needed.

### Transport

- `LOCAL_SIGNER_TRANSPORT`: `stdio` or `streamable-http`
- `LOCAL_SIGNER_HOST`: Bind host for HTTP mode
- `LOCAL_SIGNER_PORT`: Bind port for HTTP mode
- `LOCAL_SIGNER_TLS_CERT_PATH`: Optional TLS certificate path for HTTPS mode
- `LOCAL_SIGNER_TLS_KEY_PATH`: Optional TLS private key path for HTTPS mode
- `LOCAL_SIGNER_TLS_PASSPHRASE`: Optional TLS private key passphrase

### EVM

- `LOCAL_SIGNER_EVM_PRIVATE_KEY`: Default EVM private key, with or without `0x`
- `LOCAL_SIGNER_EVM_RPC_URL`: Default EVM JSON-RPC URL used for nonce, fee data, and broadcasting
- `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainSymbol>` or `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainId>`: Optional scoped EVM private key overrides per chain
- `LOCAL_SIGNER_EVM_RPC_URL_<chainSymbol>` or `LOCAL_SIGNER_EVM_RPC_URL_<chainId>`: Optional scoped EVM RPC overrides per chain
- `LOCAL_SIGNER_EVM_WALLET_<walletId>_PRIVATE_KEY`: Optional EVM wallet slot private key
- `LOCAL_SIGNER_EVM_WALLET_<walletId>_RPC_URL`: Optional EVM wallet slot RPC URL
- `LOCAL_SIGNER_EVM_WALLET_<walletId>_CHAIN_ID`: Optional EVM wallet slot chain id
- `LOCAL_SIGNER_EVM_WALLET_<walletId>_CHAIN_SYMBOL`: Optional EVM wallet slot chain symbol

### Solana

- `LOCAL_SIGNER_SOL_PRIVATE_KEY`: Default Solana private key encoded as base58
- `LOCAL_SIGNER_SOL_RPC_URL`: Default Solana RPC URL
- `LOCAL_SIGNER_SOL_WALLET_<walletId>_PRIVATE_KEY`: Optional Solana wallet slot private key
- `LOCAL_SIGNER_SOL_WALLET_<walletId>_RPC_URL`: Optional Solana wallet slot RPC URL

### Tron

- `LOCAL_SIGNER_TRX_PRIVATE_KEY`: Default Tron private key
- `LOCAL_SIGNER_TRX_RPC_URL`: Default Tron full node URL
- `LOCAL_SIGNER_TRX_WALLET_<walletId>_PRIVATE_KEY`: Optional Tron wallet slot private key
- `LOCAL_SIGNER_TRX_WALLET_<walletId>_RPC_URL`: Optional Tron wallet slot RPC URL

### Algorand

- `LOCAL_SIGNER_ALG_PRIVATE_KEY`: Default Algorand secret key encoded as hex
- `LOCAL_SIGNER_ALG_RPC_URL`: Default Algorand algod URL
- `LOCAL_SIGNER_ALG_WALLET_<walletId>_PRIVATE_KEY`: Optional Algorand wallet slot private key
- `LOCAL_SIGNER_ALG_WALLET_<walletId>_RPC_URL`: Optional Algorand wallet slot RPC URL

### Stacks

- `LOCAL_SIGNER_STX_PRIVATE_KEY`: Default Stacks private key
- `LOCAL_SIGNER_STX_RPC_URL`: Default Stacks node URL
- `LOCAL_SIGNER_STX_WALLET_<walletId>_PRIVATE_KEY`: Optional Stacks wallet slot private key
- `LOCAL_SIGNER_STX_WALLET_<walletId>_RPC_URL`: Optional Stacks wallet slot RPC URL

The signer probes the selected Stacks RPC via `/v2/info` and rejects mainnet/testnet mismatches before signing or broadcasting.

### Soroban / Stellar

- `LOCAL_SIGNER_SRB_PRIVATE_KEY`: Default Soroban / Stellar secret key
- `LOCAL_SIGNER_SRB_RPC_URL`: Default Soroban RPC URL
- `LOCAL_SIGNER_SRB_NETWORK_PASSPHRASE`: Default Soroban network passphrase
- `LOCAL_SIGNER_SRB_WALLET_<walletId>_PRIVATE_KEY`: Optional Soroban / Stellar wallet slot private key
- `LOCAL_SIGNER_SRB_WALLET_<walletId>_RPC_URL`: Optional Soroban wallet slot RPC URL
- `LOCAL_SIGNER_SRB_WALLET_<walletId>_NETWORK_PASSPHRASE`: Optional Soroban wallet slot network passphrase

### Sui

- `LOCAL_SIGNER_SUI_PRIVATE_KEY`: Default Sui private key
- `LOCAL_SIGNER_SUI_RPC_URL`: Default Sui RPC URL
- `LOCAL_SIGNER_SUI_WALLET_<walletId>_PRIVATE_KEY`: Optional Sui wallet slot private key
- `LOCAL_SIGNER_SUI_WALLET_<walletId>_RPC_URL`: Optional Sui wallet slot RPC URL

## Run

```bash
pnpm start
```

For local development:

```bash
pnpm start:dev
```

For local inspection:

```bash
pnpm inspect
```

## Transport Examples

### Stdio

This is the default mode:

```bash
pnpm start
```

### HTTP

For a remote-capable connector or a local proxy setup:

```bash
LOCAL_SIGNER_TRANSPORT=streamable-http \
LOCAL_SIGNER_HOST=127.0.0.1 \
LOCAL_SIGNER_PORT=3333 \
pnpm start
```

### HTTPS

If the client requires `https://`, provide TLS material:

```bash
LOCAL_SIGNER_TRANSPORT=streamable-http \
LOCAL_SIGNER_HOST=127.0.0.1 \
LOCAL_SIGNER_PORT=3333 \
LOCAL_SIGNER_TLS_CERT_PATH=/absolute/path/to/cert.pem \
LOCAL_SIGNER_TLS_KEY_PATH=/absolute/path/to/key.pem \
pnpm start
```

Use `0.0.0.0` for `LOCAL_SIGNER_HOST` only when the server is exposed through a tunnel or reverse proxy you trust. HTTP mode is unauthenticated.

### Docker

Run the same entrypoint in a container:

```bash
docker build -t local-signer-mcp .
docker run -i --rm \
  -e LOCAL_SIGNER_EVM_PRIVATE_KEY=0xyourprivatekey \
  -e LOCAL_SIGNER_EVM_RPC_URL=https://your-rpc.example \
  local-signer-mcp
```

To expose the HTTP transport from Docker, add `LOCAL_SIGNER_TRANSPORT=streamable-http` and the matching host/port/TLS variables at `docker run` time.

## Documentation

- GitBook entrypoint: [`docs/gitbook/ai/README.md`](./docs/gitbook/ai/README.md)
- GitBook summary: [`docs/gitbook/ai/SUMMARY.md`](./docs/gitbook/ai/SUMMARY.md)
- Workflow guide: [`docs/usage.md`](./docs/usage.md)
- Skills note: [`SKILL.md`](./SKILL.md)

## Examples

- Claude Code config: [`examples/claude-code.md`](./examples/claude-code.md)
- Cursor config: [`examples/cursor.mcp.json`](./examples/cursor.mcp.json)
- Tool usage: [`examples/tool-usage.md`](./examples/tool-usage.md)

## Verification

```bash
pnpm build
pnpm test
```

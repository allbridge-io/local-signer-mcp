# Client Integrations

Use `stdio` whenever the MCP client can launch a local process on the same machine as the private keys. Use `streamable-http` only when the client requires a URL.

## Path Or npx

The recipes below start a local checkout (`node /absolute/path/to/local-signer-mcp/dist/index.js`). To run the published package, replace the command with `npx` and pin an exact version, since this process holds private keys:

```json
{ "command": "npx", "args": ["-y", "@allbridge/local-signer-mcp@0.2.0"] }
```

The `env` block stays the same. Set a key and an RPC per EVM chain (`LOCAL_SIGNER_EVM_PRIVATE_KEY_<CHAIN>`, `LOCAL_SIGNER_EVM_RPC_URL_<CHAIN>`); with only the defaults, every EVM chain uses the same RPC.

## Codex

In `~/.codex/config.toml` (keep the file readable only by you: `chmod 600`):

```toml
[mcp_servers.local-signer]
command = "npx"
args = ["-y", "@allbridge/local-signer-mcp@0.2.0"]

[mcp_servers.local-signer.env]
LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB = "<private-key>"
LOCAL_SIGNER_EVM_RPC_URL_ARB = "<rpc-url>"
```

## Claude Desktop

Open `Settings` -> `Developer` -> `Local MCP servers` -> `Edit Config`, then merge this entry into the existing JSON.

Do not replace existing `preferences` or other MCP server entries.

```json
{
  "mcpServers": {
    "local-signer": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY": "<private-key>",
        "LOCAL_SIGNER_EVM_RPC_URL": "<rpc-url>"
      }
    }
  }
}
```

For GUI clients, prefer an absolute Node path. If you use `nvm`, `asdf`, or `volta`, run `which node` after selecting the intended version and use that path in `command`.

## Claude Code

```bash
claude mcp add local-signer \
  --env LOCAL_SIGNER_EVM_PRIVATE_KEY=<private-key> \
  --env LOCAL_SIGNER_EVM_RPC_URL=<rpc-url> \
  -- /absolute/path/to/node /absolute/path/to/local-signer-mcp/dist/index.js
```

## Cursor

Save as `~/.cursor/mcp.json` or project-level `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "local-signer": {
      "command": "/absolute/path/to/node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/local-signer-mcp",
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY": "<private-key>",
        "LOCAL_SIGNER_EVM_RPC_URL": "<rpc-url>"
      }
    }
  }
}
```

## Docker Wrapper

Use this shape when the client can launch `docker` and you want the signer to run in a container while still speaking MCP over `stdio`.

Keep the env file on the host and do not commit it.

```json
{
  "mcpServers": {
    "local-signer": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--env-file",
        "/absolute/path/to/local-signer.env",
        "allbridge/local-signer-mcp:latest",
        "node",
        "dist/index.js"
      ],
      "env": {}
    }
  }
}
```

## Remote Connector

Use HTTP mode only when the client cannot launch a local process.

```json
{
  "mcpServers": {
    "local-signer": {
      "url": "https://your-signer.example.com/mcp"
    }
  }
}
```

If a client requires `https://`, terminate TLS at a trusted proxy or provide TLS files to the signer process.

## Pairing With Allbridge MCP

A client can register both servers side by side:

```json
{
  "mcpServers": {
    "allbridge": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/allbridge-mcp/dist/index.js"],
      "env": {
        "ALLBRIDGE_API_BASE_URL": "http://127.0.0.1:3000"
      }
    },
    "local-signer": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY": "<private-key>",
        "LOCAL_SIGNER_EVM_RPC_URL": "<rpc-url>"
      }
    }
  }
}
```

Keep orchestration and signing separate: `allbridge-mcp` plans and tracks, while `local-signer-mcp` signs the unsigned execution step.

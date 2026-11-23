# Client Integrations

Use `stdio` whenever the MCP client can launch a local process on the same machine as the private keys. Use `streamable-http` only when the client requires a URL.

## Path Or npx

The recipes below start a local checkout (`node /absolute/path/to/local-signer-mcp/dist/index.js`). To run the published package, replace the command with `npx` and pin an exact version, since this process holds private keys:

```json
{ "command": "npx", "args": ["-y", "@allbridge/local-signer-mcp@1.0.0"] }
```

The `env` block stays the same. The recipes below configure one EVM chain (`ARB`); add a key and an RPC for every EVM chain you send from (`LOCAL_SIGNER_EVM_PRIVATE_KEY_<CHAIN>`, `LOCAL_SIGNER_EVM_RPC_URL_<CHAIN>`, `<CHAIN>` an upper-case Allbridge chain symbol). The default pair `LOCAL_SIGNER_EVM_PRIVATE_KEY` / `LOCAL_SIGNER_EVM_RPC_URL` serves the chains without their own key, through that single RPC.

## Codex

In `~/.codex/config.toml` (keep the file readable only by you: `chmod 600`):

```toml
[mcp_servers.local-signer]
command = "npx"
args = ["-y", "@allbridge/local-signer-mcp@1.0.0"]

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
        "LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB": "<private-key>",
        "LOCAL_SIGNER_EVM_RPC_URL_ARB": "<arbitrum-rpc-url>"
      }
    }
  }
}
```

For GUI clients, prefer an absolute Node path. If you use `nvm`, `asdf`, or `volta`, run `which node` after selecting the intended version and use that path in `command`.

## Claude Code

```bash
claude mcp add local-signer \
  --env LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB=<private-key> \
  --env LOCAL_SIGNER_EVM_RPC_URL_ARB=<arbitrum-rpc-url> \
  -- /absolute/path/to/node /absolute/path/to/local-signer-mcp/dist/index.js
```

## Cursor

Save as `~/.cursor/mcp.json` or project-level `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "local-signer": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/local-signer-mcp/dist/index.js"],
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB": "<private-key>",
        "LOCAL_SIGNER_EVM_RPC_URL_ARB": "<arbitrum-rpc-url>"
      }
    }
  }
}
```

## Docker Wrapper

Use this shape when the client can launch `docker` and you want the signer to run in a container while still speaking MCP over `stdio`.

Build the image first with `docker build -t local-signer-mcp .` in the repository. Keep the env file on the host and do not commit it.

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
        "local-signer-mcp"
      ],
      "env": {}
    }
  }
}
```

## No Remote Connector

Do not register the signer as a remote connector (a `url` entry). Its HTTP mode has no authentication, so anything that can reach the URL can sign and broadcast with your keys. Clients that only accept URLs (claude.ai, ChatGPT) can use `allbridge-mcp` for planning and tracking, and sign elsewhere.

## Pairing With Allbridge MCP

A client can register both servers side by side:

```json
{
  "mcpServers": {
    "allbridge": {
      "command": "npx",
      "args": ["-y", "@allbridge/allbridge-mcp@1.0.0"]
    },
    "local-signer": {
      "command": "npx",
      "args": ["-y", "@allbridge/local-signer-mcp@1.0.0"],
      "env": {
        "LOCAL_SIGNER_EVM_PRIVATE_KEY_ETH": "<private-key>",
        "LOCAL_SIGNER_EVM_RPC_URL_ETH": "<ethereum-rpc-url>",
        "LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB": "<private-key>",
        "LOCAL_SIGNER_EVM_RPC_URL_ARB": "<arbitrum-rpc-url>"
      }
    }
  }
}
```

Keep orchestration and signing separate: `allbridge-mcp` plans and tracks, while `local-signer-mcp` signs the unsigned execution step.

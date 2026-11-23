# Claude Code Example

Use the local stdio transport: Claude Code launches the signer on the same machine. Give it a key and an RPC per EVM chain you send from.

Published package:

```bash
claude mcp add local-signer \
  --env LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB=0xyourprivatekey \
  --env LOCAL_SIGNER_EVM_RPC_URL_ARB=https://your-arbitrum-rpc.example \
  -- npx -y @allbridge/local-signer-mcp@0.2.0
```

Local checkout (after `pnpm build`):

```bash
claude mcp add local-signer \
  --env LOCAL_SIGNER_EVM_PRIVATE_KEY_ARB=0xyourprivatekey \
  --env LOCAL_SIGNER_EVM_RPC_URL_ARB=https://your-arbitrum-rpc.example \
  -- /full/path/to/node /absolute/path/to/local-signer-mcp/dist/index.js
```

Do not register the signer as a remote connector: its HTTP mode has no authentication (see [`../docs/usage.md`](../docs/usage.md#http-transport)).

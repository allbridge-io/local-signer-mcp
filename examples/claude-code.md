# Claude Code Example

Use the local stdio transport when Claude Code runs on the same machine as the signer.

```bash
claude mcp add local-signer \
  --env LOCAL_SIGNER_EVM_PRIVATE_KEY=0xyourprivatekey \
  --env LOCAL_SIGNER_EVM_RPC_URL=https://your-rpc.example \
  -- /full/path/to/node /absolute/path/to/local-signer-mcp/dist/index.js
```

If you need a remote connector URL instead, start the signer in `streamable-http` mode and add TLS as described in the main README.

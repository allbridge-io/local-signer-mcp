# Local Signer Flow

Use this MCP server as a local signer and broadcaster for supported chain families.

## When To Use

Use `local-signer-mcp` when a workflow already contains an unsigned transaction and needs:

- local account discovery
- local signing
- local broadcast

Do not use it for route selection, quoting, or protocol planning.

## Default Workflow

1. Call `get_wallet_capabilities`
2. Call `get_accounts` when the workflow needs the local sender address
3. Call either:
   - `sign_transaction` and then `broadcast_transaction`
   - or `sign_and_broadcast_transaction`

## Rules

- Always include `chainFamily` in transaction payloads. Supported families: `EVM`, `SOLANA`, `TRX`, `STX`, `SRB`.
- Steps of an `allbridge-mcp` execution job are already in this shape: pass `step.transaction` as is, in step order, waiting for steps marked `waitForConfirmation` to confirm.
- Only pass fully formed unsigned transaction payloads.
- Use `sign_transaction` when the caller wants to inspect or store the signed payload before broadcast.
- Use `sign_and_broadcast_transaction` when the caller wants a single-step execution path.
- Keep this server local. It is not meant to expose keys on a shared remote deployment.
- For EVM, resolve credentials by `walletId` or `from` first when present, then by slot-scoped EVM envs, then by `chainSymbol`, then by `chainId`, then by the default EVM env vars.

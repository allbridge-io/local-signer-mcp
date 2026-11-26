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
   - `sign_and_broadcast_transaction`, the usual path;
   - or `sign_transaction`, then `broadcast_transaction` with the returned `signedTransaction` object unchanged.

## Rules

- Always include `chainFamily` in transaction payloads. Supported families: `EVM`, `SOLANA`, `TRX`, `STX`, `SRB`, `SUI`.
- Steps of an `allbridge-mcp` execution job are already in this shape: pass `step.transaction` as is, in step order, waiting for steps marked `waitForConfirmation` to confirm. The signer waits for EVM receipts, Solana confirmations and Sui execution effects itself; Tron, Stacks and Stellar broadcasts return once the node accepts them, so confirm those another way (for example `allbridge-mcp` `get_transfer_status`, or the chain explorer) before the next step.
- Only pass fully formed unsigned transaction payloads.
- Use `sign_transaction` when the caller wants to inspect or store the signed payload before broadcast.
- Use `sign_and_broadcast_transaction` when the caller wants a single-step execution path.
- Keep this server local. Its HTTP mode has no authentication, so never expose it to a network or a remote connector.
- EVM wallet choice: `walletId` wins when given. Otherwise the signer keeps the wallets matching the transaction chain and `from`, prefers one configured for that chain (a per-chain key) over the default key, and fails if that still leaves more than one. Pass `walletId` (from `get_accounts`) when several wallets serve the same chain.

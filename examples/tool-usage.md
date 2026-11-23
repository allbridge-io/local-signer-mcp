# Tool Usage Examples

## 1. Inspect wallet capabilities

Request:

```json
{
  "name": "get_wallet_capabilities",
  "arguments": {}
}
```

Expected result:

- whether a wallet is configured
- supported chain families
- wallet identifiers
- default address

## 2. Sign a transaction

Request (with `LOCAL_SIGNER_EVM_PRIVATE_KEY_ETH` / `LOCAL_SIGNER_EVM_RPC_URL_ETH` configured, walletId `ETH`):

```json
{
  "name": "sign_transaction",
  "arguments": {
    "chainFamily": "EVM",
    "chainId": 1,
    "chainSymbol": "ETH",
    "walletId": "ETH",
    "to": "0x1111111111111111111111111111111111111111",
    "data": "0x1234",
    "value": "0"
  }
}
```

Expected result:

- `chainFamily`, `walletId`, `walletAddress`, `chainId`, `chainSymbol`
- `signedTransaction`: `{ chainFamily, chainId, chainSymbol, walletId, signedTransaction }`, the input of `broadcast_transaction`

## 3. Sign and broadcast a Solana transaction

Request (the default Solana key has the walletId `SOLANA_DEFAULT`; a slot `LOCAL_SIGNER_SOL_WALLET_MAIN_*` would be `MAIN`):

```json
{
  "name": "sign_and_broadcast_transaction",
  "arguments": {
    "chainFamily": "SOLANA",
    "walletId": "SOLANA_DEFAULT",
    "serializedTransactionHex": "deadbeef"
  }
}
```

Expected result:

- `signResult`: as in step 2, with `signedTransaction.signedTransactionHex`
- `broadcastResult`: `{ chainFamily, txHash, receipt }` (`receipt` is `null` for Solana)

## 4. Broadcast a signed transaction

Request: the `signedTransaction` object from `sign_transaction`, unchanged.

```json
{
  "name": "broadcast_transaction",
  "arguments": {
    "chainFamily": "EVM",
    "chainId": 1,
    "chainSymbol": "ETH",
    "walletId": "ETH",
    "signedTransaction": "0xdeadbeef"
  }
}
```

Expected result: `chainFamily`, `txHash`, `receipt`.

## Payloads by family

| `chainFamily` | Unsigned input | Signed input of `broadcast_transaction` |
|---------------|----------------|------------------------------------------|
| `EVM` | `chainId`, `chainSymbol`, `from`, `to`, `data`, `value` | `signedTransaction` (hex) |
| `SOLANA` | `serializedTransactionHex` | `signedTransactionHex` |
| `TRX` | `rawTransaction` (object) | `signedTransaction` (object) |
| `STX` | `serializedTransactionHex` | `signedTransactionHex` |
| `SRB` | `serializedTransactionXdr` | `signedTransactionXdr` |

Requirements:

- configure a wallet and RPC for the family; pass `walletId` when more than one wallet can match
- for EVM, a per-chain key (`LOCAL_SIGNER_EVM_PRIVATE_KEY_<CHAIN>` with `LOCAL_SIGNER_EVM_RPC_URL_<CHAIN>`) wins over the default pair for its chain; see the README "Wallet Selection" section

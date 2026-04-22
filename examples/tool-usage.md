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

Request:

```json
{
  "name": "sign_transaction",
  "arguments": {
    "chainFamily": "EVM",
    "chainId": 11155111,
    "chainSymbol": "ETH",
    "walletId": "MAINNET",
    "to": "0xcontract",
    "data": "0x1234",
    "value": "0"
  }
}
```

Expected result:

- `from`
- `walletId`
- `nonce`
- `signedTransaction`
- prepared transaction fields used for signing

## 3. Sign and broadcast a Solana transaction

Request:

```json
{
  "name": "sign_and_broadcast_transaction",
  "arguments": {
    "chainFamily": "SOLANA",
    "walletId": "SOLANA_MAIN",
    "serializedTransactionHex": "deadbeef"
  }
}
```

Expected result:

- `txHash`
- `walletId`
- signed payload
- broadcast result

## 4. Broadcast a signed transaction

Request:

```json
{
  "name": "broadcast_transaction",
  "arguments": {
    "chainFamily": "EVM",
    "chainId": 11155111,
    "chainSymbol": "ETH",
    "walletId": "MAINNET",
    "signedTransaction": "0xdeadbeef"
  }
}
```

Expected result:

- `txHash`
- `walletId`
- `receipt`

Requirements:

- configure the matching wallet and RPC for the selected family via `walletId` or the single-wallet fallback
- for EVM, `from`, `LOCAL_SIGNER_EVM_WALLET_<walletId>_PRIVATE_KEY`, `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainSymbol>`, `LOCAL_SIGNER_EVM_PRIVATE_KEY_<chainId>`, or the default `LOCAL_SIGNER_EVM_PRIVATE_KEY` still work
- the same `chainFamily`-specific payload shape applies to all supported families

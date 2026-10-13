# Mobile Money — Overview

The Moko Mobile Money API lets you collect funds from a customer's mobile wallet (**Collection / Deposit**) and pay out to a customer's mobile wallet (**Withdrawal / Payout**).

A single URL and a single content-type header, with operations distinguished by the `action` field in the body.

## Single endpoint

```
POST https://api.gofreshpay.com/api/v1/gateway
Content-Type: application/json
```

The `action` field determines the operation:

| `action` | Direction | Docs |
|---|---|---|
| `debit` | Collection — customer → merchant (STK Push) | [Collection](/en/mobile-money/collection) |
| `credit` | Withdrawal — merchant → customer (payout) | [Withdrawal](/en/mobile-money/withdrawal) |
| `verify` | Look up a transaction's status | [Verify](/en/mobile-money/verify) |

## Supported operators

The `method` field in the body:

| `method` | Operator |
|---|---|
| `mpesa` | M-Pesa (Vodacom) |
| `orange` | Orange Money |
| `airtel` | Airtel Money |
| `afrimoney` | Afrimoney (Africell) |

## Currencies

- `CDF` — Congolese franc
- `USD` — US dollar

## Customer phone number format

International format without `+` or spaces: `243XXXXXXXXX` (12 digits for the DRC).

Example: `243970000000`.

## Auth

The MM API uses **body-based** authentication — there is no HMAC header. You include your credentials directly in the body:

- `merchant_id` (merchant identifier)
- `merchant_secrete` (**note the spelling**, with an `e` at the end — not `merchant_secret`)

::: warning
The `merchant_secrete` spelling is intentional on the MM API — it is the legacy field name. Don't confuse it with `merchant_secret` from the Card API.
:::

Get your credentials from `henock.barakael@mokoafrika.com` (sandbox), then on request for production.

## Asynchronous flow

All MM operations are **asynchronous**:

1. You send `POST /api/v1/gateway`
2. You immediately receive a `200 OK` response with `Status: "Success"` = **transaction created**, NOT paid
3. The customer completes the operation on their phone (STK Push, enters their PIN)
4. The operator processes the transaction
5. Moko POSTs a **webhook** to your `callback_url` with `Trans_Status = Successful | Failed | Pending`

The `Status` field in the initial response only indicates that the request was accepted. The actual result arrives in the webhook via `Trans_Status`. See [Webhooks](/en/mobile-money/webhooks).

## Page structure

- **[Collection (Deposit)](/en/mobile-money/collection)** — collect funds from a customer
- **[Withdrawal (Payout)](/en/mobile-money/withdrawal)** — pay out to a customer
- **[Verify](/en/mobile-money/verify)** — check status by reference
- **[Webhooks](/en/mobile-money/webhooks)** — callback format + retry policy + signature

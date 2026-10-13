# Hosted Checkout (UC)

The simplest mode: your backend creates a payment, Moko returns a checkout URL, and you redirect the customer.

## Flow

```
1. Customer clicks "Pay by card" on your site
2. Your backend → POST /api/v1/payment/orders (HMAC-signed)
3. Moko responds with { data: { links, transaction_uuid, transaction_status, ... } }
4. Your site redirects the customer to data.links
5. Customer enters their card on the Moko page (Cybersource Unified Checkout SDK)
6. 3DS Payer Authentication (frictionless or OTP challenge)
7. Cybersource performs auth + capture
8. Customer redirected to return_url?status=SUCCESS&... (or ?status=FAILED&...)
9. Signed webhook POSTed to callback_url (async, source of truth)
```

## Endpoint

`POST /api/v1/payment/orders`
Auth: HMAC ([see Authentication](/en/authentication))

## Request body

Based on the `PaymentInitiationRequest` Pydantic model.

```json
{
  "amount": 1.00,
  "currency": "USD",
  "merchant_reference": "INV-042",
  "callback_url": "https://your-shop.com/webhooks/moko",
  "bill_to_forename": "Jean",
  "bill_to_surname": "Kabala",
  "bill_to_email": "client@example.com",
  "bill_to_phone": "+243812345001",
  "bill_to_address_line1": "Av. Kasa-Vubu 42",
  "bill_to_address_city": "Kinshasa",
  "bill_to_address_country": "CD",
  "bill_to_address_state": null,
  "bill_to_address_postal_code": null,
  "return_url": "https://your-shop.com/order/INV-042",
  "redirect_url": null,
  "cancel_url": "https://your-shop.com/order/INV-042/cancelled"
}
```

### Fields

| Field | Type | Required | Constraints |
|---|---|---|---|
| `amount` | float | ✅ | > 0. Min USD 1.00 / CDF 500.00 |
| `currency` | string | ✅ | `USD` or `CDF` only |
| `merchant_reference` | string | ✅ | Min 1 char |
| `callback_url` | string | ✅ | Webhook events URL |
| `bill_to_forename` | string | ✅ | Min 1 char |
| `bill_to_surname` | string | ✅ | Min 1 char |
| `bill_to_email` | string | ✅ | Regex `^[^@]+@[^@]+\.[^@]+$`, lowercased server-side |
| `bill_to_phone` | string | ✅ | 5-20 chars, regex `^[\d\+][\d\s\-\(\)]+$`. Normalized to E.164 server-side. |
| `bill_to_address_line1` | string | ✅ | |
| `bill_to_address_city` | string | ✅ | |
| `bill_to_address_country` | string | ✅ | ISO 3166-1 alpha-2, uppercased server-side |
| `bill_to_address_state` | string | conditional | Required for US/CA (2 chars) |
| `bill_to_address_postal_code` | string | conditional | Required for US/CA. US format: `12345` or `12345-6789`. CA format: `A1A1A1`. |
| `return_url` | string | | Post-payment return URL. If omitted, Moko's default page is used. |
| `redirect_url` | string | | Alias of `return_url` (accepted for compatibility) |
| `cancel_url` | string | | Return URL if the customer cancels |

## Response body

```json
{
  "status": "success",
  "data": {
    "amount": "1.00",
    "currency": "USD",
    "transaction_uuid": "FP-20260930-101530-a1b2c3d4-CD",
    "transaction_status": "PENDING",
    "links": "https://uc.card.gofreshpay.com/api/v1/payment/FP-20260930-101530-a1b2c3d4-CD?sig=abc123...",
    "financial_details": {
      "commission_rate": "3.50",
      "commission_amount": "0.04",
      "merchant_amount": "0.96",
      "bank_commission_amount": "0.03",
      "freshpay_commission_amount": "0.01"
    }
  }
}
```

- `transaction_uuid` — format `FP-YYYYMMDD-HHMMSS-{8chars}-CD`, your unique Moko identifier
- `transaction_status` — always `PENDING` at this stage
- `links` — short URL to redirect the customer to (already signed with `?sig=...`)
- `financial_details` — commission breakdown computed server-side

TTL: the transaction expires after **20 minutes** if the customer does not complete checkout (configurable via the `CYBERSOURCE_PAYMENT_TTL_MINUTES` env variable).

## Redirect the customer

```html
<!-- Backend returns a 303 redirect -->
<a href="{{ data.links }}">Pay USD 1.00</a>
```

Or in JavaScript:

```javascript
window.location.href = resp.data.links;
```

## Return URL

The customer is redirected to your `return_url` with query params.

**Success**:
```
?status=SUCCESS&transaction_uuid=FP-...&transaction_id=<cs_id>&amount=1.00&currency=USD&reference=INV-042
```

**Failure**:
```
?status=FAILED&transaction_uuid=FP-...&reason_code=201&message=...
```

::: warning
The `return_url` is a client-side redirect — **do NOT use it as the source of truth** to validate a payment. The customer may close their browser before reaching it. Use the **webhook** (`callback_url`) for confirmation.
:::

## Webhook

See [Webhooks](/en/card/webhooks) for the full schema + signature verification.

PAYMENT payload (excerpt):

```json
{
  "status": "SUCCESS",
  "reference": "INV-042",
  "amount": "1.00",
  "currency": "USD",
  "decision": "ACCEPT",
  "message": "Request was processed successfully.",
  "transaction_uuid": "FP-20260930-101530-a1b2c3d4-CD",
  "auth_cavv_result": "3",
  "customer_name": "Jean Kabala",
  "customer_email": "client@example.com",
  "cavv_message": "",
  "card_type": "Visa",
  "card_last4": "3172",
  "card_expiry_date": "12-2028",
  "card_bin_country": "CD",
  "card_issuer": "Equity Bank",
  "card_scheme": "VISA DEBIT"
}
```

## Check the status

`POST /api/v1/payment/status`
Auth: HMAC ([see Authentication](/en/authentication))

### Request

```json
{ "transaction_uuid": "FP-20260930-101530-a1b2c3d4-CD" }
```

### Response

```json
{
  "status": "success",
  "data": {
    "amount": "1.00",
    "currency": "USD",
    "merchant_reference": "INV-042",
    "message": "Request was processed successfully.",
    "transaction_uuid": "FP-...",
    "transaction_status": "SUCCESS",
    "card_type": "Visa",
    "card_last4": "3172",
    "card_expiry_date": "12-2028",
    "card_bin_country": "CD",
    "card_issuer": "Equity Bank",
    "card_scheme": "VISA DEBIT"
  }
}
```

Possible `transaction_status` values: `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `EXPIRED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `VOIDED`.

Cross-merchant access is strictly blocked: a merchant can only look up its own transactions (`HTTP 404 Transaction not found` otherwise).

## Common errors

| HTTP | Detail | Cause |
|---|---|---|
| 400 | `Currency '{currency}' is not supported. Allowed: CDF, USD` | Currency other than USD/CDF |
| 400 | `Minimum amount for USD is 1.00` | Amount too small |
| 400 | `bill_to_address_state is required for US/CA` | US or CA without a state |
| 400 | `Invalid US ZIP code format (expected: 12345 or 12345-6789)` | Malformed US ZIP |
| 400 | `Invalid Canadian postal code format (expected: A1A1A1)` | Malformed CA postal code |
| 400 | Other Pydantic validation | Malformed body |
| 401 | `Missing authentication headers` | An HMAC header is missing |
| 403 | `Invalid request signature` | HMAC does not match |
| 404 | `Merchant not found` | `merchant_id` derived from `X-API-Key` not found |
| 500 | `Payment processing error` | Internal error |

## See also

- [Authentication](/en/authentication) — HMAC signature
- [Webhooks](/en/card/webhooks) — webhook signature verification
- Refunds — contact `henock.barakael@mokoafrika.com` (admin API, restricted access)

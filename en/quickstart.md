# Quickstart — Your first payment in 5 minutes

This guide creates a 1 USD card payment, redirects the customer to a Moko-hosted checkout, and receives the result via webhook.

## Prerequisites

- A Moko merchant account (contact `henock.barakael@mokoafrika.com` for your sandbox keys)
- `curl`, `python3` or `node` (your choice)

You will need:

- `MOKO_API_KEY` — your `X-API-Key`
- `MOKO_API_SECRET` — your HMAC secret (keep it server-side only)
- `MOKO_BASE_URL` — depending on the environment:
  - Sandbox (recommended to get started): `https://uc-test.card.gofreshpay.com`
  - Production: `https://uc.card.gofreshpay.com`

::: tip Start on sandbox
In this guide we use sandbox keys to avoid any real charge. See [Testing & Sandbox](/en/testing-sandbox) for details on both environments.
:::

## 1. Sign a request

All merchant requests are authenticated with HMAC-SHA256. See [Authentication](/en/authentication) for the full details.

Signed message = `body_json_string` + `timestamp` (direct concatenation, no separator).

::: code-group

```python [Python]
import hmac, hashlib, json, httpx
from datetime import datetime, timezone

API_KEY = "..."
API_SECRET = "..."
BASE = "https://uc-test.card.gofreshpay.com"  # Sandbox. Prod: https://uc.card.gofreshpay.com

body = json.dumps({
    "amount": 1.00,
    "currency": "USD",
    "merchant_reference": "INV-001",
    "callback_url": "https://your-shop.com/webhooks/moko",
    "bill_to_forename": "Jean",
    "bill_to_surname": "Kabala",
    "bill_to_email": "client@example.com",
    "bill_to_phone": "+243812345001",
    "bill_to_address_line1": "Av. Kasa-Vubu 42",
    "bill_to_address_city": "Kinshasa",
    "bill_to_address_country": "CD",
    "return_url": "https://your-shop.com/order/INV-001",
}, separators=(",", ":"))

ts = datetime.now(timezone.utc).isoformat()
sig = hmac.new(API_SECRET.encode(), (body + ts).encode(), hashlib.sha256).hexdigest()

r = httpx.post(
    f"{BASE}/api/v1/payment/orders",
    content=body,
    headers={
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-Timestamp": ts,
        "X-Signature": sig,
    },
)
print(r.json())
```

```javascript [Node.js]
import crypto from 'node:crypto';

const API_KEY = '...';
const API_SECRET = '...';
const BASE = 'https://uc-test.card.gofreshpay.com';  // Sandbox. Prod: https://uc.card.gofreshpay.com

const body = JSON.stringify({
  amount: 1.00,
  currency: 'USD',
  merchant_reference: 'INV-001',
  callback_url: 'https://your-shop.com/webhooks/moko',
  bill_to_forename: 'Jean',
  bill_to_surname: 'Kabala',
  bill_to_email: 'client@example.com',
  bill_to_phone: '+243812345001',
  bill_to_address_line1: 'Av. Kasa-Vubu 42',
  bill_to_address_city: 'Kinshasa',
  bill_to_address_country: 'CD',
  return_url: 'https://your-shop.com/order/INV-001',
});

const ts = new Date().toISOString();
const sig = crypto.createHmac('sha256', API_SECRET)
  .update(body + ts)
  .digest('hex');

const r = await fetch(`${BASE}/api/v1/payment/orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'X-Timestamp': ts,
    'X-Signature': sig,
  },
  body,
});
console.log(await r.json());
```

```bash [curl]
API_KEY="..."
API_SECRET="..."
BODY='{"amount":1.00,"currency":"USD","merchant_reference":"INV-001","callback_url":"https://your-shop.com/webhooks/moko","bill_to_forename":"Jean","bill_to_surname":"Kabala","bill_to_email":"client@example.com","bill_to_phone":"+243812345001","bill_to_address_line1":"Av. Kasa-Vubu 42","bill_to_address_city":"Kinshasa","bill_to_address_country":"CD","return_url":"https://your-shop.com/order/INV-001"}'
TS=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
SIG=$(printf '%s%s' "$BODY" "$TS" | openssl dgst -sha256 -hmac "$API_SECRET" -r | awk '{print $1}')

curl -X POST https://uc-test.card.gofreshpay.com/api/v1/payment/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

:::

## 2. Response

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

## 3. Redirect the customer

Redirect the customer's browser to the URL in `data.links`:

```python
# Python backend — return a redirect
from fastapi.responses import RedirectResponse
resp = r.json()
return RedirectResponse(resp["data"]["links"], status_code=303)
```

The customer enters their card on the Moko-hosted page, completes 3DS (bank OTP), and is then redirected to your `return_url` with query params (`status=SUCCESS` + `transaction_id` + `amount` + `currency` + `reference`, OR `status=FAILED` + `reason_code` + `message`).

## 4. Receive the webhook

Moko POSTs to your `callback_url` as soon as the payment is finalized. The body is HMAC-signed — see [Webhooks](/en/card/webhooks) for verification.

```json
{
  "status": "SUCCESS",
  "reference": "INV-001",
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

Mark the order as paid in your DB, send the receipt, ship the product.

## Next steps

- [Custom Checkout (Microform)](/en/card/microform) — checkout embedded on your own domain
- [Payment Links](/en/card/payment-links) — collect payments without a website
- Refunds — contact `henock.barakael@mokoafrika.com` (admin API, restricted access)
- [Testing & Sandbox](/en/testing-sandbox) — how to test

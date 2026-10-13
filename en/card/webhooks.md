# Webhooks

Moko notifies your backend of payment events asynchronously. Webhooks are **the source of truth** — more reliable than the client-side redirect.

## Events

| Trigger | Contains `event_type`? | Signed? |
|---|---|---|
| Payment completed (SUCCESS/FAILED) | ❌ no | ✅ yes |
| Successful admin refund | ✅ `REFUND` | ✅ yes |
| Successful admin void | ✅ `VOID` | ✅ yes |
| Customer cancellation on checkout | ✅ `PAYMENT_CANCELLATION` | ❌ **unsigned** (see warning) |

::: warning PAYMENT_CANCELLATION is unsigned
The `PAYMENT_CANCELLATION` webhook (triggered when the customer cancels on the checkout page) uses an unsigned HTTP POST. Do not use it as a critical confirmation — treat it as an informational signal. An actual `SUCCESS` or `FAILED` will arrive separately via the standard signed webhook.
:::

## Merchant-side endpoint

You expose an HTTPS `POST` endpoint and pass its URL as `callback_url`:

- In `POST /api/v1/payment/orders`, `POST /api/v1/payment-links`, or `POST /api/v1/microform/charge`

## Webhook signature

Every signed webhook includes the following headers:

| Header | Format |
|---|---|
| `X-FreshPay-Signature` | `t=<unix_timestamp>,v1=<hex_signature>` |
| `X-FreshPay-Timestamp` | `<unix_timestamp>` (redundant, informational) |

### Algorithm

```
message   = str(timestamp) + raw_body     # direct concatenation, NO separator
signature = HMAC_SHA256(callback_secret, message).hexdigest()
```

- `timestamp` = Unix integer (UTC seconds)
- `raw_body` = the exact bytes of the JSON body sent by Moko
  - Moko serializes with `json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")`
  - **Do NOT re-serialize** before verification — use the raw body as received
- `callback_secret` = merchant-specific secret (distinct from `api_secret`)

## Payloads

### PAYMENT (success or failure)

Triggered after a Cybersource capture or decline. **No `event_type` field** — distinguish via `status`.

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

On failure: `status` = `FAILED`, `decision` = `REJECT` or `REVIEW`, and `message` contains the reason.

### REFUND

Triggered after a successful admin refund (if `notify_merchant: true` on the refund call).

```json
{
  "event_type": "REFUND",
  "status": "SUCCESS",
  "transaction_uuid": "FP-...",
  "reference": "INV-042",
  "cs_payment_id": "7907643500666758704885",
  "cs_refund_id": "7907645194846489004894",
  "refund_id": 6,
  "amount": "1.00",
  "currency": "USD",
  "refunded_total": "1.00",
  "remaining": "0.00",
  "reason": "Customer request — order cancelled",
  "reason_code": "100",
  "message": "Request was processed successfully.",
  "timestamp": "2026-09-30T11:00:00Z"
}
```

### VOID

Triggered after a successful admin void (if `notify_merchant: true`).

```json
{
  "event_type": "VOID",
  "status": "SUCCESS",
  "transaction_uuid": "FP-...",
  "reference": "INV-042",
  "cs_payment_id": "7907643500666758704885",
  "cs_void_id": "7907621859236796504887",
  "void_id": 3,
  "amount": "50.00",
  "currency": "USD",
  "reason": "Ops error",
  "reason_code": "100",
  "message": "Request was processed successfully.",
  "timestamp": "2026-09-30T11:30:00Z"
}
```

### PAYMENT_CANCELLATION (unsigned)

Triggered when the customer clicks "Cancel" on the checkout page. **Unsigned** (documented backend bug).

```json
{
  "event_type": "PAYMENT_CANCELLATION",
  "transaction_uuid": "FP-...",
  "reference": "INV-042",
  "amount": "1.00",
  "currency": "USD",
  "timestamp": "2026-09-30T10:07:00Z"
}
```

## Verify a signature

### Python example (FastAPI)

```python
import hmac, hashlib, os
from fastapi import APIRouter, Request, HTTPException

CALLBACK_SECRET = os.environ["MOKO_CALLBACK_SECRET"]

router = APIRouter()

def verify_moko_signature(header: str, raw_body: bytes) -> bool:
    """Parse header 't=UNIX,v1=HEX', rebuild the signature, compare."""
    try:
        parts = dict(p.split("=", 1) for p in header.split(","))
        ts = parts["t"]
        received_sig = parts["v1"]
    except Exception:
        return False

    message = ts.encode() + raw_body  # direct concatenation
    expected = hmac.new(CALLBACK_SECRET.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(received_sig, expected)


@router.post("/webhooks/moko")
async def moko_webhook(request: Request):
    signature = request.headers.get("X-FreshPay-Signature")
    if not signature:
        raise HTTPException(400, "Missing signature")

    raw_body = await request.body()
    if not verify_moko_signature(signature, raw_body):
        raise HTTPException(403, "Invalid signature")

    payload = await request.json()
    event = payload.get("event_type")

    if event == "REFUND":
        # credit the customer
        pass
    elif event == "VOID":
        # internal rollback
        pass
    elif event == "PAYMENT_CANCELLATION":
        # informational signal — wait for the final webhook
        pass
    else:
        # PAYMENT (no event_type) — status determines the action
        if payload["status"] == "SUCCESS":
            # mark the order as paid
            pass

    return {"received": True}
```

### Node.js example (Express)

```javascript
import express from 'express';
import crypto from 'node:crypto';

const CALLBACK_SECRET = process.env.MOKO_CALLBACK_SECRET;

function verifyMokoSignature(header, rawBody) {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const ts = parts.t;
  const receivedSig = parts.v1;
  if (!ts || !receivedSig) return false;

  const message = Buffer.concat([Buffer.from(ts), rawBody]);
  const expected = crypto.createHmac('sha256', CALLBACK_SECRET)
    .update(message)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expected));
}

const app = express();

// IMPORTANT: raw body required for HMAC verification
app.post('/webhooks/moko',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['x-freshpay-signature'];
    if (!sig || !verifyMokoSignature(sig, req.body)) {
      return res.status(403).send('Invalid signature');
    }
    const payload = JSON.parse(req.body.toString());
    // ... process
    res.json({ received: true });
  }
);
```

## Idempotency

Moko may retry if your server times out or returns a 5xx. Your handler must be **idempotent**:

```python
# BAD
def handle_payment_success(tx_uuid):
    stock -= 1  # ❌ if received 3 times, stock -= 3

# GOOD
def handle_payment_success(tx_uuid):
    order = get_order_by_tx(tx_uuid)
    if order.status != 'pending':
        return  # already processed
    order.status = 'paid'
    stock -= 1
```

## Expected response codes

- **2xx** — success, Moko does not retry
- **4xx** (except 429) — permanent error, Moko does not retry
- **429** — throttled
- **5xx** — temporary error, Moko may retry

## Debug

Test reception with the Moko endpoints:

```bash
curl -X POST https://uc.card.gofreshpay.com/api/v1/test/test-callback \
  -H "Content-Type: application/json" \
  -d '{"your":"payload","for":"testing"}'

# View received history
curl https://uc.card.gofreshpay.com/api/v1/test/test-callback/history

# Last one received
curl https://uc.card.gofreshpay.com/api/v1/test/test-callback/last
```

To test locally with Moko POSTing to your machine, use [ngrok](https://ngrok.com/) to expose your dev server over HTTPS.

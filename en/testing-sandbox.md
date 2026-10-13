# Testing & Sandbox

## Environments

Moko provides **two separate environments**, each with its own domain and its own Cybersource tenant:

| | Sandbox (test) | Production |
|---|---|---|
| **Base URL** | `https://uc-test.card.gofreshpay.com` | `https://uc.card.gofreshpay.com` |
| **Merchant keys** | `is_test=1` | `is_test=0` (live) |
| **Cybersource tenant** | `drc_freshpaytest` (sandbox) | `drc_freshpay` (prod) |
| **Real money charged** | No — simulation | Yes — real cards |
| **Intended for** | Development, integration, QA | Real merchant traffic |

To get your sandbox keys + access to a test merchant account, contact `henock.barakael@mokoafrika.com`.

::: tip Always develop on sandbox first
Before you receive your `live` keys, you must demonstrate a complete HMAC-signed flow on `uc-test.card.gofreshpay.com`. See the [checklist at the bottom of the page](#going-to-production).
:::

::: danger Cross-environment calls strictly blocked
Using a sandbox key on the production endpoint (or vice versa) → **HTTP 403 `Unauthorized environment`**. Check `MOKO_BASE_URL` and your keys when your app starts.
:::

## Minimum amounts

Server-side constraint on `POST /api/v1/payment/orders`:

| Currency | Minimum |
|---|---|
| USD | `1.00` |
| CDF | `500.00` |

Below that: `HTTP 400 Minimum amount for {currency} is {min:.2f}`.

## Supported currencies

Only `USD` and `CDF` are accepted.

Anything else: `HTTP 400 Currency '{currency}' is not supported. Allowed: CDF, USD`.

## Test cards

Our Cybersource sandbox profile + Equity Bank Kenya accept the standard Cybersource test cards. The cards below **do not charge real funds** — they simulate typical scenarios.

### Visa — success scenarios

| Card (PAN) | Expected result |
|---|---|
| `4242 4242 4242 4242` | ✅ **APPROVE** — standard success (the most commonly used) |
| `4005 5192 0000 0004` | ✅ APPROVE — Visa debit |
| `4111 1111 4555 1142` | ✅ APPROVE — frictionless 3DS |

### Visa — failure scenarios

| Card (PAN) | Expected result | reason_code |
|---|---|---|
| `4000 0000 0000 0002` | ❌ DECLINED — generic decline | `203` |
| `4000 0000 0000 0127` | ❌ DECLINED — CVV check failed | `230` |
| `4000 0000 0000 9995` | ❌ DECLINED — insufficient funds | `210` |
| `4000 0000 0000 0119` | ❌ ERROR — processing error (502 on the app side) | — |
| `4000 0000 0000 0069` | ❌ DECLINED — expired card | `202` |

### Visa — 3D Secure 2.0 scenarios

| Card (PAN) | Expected result |
|---|---|
| `4000 0000 0000 1091` | 🔐 **CHALLENGE** — the Cardinal simulator opens; enter the simulated OTP to approve |
| `4000 0025 0000 3155` | ✅ **FRICTIONLESS** — silent 3DS pass (recommended to test a flow without a popup) |
| `4000 0000 0000 1026` | ❌ CHALLENGE then DECLINED (3DS auth OK, card declined afterwards) |
| `4000 0000 0000 1018` | ❌ 3DS not enrolled — fallback to no-3DS |

### Mastercard

| Card (PAN) | Expected result |
|---|---|
| `5555 5555 5555 4444` | ✅ APPROVE — Mastercard credit |
| `5200 8282 8282 8210` | ✅ APPROVE — Mastercard debit |
| `2223 0000 1017 5833` | ✅ APPROVE — Mastercard 2-series (new BIN) |
| `5200 0000 0000 0007` | ❌ DECLINED |
| `5200 0000 0000 1096` | 🔐 3DS CHALLENGE |

### Amex (if enabled on your merchant account)

| Card (PAN) | Expected result |
|---|---|
| `3782 822463 10005` | ✅ APPROVE |
| `3714 496353 98431` | ❌ DECLINED |

### Common fields

For all the test cards above:

- **CVV**: `123` (or `1234` for Amex)
- **Expiration**: any future date (e.g. `12/28`)
- **Name**: anything (e.g. `TEST USER`)
- **Billing address**: anything, but provide at least `country` + `address_line1` + `city` + `postal_code` to avoid 400 validation errors

### Amounts that trigger special scenarios

With the "approve" cards above, the amount can influence the result on some Cybersource processors:

| Amount USD | Behavior |
|---|---|
| `1.00` | Always approved (recommended for smoke tests) |
| `100.00` | Approved + high risk score (tests the anti-fraud flag) |
| `0.75` | **DECLINED** — simulates a below-minimum error (via app 400 code) |

::: tip Recommended primary card
For a first complete smoke test (card → 3DS → webhook), use **`4000 0025 0000 3155`** (Visa frictionless 3DS) with an amount of `1.00 USD`. Fully simulated flow with no OTP popup.
:::

::: warning Never use real cards on sandbox
Even if the flow works, sandbox transactions don't charge — but CSV reporting and risk metrics will pick up noise. Any real card seen on the `drc_freshpaytest` profile is automatically flagged + the team is notified by email.
:::

For additional scenarios (foreign card, chargeback test, pre-auth without capture test, etc.), contact `henock.barakael@mokoafrika.com`.

## Testing a payment end to end

See [Quickstart](/en/quickstart) for the full example (replacing `BASE_URL` with `https://uc-test.card.gofreshpay.com`). The flow:

1. `POST /api/v1/payment/orders` with your sandbox keys → `data.links`
2. Open `data.links` in a browser
3. Enter a test card + CVV + future expiration date
4. If 3DS: the Cardinal simulator opens; enter the simulated OTP
5. Redirect to your `return_url?status=SUCCESS&...`
6. Webhook sent to your `callback_url` (source of truth)

### Sandbox curl example

```bash
# 1. Sign the request (see /en/authentication for HMAC details)
API_KEY="your_sandbox_test_key"
API_SECRET="your_sandbox_secret"
BASE_URL="https://uc-test.card.gofreshpay.com"
TIMESTAMP=$(date +%s)
BODY='{"amount":1.00,"currency":"USD","merchant_reference":"test-001","callback_url":"https://your-shop.com/webhooks/moko"}'
SIGNATURE=$(printf "%s%s" "$BODY" "$TIMESTAMP" | openssl dgst -sha256 -hmac "$API_SECRET" | awk '{print $NF}')

# 2. Create the order (sandbox)
curl -X POST "$BASE_URL/api/v1/payment/orders" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

Expected response: `200 OK` with `data.links` (hosted checkout URL) and `data.transaction_uuid`.

## Verifying your webhooks

To test webhook delivery locally (before you have a public domain):

- **ngrok** — `ngrok http 8000`, then pass the URL `https://xxx.ngrok.io/webhook` as `callback_url`
- **webhook.site** — to inspect the payload and signature without a backend

Moko also provides test endpoints on **sandbox** for manually receiving fake webhooks:

```bash
BASE_URL="https://uc-test.card.gofreshpay.com"

# Test endpoint that receives a fake webhook and stores it
curl -X POST "$BASE_URL/api/v1/test/test-callback" \
  -H "Content-Type: application/json" \
  -d '{"your":"payload","for":"testing"}'

# View the received history
curl "$BASE_URL/api/v1/test/test-callback/history"

# Last one received
curl "$BASE_URL/api/v1/test/test-callback/last"

# Clear the history
curl -X DELETE "$BASE_URL/api/v1/test/test-callback/clear"
```

These endpoints exist **only on sandbox** — not on production.

## Going to production

Checklist before receiving your `live` keys:

- [ ] HMAC signature verified on at least 10 sandbox payments
- [ ] Complete sandbox flow tested: order creation → checkout → webhook received → status persisted
- [ ] Webhook receiver stable, signature validated, idempotent
- [ ] Network timeouts handled (Moko API: 20s max recommended)
- [ ] Structured logging in place
- [ ] Valid SSL certificate on your `return_url` and `callback_url`
- [ ] Separate `MOKO_BASE_URL`, `MOKO_API_KEY`, `MOKO_API_SECRET` env variables for sandbox vs prod
- [ ] Customer support ready to handle DECLINED / 3DS failed cases
- [ ] Daily reconciliation planned

Once the checklist is ✅, contact `henock.barakael@mokoafrika.com` to receive your production keys and switch `MOKO_BASE_URL` to `https://uc.card.gofreshpay.com`.

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

Our Cybersource sandbox profile + Equity Bank Kenya accept the **official Cybersource test cards**. The cards below do not charge real funds — they simulate typical card-network and Payer Authentication (3DS 2.x) scenarios.

::: warning No PAN-based declines on Cybersource sandbox
Cybersource sandbox **does not implement PAN-based declines**. All the test cards below are APPROVE by default on authorization. To simulate a non-3DS refusal (CVV mismatch, insufficient funds, expired card, etc.) you must use **processor-specific amount triggers** on the Equity Bank Kenya side — those are documented in their own Testing Guide and are not universal. Contact `henock.barakael@mokoafrika.com` for the current list.

The `4000 0000 0000 00XX` PANs you may have seen in the Stripe or Checkout.com docs **do not work** on Cybersource.
:::

### Standard (no 3DS) — APPROVE

| Brand | Card (PAN) | Expected result |
|---|---|---|
| Visa | `4111 1111 1111 1111` | ✅ APPROVE (the most commonly used) |
| Mastercard | `5555 5555 5555 4444` | ✅ APPROVE |
| Amex | `3782 822463 10005` | ✅ APPROVE (if enabled on your merchant) |

### Visa — 3D Secure 2.x (prefix `4456 5300 0000`)

| Card (PAN) | 3DS scenario |
|---|---|
| `4456 5300 0000 1013` | ❌ Frictionless FAILED (`DAUTHENTICATIONFAILED`) |
| `4456 5300 0000 1021` | ⚠️ Attempts processing (`PARes status = A`) |
| `4456 5300 0000 1039` | ⚠️ Unavailable (`PARes status = U`), proceed without liability shift |
| `4456 5300 0000 1047` | ❌ Rejected (`PARes status = R`), not permitted for authorization |
| `4456 5300 0000 1054` | ⚠️ Not available on lookup (`VERes enrolled = U`) |
| `4456 5300 0000 1062` | ⚠️ Enrollment check error |
| `4456 5300 0000 1070` | ⏱️ Time-out (10-12 s) |
| `4456 5300 0000 1088` | ⚠️ Bypassed (`VERes enrolled = B`) |
| `4456 5300 0000 1096` | 🔐 **Step-up challenge SUCCESS** — Cardinal simulator opens, enter the OTP → auth OK |
| `4456 5300 0000 1104` | 🔐 **Step-up challenge FAILED** — challenge opens, auth declined (`PARes status = N`) |
| `4456 5300 0000 1112` | ⚠️ Unavailable step-up (`PARes status = U`) |

### Mastercard — 3D Secure 2.x (prefix `5200 0000 0000`)

Same last 4 digits as the Visa grid above — for example `5200 0000 0000 1005` for Frictionless SUCCESS, `5200 0000 0000 1096` for Step-up SUCCESS, `5200 0000 0000 1104` for Step-up FAILED.

### Common fields

For all the test cards above:

- **CVV**: `123` (or `1234` for Amex)
- **Expiration**: the Cybersource docs recommend **January of the current year + 3** (e.g. `01/29` in 2026). Any future date is accepted.
- **Name**: anything (e.g. `TEST USER`)
- **Billing address**: anything, but provide at least `country` + `address_line1` + `city` + `postal_code` to avoid 400 validation errors

::: tip Recommended cards
For a first smoke test **without an OTP popup** (standard approve, no 3DS): **`4111 1111 1111 1111`** with an amount of `1.00 USD` → returns `SUCCESS` directly.

To test the **OTP challenge flow** (Cardinal simulator opens): **`4456 5300 0000 1096`** → enter the simulated OTP `1234` → auth validated → SUCCESS.

To test a **declined 3DS flow**: **`4456 5300 0000 1104`** → the Cardinal simulator opens and returns an authentication failure → FAILED.

Note: Cybersource publicly masks the true "frictionless 3DS successful" PAN (format `4XXXXX XX XXXX 27X1` in their docs). To test that specific variant, contact `henock.barakael@mokoafrika.com`.
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

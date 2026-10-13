# Custom Checkout (Microform)

Build your own checkout page on your domain, with card fields embedded through a secure Cybersource iframe. Your server never sees a PAN.

## Merchant prerequisites

- The `microform_enabled` flag must be enabled on your merchant profile. Contact `henock.barakael@mokoafrika.com` to have it activated.
- You must declare your domain in `microform_allowed_origins` (Moko validates server-side that the `target_origin` of your requests is in this list).

## Full flow

```
1. Customer lands on your checkout page
2. Backend → POST /api/v1/microform/capture-context → CS JWT
3. Frontend loads the Flex SDK, embeds card fields
4. Customer enters card → SDK tokenizes → transient_token
5. Backend → POST /api/v1/microform/pa-setup → device data collection (DDC)
6. Frontend: hidden iframe POSTs to DDC url (~5s browser fingerprint)
7. Backend → POST /api/v1/microform/pa-enroll → challenge_required ? OTP : direct
8. If challenge: visible stepUpUrl iframe → customer enters OTP
9. Backend → POST /api/v1/microform/charge (with authentication_transaction_id)
10. Moko internally: validate 3DS + auth + capture → SUCCESS
```

See [3DS Payer Authentication](/en/card/3ds) for details on the 3DS flow.

## Endpoint 1 — `POST /api/v1/microform/capture-context`

**Auth**: merchant HMAC

### Body

```json
{
  "target_origin": "https://checkout.your-shop.com",
  "allowed_card_networks": ["VISA", "MASTERCARD"],
  "locale": "fr-FR",
  "merchant_reference": "INV-042"
}
```

### Response

```json
{
  "jwt": "eyJraWQiOi...",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "expires_in": 900
}
```

The `jwt` must be passed to the Flex SDK in the browser. The `transaction_uuid` acts as the idempotency key for subsequent calls (pa-setup, pa-enroll, charge).

### Guards

- `target_origin` must be in your `microform_allowed_origins` (otherwise 403)
- `microform_enabled = 1` on your profile (otherwise 403)

## Endpoint 2 — Frontend Microform SDK

```html
<!-- On your checkout page, add the CS SDK -->
<script src="https://flex.cybersource.com/microform/bundle/v2/flex-microform.min.js"></script>

<!-- Containers for the card fields (CS iframes) -->
<div id="cs-number-container"></div>
<div id="cs-cvv-container"></div>
```

```javascript
// 1. Fetch capture-context via YOUR backend proxy (which signs HMAC + forwards to Moko)
const { jwt, transaction_uuid } = await fetch('/backend/microform/init', {
  method: 'POST',
  body: JSON.stringify({ amount: 100, reference: 'INV-042' }),
}).then(r => r.json());

// 2. Init Flex SDK
const flex = new Flex(jwt);
const microform = flex.microform({
  styles: {
    input: { 'font-size': '15px', color: '#0f172a', 'font-family': 'Inter, sans-serif' },
    ':focus': { color: '#0f172a' },
    'invalid': { color: '#d92d20' },
  },
});
microform.createField('number', { placeholder: '1234 5678 9012 3456' }).load('#cs-number-container');
microform.createField('securityCode', { placeholder: 'CVV' }).load('#cs-cvv-container');

// 3. On submit
async function handlePay(formData) {
  const transientToken = await new Promise((resolve, reject) => {
    microform.createToken({
      expirationMonth: formData.expMonth,
      expirationYear: formData.expYear,
    }, (err, token) => err ? reject(err) : resolve(token));
  });

  // Send transientToken + transaction_uuid to your backend, which runs pa-setup, pa-enroll, charge
  // See /en/card/3ds for the full flow
}
```

## Endpoint 3 — `POST /api/v1/microform/charge`

**Auth**: merchant HMAC

Charges the transient token once 3DS is complete (see [3DS](/en/card/3ds) for the required setup/enroll steps beforehand).

### Body

```json
{
  "transient_token": "eyJraWQiOi...",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "amount": 1.00,
  "currency": "USD",
  "merchant_reference": "INV-042",
  "bill_to": {
    "first_name": "Jean",
    "last_name": "Kabala",
    "email": "client@example.com",
    "phone_number": "+243812345001",
    "address_line1": "Av. de la Paix, 42",
    "address_city": "Kinshasa",
    "address_state": "",
    "address_postal_code": "00000",
    "address_country": "CD"
  },
  "callback_url": "https://your-shop.com/webhooks/moko",
  "authentication_transaction_id": "eD6BPpZLUlcijSh718c1"
}
```

::: warning
`authentication_transaction_id` is **required** if the Decision Manager on your CS profile enforces 3DS (the standard case in the DRC via Equity Bank). Without it, the transaction will be rejected with `Non 3Ds Reject`.
:::

### Response

```json
{
  "status": "SUCCESS",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "transaction_id": "7907643500666758704885",
  "reason_code": null,
  "message": null
}
```

## Full HTML sample

A standalone example (dev-only, do not deploy as-is) is served at:

**https://uc.card.gofreshpay.com/static/microform-sample.html**

::: danger
This sample signs the HMAC in the browser to keep the demo simple. **NEVER reproduce this pattern in production** — the HMAC secret must always stay server-side. Use a backend proxy as shown in the code above.
:::

## Known gotchas

Issues observed during real integrations. Patterns to recognize and apply before shipping.

### 1. `target_origin not in merchant allowlist` (HTTP 403)

**What you see** on `POST /api/v1/microform/capture-context`:

```json
{"detail": "target_origin 'https://your-domain.com' not in merchant allowlist. Allowed: ['https://pay.your-domain.com']"}
```

**Why**: the `target_origin` you send must be in your merchant's `microform_allowed_origins` list. The whitelist is signed into the capture-context JWT and enforced by the Cybersource Flex SDK against `window.location.origin` in the browser.

**Fix**: this is **not self-service**. Email your Moko contact to add the new origin to your merchant allowlist. Existing origins are preserved — other integrations keep working while the new one is added. Change propagates immediately (no restart, no cache).

### 2. 3-D Secure challenge shows a blank frame

**What you see**: after the cardholder enters the OTP, the challenge frame stays empty. Browser console shows:

```
Refused to display 'http://acs1.<issuer>.com/...' in a frame because
it set 'X-Frame-Options' to 'deny'.
```

**Why**: many issuer-bank ACS endpoints set `X-Frame-Options: deny` as an anti-clickjacking measure. The challenge page cannot be rendered inside an `<iframe>`. This is enforced by the browser; not controllable from your side or ours.

**Fix**: submit the `stepUpUrl` with a top-level form POST, not an iframe:

```html
<form action="{stepUpUrl}" method="POST" target="_top" id="stepup">
  <input type="hidden" name="JWT" value="{accessToken}" />
</form>
<script>document.getElementById('stepup').submit();</script>
```

Persist the state you need to resume (`transient_token`, `authentication_transaction_id`, `bill_to`) in `sessionStorage` before submitting — the browser leaves your page and comes back via the ACS → `return_url` POST.

### 3. Return URL must accept POST and live on the main domain

**What you see**: after the OTP, either `405 Method Not Allowed` or a blank page with `Refused to display 'https://api.your-domain.com/...' in a frame`.

**Why**: the issuer ACS calls your `return_url` with an HTTP **POST**. Two things go wrong often:

- Framework route only declared for GET (Next.js `page.tsx` without `POST` handler, Rails default routes, etc.) → 405.
- Return URL served from an API subdomain fronted by Cloudflare → Cloudflare injects `X-Frame-Options: deny` on API subdomains by default, which breaks the ACS → page transition.

**Fix**:
- Accept both GET and POST on the return handler.
- Serve the return URL from the **same domain as the checkout page**, not from an API subdomain.

### 4. SDK deprecation warning on `flex.microform(options)`

**What you see** in the browser console:

```
The microform method now requires a MicroformType as the first argument.
Defaulting to 'card'
```

**Why**: Flex Microform v2 requires the field type as the first positional argument. The implicit `'card'` default still works today but will be removed.

**Fix**: `flex.microform('card', options)` instead of `flex.microform(options)`.

### 5. `/charge` returns Reason Code 481 ("Non 3DS Reject")

**What you see**: your `/charge` call succeeds HTTP-wise, but the Cybersource response is `reason_code: "481"` and `status: "FAILED"` even though everything looked clean upstream.

**Why**: the Equity acquirer profile enforces 3-D Secure as mandatory. If `/charge` is called without the `authentication_transaction_id` returned by `/pa-enroll`, the acquirer treats the transaction as non-authenticated and rejects it.

**Fix**: always pass `authentication_transaction_id` from the `/pa-enroll` response into the `/charge` body — **including in the AUTHENTICATED (frictionless) path** where no OTP was required.

## See also

- [3DS Payer Authentication](/en/card/3ds) — full setup/enroll/challenge flow
- [Authentication](/en/authentication) — merchant HMAC signature
- [Webhooks](/en/card/webhooks) — callback signature verification
- Refunds — contact `henock.barakael@mokoafrika.com` (admin API, restricted access)

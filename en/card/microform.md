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

## See also

- [3DS Payer Authentication](/en/card/3ds) — full setup/enroll/challenge flow
- [Authentication](/en/authentication) — merchant HMAC signature
- [Webhooks](/en/card/webhooks) — callback signature verification
- Refunds — contact `henock.barakael@mokoafrika.com` (admin API, restricted access)

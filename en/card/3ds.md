# 3DS Payer Authentication

Since 2026-09, Moko's Cybersource profile requires 3D Secure on every card transaction. Without 3DS authentication, the charge is automatically rejected by Decision Manager (rule `Non 3Ds Reject`, `reason_code: 481`).

::: info Hosted Checkout
If you use [Hosted Checkout](/en/card/hosted-checkout), 3DS is **automatic** (the UC SDK handles everything). This guide only applies to [Microform](/en/card/microform), where you must orchestrate 3DS explicitly.
:::

## The 5-step flow

```
1. Tokenize card via Microform SDK          → transient_token
2. POST /api/v1/microform/pa-setup          → reference_id + DDC url + access_token
3. Browser: hidden iframe POSTs to DDC url  (~5s device fingerprint)
4. POST /api/v1/microform/pa-enroll         → AUTHENTICATED or CHALLENGE_REQUIRED
5a. AUTHENTICATED (frictionless)            → go to step 6
5b. CHALLENGE_REQUIRED                      → visible stepUpUrl iframe (customer OTP)
6. POST /api/v1/microform/charge            with authentication_transaction_id
```

The Moko `charge` backend automatically calls `/risk/v1/authentication-results` internally to commit the challenge before authorization. You don't need to validate it yourself.

## Endpoint — `POST /api/v1/microform/pa-setup`

**Auth**: merchant HMAC

Takes the transient token and starts device fingerprint collection.

### Body

```json
{
  "transient_token": "eyJraWQiOi...",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c"
}
```

### Response

```json
{
  "reference_id": "12f3d71d-8916-44ce-baa4-a772b9345807",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "device_data_collection_url": "https://centinelapi.cardinalcommerce.com/V1/Cruise/Collect"
}
```

## Device Data Collection (browser side)

A hidden iframe posts the JWT to the DDC URL. Cybersource collects the browser fingerprint (~2-5 seconds).

```javascript
function runDDC(url, accessToken, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'cs-ddc-frame';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = 'cs-ddc-frame';
    form.innerHTML = `<input type="hidden" name="JWT" value="${accessToken}">`;
    document.body.appendChild(form);
    form.submit();

    // Safety timeout (CS has a fallback if DDC fails)
    const t = setTimeout(() => { cleanup(); resolve(); }, timeoutMs);

    // Wait for the postMessage from CS
    function onMsg(ev) {
      if (!ev.origin.includes('cardinalcommerce.com')) return;
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (data.MessageType === 'profile.completed') {
          clearTimeout(t);
          cleanup();
          resolve();
        }
      } catch {}
    }
    function cleanup() {
      window.removeEventListener('message', onMsg);
      iframe.remove();
      form.remove();
    }
    window.addEventListener('message', onMsg);
  });
}

// Usage
await runDDC(setup.device_data_collection_url, setup.access_token);
```

## Endpoint — `POST /api/v1/microform/pa-enroll`

**Auth**: merchant HMAC

Checks whether a challenge is needed and returns either `AUTHENTICATED` (challenge skipped) or `CHALLENGE_REQUIRED` with the URL of the issuer's OTP page.

### Body

```json
{
  "transient_token": "eyJraWQiOi...",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "reference_id": "12f3d71d-8916-44ce-baa4-a772b9345807",
  "amount": 1.00,
  "currency": "USD",
  "bill_to": {
    "first_name": "Jean", "last_name": "Kabala",
    "email": "client@example.com",
    "address_line1": "Av. Kasa-Vubu", "address_city": "Kinshasa",
    "address_postal_code": "00000", "address_country": "CD"
  },
  "return_url": "https://checkout.your-shop.com/3ds-return"
}
```

`return_url` = the URL of your own page that will receive the POST callback after the challenge. See below.

### Response (frictionless — no OTP)

```json
{
  "status": "AUTHENTICATED",
  "authentication_transaction_id": "aeyEthCtnCswTcaZfju1",
  "step_up_url": null,
  "access_token": null,
  "ecommerce_indicator": "vbv"
}
```

→ Go straight to `/charge` with `authentication_transaction_id`.

### Response (challenge — OTP required)

```json
{
  "status": "CHALLENGE_REQUIRED",
  "authentication_transaction_id": "aeyEthCtnCswTcaZfju1",
  "step_up_url": "https://centinelapi.cardinalcommerce.com/V2/Cruise/StepUp",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "ecommerce_indicator": null
}
```

→ Render the visible iframe with the `step_up_url` and `access_token`, then wait for the callback on `return_url`.

### Response (authentication failed)

```json
{
  "status": "FAILED",
  "reason_code": "476",
  "message": "Authentication failed"
}
```

→ Do NOT call `/charge`. Show an error to the user.

## Challenge iframe (browser side)

```javascript
function runStepUpChallenge(stepUpUrl, accessToken) {
  return new Promise((resolve, reject) => {
    // Nexera-branded modal with a visible iframe
    const modal = document.createElement('div');
    modal.className = 'your-3ds-modal';
    modal.innerHTML = `
      <div class="your-3ds-header">Bank verification</div>
      <iframe name="cs-stepup-frame" style="width:100%;height:500px;border:0;"></iframe>
    `;
    document.body.appendChild(modal);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = stepUpUrl;
    form.target = 'cs-stepup-frame';
    form.innerHTML = `<input type="hidden" name="JWT" value="${accessToken}">`;
    document.body.appendChild(form);
    form.submit();

    // Wait for the postMessage from your /3ds-return page
    function onMsg(ev) {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.type === '3ds-complete') {
        cleanup();
        resolve();
      }
    }
    function cleanup() {
      window.removeEventListener('message', onMsg);
      modal.remove();
      form.remove();
    }
    window.addEventListener('message', onMsg);

    // 5-minute timeout
    setTimeout(() => { cleanup(); reject(new Error('3DS timeout')); }, 5 * 60_000);
  });
}
```

## Your `/3ds-return` page

Cybersource POSTs to `return_url` after the challenge (whether it succeeded or failed). This page must:

1. Accept GET **and POST** (Cybersource POSTs)
2. Send the headers `X-Frame-Options: SAMEORIGIN` + `CSP: frame-ancestors 'self'`
3. Notify the parent frame via postMessage

FastAPI example:

```python
from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse

router = APIRouter()

@router.api_route("/checkout/{tx_id}/3ds-return", methods=["GET", "POST"])
async def three_ds_return(tx_id: str):
    html = """
    <!DOCTYPE html>
    <html>
      <head><title>Verification complete</title></head>
      <body>
        <p>Verifying, please wait…</p>
        <script>
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({type: '3ds-complete'}, window.location.origin);
          }
        </script>
      </body>
    </html>
    """
    return HTMLResponse(
        content=html,
        headers={
            "X-Frame-Options": "SAMEORIGIN",
            "Content-Security-Policy": "frame-ancestors 'self'",
        },
    )
```

## Charge with `authentication_transaction_id`

Once you get `AUTHENTICATED`, OR after the challenge completes, call `/charge` with the `authentication_transaction_id`. The Moko backend:

1. Calls `/risk/v1/authentication-results` (commits the 3DS result with CS)
2. Extracts `cavv`, `xid`, `eci` from the response
3. Injects everything into the `POST /pts/v2/payments` call
4. Sets `commerceIndicator` automatically based on the network (`vbv` for Visa, `spa` for MasterCard)

See [Microform](/en/card/microform#endpoint-3-post-api-v1-microform-charge).

## Debug

If the charge fails with `reason_code: 481` (Non 3Ds Reject), check our logs for:

- `[PA validate] cs_status=AUTHENTICATION_FAILED` — the challenge was never completed
- `[PA validate] cs_status=AUTHENTICATION_SUCCESSFUL eci=05` — 3DS OK, the rejection has another cause

See [Response codes](/en/references/response-codes) for the full interpretation.

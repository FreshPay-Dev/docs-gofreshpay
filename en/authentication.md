# Authentication

The Moko API uses **HMAC-SHA256** to sign every merchant request.

## Base URL

```
https://uc.card.gofreshpay.com
```

The environment (development / production) is determined server-side by your merchant profile. A key bound to one environment cannot call the other — otherwise you get `403 Unauthorized environment`.

## Getting your keys

Contact `henock.barakael@mokoafrika.com` to receive your sandbox keys and start testing. Once you are approved, production keys are delivered separately.

Each merchant receives:

- `X-API-Key`: public identifier
- `api_secret`: HMAC key (**must stay server-side**)
- `callback_secret`: a separate HMAC key used to verify incoming webhooks (see [Webhooks](/en/card/webhooks))

## Required headers

Every request must include all 3 headers:

| Header | Value |
|---|---|
| `X-API-Key` | Your public key |
| `X-Timestamp` | ISO 8601 timestamp (parseable by `datetime.fromisoformat`) |
| `X-Signature` | Hex HMAC-SHA256 of `body + timestamp` using `api_secret` |

## Signature algorithm

```
message   = request_body_string + timestamp_string
signature = HMAC_SHA256(api_secret, message).hexdigest()
```

- `request_body_string` = JSON body serialized without extra whitespace (byte-for-byte identical to what you send)
- `timestamp_string` = exact value of your `X-Timestamp` header
- **No separator** between body and timestamp — direct concatenation
- Result = 64-character hex string (lowercase)

**Note**: for endpoints without a body (GET), use `body_string = ""` (empty string).

## Validity window

The server rejects any request whose `X-Timestamp` is **more than 30 seconds** in the past (relative to the server's UTC clock).

Response when the timestamp has expired:

```json
{ "detail": "Expired request" }
```
HTTP **408 Request Timeout**.

Make sure your server clock is synchronized via NTP.

## Examples

::: code-group

```python [Python]
import hmac, hashlib, json
from datetime import datetime, timezone

def sign_request(api_secret: str, body: dict) -> tuple[str, str, str]:
    """Returns (body_str, timestamp, signature)."""
    body_str = json.dumps(body, separators=(",", ":"))
    ts = datetime.now(timezone.utc).isoformat()
    sig = hmac.new(
        api_secret.encode(),
        (body_str + ts).encode(),
        hashlib.sha256,
    ).hexdigest()
    return body_str, ts, sig
```

```javascript [Node.js]
import crypto from 'node:crypto';

function signRequest(apiSecret, body) {
  const bodyStr = JSON.stringify(body);
  const ts = new Date().toISOString();
  const sig = crypto.createHmac('sha256', apiSecret)
    .update(bodyStr + ts)
    .digest('hex');
  return { bodyStr, ts, sig };
}
```

```php [PHP]
<?php
function signRequest(string $apiSecret, array $body): array {
    $bodyStr = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $ts = gmdate('Y-m-d\TH:i:s\Z');
    $sig = hash_hmac('sha256', $bodyStr . $ts, $apiSecret);
    return ['body' => $bodyStr, 'timestamp' => $ts, 'signature' => $sig];
}
```

:::

## Authentication errors

| HTTP code | Detail | Cause |
|---|---|---|
| 401 | `Missing authentication headers` | One of the 3 headers is missing |
| 403 | `Invalid credentials` | Unknown `X-API-Key` — merchant not found OR api_key does not match |
| 403 | `Invalid request signature` | HMAC does not match (secret mismatch or altered body) |
| 403 | `Unauthorized environment` | Sandbox key used on a production endpoint (or vice versa) |
| 403 | `Test account not allowed in production` | Account flagged `is_test=1` used in the production environment |
| 400 | `Invalid timestamp format` | `X-Timestamp` not parseable by `datetime.fromisoformat` |
| 408 | `Expired request` | `X-Timestamp` > 30s in the past |

## Best practices

- **Never** expose `api_secret` on the frontend (browser, mobile app). Always sign server-side.
- Use a **backend proxy** if you have an SPA checkout: your frontend calls your backend, which signs and forwards to Moko.
- Rotate your keys at least **twice a year** (contact support).
- Store `api_secret` in a vault (AWS Secrets Manager, HashiCorp Vault, or an encrypted environment variable).

## Webhooks sent by Moko

These use a **different scheme** — see [Webhooks](/en/card/webhooks). The secret used is `callback_secret` (distinct from `api_secret`), and the signature format is `X-FreshPay-Signature: t=UNIX_TS,v1=HEX`.

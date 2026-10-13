# Errors

Error format returned by Moko endpoints on failure (4xx / 5xx).

## Base format

```json
{
  "detail": "Human-readable description of the error"
}
```

Standard FastAPI format. Used for most errors (auth, validation, business guards).

## Validation errors (422)

FastAPI returns Pydantic validation errors in this format:

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "amount"],
      "msg": "Field required",
      "input": {...}
    }
  ]
}
```

You can iterate over `detail[]` to extract the invalid fields.

## HTTP codes used

| HTTP | Use case |
|---|---|
| **200 OK** | Success. For `/microform/charge`: check the `status` field in the body (SUCCESS vs business FAILED) |
| **303 See Other** | Redirect (post-checkout to the merchant `return_url`) |
| **307 Temporary Redirect** | Redirect (payment link `/pl/{code}` → UC checkout) |
| **400 Bad Request** | Malformed body, business validation (invalid currency, amount too small, etc.) |
| **401 Unauthorized** | One of the 3 HMAC headers is missing |
| **403 Forbidden** | Invalid auth (signature, cross-environment, test account in prod), or admin access denied |
| **404 Not Found** | Resource not found (tx_uuid, link_id, cs_payment_id, merchant_id) |
| **408 Request Timeout** | `X-Timestamp` > 30s in the past |
| **409 Conflict** | Incompatible state (tx status incompatible with the action, over-refund, void outside the 24h window, link cancelled/exhausted, etc.) |
| **410 Gone** | Expired resource (tx expired after 20 min, payment link `EXPIRED` or `EXHAUSTED` or `CANCELLED`) |
| **422 Unprocessable Entity** | Pydantic validation |
| **500 Internal Server Error** | Unexpected server error |
| **502 Bad Gateway** | Cybersource upstream unreachable, CS 5xx, or wrapping application error (`Refund upstream failed`, `Void upstream failed`, `Reporting fetch failed`) |

## Distinguishing 502 vs 200/FAILED

**Important** — 3DS failures and declined cards **are NOT 502s**. They are `200 OK` with `status: "FAILED"` in the body:

```bash
POST /api/v1/microform/charge
→ HTTP 200 OK
{
  "status": "FAILED",
  "transaction_uuid": "FP-...",
  "transaction_id": "cs_payment_id_or_null",
  "reason_code": "201",
  "message": "..."
}
```

A `502` means that **Cybersource itself is unreachable or returned a 5xx** — retrying is appropriate.

Your client should:
- Parse the JSON body even on 200
- Check `status` before treating the payment as successful
- NOT treat 4xx as retryable
- Retry only 502 / 503 / 504 / timeouts, with exponential backoff

## Idempotency

Our endpoints that create a resource (tx, refund, void, payment link) do **not** have a strict server-side idempotency-key mechanism. Two `POST /payment/orders` with the same `merchant_reference` will create two distinct transactions.

**Recommendation**: on the client side, deduplicate by `merchant_reference` (unique in your DB) before sending, and handle retries with exponential backoff on 502s only.

## Product-level debugging

For any unexpected 5xx error:

1. Get the `transaction_uuid` or `cs_payment_id` of the affected transaction
2. The precise UTC timestamp of the call
3. Send it to `henock.barakael@mokoafrika.com` with context (endpoint, headers excluding secrets, payload)

Typical response time < 24h. For blocking production incidents, put `URGENT PROD` in the subject line.

## See also

- [Response codes](/en/references/response-codes) — Cybersource codes
- [Authentication](/en/authentication) — HMAC errors (401/403/408)

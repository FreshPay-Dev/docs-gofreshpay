# Response codes

Codes returned by Cybersource and surfaced in our webhooks (`message` + `decision` fields) or in `/microform/charge` responses (`reason_code` field).

::: info Source of truth
This page lists the codes we have observed in production or explicitly handle in our backend. For the complete, up-to-date list, see the [official Cybersource documentation](https://developer.cybersource.com/api/reference/response-codes.html).
:::

## Success codes

| rc | Meaning |
|---|---|
| `100` | Success. May be missing from the top level in some `/pts/v2/payments` responses — in that case rely on the `status` field (`AUTHORIZED`, `PARTIAL_AUTHORIZED`). |

## 3DS Payer Authentication codes

Observed in our Microform 3DS flow:

| rc | Meaning |
|---|---|
| `475` | Cardholder enrolled in 3DS — challenge in progress (status `PENDING_AUTHENTICATION`, intermediate) |
| `476` | 3DS authentication failed (incorrect OTP, timeout, customer refusal, expired Entersekt session) |

Our `/microform/charge` returns `reason_code: "476"` if the `/risk/v1/authentication-results` pre-check detects that the challenge did not complete.

## Decision Manager codes (fraud engine)

| rc | Meaning | Action |
|---|---|---|
| `480` | Marked for review — DM requires manual analysis | Auth OK, but hold shipping/service until manual confirmation |
| `481` | **Rejected by Decision Manager** — a fraud rule fired | Auth automatically reversed by CS. Check `riskInformation.rules` to identify the rule |

::: warning Non 3Ds Reject (rc=481 on our profile)
On our Cybersource `Equity Bank Standard Profile`, the `Non 3Ds Reject` rule fires automatically if a card transaction is not 3DS-authenticated. For Microform, **make sure you call `/pa-setup` + `/pa-enroll` and pass `authentication_transaction_id` to `/charge`**. See [3DS Payer Authentication](/en/card/3ds).

The Hosted Checkout (UC) handles 3DS automatically — no action required on the merchant side.
:::

## Common payment decline codes

The codes below are documented in the official Cybersource reference. They are issued by the issuing bank via the processor (Equity Bank Kenya in our case):

| rc | Typical meaning |
|---|---|
| `201` | General decline by the issuing bank |
| `202` | Expired card |
| `203` | General decline by the processor |
| `204` | Insufficient funds |
| `205` | Lost or stolen card |
| `207` | Account suspended |
| `208` | Inactive card |
| `210` | Credit limit exceeded |
| `211` | Invalid CVV (mismatch) |
| `230` | AVS decline — address does not match |
| `231` | Invalid account number |
| `232` | Card type not accepted by the processor |
| `233` | General decline by the processor |
| `240` | Card type does not match the number prefix |

These codes may vary slightly depending on the issuer and country. Always consider the returned text `message` as well.

## Interpreting the normalized Moko `status` (`/microform/charge`)

Our `/microform/charge` normalizes the Cybersource `status` according to this logic (extracted from the code):

| Moko `status` | Corresponding CS status | Merchant interpretation |
|---|---|---|
| `SUCCESS` | `AUTHORIZED`, `PARTIAL_AUTHORIZED` | Money committed. Ship the product / service. |
| `SUCCESS` (log warning) | `AUTHORIZED_PENDING_REVIEW` | DM requires manual review. Do NOT ship — wait for support confirmation. |
| `FAILED` | `DECLINED`, `AUTHORIZED_RISK_DECLINED`, `PENDING_AUTHENTICATION`, `PENDING_REVIEW`, `INVALID_REQUEST` | No charge. Show an error to the customer. |
| `FAILED` (defensive) | Any other unexpected status | Log warning for support investigation. |

## Interpreting `transaction_status` (POST /payment/status)

`transaction_status` maps to the DB column `cybersource_transactions.status` — enum:

| Value | Meaning |
|---|---|
| `PENDING` | Tx created, checkout not yet completed |
| `SUCCESS` | Charge OK |
| `FAILED` | Charge failed (declined, 3DS fail, etc.) |
| `CANCELLED` | Customer clicked "Cancel" on checkout |
| `EXPIRED` | 20 min TTL exceeded without completion |
| `REFUNDED` | Fully refunded |
| `PARTIALLY_REFUNDED` | Partially refunded |
| `VOIDED` | Voided before settlement |

## See also

- [Errors (RFC 7807)](/en/references/errors)
- [Security](/en/references/security)
- [Cybersource official reason codes](https://developer.cybersource.com/api/reference/response-codes.html)

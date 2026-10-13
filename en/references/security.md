# Security

## PCI DSS

Thanks to the design of our API, **your server never touches a card number**:

- **Hosted Checkout** — the customer enters their card on `uc.card.gofreshpay.com` (Moko/Cybersource page). You only see the `transaction_id` in return.
- **Microform** — the card fields live in an iframe hosted by Cybersource. You only receive an opaque `transient_token`.

**Result**: you stay at PCI DSS level **SAQ-A** (Self-Assessment Questionnaire A), the lightest one. No mandatory annual audit, no quarterly scan of your servers.

**Comparison**:
- SAQ-A = never any PAN on your systems (our case)
- SAQ-A-EP = no PAN, but your page redirects (checkpoint scan required)
- SAQ-D = your servers see the PAN (mandatory annual audit, quarterly ASV scan)

## Secret management

### `api_secret` (merchant HMAC)

- **Rotation**: recommended every 6 months. Contact support for a coordinated rotation.
- **Storage**: vault (AWS Secrets Manager, HashiCorp Vault, Doppler) or encrypted environment variable
- **Never**: commit it to git, expose it on the frontend, send it in plain text by email/Slack
- **If leaked**: contact `henock.barakael@mokoafrika.com` immediately for revocation and emergency rotation

### `callback_secret` (webhook HMAC)

- Distinct from `api_secret`
- Used to verify the `X-FreshPay-Signature` of incoming webhooks
- Same storage rules

## TLS / HTTPS

- **All communications** with Moko are HTTPS only (TLS 1.2+)
- Our certificates are issued by Let's Encrypt (automatic renewal)
- **Your `return_url` and `callback_url` must be HTTPS** — HTTP is rejected
- If you use Microform, your `target_origin` must be HTTPS

## Anti-fraud (Decision Manager)

Cybersource Decision Manager runs on every transaction with the `Equity Bank Standard Profile` profile. Active rules:

- **Non 3Ds Reject** — reject if no 3DS was performed (phishing mitigation)
- **Order outside merchant's region** — logged (IGNORE decision) but can be promoted to REJECT depending on the profile

Fraud score computed on a 0-100 scale. Interpretation in `riskInformation.score` of the TSS response.

## 3DS Payer Authentication

- **Mandatory** for all card transactions on our CS profile (via the Non 3Ds Reject rule)
- 3D Secure 2.0 standard (protocol 2.2.0)
- **Frictionless** possible if the issuer trusts the device (no OTP requested)
- **OTP challenge** otherwise (issuer page, outside Moko's control)

See [3DS Payer Authentication](/en/card/3ds) for integration.

## Separate environments

**Cross-environment calls strictly blocked** — you cannot use a `test_*` key on a production transaction (or vice versa). Our server returns 403 `Unauthorized environment`.

This prevents catastrophic operational errors (charging real cards while thinking you are in sandbox).

## Logs and audit

Every sensitive action is logged with:

- `transaction_uuid` or `cs_payment_id`
- `X-Admin-User` (operator identity for admin actions)
- UTC timestamp
- Text reason

Logs are retained for at least **12 months**. Audit requests can be made via `henock.barakael@mokoafrika.com`.

## Rate limiting

*Coming soon* — abuse protection. Recommendation: already limit yourself to 10 req/s per tx on your side to avoid 429s.

## Reporting vulnerabilities

If you discover a vulnerability:

- Do **NOT** open a public GitHub issue
- Send it to `security@gofreshpay.com` (PGP-encrypted if possible)
- We respond within 48 business hours
- Bug bounty program in preparation

## See also

- [Authentication](/en/authentication) — detailed HMAC
- [Webhooks](/en/card/webhooks) — signature verification on receipt
- [Response codes](/en/references/response-codes)

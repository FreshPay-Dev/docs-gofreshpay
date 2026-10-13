# Secure Acceptance (Legacy)

::: danger Deprecated
Secure Acceptance (SA) is Moko's **original** card payment mode, in production since the offering launched. It has now been **replaced by Unified Checkout (UC)** for all new integrations. Existing SA merchants continue to operate without interruption, but no new merchants are provisioned on SA.

**UC migration**: see the cutover plan (to be published). Existing SA merchants will be migrated progressively.
:::

## What is SA

Secure Acceptance = Cybersource's first-generation "hosted checkout" solution. The flow:

```
1. POST /api/v1/payment/orders                     (same params as UC)
2. Response: { data: { links: "https://.../{uuid}?sig=..." } }
3. GET /api/v1/payment/{uuid}?sig=...              (Moko page)
4. Moko backend returns an HTML PAGE with an auto-submit <form>
   containing the signed CS parameters (access_key, profile_id, signature, ...)
5. The browser automatically POSTs to the Cybersource Secure Acceptance URL
6. The customer enters their card on the Cybersource page (hosted form)
7. 3DS triggered by CS if applicable
8. CS POSTs the result to /api/v1/payment/receipt
9. Redirect to the merchant return_url
10. Signed webhook to callback_url (identical to UC)
```

## SA vs UC — why migrate

| Aspect | SA (legacy) | UC (new) |
|---|---|---|
| Rendering | CS page with auto-submit form | SDK embedded in a Moko page |
| Visible domain | `secureacceptance.cybersource.com` (full redirect) | `uc.card.gofreshpay.com` (Moko-branded) |
| Customer flow | 2 redirects (merchant → CS → merchant) | 1 stable page (Cybersource SDK in an iframe) |
| UX customization | Low (standard CS page) | Better (control over the wrapper) |
| 3DS | Automatic | Automatic |
| Cybersource support | Maintenance mode | Active (new development) |
| Reason codes | Identical | Identical |
| Refund / Void | Via Moko support (identical) | Via Moko support (identical) |
| Webhook format | Identical | Identical |

## Identical merchant-side API

**Good news**: the merchant API is **strictly identical** between SA and UC. The same `POST /api/v1/payment/orders` works, the same webhook schema arrives, and refunds and voids are still handled by Moko support in the same way. The difference is **purely backend** — branching is controlled by a `USE_UC` environment variable on the Moko container serving your merchant.

In other words: **if you integrate following the [Hosted Checkout](/en/card/hosted-checkout) docs today, your code will work the same whether you are served by an SA or a UC container**. The migration is transparent to your code.

## Differences visible to the customer

- **SA**: after clicking "Pay", the browser navigates to a Cybersource domain. The customer sees a `secureacceptance.cybersource.com` URL in the address bar, then returns to your `return_url`.
- **UC**: after clicking "Pay", the customer stays on `uc.card.gofreshpay.com` (Moko domain). The Cybersource SDK embeds the card fields via a secure iframe. The customer never sees `cybersource.com` in the URL.

Customers perceive UC as "more integrated / more professional". Lower drop-off has been observed.

## Existing SA merchants

If you are already integrated via SA:

- **You don't need to change anything today.** Your merchant runs on the SA container (`cybersource-app`). No code changes required.
- **You will be notified** before any switchover — at least 30 days' notice before the `USE_UC` flag is flipped on your container.
- **No development on your side** will be required for the cutover, unless you voluntarily switch to Microform (embedded custom checkout).
- **Test UC now** by requesting UC sandbox access — same API, so you can check the customer experience before your migration.

## New merchants

If you are starting your integration today:

- **Follow the [Hosted Checkout](/en/card/hosted-checkout) docs** — you will be provisioned directly on UC.
- **No choice to make** between SA and UC — the decision is made on the backend. We only provision new accounts on UC.
- If you want full UX control (checkout on your own domain), see [Microform](/en/card/microform).

## Cutover roadmap

To be published. Planned outline:

1. **Current phase**: SA and UC coexist. New merchant → UC. Existing merchant → SA (status quo).
2. **Migration phase**: 30-day notice → switchover in merchant batches, with 48h monitoring per batch.
3. **Final phase**: decommissioning of the SA container `cybersource-app`.

Target dates will be announced with the official communication.

## Support during the transition

For any questions about SA / the migration roadmap:

- `henock.barakael@mokoafrika.com` (technical)
- `support@gofreshpay.com` (account / cutover questions)

## See also

- [Hosted Checkout (UC)](/en/card/hosted-checkout) — the current implementation
- [Custom Checkout (Microform)](/en/card/microform) — for full UX control
- [Overview](/en/card/overview) — comparison of the 3 modes

# Bank card — Overview

Moko supports 3 card acceptance modes. Pick the one that fits your context.

## Hosted Checkout (UC)

**The customer is redirected to a Moko page** to enter their card, then sent back to your `return_url`.

**Who it's for**: merchants who want the fastest integration with no PCI headaches. WooCommerce, PrestaShop, standard e-commerce sites.

**Dev effort**: ~30 min. A single `POST /api/v1/payment/orders` request, one redirect, one webhook.

**Constraint**: the customer sees `uc.card.gofreshpay.com` in their browser during checkout.

[→ Hosted Checkout documentation](/en/card/hosted-checkout)

## Custom Checkout (Microform)

**You host the checkout page on your own domain.** Cybersource embeds only the card fields (PAN, CVV) in a secure iframe.

**Who it's for**: SaaS platforms and merchants who want a fully branded experience with no visible redirect, and are fine with a bit more development work.

**Dev effort**: ~6-9 hours (backend proxy + frontend JS + 3DS iframe).

**PCI advantage**: you stay SAQ-A (the Cybersource iframe never sends card data to your servers).

[→ Microform documentation](/en/card/microform)

## Payment Links

**You generate a short URL** (`https://uc.card.gofreshpay.com/pl/aBc1XyZ9`) and share it via WhatsApp, SMS, email, or QR code. The customer clicks, pays, done.

**Who it's for**: sales agents, freelancers, restaurants, one-off invoices, NGOs, membership fees — anyone without a website.

**Dev effort**: ~15 minutes (a single `POST /api/v1/payment-links` request).

[→ Payment Links documentation](/en/card/payment-links)

## Quick comparison

| | Hosted Checkout | Microform | Payment Links |
|---|---|---|---|
| Domain visible to customer | `uc.card.gofreshpay.com` | Yours | `uc.card.gofreshpay.com` |
| Dev effort | 30 min | 6-9h | 15 min |
| UX control | Low (Moko brand) | Full | None (Moko brand) |
| PCI scope | SAQ-A | SAQ-A | SAQ-A |
| 3DS | Automatic | Must be integrated explicitly | Automatic |
| Refund / Void | Via Moko support | Via Moko support | Via Moko support |
| Website required | Yes | Yes | **No** |

## What all modes have in common

- **Supported networks**: Visa, MasterCard (Amex on request)
- **Currencies**: USD, CDF (Congo)
- **3DS**: automatic 3D Secure 2.0 via Cardinal Commerce
- **Processor**: Cybersource + Equity Bank Kenya
- **Refunds / Voids**: handled by the Moko support team on request (`henock.barakael@mokoafrika.com`)
- **Chargebacks**: tracked automatically via daily reporting

## Next steps

- Choose your mode and follow the dedicated guide
- Read [Testing & Sandbox](/en/testing-sandbox) for test cards
- Set up your [Webhooks](/en/card/webhooks) before going to production

## Legacy Secure Acceptance merchants

A 4th mode exists on the backend: **Secure Acceptance (SA)**, Moko's first-generation card implementation. Legacy merchants continue to be served on it without interruption, but **no new integrations go through SA** — all new accounts are provisioned on UC. The 3 modes above are the only ones offered for new integrations.

To learn about SA (if you are a legacy merchant) and the migration roadmap, see [Secure Acceptance (legacy)](/en/card/secure-acceptance-legacy).

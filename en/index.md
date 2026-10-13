---
layout: home

hero:
  name: "Moko Afrika"
  text: "The payment infrastructure for the DRC"
  tagline: "Accept Visa, MasterCard and Mobile Money through a single REST integration. No card data ever touches your servers."
  image:
    src: /moko-logo.png
    alt: Moko Afrika
  actions:
    - theme: brand
      text: 5-minute Quickstart
      link: /en/quickstart
    - theme: alt
      text: Integrate cards
      link: /en/card/overview
    - theme: alt
      text: Integrate Mobile Money
      link: /en/mobile-money/overview

features:
  - title: Mobile Money
    details: M-Pesa, Airtel, Orange, Afrimoney. Collection (C2B) and Withdrawal (B2C) through a single API — 4 operators, no per-operator integration.
    link: /en/mobile-money/overview
    linkText: Mobile Money documentation
  - title: Bank cards
    details: Visa, MasterCard. Automatic 3DS Payer Authentication. Moko-hosted checkout OR custom checkout on your own domain via Microform.
    link: /en/card/overview
    linkText: Card documentation
  - title: Payment Links
    details: Generate a short URL to share via WhatsApp, SMS, email or QR code. No merchant-side code, no website required.
    link: /en/card/payment-links
    linkText: Payment Links
  - title: PCI DSS SAQ-A
    details: Thanks to the Cybersource + Equity Bank Kenya iframe, your server never sees a card number. You stay at the simplest PCI level.
    link: /en/references/security
    linkText: Security
---

## One API to collect every payment

Moko Afrika is the first multi-channel payment processor built for merchants in the DRC. A simple REST API, signed HMAC authentication, and two payment methods available today:

- **Bank cards** — Visa, MasterCard, with 3DS Secure. Powered by Cybersource + Equity Bank Kenya.
- **Mobile Money** — M-Pesa Vodacom, Airtel Money, Orange Money, Afrimoney. Collection (C2B) and Withdrawal (B2C) through a single REST API. [→ Documentation](/en/mobile-money/overview)

## Who it's for

- **E-commerce** — WooCommerce, PrestaShop, or a custom site
- **Physical merchants** — POS, restaurants, sales agents (via Payment Links)
- **SaaS and subscriptions** — embedded checkout, recurring billing flow
- **Institutions** — schools, mutual insurers, NGOs, cooperatives

## Get started

```bash
# 1. Quick test, no account needed
curl https://docs.gofreshpay.com/api/health

# 2. Create a merchant account
# Contact henock.barakael@mokoafrika.com for your sandbox API keys

# 3. First payment
```

See the [5-minute Quickstart](/en/quickstart) for an end-to-end example.

---
layout: home

hero:
  name: "Moko Afrika"
  text: "L'infrastructure paiement de la RDC"
  tagline: "Accepte Visa, MasterCard et Mobile Money dans une seule intégration REST. Zéro carte bancaire ne touche vos serveurs."
  image:
    src: /moko-logo.png
    alt: Moko Afrika
  actions:
    - theme: brand
      text: Quickstart 5 min
      link: /quickstart
    - theme: alt
      text: Intégrer la carte
      link: /card/overview

features:
  - title: Carte bancaire
    details: Visa, MasterCard. 3DS Payer Authentication automatique. Checkout hébergé Moko OU custom sur votre domaine via Microform.
    link: /card/overview
    linkText: Documentation Carte
  - title: Payment Links
    details: Générez une URL courte à partager par WhatsApp, SMS, email ou QR code. Zéro code côté marchand, pas de site web nécessaire.
    link: /card/payment-links
    linkText: Payment Links
  - title: PCI DSS SAQ-A
    details: Grâce à l'iframe Cybersource + Equity Bank Kenya, votre serveur ne voit jamais un numéro de carte. Vous restez au niveau PCI le plus simple.
    link: /references/security
    linkText: Sécurité
---

## Une seule API pour tout encaisser

Moko Afrika est le premier processeur de paiement multi-canal fait pour les marchands de RDC. Une API REST simple, une auth HMAC signée, deux modes d'encaissement disponibles maintenant :

- **Carte bancaire** — Visa, MasterCard, avec 3DS Secure. Powered by Cybersource + Equity Bank Kenya.
- **Mobile Money** — M-Pesa Vodacom, Airtel Money, Orange Money, Afrimoney. Collection (C2B) et Withdrawal (B2C) via une seule API REST. [→ Documentation](/mobile-money/overview)

## Pour qui

- **E-commerce** — WooCommerce, PrestaShop, ou site custom
- **Marchands physiques** — POS, restaurants, agents commerciaux (via Payment Links)
- **SaaS et abonnements** — checkout embed, refunds programmatiques
- **Institutions** — écoles, mutuelles, ONG, coopératives

## Commencer

```bash
# 1. Test rapide sans compte
curl https://docs.gofreshpay.com/api/health

# 2. Créer un compte marchand
# Contactez dev@gofreshpay.com pour vos clés API sandbox

# 3. Premier paiement
```

Cf. [Quickstart 5 min](/quickstart) pour un exemple end-to-end.

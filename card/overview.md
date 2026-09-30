# Carte bancaire — Overview

Moko supporte 3 modes d'encaissement carte. Choisissez selon votre contexte.

## Hosted Checkout (UC)

**Le customer est redirigé vers une page Moko** pour taper sa carte, puis renvoyé vers votre `return_url`.

**Pour qui** : marchands qui veulent la mise en œuvre la plus rapide et sans souci PCI. WooCommerce, PrestaShop, sites e-commerce standard.

**Effort dev** : ~30 min. Une seule requête `POST /api/v1/payment/orders`, un redirect, un webhook.

**Contrainte** : le customer voit `uc.card.gofreshpay.com` dans son navigateur pendant le checkout.

[→ Documentation Hosted Checkout](/card/hosted-checkout)

## Custom Checkout (Microform)

**Vous hébergez la page checkout sur votre propre domaine.** Cybersource embed uniquement les champs carte (PAN, CVV) dans un iframe sécurisé.

**Pour qui** : SaaS et marchands qui veulent une expérience 100% brandée, pas de redirect visible, mais sont OK pour développer un peu plus.

**Effort dev** : ~6-9 heures (backend proxy + frontend JS + 3DS iframe).

**Avantage PCI** : reste SAQ-A (l'iframe Cybersource ne touche jamais vos serveurs avec les données carte).

[→ Documentation Microform](/card/microform)

## Payment Links

**Vous générez une URL courte** (`https://uc.card.gofreshpay.com/pl/aBc1XyZ9`) et la partagez par WhatsApp, SMS, email ou QR code. Le customer clique, paie, reçu.

**Pour qui** : agents commerciaux, freelance, restaurants, factures ponctuelles, ONG, cotisations — tout ceux qui n'ont pas de site web.

**Effort dev** : ~15 minutes (une seule requête `POST /api/v1/payment-links`).

[→ Documentation Payment Links](/card/payment-links)

## Comparaison rapide

| | Hosted Checkout | Microform | Payment Links |
|---|---|---|---|
| Domaine visible customer | `uc.card.gofreshpay.com` | Le vôtre | `uc.card.gofreshpay.com` |
| Effort dev | 30 min | 6-9h | 15 min |
| Contrôle UX | Faible (Moko brand) | Total | Aucun (Moko brand) |
| PCI scope | SAQ-A | SAQ-A | SAQ-A |
| 3DS | Automatique | À intégrer explicitement | Automatique |
| Refund | Disponible | Disponible | Disponible |
| Site web nécessaire | Oui | Oui | **Non** |

## Ce qui est commun à tous

- **Networks supportés** : Visa, MasterCard (Amex sur demande)
- **Devises** : USD, CDF (Congo)
- **3DS** : 3D Secure 2.0 automatique via Cardinal Commerce
- **Processeur** : Cybersource + Equity Bank Kenya
- **Refunds** : API admin disponible pour tous les modes
- **Chargebacks** : suivi automatique via reporting daily

## Prochaines étapes

- Choisissez votre mode et suivez le guide dédié
- Lisez [Testing & Sandbox](/testing-sandbox) pour les cartes de test
- Configurez vos [Webhooks](/card/webhooks) avant d'aller en prod

## Marchands historiques Secure Acceptance

Un 4ème mode existe côté backend : **Secure Acceptance (SA)**, l'implémentation carte première génération de Moko. Les marchands historiques continuent d'y être servis sans interruption, mais **aucune nouvelle intégration ne passe par SA** — tous les nouveaux comptes sont provisionnés en UC. Les 3 modes ci-dessus sont les seuls proposés pour de nouvelles intégrations.

Pour comprendre SA (si vous êtes marchand historique) et la roadmap de migration, voir [Secure Acceptance (legacy)](/card/secure-acceptance-legacy).

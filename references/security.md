# Sécurité

## PCI DSS

Grâce au design de notre API, **votre serveur ne touche jamais un numéro de carte** :

- **Hosted Checkout** — le customer tape sa carte sur `uc.card.gofreshpay.com` (page Moko/Cybersource). Vous ne voyez que le `transaction_id` en retour.
- **Microform** — les champs carte sont dans un iframe hébergé par Cybersource. Vous recevez uniquement un `transient_token` opaque.

**Résultat** : vous restez au niveau PCI DSS **SAQ-A** (Self-Assessment Questionnaire A), le plus léger. Pas d'audit annuel obligatoire, pas de scan trimestriel de vos serveurs.

**Comparaison** :
- SAQ-A = jamais de PAN sur vos systèmes (notre cas)
- SAQ-A-EP = pas de PAN mais votre page redirige (checkpoint scan requis)
- SAQ-D = vos serveurs voient le PAN (audit annuel obligatoire, scan ASV trimestriel)

## Gestion des secrets

### `api_secret` (HMAC merchant)

- **Rotation** : recommandée tous les 6 mois. Contactez support pour rotation coordonnée.
- **Stockage** : vault (AWS Secrets Manager, HashiCorp Vault, Doppler) ou variable d'environnement chiffrée
- **Ne jamais** : commit dans git, exposer côté frontend, envoyer par email/Slack en clair
- **En cas de fuite** : contactez `dev@gofreshpay.com` immédiatement pour révocation et rotation d'urgence

### `callback_secret` (webhook HMAC)

- Distinct de `api_secret`
- Utilisé pour vérifier `X-FreshPay-Signature` des webhooks reçus
- Mêmes règles de stockage

### `X-Admin-Token` (refunds/voids/reporting)

- Stocké dans un fichier root-only sur votre bastion (mode 600)
- Rotation à la demande

## TLS / HTTPS

- **Toutes les communications** avec Moko sont HTTPS uniquement (TLS 1.2+)
- Nos certificats sont émis par Let's Encrypt (renouvellement automatique)
- **Votre `return_url` et `callback_url` doivent être HTTPS** — HTTP est refusé
- Si vous utilisez Microform, votre `target_origin` doit être HTTPS

## Anti-fraud (Decision Manager)

Cybersource Decision Manager tourne sur chaque tx avec le profile `Equity Bank Standard Profile`. Règles actives :

- **Non 3Ds Reject** — reject si pas de 3DS effectué (mitigation phishing)
- **Order outside merchant's region** — logged (IGNORE decision) mais peut être promu à REJECT selon profile

Score fraud calculé sur 0-100. Interprétation dans `riskInformation.score` de la réponse TSS.

## 3DS Payer Authentication

- **Obligatoire** pour toutes les tx carte sur notre profile CS (via règle Non 3Ds Reject)
- Standard 3D Secure 2.0 (protocol 2.2.0)
- **Frictionless** possible si l'émetteur trust le device (pas d'OTP demandé)
- **Challenge OTP** sinon (page émetteur, hors contrôle Moko)

Voir [3DS Payer Authentication](/card/3ds) pour l'intégration.

## Contrôle d'accès par IP

Les endpoints administratifs (`/api/v1/admin/*`) sont **doublement protégés** :

1. Header `X-Admin-Token` (constant-time compare)
2. Allowlist réseau nginx : bastion FreshPay `68.183.65.177` + localhost uniquement

Si votre backoffice a besoin d'accéder à ces endpoints, contactez `dev@gofreshpay.com` pour :
- Whitelist de votre IP publique
- Proxy authentifié
- Ou VPN tunneled

## Environnement séparé

**Cross-environment strictement bloqué** — vous ne pouvez pas utiliser une clé `test_*` sur une tx prod (ni l'inverse). Notre serveur retourne 403 `Unauthorized environment`.

Cela empêche les erreurs opérationnelles catastrophiques (charger de vraies cartes en pensant être en sandbox).

## Logs et audit

Chaque action sensible est loggée avec :

- `transaction_uuid` ou `cs_payment_id`
- `X-Admin-User` (identité de l'opérateur pour actions admin)
- Timestamp UTC
- Raison textuelle

Logs conservés **12 mois** minimum. Requêtes d'audit possibles via `dev@gofreshpay.com`.

## Rate limiting

*À venir* — protection contre abuse. Recommandation : limitez déjà côté vous à 10 req/s par tx pour éviter les 429.

## Signalement de vulnérabilités

Si vous découvrez une vulnérabilité :

- **Ne PAS** ouvrir d'issue GitHub publique
- Envoyer à `security@gofreshpay.com` (chiffré PGP si possible)
- Nous répondons dans les 48h ouvrables
- Programme bug bounty en préparation

## Voir aussi

- [Authentication](/authentication) — HMAC détaillé
- [Webhooks](/card/webhooks) — vérification signature réception
- [Response codes](/references/response-codes)

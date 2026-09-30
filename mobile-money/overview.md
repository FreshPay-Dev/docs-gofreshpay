# Mobile Money — Overview

L'API Mobile Money Moko permet d'encaisser depuis un wallet mobile customer (**Collection / Deposit**) et de payer vers un wallet mobile customer (**Withdrawal / Payout**).

Une seule URL, un seul header content-type, discriminée par le champ `action` du body.

## Endpoint unique

```
POST https://api.gofreshpay.com/api/v1/gateway
Content-Type: application/json
```

Champ discriminant `action` :

| `action` | Sens | Doc |
|---|---|---|
| `debit` | Collection — customer → marchand (STK Push) | [Collection](/mobile-money/collection) |
| `credit` | Withdrawal — marchand → customer (payout) | [Withdrawal](/mobile-money/withdrawal) |
| `verify` | Consultation statut d'une tx | [Verify](/mobile-money/verify) |

## Opérateurs supportés

Champ `method` dans le body :

| `method` | Opérateur |
|---|---|
| `mpesa` | M-Pesa (Vodacom) |
| `orange` | Orange Money |
| `airtel` | Airtel Money |
| `afrimoney` | Afrimoney (Africell) |

## Devises

- `CDF` — Franc congolais
- `USD` — Dollar américain

## Format du numéro client

Format international sans `+` ni espaces : `243XXXXXXXXX` (12 chiffres pour la RDC).

Exemple : `243970000000`.

## Auth

L'API MM utilise l'authentification **body-based** — pas de header HMAC. Vous incluez vos identifiants directement dans le body :

- `merchant_id` (identifiant marchand)
- `merchant_secrete` (**noter l'orthographe**, avec `e` à la fin — pas `merchant_secret`)

::: warning
L'orthographe `merchant_secrete` est intentionnelle côté API MM — c'est le nom du champ historique. Ne pas confondre avec `merchant_secret` de l'API Card.
:::

Récupérez vos identifiants via `dev@gofreshpay.com` (sandbox) puis sur demande pour production.

## Flow asynchrone

Toutes les opérations MM sont **asynchrones** :

1. Vous envoyez `POST /api/v1/gateway`
2. Réponse immédiate `200 OK` avec `Status: "Success"` = **transaction créée**, PAS payée
3. Le customer complète l'opération sur son téléphone (STK Push, tape PIN)
4. L'opérateur traite
5. Moko POSTe un **webhook** sur votre `callback_url` avec `Trans_Status = Successful | Failed | Pending`

Le champ `Status` de la réponse initiale indique juste que la requête a été acceptée. Le vrai résultat arrive dans le webhook via `Trans_Status`. Voir [Webhooks](/mobile-money/webhooks).

## Structure des pages

- **[Collection (Deposit)](/mobile-money/collection)** — encaisser depuis un customer
- **[Withdrawal (Payout)](/mobile-money/withdrawal)** — payer vers un customer
- **[Verify](/mobile-money/verify)** — check statut par référence
- **[Webhooks](/mobile-money/webhooks)** — format callback + retry policy + signature

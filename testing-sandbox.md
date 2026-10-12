# Testing & Sandbox

## Environnements

Moko fournit **deux environnements distincts**, chacun avec son propre domaine et son propre tenant Cybersource :

| | Sandbox (test) | Production |
|---|---|---|
| **Base URL** | `https://uc-test.card.gofreshpay.com` | `https://uc.card.gofreshpay.com` |
| **Clés marchand** | `is_test=1` | `is_test=0` (live) |
| **Tenant Cybersource** | `drc_freshpaytest` (sandbox) | `drc_freshpay` (prod) |
| **Argent réellement débité** | Non — simulation | Oui — vraies cartes |
| **Pour qui** | Développement, intégration, QA | Trafic réel marchand |

Pour obtenir vos clés sandbox + l'accès à un compte marchand de test, contactez `henock.barakael@mokoafrika.com`.

::: tip Développez toujours sur sandbox d'abord
Avant de recevoir vos clés `live`, vous devez démontrer un flow complet signé HMAC sur `uc-test.card.gofreshpay.com`. Voir la [checklist en bas de page](#passer-en-production).
:::

::: danger Cross-environment strictement bloqué
Utiliser une clé sandbox sur l'endpoint prod (ou l'inverse) → **HTTP 403 `Unauthorized environment`**. Vérifiez `MOKO_BASE_URL` et vos clés au démarrage de votre app.
:::

## Montants minimum

Contrainte serveur sur `POST /api/v1/payment/orders` :

| Devise | Minimum |
|---|---|
| USD | `1.00` |
| CDF | `500.00` |

En dessous : `HTTP 400 Minimum amount for {currency} is {min:.2f}`.

## Devises supportées

Seules `USD` et `CDF` sont acceptées.

En dehors : `HTTP 400 Currency '{currency}' is not supported. Allowed: CDF, USD`.

## Cartes de test

Notre profile Cybersource sandbox + Equity Bank Kenya acceptent les cartes de test standard Cybersource. Les cartes ci-dessous **ne débitent pas de vrais fonds** — elles simulent les scénarios typiques.

### Visa — scénarios de succès

| Carte (PAN) | Résultat attendu |
|---|---|
| `4242 4242 4242 4242` | ✅ **APPROVE** — succès standard (la plus utilisée) |
| `4005 5192 0000 0004` | ✅ APPROVE — Visa debit |
| `4111 1111 4555 1142` | ✅ APPROVE — frictionless 3DS |

### Visa — scénarios d'échec

| Carte (PAN) | Résultat attendu | reason_code |
|---|---|---|
| `4000 0000 0000 0002` | ❌ DECLINED — generic decline | `203` |
| `4000 0000 0000 0127` | ❌ DECLINED — CVV check failed | `230` |
| `4000 0000 0000 9995` | ❌ DECLINED — insufficient funds | `210` |
| `4000 0000 0000 0119` | ❌ ERROR — processing error (502 côté app) | — |
| `4000 0000 0000 0069` | ❌ DECLINED — expired card | `202` |

### Visa — scénarios 3D Secure 2.0

| Carte (PAN) | Résultat attendu |
|---|---|
| `4000 0000 0000 1091` | 🔐 **CHALLENGE** — simulateur Cardinal s'ouvre, tapez l'OTP simulé pour approuver |
| `4000 0025 0000 3155` | ✅ **FRICTIONLESS** — passage 3DS silencieux (recommandé pour tester un flow sans popup) |
| `4000 0000 0000 1026` | ❌ CHALLENGE puis DECLINED (3DS auth OK, carte refusée après) |
| `4000 0000 0000 1018` | ❌ 3DS not enrolled — fallback no-3DS |

### Mastercard

| Carte (PAN) | Résultat attendu |
|---|---|
| `5555 5555 5555 4444` | ✅ APPROVE — Mastercard credit |
| `5200 8282 8282 8210` | ✅ APPROVE — Mastercard debit |
| `2223 0000 1017 5833` | ✅ APPROVE — Mastercard 2-series (nouveau BIN) |
| `5200 0000 0000 0007` | ❌ DECLINED |
| `5200 0000 0000 1096` | 🔐 CHALLENGE 3DS |

### Amex (si enabled sur votre marchand)

| Carte (PAN) | Résultat attendu |
|---|---|
| `3782 822463 10005` | ✅ APPROVE |
| `3714 496353 98431` | ❌ DECLINED |

### Champs communs

Pour toutes les cartes test ci-dessus :

- **CVV** : `123` (ou `1234` pour Amex)
- **Expiration** : toute date dans le futur (ex: `12/28`)
- **Nom** : au choix (ex: `TEST USER`)
- **Adresse de facturation** : au choix, mais fournir au minimum `country` + `address_line1` + `city` + `postal_code` pour éviter les 400 validation

### Montants qui déclenchent des scénarios spéciaux

Avec les cartes "approve" ci-dessus, le montant peut influencer le résultat sur certains processeurs Cybersource :

| Amount USD | Comportement |
|---|---|
| `1.00` | Approve systématique (recommandé pour smoke tests) |
| `100.00` | Approve + risk score élevé (test flag anti-fraud) |
| `0.75` | **DECLINED** — simule une erreur sous-minimum (via code 400 app) |

::: tip Carte principale recommandée
Pour un premier smoke test complet (card → 3DS → webhook), utilisez **`4000 0025 0000 3155`** (Visa frictionless 3DS) avec montant `1.00 USD`. Flow entièrement simulé sans popup OTP.
:::

::: warning Ne jamais utiliser de vraies cartes sur sandbox
Même si le flow fonctionne, les transactions sandbox ne débitent pas — mais le CSV reporting et les métriques risque vont voir du bruit. Toute vraie carte vue sur le profile `drc_freshpaytest` est automatiquement flaggée + l'équipe prévient par email.
:::

Pour des scénarios supplémentaires (Carte étrangère, test de chargeback, test de pre-auth sans capture, etc.), contactez `henock.barakael@mokoafrika.com`.

## Tester un paiement de bout en bout

Voir [Quickstart](/quickstart) pour l'exemple complet (en remplaçant `BASE_URL` par `https://uc-test.card.gofreshpay.com`). Le flow :

1. `POST /api/v1/payment/orders` avec vos clés sandbox → `data.links`
2. Ouvrir `data.links` dans un navigateur
3. Taper carte de test + CVV + expiration future
4. Si 3DS : simulateur Cardinal ouvre, tapez l'OTP simulé
5. Redirect vers votre `return_url?status=SUCCESS&...`
6. Webhook envoyé sur votre `callback_url` (source de vérité)

### Exemple curl sandbox

```bash
# 1. Signer la requête (voir /authentication pour le détail HMAC)
API_KEY="your_sandbox_test_key"
API_SECRET="your_sandbox_secret"
BASE_URL="https://uc-test.card.gofreshpay.com"
TIMESTAMP=$(date +%s)
BODY='{"amount":1.00,"currency":"USD","merchant_reference":"test-001","callback_url":"https://your-shop.com/webhooks/moko"}'
SIGNATURE=$(printf "%s%s" "$BODY" "$TIMESTAMP" | openssl dgst -sha256 -hmac "$API_SECRET" | awk '{print $NF}')

# 2. Créer l'order (sandbox)
curl -X POST "$BASE_URL/api/v1/payment/orders" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

Réponse attendue : `200 OK` avec `data.links` (URL de checkout hébergée) et `data.transaction_uuid`.

## Vérifier vos webhooks

Pour tester la réception des webhooks en local (avant d'avoir un domaine public) :

- **ngrok** — `ngrok http 8000` puis passez l'URL `https://xxx.ngrok.io/webhook` comme `callback_url`
- **webhook.site** — pour inspecter le payload et la signature sans backend

Moko fournit aussi des endpoints de test sur **sandbox** pour recevoir manuellement des webhooks fake :

```bash
BASE_URL="https://uc-test.card.gofreshpay.com"

# Endpoint test qui reçoit un webhook fake et le stocke
curl -X POST "$BASE_URL/api/v1/test/test-callback" \
  -H "Content-Type: application/json" \
  -d '{"your":"payload","for":"testing"}'

# Consulter l'historique reçu
curl "$BASE_URL/api/v1/test/test-callback/history"

# Dernier reçu
curl "$BASE_URL/api/v1/test/test-callback/last"

# Vider l'historique
curl -X DELETE "$BASE_URL/api/v1/test/test-callback/clear"
```

Ces endpoints n'existent **que sur sandbox** — pas sur prod.

## Passer en production

Checklist avant de recevoir vos clés `live` :

- [ ] Signature HMAC vérifiée sur au moins 10 paiements sandbox
- [ ] Flow complet sandbox testé : création order → checkout → webhook reçu → statut persisté
- [ ] Webhook receiver stable, signature validée, idempotent
- [ ] Timeouts network gérés (Moko API : 20s max recommandé)
- [ ] Logs structurés en place
- [ ] Certificat SSL valide sur votre `return_url` et `callback_url`
- [ ] Variables d'env séparées `MOKO_BASE_URL`, `MOKO_API_KEY`, `MOKO_API_SECRET` pour sandbox vs prod
- [ ] Support customer prêt pour gérer les cas DECLINED / 3DS failed
- [ ] Réconciliation quotidienne prévue

Une fois checklist ✅, contactez `henock.barakael@mokoafrika.com` pour recevoir vos clés production et basculer `MOKO_BASE_URL` vers `https://uc.card.gofreshpay.com`.

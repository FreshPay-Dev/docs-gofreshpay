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

Notre profile Cybersource sandbox + Equity Bank Kenya acceptent **les cartes de test officielles Cybersource**. Les cartes ci-dessous ne débitent pas de vrais fonds — elles simulent les scénarios typiques côté réseau cartes et côté Payer Authentication (3DS 2.x).

::: warning Pas de "cartes de refus" en sandbox Cybersource
Cybersource sandbox **n'implémente pas de PAN-based declines**. Toutes les cartes de test ci-dessous sont APPROVE par défaut sur l'autorisation. Pour simuler un refus hors 3DS (CVV mismatch, insufficient funds, expired card, etc.), il faut utiliser des **triggers amount processor-specific** côté Equity Bank Kenya — ces triggers sont documentés dans leur Testing Guide propre et ne sont pas universels. Contactez `henock.barakael@mokoafrika.com` pour la liste à jour.

Les PANs du type `4000 0000 0000 00XX` qu'on trouve dans la doc Stripe ou Checkout.com **ne fonctionnent pas** chez Cybersource.
:::

### Standard (sans 3DS) — APPROVE

| Brand | Carte (PAN) | Résultat attendu |
|---|---|---|
| Visa | `4111 1111 1111 1111` | ✅ APPROVE (la plus utilisée) |
| Mastercard | `5555 5555 5555 4444` | ✅ APPROVE |
| Amex | `3782 822463 10005` | ✅ APPROVE (si enabled sur votre marchand) |

### Visa — 3D Secure 2.x (préfixe `4456 5300 0000`)

| Carte (PAN) | Scénario 3DS |
|---|---|
| `4456 5300 0000 0100` | ✅ **Frictionless SUCCESS** — pas de popup, auth réussie (`PARes status = Y`) |
| `4456 5300 0000 1013` | ❌ Frictionless FAILED (`DAUTHENTICATIONFAILED`) |
| `4456 5300 0000 1021` | ⚠️ Attempts processing (`PARes status = A`) |
| `4456 5300 0000 1039` | ⚠️ Unavailable (`PARes status = U`), proceed without liability shift |
| `4456 5300 0000 1047` | ❌ Rejected (`PARes status = R`), not permitted for authorization |
| `4456 5300 0000 1054` | ⚠️ Not available on lookup (`VERes enrolled = U`) |
| `4456 5300 0000 1062` | ⚠️ Enrollment check error |
| `4456 5300 0000 1070` | ⏱️ Time-out (10-12 s) |
| `4456 5300 0000 1088` | ⚠️ Bypassed (`VERes enrolled = B`) |
| `4456 5300 0000 1096` | 🔐 **Step-up challenge SUCCESS** — simulateur Cardinal s'ouvre, l'OTP valide → auth OK |
| `4456 5300 0000 1104` | 🔐 **Step-up challenge FAILED** — challenge ouvre, auth refusée (`PARes status = N`) |
| `4456 5300 0000 1112` | ⚠️ Unavailable step-up (`PARes status = U`) |

### Mastercard — 3D Secure 2.x (préfixe `5200 0000 0000`)

Mêmes 4 derniers chiffres que la grille Visa ci-dessus — par exemple `5200 0000 0000 1005` pour Frictionless SUCCESS, `5200 0000 0000 1096` pour Step-up SUCCESS, `5200 0000 0000 1104` pour Step-up FAILED.

### Champs communs

Pour toutes les cartes test ci-dessus :

- **CVV** : `123` (ou `1234` pour Amex)
- **Expiration** : la doc Cybersource recommande **janvier de l'année courante + 3 ans** (ex: `01/29` en 2026). Toute date future reste acceptée.
- **Nom** : au choix (ex: `TEST USER`)
- **Adresse de facturation** : au choix, mais fournir au minimum `country` + `address_line1` + `city` + `postal_code` pour éviter les 400 validation

::: tip Carte principale recommandée
Pour un premier smoke test complet (card → 3DS → webhook), utilisez **`4456 5300 0000 0100`** (Visa frictionless 3DS SUCCESS) avec montant `1.00 USD`. Flow entièrement simulé sans popup OTP, retourne `SUCCESS` directement.

Pour tester le flow challenge-OTP, utilisez **`4456 5300 0000 1096`** — le simulateur Cardinal ouvre, saisissez l'OTP simulé (`1234`) → auth validée → SUCCESS.

Pour tester un flow 3DS refusé, utilisez **`4456 5300 0000 1104`** — le simulateur Cardinal ouvre puis renvoie un échec d'authentification → FAILED.
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

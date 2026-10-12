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

Pour obtenir vos clés sandbox + l'accès à un compte marchand de test, contactez `dev@gofreshpay.com`.

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

Les cartes de test spécifiques dépendent de notre profile Cybersource sandbox + de l'acquirer (Equity Bank Kenya). Pour recevoir la liste actuelle des PANs sandbox valides avec les scénarios associés (approve, decline, 3DS challenge, 3DS frictionless), contactez `dev@gofreshpay.com`.

::: warning
Les cartes de test génériques Cybersource (comme `4111 1111 1111 1111`) **ne fonctionnent pas** sur notre profile — notre routing passe par Equity Bank Kenya qui a sa propre liste de BINs testables. L'équipe Moko peut fournir les BINs sur demande.
:::

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

Une fois checklist ✅, contactez `dev@gofreshpay.com` pour recevoir vos clés production et basculer `MOKO_BASE_URL` vers `https://uc.card.gofreshpay.com`.

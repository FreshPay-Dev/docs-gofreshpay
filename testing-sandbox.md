# Testing & Sandbox

## Environnements

Une seule base URL, deux environnements distingués par vos clés :

```
https://uc.card.gofreshpay.com
```

- **Sandbox** — clés `test_*`. Cartes de test uniquement. Aucun débit réel.
- **Production** — clés `live_*`. **Débits réels sur les cartes du customer.**

::: danger Ne jamais mixer les environnements
Le serveur refuse strictement une clé sandbox sur une tx prod (et vice-versa). Vous recevrez un HTTP 403 `Unauthorized environment`. Vérifiez vos variables d'environnement au démarrage.
:::

## Cartes de test (sandbox)

Utilisez ces numéros **uniquement** avec vos clés sandbox `test_*`.

| Numéro | Type | Résultat attendu | 3DS |
|---|---|---|---|
| `4111 1111 1111 1111` | Visa | ✅ SUCCESS | Frictionless (pas d'OTP) |
| `4000 0000 0000 0002` | Visa | ❌ DECLINED | Frictionless |
| `4000 0000 0000 3220` | Visa | ✅ SUCCESS | Challenge OTP requis |
| `5555 5555 5555 4444` | MasterCard | ✅ SUCCESS | Frictionless |
| `5200 8282 8282 8210` | MasterCard | ❌ DECLINED | Frictionless |
| `2223 0000 4841 0010` | MasterCard 2-series | ✅ SUCCESS | Challenge OTP requis |

**Pour tous les tests** :
- CVV : `123` (Visa) ou `1234` (Amex si applicable)
- Expiration : n'importe quelle date **future** (ex : `12/28`)
- OTP challenge : `1234` sur la page issuer simulée

## Tester un paiement de bout en bout

```bash
# 1. Créer une tx test $1
curl -X POST https://uc.card.gofreshpay.com/api/v1/payment/orders \
  -H "X-API-Key: test_..." \
  -H "X-Timestamp: 2026-09-30T10:00:00Z" \
  -H "X-Signature: ..." \
  -d '{"amount":100,"currency":"USD","reference":"TEST-001","customer_email":"test@example.com","customer_name":"Test User","return_url":"http://localhost:8000/return"}'

# 2. Ouvrir checkout_url dans votre navigateur
# 3. Taper carte 4111 1111 1111 1111 + CVV 123 + 12/28
# 4. Validation 3DS (frictionless ou OTP 1234 selon carte)
# 5. Redirect vers return_url avec ?status=succeeded
# 6. Webhook envoyé sur callback_url (si configuré) — vérifier votre serveur test
```

## Sandbox pour Mobile Money

*Documentation à venir. Contact `dev@gofreshpay.com` pour setup sandbox MM temporaire.*

## Vérifier vos webhooks

Pour tester la réception des webhooks en local (avant d'avoir un domaine public), utilisez :

- **ngrok** — `ngrok http 8000` puis passez l'URL `https://xxx.ngrok.io/webhook` comme `callback_url`
- **webhook.site** — pour inspecter le payload et la signature sans backend

Moko fournit aussi un endpoint pour tester manuellement l'envoi d'un webhook :

```bash
# Test callback receiver Moko (utile pour debugger votre HMAC verification)
curl -X POST https://uc.card.gofreshpay.com/api/v1/test/test-callback \
  -H "Content-Type: application/json" \
  -d '{"your":"payload","for":"testing"}'

# Consulter l'historique reçu
curl https://uc.card.gofreshpay.com/api/v1/test/test-callback/history
```

## Passer en production

Checklist avant de flipper de `test_` à `live_` :

- [ ] Signature HMAC verifiée sur au moins 10 paiements sandbox
- [ ] Webhook receiver stable, signature validée, idempotent
- [ ] Timeouts network gérés (Moko API : 20s max recommandé)
- [ ] Logs structurés en place (Sentry, CloudWatch, etc.)
- [ ] Certificat SSL valide sur votre `return_url` et `callback_url`
- [ ] Support customer prêt pour gérer les cas DECLINED / 3DS failed
- [ ] Réconciliation quotidienne prévue (voir [Refunds](/card/refunds))
- [ ] Rotation `api_secret` planifiée (calendrier semestriel)

Une fois checklist ✅, contactez `dev@gofreshpay.com` pour recevoir vos clés `live_*`.

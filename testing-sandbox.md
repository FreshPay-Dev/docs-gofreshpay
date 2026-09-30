# Testing & Sandbox

## Environnements

Une seule base URL :

```
https://uc.card.gofreshpay.com
```

L'environnement (`development` / `production`) est **rattaché à votre profile marchand** côté serveur. Une clé marchand `is_test=1` ne peut pas encaisser en production.

::: danger Cross-environment strictement bloqué
Utiliser une clé sandbox sur un endpoint prod (ou l'inverse) → **HTTP 403 `Unauthorized environment`**. Vérifiez vos variables d'environnement au démarrage.
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

Les cartes de test spécifiques dépendent de votre profile Cybersource + de l'acquirer (Equity Bank Kenya). Pour recevoir la liste actuelle des PANs sandbox valides, contactez `dev@gofreshpay.com`.

::: warning
Les cartes de test génériques Cybersource (comme `4111 1111 1111 1111`) ne fonctionnent pas nécessairement sur notre profile production car il route via Equity Bank Kenya. Équipe Moko peut fournir les BINs testables sur demande.
:::

## Tester un paiement de bout en bout

Voir [Quickstart](/quickstart) pour l'exemple complet. Le flow :

1. `POST /api/v1/payment/orders` avec vos clés sandbox → `data.links`
2. Ouvrir `data.links` dans un navigateur
3. Taper carte de test + CVV + expiration future
4. Si 3DS : simulateur Cardinal ouvre, tapez l'OTP simulé
5. Redirect vers votre `return_url?status=SUCCESS&...`
6. Webhook envoyé sur votre `callback_url` (source de vérité)

## Vérifier vos webhooks

Pour tester la réception des webhooks en local (avant d'avoir un domaine public) :

- **ngrok** — `ngrok http 8000` puis passez l'URL `https://xxx.ngrok.io/webhook` comme `callback_url`
- **webhook.site** — pour inspecter le payload et la signature sans backend

Moko fournit aussi des endpoints pour tester manuellement la réception :

```bash
# Endpoint test qui reçoit un webhook fake et le stocke
curl -X POST https://uc.card.gofreshpay.com/api/v1/test/test-callback \
  -H "Content-Type: application/json" \
  -d '{"your":"payload","for":"testing"}'

# Consulter l'historique reçu
curl https://uc.card.gofreshpay.com/api/v1/test/test-callback/history

# Dernier reçu
curl https://uc.card.gofreshpay.com/api/v1/test/test-callback/last

# Vider l'historique
curl -X DELETE https://uc.card.gofreshpay.com/api/v1/test/test-callback/clear
```

## Passer en production

Checklist avant d'utiliser vos clés `live` :

- [ ] Signature HMAC verifiée sur au moins 10 paiements sandbox
- [ ] Webhook receiver stable, signature validée, idempotent
- [ ] Timeouts network gérés (Moko API : 20s max recommandé)
- [ ] Logs structurés en place
- [ ] Certificat SSL valide sur votre `return_url` et `callback_url`
- [ ] Support customer prêt pour gérer les cas DECLINED / 3DS failed
- [ ] Réconciliation quotidienne prévue

Une fois checklist ✅, contactez `dev@gofreshpay.com` pour recevoir vos clés production.

# Hosted Checkout (UC)

Mode le plus simple : votre backend crée un paiement, Moko retourne un `checkout_url`, vous redirigez le customer.

## Flow

```
1. Customer clique "Payer par carte" sur votre site
2. Votre backend → POST /api/v1/payment/orders (HMAC signé)
3. Moko répond avec { checkout_url, transaction_uuid, expires_at }
4. Votre site redirige le customer vers checkout_url
5. Customer tape sa carte sur la page Moko, valide 3DS
6. Cybersource fait auth + capture
7. Customer redirigé vers return_url?status=succeeded (ou ?status=failed)
8. Webhook envoyé sur callback_url (async, source de vérité)
```

## Créer un paiement

**Endpoint** : `POST /api/v1/payment/orders`
**Auth** : HMAC ([voir Authentication](/authentication))

### Body

```json
{
  "amount": 100,
  "currency": "USD",
  "reference": "INV-042",
  "description": "Facture INV-042",
  "customer_email": "client@example.com",
  "customer_name": "Jean Kabala",
  "return_url": "https://your-shop.com/order/INV-042/return",
  "callback_url": "https://your-shop.com/webhooks/moko",
  "expires_in_minutes": 15
}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `amount` | int | ✅ | Montant en cents (100 = 1.00 USD) |
| `currency` | string | ✅ | `USD` ou `CDF` |
| `reference` | string | ✅ | Votre ID interne unique par tx |
| `description` | string | | Affiché au customer sur le checkout |
| `customer_email` | string | ✅ | Email du payeur |
| `customer_name` | string | ✅ | Nom du payeur (pour billTo) |
| `return_url` | string | ✅ | URL de retour après paiement (avec `?status=succeeded\|failed`) |
| `callback_url` | string | | Webhook async pour événements (recommandé) |
| `expires_in_minutes` | int | | Durée validité du checkout, default 15 min |

### Réponse

```json
{
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "checkout_url": "https://uc.card.gofreshpay.com/api/v1/payment/uc/6f719977-.../?sig=abc123...",
  "expires_at": "2026-09-30T10:15:00Z",
  "status": "PENDING"
}
```

## Rediriger le customer

```html
<!-- Depuis votre backend, retournez un redirect HTTP 303 -->
<a href="{{ checkout_url }}">Payer 1,00 USD</a>

<!-- OU JavaScript client-side après réponse fetch/axios -->
<script>
  window.location.href = data.checkout_url;
</script>
```

## Recevoir le résultat

### Return URL

Le customer est redirigé vers votre `return_url` avec un query param :

- `?status=succeeded` — paiement réussi
- `?status=failed` — refusé ou annulé
- `?status=expired` — timeout (customer n'a rien fait dans les 15 min)

::: warning
Le `return_url` est **basé sur du redirect client-side** — ne l'utilisez PAS comme source de vérité pour valider un paiement. Le customer peut fermer son navigateur avant le redirect. Utilisez le **webhook** pour confirmer.
:::

### Webhook (source de vérité)

Si vous avez fourni `callback_url`, Moko POSTe un JSON signé sur cette URL dès que le paiement est finalisé côté Cybersource :

```json
{
  "event_type": "PAYMENT",
  "status": "SUCCESS",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "transaction_id": "7907643500666758704885",
  "amount": "1.00",
  "currency": "USD",
  "reference": "INV-042",
  "reason_code": null,
  "message": null,
  "timestamp": "2026-09-30T10:32:00Z"
}
```

Header `X-FreshPay-Signature` à vérifier — voir [Webhooks](/card/webhooks).

## Personnalisation

::: info
Le hosted checkout est aux couleurs Moko par défaut. Pour un checkout branded (votre logo, palette, textes), utilisez [Custom Checkout (Microform)](/card/microform).
:::

## Erreurs courantes

| HTTP | Detail | Cause |
|---|---|---|
| 400 | `amount must be > 0` | Body invalide |
| 401 | `Missing authentication headers` | Un header HMAC manquant |
| 403 | `Invalid request signature` | HMAC ne match pas |
| 409 | `reference already used` | Idempotency : cette `reference` a déjà une tx |
| 422 | `currency must be USD or CDF` | Devise non supportée |

## Voir aussi

- [Authentication](/authentication) — signature HMAC
- [Webhooks](/card/webhooks) — vérification signature
- [Refunds](/card/refunds) — rembourser un paiement

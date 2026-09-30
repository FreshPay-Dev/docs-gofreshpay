# Hosted Checkout (UC)

Mode le plus simple : votre backend crée un paiement, Moko retourne une URL de checkout, vous redirigez le customer.

## Flow

```
1. Customer clique "Payer par carte" sur votre site
2. Votre backend → POST /api/v1/payment/orders (HMAC signé)
3. Moko répond avec { data: { links, transaction_uuid, transaction_status, ... } }
4. Votre site redirige le customer vers data.links
5. Customer tape sa carte sur la page Moko (Unified Checkout SDK Cybersource)
6. 3DS Payer Authentication (frictionless ou OTP challenge)
7. Cybersource fait auth + capture
8. Customer redirigé vers return_url?status=SUCCESS&... (ou ?status=FAILED&...)
9. Webhook signé POSTé sur callback_url (async, source de vérité)
```

## Endpoint

`POST /api/v1/payment/orders`
Auth : HMAC ([voir Authentication](/authentication))

## Request body

Basé sur le model Pydantic `PaymentInitiationRequest`.

```json
{
  "amount": 1.00,
  "currency": "USD",
  "merchant_reference": "INV-042",
  "callback_url": "https://your-shop.com/webhooks/moko",
  "bill_to_forename": "Jean",
  "bill_to_surname": "Kabala",
  "bill_to_email": "client@example.com",
  "bill_to_phone": "+243812345001",
  "bill_to_address_line1": "Av. Kasa-Vubu 42",
  "bill_to_address_city": "Kinshasa",
  "bill_to_address_country": "CD",
  "bill_to_address_state": null,
  "bill_to_address_postal_code": null,
  "return_url": "https://your-shop.com/order/INV-042",
  "redirect_url": null,
  "cancel_url": "https://your-shop.com/order/INV-042/cancelled"
}
```

### Champs

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `amount` | float | ✅ | > 0. Min USD 1.00 / CDF 500.00 |
| `currency` | string | ✅ | `USD` ou `CDF` seulement |
| `merchant_reference` | string | ✅ | Min 1 char |
| `callback_url` | string | ✅ | URL webhook events |
| `bill_to_forename` | string | ✅ | Min 1 char |
| `bill_to_surname` | string | ✅ | Min 1 char |
| `bill_to_email` | string | ✅ | Regex `^[^@]+@[^@]+\.[^@]+$`, lowercased server-side |
| `bill_to_phone` | string | ✅ | 5-20 chars, regex `^[\d\+][\d\s\-\(\)]+$`. Normalisé E.164 côté serveur. |
| `bill_to_address_line1` | string | ✅ | |
| `bill_to_address_city` | string | ✅ | |
| `bill_to_address_country` | string | ✅ | ISO 3166-1 alpha-2, uppercased server-side |
| `bill_to_address_state` | string | conditionnel | Requis pour US/CA (2 chars) |
| `bill_to_address_postal_code` | string | conditionnel | Requis pour US/CA. Format US : `12345` ou `12345-6789`. Format CA : `A1A1A1`. |
| `return_url` | string | | URL retour post-payment. Si absent, page par défaut Moko. |
| `redirect_url` | string | | Alias de `return_url` (accepté pour compatibilité) |
| `cancel_url` | string | | URL retour si customer annule |

## Response body

```json
{
  "status": "success",
  "data": {
    "amount": "1.00",
    "currency": "USD",
    "transaction_uuid": "FP-20260930-101530-a1b2c3d4-CD",
    "transaction_status": "PENDING",
    "links": "https://uc.card.gofreshpay.com/api/v1/payment/FP-20260930-101530-a1b2c3d4-CD?sig=abc123...",
    "financial_details": {
      "commission_rate": "3.50",
      "commission_amount": "0.04",
      "merchant_amount": "0.96",
      "bank_commission_amount": "0.03",
      "freshpay_commission_amount": "0.01"
    }
  }
}
```

- `transaction_uuid` — format `FP-YYYYMMDD-HHMMSS-{8chars}-CD`, votre identifiant Moko unique
- `transaction_status` — toujours `PENDING` à ce stade
- `links` — URL courte à laquelle rediriger le customer (déjà signée `?sig=...`)
- `financial_details` — breakdown de commission calculé côté serveur

TTL : la tx expire après **20 minutes** si le customer ne complète pas le checkout (configurable via env `CYBERSOURCE_PAYMENT_TTL_MINUTES`).

## Rediriger le customer

```html
<!-- Backend renvoie un redirect 303 -->
<a href="{{ data.links }}">Payer 1,00 USD</a>
```

Ou JavaScript :

```javascript
window.location.href = resp.data.links;
```

## Return URL

Le customer est redirigé vers votre `return_url` avec des query params.

**Succès** :
```
?status=SUCCESS&transaction_uuid=FP-...&transaction_id=<cs_id>&amount=1.00&currency=USD&reference=INV-042
```

**Échec** :
```
?status=FAILED&transaction_uuid=FP-...&reason_code=201&message=...
```

::: warning
Le `return_url` est un redirect client-side — **ne l'utilisez PAS comme source de vérité** pour valider un paiement. Le customer peut fermer son navigateur avant. Utilisez le **webhook** (`callback_url`) pour la confirmation.
:::

## Webhook

Voir [Webhooks](/card/webhooks) pour le schema complet + vérification signature.

Payload PAYMENT (extrait) :

```json
{
  "status": "SUCCESS",
  "reference": "INV-042",
  "amount": "1.00",
  "currency": "USD",
  "decision": "ACCEPT",
  "message": "Request was processed successfully.",
  "transaction_uuid": "FP-20260930-101530-a1b2c3d4-CD",
  "auth_cavv_result": "3",
  "customer_name": "Jean Kabala",
  "customer_email": "client@example.com",
  "cavv_message": "",
  "card_type": "Visa",
  "card_last4": "3172",
  "card_expiry_date": "12-2028",
  "card_bin_country": "CD",
  "card_issuer": "Equity Bank",
  "card_scheme": "VISA DEBIT"
}
```

## Consulter le statut

`POST /api/v1/payment/status`
Auth : HMAC ([voir Authentication](/authentication))

### Request

```json
{ "transaction_uuid": "FP-20260930-101530-a1b2c3d4-CD" }
```

### Response

```json
{
  "status": "success",
  "data": {
    "amount": "1.00",
    "currency": "USD",
    "merchant_reference": "INV-042",
    "message": "Request was processed successfully.",
    "transaction_uuid": "FP-...",
    "transaction_status": "SUCCESS",
    "card_type": "Visa",
    "card_last4": "3172",
    "card_expiry_date": "12-2028",
    "card_bin_country": "CD",
    "card_issuer": "Equity Bank",
    "card_scheme": "VISA DEBIT"
  }
}
```

`transaction_status` possibles : `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `EXPIRED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `VOIDED`.

Cross-merchant strictement bloqué : un marchand ne peut consulter que ses propres tx (`HTTP 404 Transaction not found` sinon).

## Erreurs courantes

| HTTP | Detail | Cause |
|---|---|---|
| 400 | `Currency '{currency}' is not supported. Allowed: CDF, USD` | Autre devise que USD/CDF |
| 400 | `Minimum amount for USD is 1.00` | Amount trop petit |
| 400 | `bill_to_address_state is required for US/CA` | US ou CA sans state |
| 400 | `Invalid US ZIP code format (expected: 12345 or 12345-6789)` | ZIP US mal formé |
| 400 | `Invalid Canadian postal code format (expected: A1A1A1)` | Postal CA mal formé |
| 400 | Autre validation Pydantic | Body malformé |
| 401 | `Missing authentication headers` | Un header HMAC manquant |
| 403 | `Invalid request signature` | HMAC ne match pas |
| 404 | `Merchant not found` | `merchant_id` derived from `X-API-Key` introuvable |
| 500 | `Payment processing error` | Erreur interne |

## Voir aussi

- [Authentication](/authentication) — signature HMAC
- [Webhooks](/card/webhooks) — vérification signature webhook
- [Refunds](/card/refunds) — rembourser un paiement

# Voids

Annulation d'une auth ou capture **avant settlement** (typiquement < 24h après la tx). Aucun mouvement de fonds sur la carte — comme si la tx n'avait jamais existé.

::: warning Accès restreint
Voids exposés sous `/api/v1/admin/*` avec double protection : `X-Admin-Token` + allowlist nginx bastion. Contactez `dev@gofreshpay.com` pour intégrer dans votre backoffice marchand.
:::

## Void vs Refund

| | Void | Refund |
|---|---|---|
| Quand ? | < 24h (avant clearing) | Après settlement |
| Coût | 0 (gratuit) | Interchange perdu (~1-2%) |
| Effet carte customer | Rien (auth relâchée) | 2 lignes visible : charge + refund |
| Réversible ? | Non | Non |
| Montant | Full only | Partiel possible |

**Préférez void quand la fenêtre le permet** — pas d'interchange perdu.

## Endpoint

`POST /api/v1/admin/payment/voids/{cs_payment_id}`

## Body

```json
{
  "reason": "Erreur ops — mauvais client",
  "notify_merchant": true,
  "force": false
}
```

## Réponse

```json
{
  "void_id": 3,
  "cs_void_id": "7907621859236796504887",
  "status": "SUCCESS",
  "amount": "50.0000",
  "currency": "USD",
  "transaction_status": "VOIDED"
}
```

## Guards

- Tx status = `SUCCESS` (pas de void sur refundée ou déjà voided)
- `refunded_amount == 0` (déjà refundée = interchange déjà bougé)
- Tx < **24h** (bypass via `force=true`, mais CS peut renvoyer `rc=246` si settlement déjà passé)
- 1 seul void par tx (contrainte DB `UNIQUE cs_payment_id`)

## Historique voids

**Endpoint** : `GET /api/v1/admin/payment/voids/{transaction_uuid}`

```json
{
  "transaction_uuid": "6f719977-...",
  "voids": [
    {
      "id": 3,
      "cs_void_id": "7907621859236796504887",
      "amount": "50.0000",
      "status": "SUCCESS",
      "reason": "Erreur ops — mauvais client",
      "voided_by": "henock",
      "created_at": "2026-09-30T11:30:00Z"
    }
  ]
}
```

## Webhook merchant

Si `notify_merchant: true`, webhook signé HMAC :

```json
{
  "event_type": "VOID",
  "status": "SUCCESS",
  "transaction_uuid": "6f719977-...",
  "cs_payment_id": "7907643500666758704885",
  "cs_void_id": "7907621859236796504887",
  "void_id": 3,
  "amount": "50.00",
  "currency": "USD",
  "reason": "Erreur ops — mauvais client",
  "timestamp": "2026-09-30T11:30:00Z"
}
```

## Erreurs

| HTTP | Detail |
|---|---|
| 403 | `Invalid admin token` |
| 404 | `No transaction with cs_payment_id=X` |
| 409 | `Cannot void a tx in status X` (status ≠ SUCCESS) |
| 409 | `Transaction already has refunds` |
| 409 | `Transaction is Xh old, beyond 24h window` (pass `force=true`) |
| 502 | `Void upstream failed` |

## rc=246 : cannot void at this time

Signifie que Cybersource considère la tx comme déjà settled (clearing batch passé). Utilisez [Refund](/card/refunds) à la place.

## Cas d'usage typiques

- **Erreur de saisie ops** — chargé le mauvais montant ou mauvais client
- **Fraude détectée immédiatement** — void avant que les fonds bougent
- **Ordre annulé instantanément** — customer change d'avis dans les minutes qui suivent

Après 24h, plus qu'un refund possible.

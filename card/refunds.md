# Refunds

Remboursement d'une transaction carte, partiel ou complet, via l'API admin.

::: warning Accès restreint
Les refunds sont exposés sous `/api/v1/admin/*` avec double protection :
- Header `X-Admin-Token` (constant-time compare)
- Allowlist réseau nginx (bastion FreshPay + localhost)

Pour intégrer refunds dans votre backoffice marchand, contactez `dev@gofreshpay.com` — on met en place un accès dédié (VPN ou proxy signé).
:::

## Endpoint

`POST /api/v1/admin/payment/refunds/{cs_payment_id}`

`cs_payment_id` = le `transaction_id` retourné par Cybersource (visible dans les webhooks ou dans notre DB `cybersource_transactions.transaction_id`).

## Body

```json
{
  "amount": 25.00,
  "reason": "Client demandé — commande annulée",
  "notify_merchant": true,
  "force": false
}
```

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `amount` | number | plein montant restant | Montant à rembourser. Omit pour full refund. |
| `reason` | string | ✅ | Raison libre (audit, min 3 chars) |
| `notify_merchant` | bool | `true` | Envoyer webhook `event_type=REFUND` au marchand |
| `force` | bool | `false` | Bypass window guard 60 jours (admin only) |

## Réponse

```json
{
  "refund_id": 6,
  "cs_refund_id": "7907645194846489004894",
  "status": "SUCCESS",
  "amount": "25.0000",
  "currency": "USD",
  "refunded_total": "25.0000",
  "remaining": "25.0000",
  "transaction_status": "PARTIALLY_REFUNDED"
}
```

## Guards

- Tx status doit être `SUCCESS` ou `PARTIALLY_REFUNDED`
- `refunded_amount + amount <= tx.amount` (pas d'over-refund)
- Tx doit avoir été créée dans les **60 derniers jours** (bypass via `force=true`)

## Refund partiel multi-étapes

Vous pouvez refunder en plusieurs fois tant qu'il reste du montant :

```bash
# tx originale : 100 USD
# 1er refund partiel 30 USD
POST /admin/payment/refunds/{cs_payment_id}  {"amount": 30, "reason": "..."}
# → tx_status = PARTIALLY_REFUNDED, remaining = 70

# 2e refund 50 USD
POST /admin/payment/refunds/{cs_payment_id}  {"amount": 50, "reason": "..."}
# → tx_status = PARTIALLY_REFUNDED, remaining = 20

# 3e refund du reste (omit amount)
POST /admin/payment/refunds/{cs_payment_id}  {"reason": "..."}
# → tx_status = REFUNDED, remaining = 0
```

## Historique refunds d'une tx

**Endpoint** : `GET /api/v1/admin/payment/refunds/{transaction_uuid}`

```json
{
  "transaction_uuid": "6f719977-efc6-...",
  "refunds": [
    {
      "id": 6,
      "cs_refund_id": "7907645194846489004894",
      "amount": "25.0000",
      "status": "SUCCESS",
      "reason": "Client demandé — commande annulée",
      "refunded_by": "henock",
      "created_at": "2026-09-30T11:00:00Z",
      "callback_delivered": true,
      ...
    }
  ]
}
```

## Webhook merchant

Si `notify_merchant: true`, un webhook signé HMAC est envoyé sur le `callback_url` de la tx originale :

```json
{
  "event_type": "REFUND",
  "status": "SUCCESS",
  "transaction_uuid": "6f719977-...",
  "reference": "INV-042",
  "cs_payment_id": "7907643500666758704885",
  "cs_refund_id": "7907645194846489004894",
  "refund_id": 6,
  "amount": "25.00",
  "currency": "USD",
  "refunded_total": "25.00",
  "remaining": "25.00",
  "reason": "Client demandé — commande annulée",
  "timestamp": "2026-09-30T11:00:00Z"
}
```

Header `X-FreshPay-Signature` = HMAC-SHA256 du body avec votre `callback_secret`. Voir [Webhooks](/card/webhooks) pour vérification.

## Différence avec Void

- **Refund** — après settlement (typiquement >24h) — mouvement de fonds inverse. Coûte l'interchange perdu.
- **Void** — avant settlement (<24h) — auth annulée sans mouvement de fonds. Gratuit.

Utilisez [Void](/card/voids) quand c'est encore possible, refund quand c'est trop tard.

## Erreurs

| HTTP | Detail | Cause |
|---|---|---|
| 403 | `Invalid admin token` | `X-Admin-Token` incorrect |
| 404 | `No transaction with cs_payment_id=X` | tx introuvable |
| 409 | `Cannot refund a tx in status FAILED` | Rien à refunder |
| 409 | `Transaction already fully refunded` | `remaining` = 0 |
| 422 | `Refund amount exceeds remaining` | Over-refund |
| 409 | `Transaction older than 60 days` | Passer `force=true` |
| 502 | `Refund upstream failed` | Erreur Cybersource — retry |

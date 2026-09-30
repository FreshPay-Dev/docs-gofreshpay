# Payment Links

URL courte que le marchand partage par WhatsApp, SMS, email ou QR code. Le customer clique, arrive sur le checkout Moko, paie. **Zéro code côté marchand.**

## Cas d'usage

- **Agents commerciaux** — envoient un lien après un rdv, encaissent à distance
- **Restaurants** — QR code sur la table
- **Freelance / consultants** — facture par WhatsApp
- **Cotisations, mutuelles, dons** — lien réutilisable multi-uses
- **Rappels de paiement** — impayés, échéances

## Créer un lien

**Endpoint** : `POST /api/v1/payment-links`
**Auth** : HMAC merchant

### Body

```json
{
  "amount": 50.00,
  "currency": "USD",
  "description": "Facture INV-042 — cours de formation",
  "merchant_reference": "INV-042",
  "expires_in_hours": 168,
  "max_uses": 1,
  "metadata": {"customer_id": "cust_123"},
  "callback_url": "https://your-shop.com/webhooks/moko"
}
```

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `amount` | number | ✅ | Montant en unités (50.00 = 50 USD) |
| `currency` | string | `USD` | `USD` ou `CDF` |
| `description` | string | | Affichée au customer sur le checkout |
| `merchant_reference` | string | | Votre ID interne |
| `expires_in_hours` | int | 168 (7 jours) | Durée validité, max 90 jours |
| `max_uses` | int | 1 | 1 = single-use, N = multi-paiements |
| `metadata` | object | | Champs libres |
| `callback_url` | string | | Webhook pour événements paiement |

### Réponse

```json
{
  "link_id": 42,
  "short_code": "aBc1XyZ9",
  "checkout_url": "https://uc.card.gofreshpay.com/pl/aBc1XyZ9",
  "amount": "50.0000",
  "currency": "USD",
  "description": "Facture INV-042 — cours de formation",
  "max_uses": 1,
  "use_count": 0,
  "status": "ACTIVE",
  "expires_at": "2026-10-07T10:00:00Z",
  "created_at": "2026-09-30T10:00:00Z"
}
```

## Partager

```
Bonjour, votre lien de paiement 50.00 USD :
https://uc.card.gofreshpay.com/pl/aBc1XyZ9
Le lien expire dans 7 jours.
```

Ou générez un QR code :

```bash
# Avec qrencode CLI
echo "https://uc.card.gofreshpay.com/pl/aBc1XyZ9" | qrencode -o inv-042.png
```

## Que voit le customer

1. Clique le lien → arrive sur `pl/aBc1XyZ9`
2. Automatiquement redirigé vers le checkout carte hébergé Moko
3. Voit le montant + description
4. Tape sa carte, valide 3DS
5. Redirection vers page de confirmation Moko
6. Vous recevez le webhook

## Suivre un lien

**Endpoint** : `GET /api/v1/payment-links/{link_id}`
**Auth** : HMAC merchant

Retourne l'état du lien + toutes les tx associées :

```json
{
  "link": {
    "link_id": 42,
    "short_code": "aBc1XyZ9",
    "amount": "50.0000",
    "currency": "USD",
    "status": "EXHAUSTED",
    "use_count": 1,
    "max_uses": 1,
    ...
  },
  "transactions_count": 1,
  "transactions": [
    {
      "transaction_uuid": "6f719977-...",
      "amount": "50.0000",
      "currency": "USD",
      "status": "SUCCESS",
      "transaction_id": "7907643500666758704885",
      "created_at": "2026-10-01T14:22:00Z"
    }
  ]
}
```

## Annuler un lien

**Endpoint** : `POST /api/v1/payment-links/{link_id}/cancel`
**Auth** : HMAC merchant

Empêche tout futur clic sur le lien. Les tx déjà réussies ne sont **pas** annulées.

```json
{ "link_id": 42, "status": "CANCELLED" }
```

Si le customer clique après cancel, il verra :

> **Lien annulé** — Ce lien a été annulé par le marchand.

## Statuts

| Status | Signification |
|---|---|
| `ACTIVE` | Utilisable, dans la fenêtre de validité |
| `EXHAUSTED` | `max_uses` atteint |
| `EXPIRED` | Passé la date `expires_at` |
| `CANCELLED` | Annulé manuellement par marchand |

## Multi-uses (cotisations, dons)

Pour un lien réutilisable N fois :

```json
{
  "amount": 5.00,
  "currency": "USD",
  "description": "Don pour l'orphelinat Saint-Joseph",
  "expires_in_hours": 2160,
  "max_uses": 500
}
```

Chaque visite crée une tx séparée. Le lien passe à `EXHAUSTED` après 500 paiements OU après 90 jours.

## Limites

- Max **90 jours** validité (`expires_in_hours` ≤ 2160)
- Max **10 000 uses**
- Le lien ne peut pas être modifié après création (créez-en un nouveau)

## Voir aussi

- [Webhooks](/card/webhooks) — recevoir les paiements
- [Refunds](/card/refunds) — rembourser une tx issue d'un link

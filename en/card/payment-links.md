# Payment Links

A short URL that the merchant shares via WhatsApp, SMS, email, or QR code. The customer clicks it, lands on the Moko checkout, and pays. **Zero code on the merchant side.**

## Use cases

- **Sales agents** — send a link after a meeting and collect payment remotely
- **Restaurants** — QR code on the table
- **Freelancers / consultants** — invoice via WhatsApp
- **Membership fees, mutual insurance, donations** — reusable multi-use link
- **Payment reminders** — unpaid invoices, due dates

## Create a link

**Endpoint**: `POST /api/v1/payment-links`
**Auth**: Merchant HMAC

### Body

```json
{
  "amount": 50.00,
  "currency": "USD",
  "description": "Invoice INV-042 — training course",
  "merchant_reference": "INV-042",
  "expires_in_hours": 168,
  "max_uses": 1,
  "metadata": {"customer_id": "cust_123"},
  "callback_url": "https://your-shop.com/webhooks/moko"
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `amount` | number | ✅ | Amount in units (50.00 = 50 USD) |
| `currency` | string | `USD` | `USD` or `CDF` |
| `description` | string | | Shown to the customer on the checkout |
| `merchant_reference` | string | | Your internal ID |
| `expires_in_hours` | int | 168 (7 days) | Validity period, max 90 days |
| `max_uses` | int | 1 | 1 = single-use, N = multiple payments |
| `metadata` | object | | Free-form fields |
| `callback_url` | string | | Webhook for payment events |

### Response

```json
{
  "link_id": 42,
  "short_code": "aBc1XyZ9",
  "checkout_url": "https://uc.card.gofreshpay.com/pl/aBc1XyZ9",
  "amount": "50.0000",
  "currency": "USD",
  "description": "Invoice INV-042 — training course",
  "max_uses": 1,
  "use_count": 0,
  "status": "ACTIVE",
  "expires_at": "2026-10-07T10:00:00Z",
  "created_at": "2026-09-30T10:00:00Z"
}
```

## Share

```
Hello, here is your payment link for 50.00 USD:
https://uc.card.gofreshpay.com/pl/aBc1XyZ9
The link expires in 7 days.
```

Or generate a QR code:

```bash
# With the qrencode CLI
echo "https://uc.card.gofreshpay.com/pl/aBc1XyZ9" | qrencode -o inv-042.png
```

## What the customer sees

1. Clicks the link → lands on `pl/aBc1XyZ9`
2. Is automatically redirected to the Moko-hosted card checkout
3. Sees the amount + description
4. Enters their card details and completes 3DS
5. Is redirected to the Moko confirmation page
6. You receive the webhook

## Track a link

**Endpoint**: `GET /api/v1/payment-links/{link_id}`
**Auth**: Merchant HMAC

Returns the link status + all associated transactions:

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

## Cancel a link

**Endpoint**: `POST /api/v1/payment-links/{link_id}/cancel`
**Auth**: Merchant HMAC

Prevents any future clicks on the link. Transactions that have already succeeded are **not** cancelled.

```json
{ "link_id": 42, "status": "CANCELLED" }
```

If the customer clicks the link after cancellation, they will see:

> **Link cancelled** — This link has been cancelled by the merchant.

## Statuses

| Status | Meaning |
|---|---|
| `ACTIVE` | Usable, within the validity window |
| `EXHAUSTED` | `max_uses` reached |
| `EXPIRED` | Past the `expires_at` date |
| `CANCELLED` | Manually cancelled by the merchant |

## Multi-use (membership fees, donations)

For a link that can be reused N times:

```json
{
  "amount": 5.00,
  "currency": "USD",
  "description": "Donation to the Saint-Joseph orphanage",
  "expires_in_hours": 2160,
  "max_uses": 500
}
```

Each visit creates a separate transaction. The link switches to `EXHAUSTED` after 500 payments OR after 90 days.

## Limits

- Max **90 days** validity (`expires_in_hours` ≤ 2160)
- Max **10,000 uses**
- A link cannot be modified after creation (create a new one instead)

## See also

- [Webhooks](/en/card/webhooks) — receive payments
- Refunds — contact `henock.barakael@mokoafrika.com` (admin API, restricted access)

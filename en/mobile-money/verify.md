# Verify

Look up the status of a Mobile Money transaction by its reference. Useful if you haven't configured a `callback_url`, OR if you want to poll as a fallback.

## Endpoint

```
POST https://api.gofreshpay.com/api/v1/gateway
```

Same URL as Collection and Withdrawal. Discriminator: `action: "verify"`.

## Body parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | string | ✅ | Your merchant identifier |
| `merchant_secrete` | string | ✅ | Your API secret (note the spelling) |
| `action` | string | ✅ | `verify` |
| `reference` | string | ✅ | Reference to check (merchant `reference` OR Moko `Transaction_id`) |

## Examples

::: code-group

```bash [cURL]
curl -X POST https://api.gofreshpay.com/api/v1/gateway \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your_merchant_id",
    "merchant_secrete": "your_merchant_secret",
    "action": "verify",
    "reference": "order_001"
  }'
```

```javascript [Node.js]
const axios = require('axios');

const { data } = await axios.post(
  'https://api.gofreshpay.com/api/v1/gateway',
  {
    merchant_id: 'your_merchant_id',
    merchant_secrete: 'your_merchant_secret',
    action: 'verify',
    reference: 'order_001',
  }
);

console.log(data);
```

```python [Python]
import requests

response = requests.post(
    'https://api.gofreshpay.com/api/v1/gateway',
    json={
        'merchant_id': 'your_merchant_id',
        'merchant_secrete': 'your_merchant_secret',
        'action': 'verify',
        'reference': 'order_001',
    }
)

print(response.json())
```

:::

## Response

```json
{
  "Status": "Success",
  "Comment": "Transaction Found",
  "Trans_Status": "Successful",
  "Currency": "CDF",
  "Amount": 5000.0,
  "Method": "mpesa",
  "Customer_result": "243970000000",
  "Reference": "order_001",
  "Transaction_id": "PDxK3mN09vR2qL7y26wPz",
  "Action": "debit",
  "Created_at": "2026-03-06 15:30:00",
  "Updated_at": "2026-03-06 15:30:05",
  "Trans_Status_Description": "Transaction completed",
  "Financial_Institution_id": "TXN123456789"
}
```

## Response fields

| Field | Description |
|---|---|
| `Status` | `Success` if the transaction was found |
| `Comment` | Text message (usually `Transaction Found`) |
| `Trans_Status` | **Actual transaction status**: `Successful`, `Pending`, `Failed` |
| `Currency` | `CDF` or `USD` |
| `Amount` | Amount |
| `Method` | Operator (`mpesa`, `orange`, `airtel`, `afrimoney`) |
| `Customer_result` | Customer phone number |
| `Reference` | Your original reference |
| `Transaction_id` | Unique Moko identifier |
| `Action` | `debit` (collection) or `credit` (withdrawal) |
| `Created_at` | Creation timestamp |
| `Updated_at` | Last update timestamp |
| `Trans_Status_Description` | Text message |
| `Financial_Institution_id` | Operator reference |

## Polling strategy

If you poll Verify to get the result:

- **Recommended interval**: 5-10 seconds
- **Total timeout**: 5 minutes max (beyond that, treat the transaction as failed and notify support)
- **Backoff**: optional — poll faster during the first 30 seconds (2-3s), then space out requests
- **Webhooks first**: if you've configured a `callback_url`, the webhook will arrive faster than polling — rely on it first and use polling only as a fallback

::: tip
In production, always prefer [Webhooks](/en/mobile-money/webhooks) over polling — less load on our servers and faster results on your side.
:::

## Merchant reference vs Moko reference

The `reference` field accepts either:
- Your original `reference` passed with the `debit` or `credit` request
- OR the Moko `Transaction_id` returned in the initial response

Useful if you've lost your internal reference but have the Moko ID (or vice versa).

# Collection (Deposit)

Collect a payment from a customer's Mobile Money wallet. The operator sends an **STK Push** to their phone, they enter their PIN, and the transaction is debited from their wallet and credited to your Moko wallet.

## Endpoint

```
POST https://api.gofreshpay.com/api/v1/gateway
```

Content-Type: `application/json`. No auth header — credentials go in the body (see [Overview](/en/mobile-money/overview#auth)).

## Body parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | string | ✅ | Your merchant identifier |
| `merchant_secrete` | string | ✅ | Your API secret (note the spelling) |
| `action` | string | ✅ | `debit` — for collection |
| `method` | string | ✅ | `mpesa`, `orange`, `airtel`, `afrimoney` |
| `amount` | string | ✅ | Amount to collect |
| `currency` | string | ✅ | `CDF` or `USD` |
| `customer_number` | string | ✅ | Customer phone number in `243XXXXXXXXX` format |
| `reference` | string | ✅ | Your unique reference for the transaction |
| `firstname` | string | ✅ | Customer's first name |
| `lastname` | string | ✅ | Customer's last name |
| `email` | string | ✅ | Customer's email |
| `callback_url` | string | | Webhook URL for async notifications |

## Examples

::: code-group

```bash [cURL]
curl -X POST https://api.gofreshpay.com/api/v1/gateway \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "your_merchant_id",
    "merchant_secrete": "your_merchant_secret",
    "action": "debit",
    "method": "mpesa",
    "amount": "5000",
    "currency": "CDF",
    "customer_number": "243970000000",
    "reference": "order_001",
    "firstname": "John",
    "lastname": "Doe",
    "email": "customer@example.com",
    "callback_url": "https://yoursite.com/webhook"
  }'
```

```javascript [Node.js]
const axios = require('axios');

const { data } = await axios.post(
  'https://api.gofreshpay.com/api/v1/gateway',
  {
    merchant_id: 'your_merchant_id',
    merchant_secrete: 'your_merchant_secret',
    action: 'debit',
    method: 'mpesa',
    amount: '5000',
    currency: 'CDF',
    customer_number: '243970000000',
    reference: 'order_001',
    firstname: 'John',
    lastname: 'Doe',
    email: 'customer@example.com',
    callback_url: 'https://yoursite.com/webhook',
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
        'action': 'debit',
        'method': 'mpesa',
        'amount': '5000',
        'currency': 'CDF',
        'customer_number': '243970000000',
        'reference': 'order_001',
        'firstname': 'John',
        'lastname': 'Doe',
        'email': 'customer@example.com',
        'callback_url': 'https://yoursite.com/webhook',
    }
)

print(response.json())
```

```php [PHP]
<?php
$ch = curl_init('https://api.gofreshpay.com/api/v1/gateway');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'merchant_id'      => 'your_merchant_id',
    'merchant_secrete' => 'your_merchant_secret',
    'action'           => 'debit',
    'method'           => 'mpesa',
    'amount'           => '5000',
    'currency'         => 'CDF',
    'customer_number'  => '243970000000',
    'reference'        => 'order_001',
    'firstname'        => 'John',
    'lastname'         => 'Doe',
    'email'            => 'customer@example.com',
    'callback_url'     => 'https://yoursite.com/webhook',
]));

$response = curl_exec($ch);
curl_close($ch);

print_r(json_decode($response));
```

:::

## Response (200 OK)

```json
{
  "Status": "Success",
  "Comment": "Transaction Received Successfully",
  "Reference": "order_001",
  "Customer_Number": "243970000000",
  "Amount": 5000.0,
  "Currency": "CDF",
  "Created_At": "2026-03-06 13:05:35.018745",
  "Updated_At": "2026-03-06 13:05:35.018764",
  "Transaction_id": "PDxK3mN09vR2qL7y26wPz"
}
```

::: warning `Status: "Success"` ≠ payment completed
`Status: "Success"` in this response means **the request was received and the STK Push was sent to the customer**, NOT that the payment was completed. The actual result arrives via the [webhook](/en/mobile-money/webhooks) on your `callback_url` with `Trans_Status = Successful | Failed | Pending`.
:::

## Response fields

| Field | Description |
|---|---|
| `Status` | Request status (`Success` = STK Push sent) |
| `Comment` | Text message |
| `Reference` | Your original reference |
| `Customer_Number` | Customer phone number |
| `Amount` | Amount |
| `Currency` | `CDF` or `USD` |
| `Created_At` | Creation timestamp on Moko's side |
| `Updated_At` | Last update timestamp |
| `Transaction_id` | Unique Moko identifier (store it for `verify` and reconciliation) |

## Next steps

- **[Configure your webhook](/en/mobile-money/webhooks)** — receive the final result
- **[Verify](/en/mobile-money/verify)** — polling alternative if you don't use a webhook
- **[Withdrawal](/en/mobile-money/withdrawal)** — send funds to a customer

# Custom Checkout (Microform)

Construisez votre propre page checkout sur votre domaine, avec les champs carte embedded via un iframe sécurisé Cybersource. Votre serveur ne voit jamais un PAN.

## Prérequis marchand

- Le flag `microform_enabled` doit être activé sur votre profile marchand. Contactez `henock.barakael@mokoafrika.com` pour l'activation.
- Vous devez déclarer votre domaine dans `microform_allowed_origins` (Moko valide côté serveur que le `target_origin` de vos requêtes est bien dans cette liste).

## Flow complet

```
1. Customer arrive sur votre page checkout
2. Backend → POST /api/v1/microform/capture-context → JWT CS
3. Frontend charge Flex SDK, embed champs carte
4. Customer tape carte → SDK tokenize → transient_token
5. Backend → POST /api/v1/microform/pa-setup → device data collection (DDC)
6. Frontend : iframe caché POST DDC url (~5s fingerprint browser)
7. Backend → POST /api/v1/microform/pa-enroll → challenge_required ? OTP : direct
8. Si challenge : iframe visible stepUpUrl → customer tape OTP
9. Backend → POST /api/v1/microform/charge (avec authentication_transaction_id)
10. Moko internally: validate 3DS + auth + capture → SUCCESS
```

Voir [3DS Payer Authentication](/card/3ds) pour le détail du flow 3DS.

## Endpoint 1 — `POST /api/v1/microform/capture-context`

**Auth** : HMAC merchant

### Body

```json
{
  "target_origin": "https://checkout.your-shop.com",
  "allowed_card_networks": ["VISA", "MASTERCARD"],
  "locale": "fr-FR",
  "merchant_reference": "INV-042"
}
```

### Réponse

```json
{
  "jwt": "eyJraWQiOi...",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "expires_in": 900
}
```

Le `jwt` doit être passé au SDK Flex côté browser.

Le `transaction_uuid` est votre **identifiant d'attempt** pour ce paiement. Il est obligatoire sur `pa-setup`, `pa-enroll` et `charge`, et il protège contre les double-débits sur `charge` : rejouer `POST /charge` avec le même `transaction_uuid` sur une tx déjà SUCCESS ne débite jamais une seconde fois — vous recevez l'état existant. Ce n'est **pas** un idempotency-key générique (vous ne pouvez pas le fournir vous-même, et il ne couvre pas `/payment/orders`) : voir [Idempotence](/references/errors#idempotence) pour les règles exactes. Si la réponse de `/charge` est perdue (timeout réseau), vérifiez l'état via `POST /payment/status` avec le même `transaction_uuid` avant de retenter.

### Guards

- `target_origin` doit être dans votre `microform_allowed_origins` (sinon 403)
- `microform_enabled = 1` sur votre profile (sinon 403)

## Endpoint 2 — Frontend Microform SDK

```html
<!-- Dans votre page checkout. L'URL du SDK est renvoyée dans le JWT du
     capture-context (champs clientLibrary + clientLibraryIntegrity). Lisez-la
     depuis le JWT décodé plutôt qu'en dur — elle change selon l'environnement
     (sandbox pointe vers testflex.cybersource.com, prod vers flex.cybersource.com)
     et selon la version SDK que CyberSource vous attribue. -->
<script
  src="{{ clientLibrary }}"
  integrity="{{ clientLibraryIntegrity }}"
  crossorigin="anonymous"></script>

<!-- Containers pour les champs carte (iframes CS) -->
<div id="cs-number-container"></div>
<div id="cs-cvv-container"></div>
```

```javascript
// 1. Fetch capture-context via VOTRE backend proxy (qui signe HMAC + forward Moko)
const { jwt, transaction_uuid } = await fetch('/backend/microform/init', {
  method: 'POST',
  body: JSON.stringify({ amount: 100, reference: 'INV-042' }),
}).then(r => r.json());

// 2. Init Flex SDK
const flex = new Flex(jwt);
const microform = flex.microform({
  styles: {
    input: { 'font-size': '15px', color: '#0f172a', 'font-family': 'Inter, sans-serif' },
    ':focus': { color: '#0f172a' },
    'invalid': { color: '#d92d20' },
  },
});
microform.createField('number', { placeholder: '1234 5678 9012 3456' }).load('#cs-number-container');
microform.createField('securityCode', { placeholder: 'CVV' }).load('#cs-cvv-container');

// 3. À la soumission
async function handlePay(formData) {
  const transientToken = await new Promise((resolve, reject) => {
    microform.createToken({
      expirationMonth: formData.expMonth,
      expirationYear: formData.expYear,
    }, (err, token) => err ? reject(err) : resolve(token));
  });

  // Envoyer transientToken + transaction_uuid à votre backend qui fait pa-setup, pa-enroll, charge
  // Voir /card/3ds pour le flow complet
}
```

## Endpoint 3 — `POST /api/v1/microform/charge`

**Auth** : HMAC merchant

Charge le transient token une fois 3DS complété (voir [3DS](/card/3ds) pour setup/enroll obligatoires avant).

### Body

```json
{
  "transient_token": "eyJraWQiOi...",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "amount": 1.00,
  "currency": "USD",
  "merchant_reference": "INV-042",
  "bill_to": {
    "first_name": "Jean",
    "last_name": "Kabala",
    "email": "client@example.com",
    "phone_number": "+243812345001",
    "address_line1": "Av. de la Paix, 42",
    "address_city": "Kinshasa",
    "address_state": "",
    "address_postal_code": "00000",
    "address_country": "CD"
  },
  "callback_url": "https://your-shop.com/webhooks/moko",
  "authentication_transaction_id": "eD6BPpZLUlcijSh718c1"
}
```

::: warning
`authentication_transaction_id` est **obligatoire** si Decision Manager de votre profile CS impose 3DS (cas standard en RDC via Equity Bank). Sans, la tx sera rejetée avec `Non 3Ds Reject`.
:::

### Réponse

```json
{
  "status": "SUCCESS",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "transaction_id": "7907643500666758704885",
  "reason_code": null,
  "message": null
}
```

## Sample HTML complet

Un exemple standalone (dev-only, ne pas déployer tel quel) est servi sur :

**https://uc.card.gofreshpay.com/static/microform-sample.html**

::: danger
Ce sample signe le HMAC côté browser pour simplifier la démo. **Ne JAMAIS reproduire ce pattern en production** — le secret HMAC doit toujours rester server-side. Utilisez un backend proxy comme dans le code plus haut.
:::

## Voir aussi

- [3DS Payer Authentication](/card/3ds) — flow complet setup/enroll/challenge
- [Authentication](/authentication) — signature HMAC merchant
- [Webhooks](/card/webhooks) — vérification signature callback
- Refunds — contactez `henock.barakael@mokoafrika.com` (API admin, accès restreint)

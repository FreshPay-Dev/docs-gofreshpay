# 3DS Payer Authentication

Depuis 2026-09, le profile Cybersource Moko exige 3D Secure sur toute transaction carte. Sans authentification 3DS, le charge est automatiquement rejeté par Decision Manager (règle `Non 3Ds Reject`, `reason_code: 481`).

::: info Hosted Checkout
Si vous utilisez [Hosted Checkout](/card/hosted-checkout), 3DS est **automatique** (UC SDK gère tout). Ce guide concerne uniquement [Microform](/card/microform) où vous devez orchestrer le 3DS explicitement.
:::

## Le flow en 5 étapes

```
1. Tokenize card via Microform SDK          → transient_token
2. POST /api/v1/microform/pa-setup          → reference_id + DDC url + access_token
3. Browser : iframe caché POST DDC url      (~5s fingerprint device)
4. POST /api/v1/microform/pa-enroll         → AUTHENTICATED ou CHALLENGE_REQUIRED
5a. AUTHENTICATED (frictionless)            → aller à étape 6
5b. CHALLENGE_REQUIRED                      → iframe visible stepUpUrl (OTP customer)
6. POST /api/v1/microform/charge            avec authentication_transaction_id
```

Après un challenge (`CHALLENGE_REQUIRED`), le backend Moko `charge` appelle automatiquement `/risk/v1/authentication-results` en interne pour committer le résultat avant l'auth. Vous n'avez pas besoin de valider vous-même.

En frictionless (`AUTHENTICATED`), aucun validate n'est nécessaire : le cavv et l'eci sont déjà présents dans la réponse de `/pa-enroll` (ARes selon EMVCo 3DS 2.x). Le backend les injecte directement dans `/pts/v2/payments`.

## Endpoint — `POST /api/v1/microform/pa-setup`

**Auth** : HMAC merchant

Prend le transient token, initie la collecte device fingerprint.

### Body

```json
{
  "transient_token": "eyJraWQiOi...",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c"
}
```

### Réponse

```json
{
  "reference_id": "12f3d71d-8916-44ce-baa4-a772b9345807",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "device_data_collection_url": "https://centinelapi.cardinalcommerce.com/V1/Cruise/Collect"
}
```

## Device Data Collection (côté browser)

Iframe caché qui poste le JWT vers l'URL DDC. Cybersource collecte le fingerprint browser (~2-5 secondes).

```javascript
function runDDC(url, accessToken, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'cs-ddc-frame';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = 'cs-ddc-frame';
    form.innerHTML = `<input type="hidden" name="JWT" value="${accessToken}">`;
    document.body.appendChild(form);
    form.submit();

    // Timeout de sécurité (CS a un fallback si le DDC échoue)
    const t = setTimeout(() => { cleanup(); resolve(); }, timeoutMs);

    // Attendre message postMessage de CS
    function onMsg(ev) {
      if (!ev.origin.includes('cardinalcommerce.com')) return;
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (data.MessageType === 'profile.completed') {
          clearTimeout(t);
          cleanup();
          resolve();
        }
      } catch {}
    }
    function cleanup() {
      window.removeEventListener('message', onMsg);
      iframe.remove();
      form.remove();
    }
    window.addEventListener('message', onMsg);
  });
}

// Usage
await runDDC(setup.device_data_collection_url, setup.access_token);
```

## Endpoint — `POST /api/v1/microform/pa-enroll`

**Auth** : HMAC merchant

Vérifie si un challenge est nécessaire, retourne soit `AUTHENTICATED` (skip challenge), soit `CHALLENGE_REQUIRED` avec URL de la page OTP issuer.

### Body

```json
{
  "transient_token": "eyJraWQiOi...",
  "transaction_uuid": "6f719977-efc6-458c-9dea-fefde7133e9c",
  "reference_id": "12f3d71d-8916-44ce-baa4-a772b9345807",
  "amount": 1.00,
  "currency": "USD",
  "bill_to": {
    "first_name": "Jean", "last_name": "Kabala",
    "email": "client@example.com",
    "address_line1": "Av. Kasa-Vubu", "address_city": "Kinshasa",
    "address_postal_code": "00000", "address_country": "CD"
  },
  "return_url": "https://checkout.your-shop.com/3ds-return",
  "browser_user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ...",
  "browser_language": "fr-FR",
  "browser_accept_header": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}
```

`return_url` = URL de votre propre page qui recevra le callback POST après challenge. Voir plus bas.

::: danger Champs browser obligatoires
Les 3 champs `browser_user_agent`, `browser_language` et `browser_accept_header` sont **obligatoires** pour `deviceChannel=BROWSER` selon la spec EMVCo 3DS 2.x Table A.1. Sans eux, Visa Directory Server répond `errorCode=201 "A message element required as defined in Table A.1 is missing"`, l'authentification n'a pas lieu, `ecommerceIndicator=internet`, et la règle Decision Manager `Non 3Ds Reject` rejette la charge avec `reason_code: 481`.

Lisez-les depuis le browser du client final :
```javascript
browser_user_agent: navigator.userAgent,
browser_language: navigator.language || "en-US",
browser_accept_header: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
```
Ne les lisez **pas** depuis les headers du serveur merchant — ce sont les infos du browser du client final qui comptent, pas celles de votre backend proxy.
:::

### Réponse (frictionless — sans OTP)

```json
{
  "status": "AUTHENTICATED",
  "authentication_transaction_id": "aeyEthCtnCswTcaZfju1",
  "step_up_url": null,
  "access_token": null,
  "ecommerce_indicator": "vbv"
}
```

→ Passez directement à `/charge` avec `authentication_transaction_id`.

### Réponse (challenge — OTP requis)

```json
{
  "status": "CHALLENGE_REQUIRED",
  "authentication_transaction_id": "aeyEthCtnCswTcaZfju1",
  "step_up_url": "https://centinelapi.cardinalcommerce.com/V2/Cruise/StepUp",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "ecommerce_indicator": null
}
```

→ Rendre l'iframe visible avec le `step_up_url` et `access_token`, attendre callback sur `return_url`.

### Réponse (échec authentification)

```json
{
  "status": "FAILED",
  "reason_code": "476",
  "message": "Authentication failed"
}
```

→ Ne PAS appeler `/charge`. Afficher erreur user.

## Challenge iframe (côté browser)

```javascript
function runStepUpChallenge(stepUpUrl, accessToken) {
  return new Promise((resolve, reject) => {
    // Modal Nexera-branded avec iframe visible
    const modal = document.createElement('div');
    modal.className = 'your-3ds-modal';
    modal.innerHTML = `
      <div class="your-3ds-header">Validation bancaire</div>
      <iframe name="cs-stepup-frame" style="width:100%;height:500px;border:0;"></iframe>
    `;
    document.body.appendChild(modal);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = stepUpUrl;
    form.target = 'cs-stepup-frame';
    form.innerHTML = `<input type="hidden" name="JWT" value="${accessToken}">`;
    document.body.appendChild(form);
    form.submit();

    // Attendre message postMessage depuis votre page /3ds-return
    function onMsg(ev) {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.type === '3ds-complete') {
        cleanup();
        resolve();
      }
    }
    function cleanup() {
      window.removeEventListener('message', onMsg);
      modal.remove();
      form.remove();
    }
    window.addEventListener('message', onMsg);

    // Timeout 5min
    setTimeout(() => { cleanup(); reject(new Error('3DS timeout')); }, 5 * 60_000);
  });
}
```

## Votre page `/3ds-return`

Cybersource POSTe sur `return_url` après le challenge (que ce soit un succès ou échec). Cette page doit :

1. Accepter GET **et POST** (Cybersource POSTe)
2. Avoir les headers `X-Frame-Options: SAMEORIGIN` + `CSP: frame-ancestors 'self'`
3. Notifier le parent frame via postMessage

### Champs postés par Cybersource

Le body est en `application/x-www-form-urlencoded`. Les champs à attendre (seul `TransactionId` est garanti présent, les autres dépendent du scénario) :

| Champ | Toujours présent | Description |
|---|---|---|
| `TransactionId` | oui | Identifiant Cybersource de l'authentification 3DS. À matcher avec le `authentication_transaction_id` de `/pa-enroll`. |
| `MD` | oui | Opaque Merchant Data. C'est votre propre `transaction_uuid` que vous avez passé à `/pa-enroll` — Cybersource vous le renvoie tel quel pour que vous retrouviez la session. |
| `PaRes` | 3DS 1.0 uniquement | Payer Authentication Response signée. Seulement si la carte est en 3DS 1.0 (de plus en plus rare). |
| `AuthenticationStatus` | 3DS 2.x | Résultat du challenge : `Y` (approved), `N` (declined), `A` (attempted), `U` (unavailable), `R` (rejected). |
| `ECI` | 3DS 2.x | Electronic Commerce Indicator (`05`, `06`, `07` selon le niveau de liability shift). |
| `CAVV` | 3DS 2.x succès | Cardholder Authentication Verification Value. Preuve que l'authentification a eu lieu. |
| `DSTransactionId` | 3DS 2.x | Identifiant Directory Server (Visa/Mastercard). |

Vous n'avez **pas besoin de parser ces champs vous-même** côté marchand — appelez `/api/v1/microform/charge` avec le `transaction_uuid` d'origine et notre backend ira les lire via Cybersource. Les champs ci-dessus servent uniquement si vous voulez logger ou faire du monitoring.

Exemple FastAPI :

```python
from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse

router = APIRouter()

@router.api_route("/checkout/{tx_id}/3ds-return", methods=["GET", "POST"])
async def three_ds_return(tx_id: str):
    html = """
    <!DOCTYPE html>
    <html>
      <head><title>Validation terminée</title></head>
      <body>
        <p>Validation en cours, veuillez patienter…</p>
        <script>
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({type: '3ds-complete'}, window.location.origin);
          }
        </script>
      </body>
    </html>
    """
    return HTMLResponse(
        content=html,
        headers={
            "X-Frame-Options": "SAMEORIGIN",
            "Content-Security-Policy": "frame-ancestors 'self'",
        },
    )
```

## Charge avec `authentication_transaction_id`

Une fois `AUTHENTICATED` OU après completion du challenge, appelez `/charge` avec le `authentication_transaction_id`. Le backend Moko :

1. Appelle `/risk/v1/authentication-results` (commit le 3DS chez CS)
2. Extrait `cavv`, `xid`, `eci` de la réponse
3. Injecte tout dans le `POST /pts/v2/payments`
4. `commerceIndicator` défini automatiquement selon network (`vbv` Visa, `spa` MasterCard)

Voir [Microform](/card/microform#endpoint-3-post-api-v1-microform-charge).

## Debug

Si la charge échoue avec `reason_code: 481` (Non 3Ds Reject), vérifiez dans nos logs :

- `[PA enroll] veres=U indicator=internet` + WARNING `directoryServerErrorCode=201` — l'appel `/pa-enroll` n'a pas transmis les 3 champs browser obligatoires, Visa DS a rejeté le AReq. Vérifiez que `browser_user_agent`, `browser_language` et `browser_accept_header` sont bien envoyés depuis le browser du client final.
- `[PA validate] cs_status=AUTHENTICATION_FAILED` — le challenge n'a jamais été complété (user n'a pas tapé l'OTP à temps, timeout, ou refusé)
- `[PA validate] cs_status=AUTHENTICATION_SUCCESSFUL eci=05` — 3DS OK, le reject vient d'une autre règle DM (BIN non-éligible, geo loc inconsistency, velocity, etc.)

Cf. [Response codes](/references/response-codes) pour l'interprétation complète.

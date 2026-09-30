# Erreurs

Format d'erreur standard renvoyé par les endpoints Moko en cas d'échec (4xx / 5xx).

## Format de base

```json
{
  "detail": "Description humaine de l'erreur"
}
```

Simple, lisible. Utilisé pour la majorité des erreurs (auth, validation, guards métier).

## Erreurs de validation (422)

FastAPI retourne les erreurs de validation Pydantic au format :

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "amount"],
      "msg": "Field required",
      "input": {...}
    }
  ]
}
```

Vous pouvez itérer sur `detail[]` pour extraire les champs invalides et les afficher au user.

## Codes HTTP standards

| HTTP | Cas d'usage |
|---|---|
| **200 OK** | Succès (charge/refund/void) — vérifier le champ `status` du body pour distinguer SUCCESS / FAILED business |
| **201 Created** | Ressource créée (payment link, etc.) |
| **307 Temporary Redirect** | Redirection (payment link visit → UC checkout) |
| **400 Bad Request** | Body malformé, champ invalide |
| **401 Unauthorized** | Headers auth manquants |
| **403 Forbidden** | Auth invalide, environnement cross, cross-merchant |
| **404 Not Found** | Ressource introuvable (tx_uuid, link_id, cs_payment_id) |
| **408 Request Timeout** | Timestamp trop vieux (>30s) |
| **409 Conflict** | État incompatible (tx déjà processed, refund déjà fait, over-refund) |
| **410 Gone** | Ressource expirée (link EXPIRED/EXHAUSTED, tx expired) |
| **422 Unprocessable Entity** | Validation Pydantic |
| **429 Too Many Requests** | Rate limit (à venir — respecter `Retry-After`) |
| **500 Internal Server Error** | Erreur serveur imprévue — signaler à support |
| **502 Bad Gateway** | Upstream Cybersource injoignable ou 5xx — retry avec backoff |

## Distinguer 502 vs 200/FAILED

**Important** — 3DS failure et carte declined **ne sont PAS des 502**. Ce sont des `200 OK` avec `status: "FAILED"` dans le body :

```bash
# Charge sur carte declined
POST /api/v1/microform/charge
→ HTTP 200 OK
{
  "status": "FAILED",
  "transaction_uuid": "...",
  "reason_code": "201",
  "message": "Insufficient funds"
}
```

Un `502` signifie que **Cybersource lui-même est injoignable ou a renvoyé 5xx** — retry approprié.

Votre client doit :
- Parser le body JSON même sur 200
- Vérifier `status` avant de considérer le paiement réussi
- Ne PAS traiter les 4xx (autres que 429) comme retryable
- Retry uniquement 502 / 503 / 504 / timeout avec backoff exponentiel

## Idempotence

Nos endpoints qui créent une ressource (tx, refund, payment link) sont **partiellement idempotents** via le champ `reference` (côté marchand) et `transaction_uuid` (côté Moko).

Si vous retry un `POST /payment/orders` avec la même `reference`, vous recevrez :

```json
{ "detail": "reference INV-042 already used" }
```
HTTP 409.

**Recommandation** : générer une `reference` unique par tentative (ex : UUID v4 côté vous), tracker le mapping dans votre DB.

## Debug niveau produit

Pour toute erreur 5xx inattendue ou comportement bizarre :

1. Récupérer le `transaction_uuid` ou `cs_payment_id` de la tx en question
2. Timestamp UTC précis du moment de l'appel
3. Envoyer à `dev@gofreshpay.com` avec context (endpoint appelé, payload — sans secrets)

Réponse typique < 24h. Pour incidents prod bloquants, mentionnez `URGENT PROD` dans l'objet.

## Voir aussi

- [Response codes](/references/response-codes) — codes Cybersource
- [Authentication](/authentication) — erreurs HMAC (401/403)

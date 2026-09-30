# Erreurs

Format d'erreur renvoyé par les endpoints Moko en cas d'échec (4xx / 5xx).

## Format de base

```json
{
  "detail": "Description humaine de l'erreur"
}
```

Format FastAPI standard. Utilisé pour la majorité des erreurs (auth, validation, guards métier).

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

Vous pouvez itérer sur `detail[]` pour extraire les champs invalides.

## Codes HTTP utilisés

| HTTP | Cas d'usage |
|---|---|
| **200 OK** | Succès. Pour `/microform/charge` : vérifier le champ `status` du body (SUCCESS vs FAILED business) |
| **303 See Other** | Redirect (post-checkout vers `return_url` marchand) |
| **307 Temporary Redirect** | Redirect (payment link `/pl/{code}` → UC checkout) |
| **400 Bad Request** | Body malformé, validation métier (currency invalide, amount trop petit, etc.) |
| **401 Unauthorized** | Un des 3 headers HMAC manquant |
| **403 Forbidden** | Auth invalide (signature, environnement cross, test account en prod), ou accès admin refusé |
| **404 Not Found** | Ressource introuvable (tx_uuid, link_id, cs_payment_id, merchant_id) |
| **408 Request Timeout** | `X-Timestamp` > 30s dans le passé |
| **409 Conflict** | État incompatible (tx status incompatible avec l'action, over-refund, void hors fenêtre 24h, link cancelled/exhausted, etc.) |
| **410 Gone** | Ressource expirée (tx expirée 20 min, payment link `EXPIRED` ou `EXHAUSTED` ou `CANCELLED`) |
| **422 Unprocessable Entity** | Validation Pydantic |
| **500 Internal Server Error** | Erreur serveur imprévue |
| **502 Bad Gateway** | Upstream Cybersource injoignable, 5xx CS, ou erreur applicative wrapping (`Refund upstream failed`, `Void upstream failed`, `Reporting fetch failed`) |

## Distinguer 502 vs 200/FAILED

**Important** — 3DS failure et carte declined **ne sont PAS des 502**. Ce sont des `200 OK` avec `status: "FAILED"` dans le body :

```bash
POST /api/v1/microform/charge
→ HTTP 200 OK
{
  "status": "FAILED",
  "transaction_uuid": "FP-...",
  "transaction_id": "cs_payment_id_ou_null",
  "reason_code": "201",
  "message": "..."
}
```

Un `502` signifie que **Cybersource lui-même est injoignable ou a renvoyé 5xx** — retry approprié.

Votre client doit :
- Parser le body JSON même sur 200
- Vérifier `status` avant de considérer le paiement réussi
- Ne PAS traiter les 4xx comme retryable
- Retry uniquement 502 / 503 / 504 / timeout avec backoff exponentiel

## Idempotence

Nos endpoints qui créent une ressource (tx, refund, void, payment link) n'ont **pas** de mécanisme d'idempotency-key strict côté serveur. Deux `POST /payment/orders` avec le même `merchant_reference` créeront deux tx distinctes.

**Recommandation** : côté client, dedupliquer par `merchant_reference` (unique dans votre DB) avant d'envoyer, et gérer les retries avec exponential backoff sur les 502 uniquement.

## Debug niveau produit

Pour toute erreur 5xx inattendue :

1. Récupérer le `transaction_uuid` ou `cs_payment_id` de la tx concernée
2. Timestamp UTC précis du moment de l'appel
3. Envoyer à `dev@gofreshpay.com` avec context (endpoint, headers hors secrets, payload)

Réponse typique < 24h. Pour incidents prod bloquants, mentionnez `URGENT PROD` en objet.

## Voir aussi

- [Response codes](/references/response-codes) — codes Cybersource
- [Authentication](/authentication) — erreurs HMAC (401/403/408)

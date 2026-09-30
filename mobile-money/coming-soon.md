# Mobile Money — Coming soon

L'API Mobile Money Moko est **en production depuis plusieurs années** — supporte M-Pesa Vodacom, Airtel Money, Orange Money et Afrimoney. La documentation détaillée est en cours de rédaction et sera publiée ici prochainement.

## En attendant

Si vous souhaitez intégrer Mobile Money dès maintenant, contactez `dev@gofreshpay.com` pour :

- Recevoir la doc technique interne (v0, sera publiée ici après polish)
- Vos clés API sandbox MM
- Support d'intégration

## Aperçu de ce qui sera documenté

**C2B (customer → marchand)** :
- STK Push M-Pesa, Airtel, Orange, Afrimoney
- Callback asynchrone signé
- Retry policy

**B2C (marchand → customer)** :
- Payout vers wallet MM
- Vérification bénéficiaire
- Réconciliation quotidienne

**Callbacks** :
- Structure signée
- Codes réponse par opérateur (M-Pesa `000` OK, `2006` solde insuffisant, etc.)

**Sandbox** :
- Numéros de test par opérateur
- Simulateur STK Push

---

Vous voulez qu'on prioritise cette section ? Envoyez-nous un email — plus il y a de demande, plus vite on publie.

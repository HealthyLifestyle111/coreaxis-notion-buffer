# Core Access Concierge Engine

Production-oriented routing engine for the CoreAxis online concierge. The engine performs progressive elimination and returns one primary starting route without collecting substantive health data.

## Routes

- peptide_direct
- cellcore_direct
- cellular_cleanse
- pomegranate
- menopause_core
- ovo
- oyster
- vibrant_pets
- healthier_together
- concierge_review

## Design rules

1. Direct intent wins over curated routing.
2. Ask the minimum question needed to eliminate routes.
3. Never expose the full program catalog as a consumer choice screen.
4. Never invent package details.
5. Substantive health assessment belongs in Whole Practice.
6. Return one primary route and one action.

## API contract

`POST /api/core-access/route`

Request:

```json
{
  "scope": "self|partner|pet|household|unknown",
  "intent": "peptide|cellcore|foundational|womens|menopause|fertility|mens|pet|household|unknown",
  "specificity": "exact|area|unsure",
  "life_stage": "cycle|fertility|perimenopause|menopause|postmenopause|unknown"
}
```

Response:

```json
{
  "route": "pomegranate",
  "label": "Pomegranate — Whole Woman Foundations",
  "reason": "Your best place to begin is the whole-woman pathway.",
  "action": "BEGIN_POMEGRANATE",
  "direct": false,
  "requires_whole_practice": true
}
```

The implementation deliberately contains no clinical eligibility logic and no prescription or diagnostic logic.

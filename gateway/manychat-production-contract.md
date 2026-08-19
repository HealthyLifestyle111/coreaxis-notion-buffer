# CoreAxis ManyChat Production Contract

**Authority:** `CORE ACCESS — Universal Gateway + DM Conversion System — Production Build` (August 13, 2026)

This file is the implementation contract for the ManyChat channel layer. It does not replace the CoreAxis routing engine in `gateway/router.js`.

## Channel responsibility

ManyChat is the inbound conversation layer. It must collect only the minimum gateway signals and pass the normalized event to the CoreAxis router. It must not contain a second program architecture.

## Required entry points

### Universal gateway
Trigger: inbound DM or approved keyword/CTA.

Message:
> Absolutely. I can point you toward the right place to begin. Rather than sending you a list of programs, I’ll ask a few quick questions and narrow it down for you.

Button: `FIND MY PATH`

### Known intent
If the person explicitly requests peptides:
- set `known_intent=peptide`
- route to `DIRECT_PEPTIDE`
- do not force Whole Practice

If the person explicitly requests CellCore/JumpStart:
- set `known_intent=cellcore`
- route to `CELLULAR_CLEANSE`
- Whole Practice foundation entry is required before CellCore fulfillment

If the person says they know a CoreAxis program:
- set `known_intent=known_program`
- collect only enough information to normalize the approved destination

### Concierge gateway signals
Use these normalized values:

`primary_area`: women | men | fertility | midlife | pet | household | foundational

`life_stage`: whole_woman | cycle | fertility_preconception | male_vitality | perimenopause_menopause | pet_wellness | household_wellness | foundational

`scope`: me | partner_fertility | pet | household

`investment_readiness`: resources_only | not_ready | entry_level_program | guided_program | higher_touch

`source`, `campaign`, `partner_id`, `clinic_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` are attribution fields only.

## Destination contract

| Intent | Router destination | ManyChat behavior |
|---|---|---|
| Peptide | `DIRECT_PEPTIDE` | Direct approved EllieMD destination; no Whole Practice unless separately requested |
| CellCore / JumpStart | `CELLULAR_CLEANSE` | Whole Practice foundation first; never bypass |
| Women | `POMEGRANATE` | Hand off to approved Whole Practice route |
| Fertility | `OVO` | Hand off to approved Whole Practice route |
| Midlife | `MENOPAUSE_CORE` | Hand off to approved Whole Practice route |
| Men | `OYSTER` | Hand off to approved Whole Practice route |
| Pet | `VIBRANT_PETS` | Hand off to approved Whole Practice route |
| Household | `HEALTHIER_TOGETHER` | Hand off to approved Whole Practice route |
| Foundational / unsure | `FOUNDATION_EXPERIENCE` or `CELLULAR_CLEANSE` as returned by router | Do not expose the full catalog |

## Prohibited behavior

- Do not send consumers to Notion.
- Do not present the full program catalog.
- Do not create a new START architecture.
- Do not store health answers in Notion or marketing systems.
- Do not diagnose or provide individualized medical advice.
- Do not invent URLs.
- Do not bypass Whole Practice for CellCore.
- Do not route peptide-only intent through Whole Practice.
- Do not use Aminos.

## Backend contract

The normalized ManyChat event must be capable of producing the same input shape accepted by `gateway/router.js`:

```json
{
  "answers": {
    "known_intent": "peptide|cellcore|known_program",
    "primary_area": "women|men|fertility|midlife|pet|household|foundational",
    "life_stage": "...",
    "scope": "me|partner_fertility|pet|household",
    "investment_readiness": "resources_only|not_ready|entry_level_program|guided_program|higher_touch"
  },
  "attribution": {
    "source": "instagram|tiktok|messenger|website|referral|other",
    "campaign": "...",
    "partner_id": null,
    "clinic_id": null,
    "utm_source": null,
    "utm_medium": null,
    "utm_campaign": null,
    "utm_content": null
  }
}
```

The backend response is authoritative for destination and access level. ManyChat must not independently override the router result.

## Release test matrix

1. Peptide DM -> `DIRECT_PEPTIDE`
2. CellCore DM -> `CELLULAR_CLEANSE` with Whole Practice-first rule
3. Fertility -> `OVO`
4. Perimenopause/menopause -> `MENOPAUSE_CORE`
5. Women/general -> `POMEGRANATE`
6. Men/vitality -> `OYSTER`
7. Pet -> `VIBRANT_PETS`
8. Household -> `HEALTHIER_TOGETHER`
9. Unsure -> one best-fit route, not catalog
10. Self-directed/not-ready -> approved fallback only when configured
11. Attribution preserved
12. No health-answer payload written to Notion

Production is not certified until these tests are executed against the live ManyChat account and the actual destination URLs are verified.

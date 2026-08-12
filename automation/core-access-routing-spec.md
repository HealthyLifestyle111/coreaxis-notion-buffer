# Core Access — Universal Gateway & Routing Specification

## Purpose
Production specification for the CoreAxis consumer front door. This document defines the routing layer between inbound DMs/referrals/web traffic and the existing Whole Practice client/package/questionnaire architecture.

## Governing flow
DM / social / referral / website → Core Access gateway → one primary route → Whole Practice or approved direct destination → targeted intake → practitioner review → applicable pathway/resources → reassessment/continuation.

The consumer does not select from the internal architecture unless they already know the exact destination.

## Direct exceptions
- PEPTIDE intent: direct EllieMD peptide route already established; do not force through Whole Practice unless the person separately asks for broader practice support.
- DIRECT CELLCORE intent: direct CellCore Jump Start route when explicitly requested.
- Existing clients: preserve existing client record and pathway; do not create duplicate onboarding.

## Universal gateway questions
1. Who are you looking to support?
   - Myself
   - My partner / us as a couple
   - My pet
   - My household

2. What brings you here right now?
   - I want a stronger wellness foundation
   - Women's wellness / cycle / whole-woman support
   - Perimenopause / menopause / midlife
   - Fertility / preconception / preparing for pregnancy
   - Men's vitality / performance / longevity
   - Nutrition and wellness for my pet
   - Coordinated support for my household
   - Peptides / advanced wellness
   - I'm not sure where to begin

3. What kind of starting point are you looking for?
   - Help finding the right pathway
   - A specific program
   - Nutrition / supplement support
   - Testing / tracking
   - A deeper ongoing program
   - I'm exploring

4. How specific is your goal?
   - I know exactly what I want
   - I know the general area but need direction
   - I'm exploring and want the system to guide me

5. Are you already connected to a program or provider?
   - Yes — I am already a client
   - Yes — I already have a provider / clinical pathway
   - I already use a supplement/protocol program
   - No — I'm starting here

## Routing table
| Signal | Route | Whole Practice intake |
|---|---|---|
| General foundation / cleanse | Foundational Cleanse | Toxicity & Symptom Questionnaire |
| General whole-woman | Pomegranate | Female Only Wellness + PMS Wellness as established |
| Midlife / perimenopause / menopause | Menopause Core | Appropriate menopause/premenopause questionnaire |
| Fertility / preconception | OVO | Fertility & Preconception Questionnaire |
| Men's vitality / performance / longevity | Oyster | Male Only Wellness Questionnaire |
| Pet | Vibrant Pets | Canine/Feline Pet Nutrition Wellness Questionnaire |
| Household | Healthier Together | Household intake while preserving individual routing |
| Unsure | Core Access gateway | Route to one best-fit pathway |

## Consumer DM opening
“Absolutely. I can point you toward the right place to begin. Rather than sending you a list of programs, I’ll ask a few quick questions and narrow it down for you.”

CTA: FIND MY PATH

## If consumer already knows the program
“Perfect. If you already know which pathway you want, I can take you directly there. If you want me to confirm that it is the best place to begin, use Find My Path.”

## If consumer asks what is offered
“Whole Practice is organized around distinct pathways for women, men, fertility/preconception, pets, households, and foundational wellness. You don’t need to sort through all of that yourself. I can narrow it down for you.”

CTA: FIND MY PATH

## If consumer asks about CellCore
“If you already know you want the direct CellCore route, I can send you there. If you want the practitioner-guided route, start with the foundational assessment so the appropriate pathway can be selected.”

Buttons: DIRECT CELLCORE / FIND MY CURATED PATH

## If consumer asks about Fullscript
“Fullscript is the practitioner dispensary layer connected to the practice. If you’re looking for a specific program or individualized recommendation, start with the appropriate pathway so the right resources can be connected to your client record.”

CTA: FIND MY PATH

## Compliance guardrails
- AI/automation is navigation and education, not diagnosis, prescribing, clinical eligibility determination, or individualized medical advice.
- Use only approved claims/copy.
- Never invent packages, prices, durations, inclusions, clinical claims, credentials, outcomes, links, or questionnaire assignments.
- Do not collect unnecessary health information in DM/marketing systems.
- Move substantive assessment into the appropriate secure Whole Practice intake.
- Escalate questions requiring professional judgment to Jenna/human review.
- Do not send raw health answers into Notion or marketing systems.

## Automation architecture
Whole Practice ↔ Fullscript: native integration.
Whole Practice ↔ Zapier: external orchestration.
GitHub: source control for automation specification/custom technical assets.

## Recommended Zapier flows
### Z01 — Gateway qualified lead → Whole Practice
Trigger: gateway/DM platform qualified lead event.
Actions: create/update client; assign exact routed questionnaire; record source/route metadata only.

### Z02 — Whole Practice questionnaire completed → review queue
Trigger: Completed Form or Questionnaire.
Action: notify practitioner/review workflow.

### Z03 — Purchase → onboarding
Trigger: package purchase.
Actions: update lifecycle stage; stop promotional nurture; assign correct onboarding questionnaire when needed.

### Z04 — Direct route
Trigger: PEPTIDE or DIRECT CELLCORE intent.
Action: approved direct link; no forced Whole Practice intake.

### Z05 — Attribution
Preserve source/campaign/route/conversion status only. Never export raw health answers.

## Test matrix
1. General wellness → Foundational Cleanse
2. Woman/general wellness → Pomegranate
3. Midlife → Menopause Core
4. Fertility/couple → OVO
5. Men's vitality → Oyster
6. Dog → Vibrant Pets
7. Cat → Vibrant Pets
8. Household → Healthier Together
9. PEPTIDE → direct EllieMD
10. DIRECT CELLCORE → direct CellCore Jump Start
11. Unsure → gateway → one primary route
12. Existing client → existing-client handling, no duplicate onboarding

## Release gate
A route is LIVE only after its actual destination, questionnaire/package mapping, automation trigger, and end-to-end synthetic test are verified.

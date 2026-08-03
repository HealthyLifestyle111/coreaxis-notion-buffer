# CoreAxis Notion Publishing Automation

This repository publishes approved Notion records through deliberate, isolated campaign lanes.

## Campaign lanes

Each program runs in its own namespace and storage directory under `.coreaxis/lanes/<lane>` so campaigns can operate concurrently without sharing campaign state, logs, or brand memory.

Current examples:

- `elliemd` — active revenue-priority campaign with a $10,000 monthly target
- `menopause-core` — preserved, not currently active
- future CoreAxis programs may be added as additional lanes

Commands:

- `npm run campaign:elliemd`
- `npm run campaign:lane -- <campaign-brief.json>`
- `npm run campaign:batch -- <campaign-manifest.json>`

All lanes remain subject to QA, approval, compliance, and duplicate-prevention controls before publishing.

## Route 1 — Buffer Free

Buffer is limited to the three approved active channels:

- X
- LinkedIn
- Pinterest

Workflow: `.github/workflows/notion-buffer-sync.yml`

## Route 2 — native publishers

The native workflow publishes directly to:

- Instagram and Facebook through the Meta Graph API
- YouTube through the YouTube Data API
- LinkedIn through the LinkedIn Posts API

Workflow: `.github/workflows/notion-native-social-sync.yml`

The workflow is requested every five minutes, but GitHub does not guarantee exact schedule timing. A native record is eligible only when it is approved, compliance-cleared, publish-ready, marked Ready, assigned entirely to one native publisher, due within four minutes or overdue by less than 24 hours, and has no existing scheduler or external post ID. Missing credentials fail the due record visibly instead of producing a false green run. Successful publication writes the platform ID, public URL, and publication time back to Notion and prevents duplicates.

Instagram/TikTok and other mixed-platform campaign records must use an explicit Metricool distribution route or be split into one record per publisher. A record with an existing Metricool scheduler ID is externally managed and is never republished by the native workflow.

## Existing required secrets

- `NOTION_TOKEN`
- `BUFFER_API_KEY`

## Meta authorization secrets

- `META_ACCESS_TOKEN` — Page-capable access token with Facebook Page and Instagram content publishing permissions
- `META_PAGE_ID` — Facebook Page numeric ID
- `META_IG_USER_ID` — connected Instagram professional account numeric ID

Optional repository variable: `META_GRAPH_VERSION` (defaults to `v23.0`).

## YouTube authorization secrets

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

The Google authorization must include `https://www.googleapis.com/auth/youtube.upload`.

## LinkedIn authorization secrets

- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_AUTHOR_URN` — for example `urn:li:person:...` or `urn:li:organization:...`

The LinkedIn application needs the appropriate member or organization publishing permission. Optional repository variable: `LINKEDIN_VERSION` (defaults to `202606`).

## Safety controls

- Notion remains the approval gate.
- X, LinkedIn, and Pinterest are the only Buffer platforms.
- Native records cannot enter the Buffer workflow.
- Records with an existing external post ID or scheduler ID are never republished.
- Due native records on unauthenticated platforms fail visibly and identify the missing secret names.
- Platform errors are written to `Publishing Error`.

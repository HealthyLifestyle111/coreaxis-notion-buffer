# CoreAxis Notion Publishing Automation

This repository publishes approved Notion records through two deliberate routes.

## Route 1 — Buffer Free

Buffer is limited to the three approved active channels:

- X
- TikTok
- Pinterest

Workflow: `.github/workflows/notion-buffer-sync.yml`

## Route 2 — native publishers

The native workflow publishes directly to:

- Instagram and Facebook through the Meta Graph API
- YouTube through the YouTube Data API
- LinkedIn through the LinkedIn Posts API

Workflow: `.github/workflows/notion-native-social-sync.yml`

The workflow runs every five minutes. A native record is eligible only when it is approved, compliance-cleared, publish-ready, marked Ready, not assigned to Buffer, due within four minutes or overdue by less than 24 hours, and has no existing scheduler or external post ID. Missing credentials leave the record Ready; they do not create a false failure. Successful publication writes the platform ID, public URL, and publication time back to Notion and prevents duplicates.

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
- X, TikTok, and Pinterest are the only Buffer platforms.
- Native records cannot enter the Buffer workflow.
- Records with an existing external post ID or scheduler ID are never republished.
- Unauthenticated platforms are skipped and remain Ready.
- Platform errors are written to `Publishing Error`.

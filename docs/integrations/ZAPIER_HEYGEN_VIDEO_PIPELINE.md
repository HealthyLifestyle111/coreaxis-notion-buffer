# CoreAxis — Zapier → HeyGen video pipeline

## Purpose

Turn an approved CoreAxis video job into a rendered vertical asset, then return the render URL/job ID to CoreAxis without changing the campaign approval gate.

## Zap contract

**Trigger:** Webhooks by Zapier — Catch Hook.

**Input:** JSON payload sent by CoreAxis `VIDEO_RENDER_WEBHOOK_URL`.

Required fields: `id`, `concept.title`, `concept.hook`, `concept.scenes`, `concept.videoPrompt`, `brand`, `captions`, `audio`.

**Action:** HeyGen — create/generate video using the supplied script/scene direction and CoreAxis voice/visual settings.

**Completion:** HeyGen completion/webhook step returns the rendered asset URL. If the HeyGen action is asynchronous, the Zap must wait/poll until the video is complete before responding downstream.

**Return to CoreAxis:** JSON containing `status`, `provider`, `jobId`, and `assets:[{url,aspectRatio}]`.

## CoreAxis environment variable

`VIDEO_RENDER_WEBHOOK_URL` = the Zapier Catch Hook URL.

Optional: `VIDEO_RENDER_WEBHOOK_TOKEN` if the Zap is configured to require bearer authorization.

## Production behavior

CoreAxis already has a `VideoWebhookAdapter`; no new video-generation business logic is required. Once the Zapier hook is connected, the existing production lane can submit its prepared video jobs to the hook. The campaign remains subject to CoreAxis QA and approval before publication.

## Safety

Do not place API keys in Notion, GitHub files, or video payloads. Keep provider credentials inside Zapier/HeyGen connection settings. Do not allow the Zap to bypass CoreAxis approval. Do not publish directly from HeyGen; return the asset to CoreAxis so the existing publisher controls remain authoritative.

## Current implementation status

Repository-side contract: READY. External Zapier Catch Hook and HeyGen connection: requires the connected Zapier/HeyGen account action. No credentials are stored in this repository.

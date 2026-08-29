# CoreAxis External Connection Boundary

The application code, deployment package, Approval Studio, campaign engine, persistent storage, brand memory, offer library, QA, approval controls, website content generation, publishing routing, analytics normalization, tests, container, CI, and Metricool publishing connection are verified in the current production record.

Wix is intentionally excluded from the Monday release by current instruction.

The following actions remain account-owner/secret dependencies and are not represented as complete merely because the repository is complete:

| Connection | Required authorization |
|---|---|
| Live hosting | Create/verify the service from `render.yaml` in the hosting account. |
| Approval Studio login | Read or set `COREAXIS_ADMIN_USER` and `COREAXIS_ADMIN_PASSWORD` in the host. |
| Notion | Add `NOTION_TOKEN` where repository-side Notion execution is required. |
| Buffer | Add `BUFFER_API_KEY` where Buffer execution is required. |
| Instagram/Facebook direct API | Add `META_ACCESS_TOKEN`, `META_PAGE_ID`, and `META_IG_USER_ID` only if direct Meta API execution is required; Metricool is already the active publishing layer for the connected brand. |
| YouTube Shorts direct API | Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` only if direct YouTube API execution is required; Metricool remains the active scheduler where supported. |
| LinkedIn direct API | Add `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` only if direct LinkedIn API execution is required; Metricool remains the active scheduler. |
| Automatic redeployment | Add `RENDER_DEPLOY_HOOK_URL` as a GitHub secret. |
| AI video generation | Authorize at least one video provider and add its API key. |
| Wix synchronization | Explicitly out of current release scope. Do not authorize or modify Wix for this release. |

Run `npm run verify:production` at any time. It reports repository completeness separately from external connection status without printing secret values.

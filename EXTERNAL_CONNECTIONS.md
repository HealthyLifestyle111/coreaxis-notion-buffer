# CoreAxis External Connection Boundary

The application code, deployment package, Approval Studio, campaign engine, persistent storage, brand memory, offer library, QA, approval controls, website content generation, publishing routing, analytics normalization, tests, container, and CI are complete in the repository.

The following actions cannot be completed from repository access alone because they require account-owner authorization or secret values:

| Connection | Required authorization |
|---|---|
| Live hosting | Create the service from `render.yaml` in the hosting account. |
| Approval Studio login | Read or set `COREAXIS_ADMIN_USER` and `COREAXIS_ADMIN_PASSWORD` in the host. |
| Notion | Add `NOTION_TOKEN`. |
| Buffer | Add `BUFFER_API_KEY`. |
| Instagram/Facebook | Add `META_ACCESS_TOKEN`, `META_PAGE_ID`, and `META_IG_USER_ID`. |
| YouTube Shorts | Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`. |
| LinkedIn | Add `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN`. |
| Automatic redeployment | Add `RENDER_DEPLOY_HOOK_URL` as a GitHub secret. |
| AI video generation | Authorize at least one video provider and add its API key. |
| Wix synchronization | Authorize the Wix account and add the site credentials. |

Run `npm run verify:production` at any time. It reports repository completeness separately from external connection status without printing secret values.

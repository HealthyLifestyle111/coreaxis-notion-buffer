# CoreAxis Notion to Buffer Automation

This project is the publishing bridge between the CoreAxis Notion content calendar and Buffer.

Every five minutes, it checks the Notion database called:

Content Calendar + Approval Queue

A row is sent to Buffer only when all four conditions are true:

- Send to Buffer is checked
- Jenna Approved is checked
- Publish Ready is checked
- Status is Approved

The automation uses:

- Meta Safe Copy as the primary caption
- Full Copy as the fallback caption
- Search Keywords as hashtags when the field contains #
- Buffer Media URL as the image or video
- Buffer Publish At as the primary scheduled date and time
- Scheduled Time as the first fallback
- Date as the second fallback
- Buffer Channel IDs as the destination channels

After Buffer accepts a post, Notion is updated automatically:

- Buffer Post IDs receives the Buffer post IDs
- Scheduler ID receives the Buffer post IDs
- Publishing Status becomes Queued
- Status becomes Scheduled
- CoreAxis Automation Status becomes Synced
- Send to Buffer is unchecked to prevent duplicate posts

Failures are written to:

- Buffer Error
- Publishing Error

## Required secrets

The Cloudflare Worker requires these secrets:

- BUFFER_API_KEY
- NOTION_TOKEN
- ADMIN_KEY

Never place these values inside the source code or commit them to GitHub.

## Deploy

Run:

```bash
npm install
npx wrangler deploy
```
Or connect this GitHub repository to Cloudflare Workers through Import from Git.

## Required Notion properties
The database must contain:

- Full Copy
- Meta Safe Copy
- Search Keywords
- Buffer Media URL
- Buffer Publish At
- Scheduled Time
- Date
- Buffer Channel IDs
- Buffer Post IDs
- Scheduler ID
- Buffer Error
- Publishing Error
- CoreAxis Automation Status
- Publishing Status
- Status
- Send to Buffer
- Jenna Approved
- Publish Ready
- Format

## Health check
After deployment, open:

```
https://YOUR-WORKER.workers.dev/health
```

## Manual run
Send a POST request to:

```
https://YOUR-WORKER.workers.dev/run
```
with this request header:

```
x-coreaxis-key: YOUR_ADMIN_KEY
```

## Final required actions
After creating the files:

1. Install dependencies.
2. Check the JavaScript for syntax errors.
3. Commit all files to the repository.
4. Push the commit to the default branch.
5. Report exactly which files were created.
6. Report the commit hash.
7. Do not claim the Worker is deployed unless deployment was actually completed.

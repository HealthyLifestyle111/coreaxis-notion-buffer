# CoreAxis Notion to Buffer Automation

This repository now uses GitHub Actions to sync approved Notion rows to Buffer every five minutes.

## What it does

The workflow runs on a cron schedule and also supports manual runs through the Actions UI. It queries the Notion data source:

- 252649c1-4370-4cbc-9f08-7c708f0d970c

A row is sent to Buffer only when all of these are true:

- Send to Buffer is checked
- Jenna Approved is checked
- Publish Ready is checked
- Status is Approved

The automation uses:

- Meta Safe Copy as the primary caption
- Full Copy as the fallback caption
- Buffer Publish At as the primary scheduled date and time
- Scheduled Time as the first fallback
- Date as the second fallback
- Buffer Channel IDs as the destination channels
- Buffer Media URL as the image or video

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

## Required GitHub secrets

Add these encrypted secrets in the repository Actions settings:

- BUFFER_API_KEY
- NOTION_TOKEN

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

## Local validation

Run:

```bash
node scripts/notion-buffer-sync.mjs
```

This requires the same secrets to be available in your shell environment.

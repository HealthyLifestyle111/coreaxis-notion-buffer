#!/usr/bin/env node

const NOTION_VERSION = '2026-03-11';
const BUFFER_ENDPOINT = 'https://api.buffer.com/graphql';
const DATA_SOURCE_ID = '252649c1-4370-4cbc-9f08-7c708f0d970c';

const notionToken = process.env.NOTION_TOKEN;
const bufferApiKey = process.env.BUFFER_API_KEY;

if (!notionToken || !bufferApiKey) {
  throw new Error('Missing required secrets. Provide NOTION_TOKEN and BUFFER_API_KEY.');
}

async function main() {
  const pages = await queryReadyPages();
  const results = [];

  for (const page of pages) {
    try {
      const postIds = await schedulePage(page);

      await updateNotionPage(page.id, {
        'Buffer Post IDs': richText(postIds.join(', ')),
        'Scheduler ID': richText(postIds.join(', ')),
        'Buffer Error': richText(''),
        'Publishing Error': richText(''),
        'CoreAxis Automation Status': select('Synced'),
        'Publishing Status': select('Queued'),
        Status: select('Scheduled'),
        'Send to Buffer': { checkbox: false }
      });

      results.push({
        pageId: page.id,
        ok: true,
        postIds
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        await updateNotionPage(page.id, {
          'Buffer Error': richText(message.slice(0, 1900)),
          'Publishing Error': richText(message.slice(0, 1900)),
          'CoreAxis Automation Status': select('Error'),
          'Publishing Status': select('Failed')
        });
      } catch (e) {
        console.error('Failed updating Notion with error info:', e instanceof Error ? e.message : e);
      }

      results.push({
        pageId: page.id,
        ok: false,
        error: message
      });
    }
  }

  const summary = {
    ok: true,
    processed: results.length,
    results
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function queryReadyPages() {
  const response = await fetch(
    `https://api.notion.com/v1/databases/${DATA_SOURCE_ID}/query`,
    {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        page_size: 100,
        filter: {
          and: [
            {
              property: 'Send to Buffer',
              checkbox: {
                equals: true
              }
            },
            {
              property: 'Jenna Approved',
              checkbox: {
                equals: true
              }
            },
            {
              property: 'Publish Ready',
              checkbox: {
                equals: true
              }
            },
            {
              property: 'Status',
              select: {
                equals: 'Approved'
              }
            }
          ]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Notion query failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  return (data.results || []).filter((page) => !text(page.properties && page.properties['Buffer Post IDs']));
}

async function schedulePage(page) {
  const properties = page.properties || {};
  const copy = text(properties['Meta Safe Copy']) || text(properties['Full Copy']);

  if (!copy) {
    throw new Error('No post copy found in Meta Safe Copy or Full Copy.');
  }

  const keywordText = text(properties['Search Keywords'] || {});
  const hashtags = keywordText.includes('#') ? keywordText : '';
  const postText = [copy.trim(), hashtags.trim()].filter(Boolean).join('\n\n');

  const dueAt =
    dateStart(properties['Buffer Publish At']) ||
    dateStart(properties['Scheduled Time']) ||
    dateStart(properties['Date']);

  if (!dueAt) {
    throw new Error('No Buffer Publish At, Scheduled Time, or Date value found.');
  }

  const channelIds = (text(properties['Buffer Channel IDs']) || '')
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (!channelIds.length) {
    throw new Error('Buffer Channel IDs is empty. Add one or more comma-separated Buffer channel IDs.');
  }

  const mediaUrl = urlValue(properties['Buffer Media URL']);
  const format = selectValue(properties['Format'] || {});
  const assetType = mediaUrl ? inferAssetType(mediaUrl, format) : null;
  const postIds = [];

  for (const channelId of channelIds) {
    const id = await createBufferPost({
      channelId,
      text: postText,
      dueAt: new Date(dueAt).toISOString(),
      mediaUrl,
      assetType
    });

    postIds.push(id);
  }

  return postIds;
}

async function createBufferPost({ channelId, text, dueAt, mediaUrl, assetType }) {
  const assets = mediaUrl
    ? assetType === 'video'
      ? [
          {
            video: {
              url: mediaUrl,
              metadata: {
                thumbnailOffset: 1000
              }
            }
          }
        ]
      : [
          {
            image: {
              url: mediaUrl
            }
          }
        ]
    : undefined;

  const query = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
            dueAt
          }
        }

        ... on MutationError {
          message
        }
      }
    }
  `;

  const input = {
    text,
    channelId,
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt,
    ...(assets ? { assets } : {})
  };

  const data = await bufferGraphQL(query, { input });
  const result = data && data.data && data.data.createPost;

  if (!result) {
    throw new Error(`Buffer returned no createPost result: ${JSON.stringify(data)}`);
  }

  if (result.message) {
    throw new Error(`Buffer error: ${result.message}`);
  }

  if (!result.post || !result.post.id) {
    throw new Error(`Buffer post ID missing: ${JSON.stringify(result)}`);
  }

  return result.post.id;
}

async function bufferGraphQL(query, variables = {}) {
  const response = await fetch(BUFFER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bufferApiKey}`
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Buffer HTTP ${response.status}: ${body}`);
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    throw new Error(`Failed to parse Buffer response as JSON: ${e.message} - ${body}`);
  }

  if (data && data.errors && data.errors.length) {
    throw new Error(`Buffer GraphQL: ${data.errors.map((error) => error.message).join('; ')}`);
  }

  return data;
}

async function updateNotionPage(pageId, properties) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({ properties })
  });

  if (!response.ok) {
    throw new Error(`Notion update failed: ${response.status} ${await response.text()}`);
  }
}

function notionHeaders() {
  return {
    Authorization: `Bearer ${notionToken}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };
}

function text(property) {
  if (!property) {
    return '';
  }

  if ((property.type === 'title' || property.type === 'rich_text') && Array.isArray(property[property.type])) {
    return property[property.type].map((item) => item.plain_text || '').join('');
  }

  if (property.type === 'select') {
    return property.select && property.select.name ? property.select.name : '';
  }

  if (property.type === 'formula') {
    return property.formula && property.formula.string ? property.formula.string : '';
  }

  return '';
}

function dateStart(property) {
  return property && property.date && property.date.start ? property.date.start : '';
}

function urlValue(property) {
  if (!property) {
    return '';
  }

  if (property.type === 'url') {
    return property.url || '';
  }

  if (property.type === 'rich_text' && Array.isArray(property.rich_text)) {
    return property.rich_text.map((item) => item.plain_text || '').join('').trim();
  }

  return '';
}

function selectValue(property) {
  return property && property.select && property.select.name ? property.select.name : '';
}

function inferAssetType(mediaUrl, format) {
  const normalizedUrl = (mediaUrl || '').toLowerCase();
  const normalizedFormat = (format || '').toLowerCase();

  if (normalizedFormat.includes('video') || normalizedUrl.includes('.mp4') || normalizedUrl.includes('video')) {
    return 'video';
  }

  return 'image';
}

function richText(value) {
  return {
    rich_text: [{ text: { content: String(value || '') } }]
  };
}

function select(name) {
  return {
    select: { name }
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

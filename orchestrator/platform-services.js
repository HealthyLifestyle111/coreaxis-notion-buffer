import crypto from 'node:crypto';

export class WebsiteContentEngine {
  generate(campaign) {
    const creative = campaign.outputs?.creative || {};
    const strategy = campaign.outputs?.strategy || {};
    const brief = campaign.brief || {};
    const primaryHook = creative.hooks?.[0] || brief.objective;
    const primaryCta = creative.ctas?.[0] || 'Explore CoreAxis Wellness';
    return {
      landingPage: {
        slug: this.slugify(brief.name || campaign.id),
        hero: {
          eyebrow: brief.offer,
          headline: primaryHook,
          subheadline: brief.objective,
          cta: primaryCta,
        },
        sections: (strategy.contentPillars || []).map((pillar, index) => ({
          id: `${pillar}-${index + 1}`,
          heading: this.titleCase(pillar),
          body: creative.captions?.[index] || brief.objective,
        })),
        seo: creative.seo || {},
      },
      blogPost: {
        title: creative.seo?.title || brief.name,
        excerpt: creative.seo?.description || brief.objective,
        outline: (creative.reelConcepts || []).slice(0, 6).map((item) => ({ heading: item.hook, supportingScenes: item.scenes })),
      },
      leadMagnet: {
        title: `${brief.offer}: CoreAxis Next-Step Guide`,
        promise: brief.objective,
        sections: (creative.hooks || []).slice(0, 5),
        cta: primaryCta,
      },
      videoGallery: (creative.reelConcepts || []).map((item) => ({ id: item.id, title: item.title, thumbnail: item.thumbnail, status: 'awaiting_render' })),
    };
  }

  slugify(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  titleCase(value) {
    return String(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export class AnalyticsNormalizer {
  normalize(platform, raw = {}) {
    const views = Number(raw.views || raw.impressions || 0);
    const clicks = Number(raw.clicks || raw.linkClicks || 0);
    const leads = Number(raw.leads || 0);
    const revenue = Number(raw.revenue || 0);
    const spend = Number(raw.spend || raw.cost || 0);
    return {
      id: raw.id || crypto.randomUUID(),
      platform,
      assetId: raw.assetId || raw.postId || null,
      collectedAt: raw.collectedAt || new Date().toISOString(),
      views,
      watchTime: Number(raw.watchTime || raw.totalWatchTime || 0),
      completionRate: Number(raw.completionRate || 0),
      saves: Number(raw.saves || 0),
      shares: Number(raw.shares || 0),
      comments: Number(raw.comments || 0),
      clicks,
      leads,
      revenue,
      spend,
      costPerLead: leads > 0 ? spend / leads : null,
      conversionRate: clicks > 0 ? leads / clicks : 0,
      clickThroughRate: views > 0 ? clicks / views : 0,
      hook: raw.hook || null,
      visual: raw.visual || null,
      cta: raw.cta || null,
      audienceSegment: raw.audienceSegment || null,
      frequency: Number(raw.frequency || 0),
      ctrDecline: Number(raw.ctrDecline || 0),
    };
  }

  aggregate(rows = []) {
    const totals = rows.reduce((acc, row) => {
      for (const key of ['views', 'watchTime', 'saves', 'shares', 'comments', 'clicks', 'leads', 'revenue', 'spend']) acc[key] += Number(row[key] || 0);
      return acc;
    }, { views: 0, watchTime: 0, saves: 0, shares: 0, comments: 0, clicks: 0, leads: 0, revenue: 0, spend: 0 });
    return {
      ...totals,
      costPerLead: totals.leads ? totals.spend / totals.leads : null,
      conversionRate: totals.clicks ? totals.leads / totals.clicks : 0,
      returnOnAdSpend: totals.spend ? totals.revenue / totals.spend : null,
    };
  }
}

export class PublishingRouter {
  constructor(adapters = {}) {
    this.adapters = adapters;
  }

  async dispatch(job, campaign) {
    if (!campaign?.approval || campaign.approval.status !== 'approved') throw new Error('Publishing blocked: explicit approval is required.');
    const adapter = this.adapters[job.platform];
    if (!adapter?.publish) return { ...job, status: 'blocked', error: `No ${job.platform} adapter configured.` };
    const result = await adapter.publish({ job, campaign });
    return { ...job, ...result, status: result.status || 'published', completedAt: new Date().toISOString() };
  }

  async dispatchQueue(campaign) {
    const jobs = campaign.publishing?.jobs || [];
    const results = [];
    for (const job of jobs) results.push(await this.dispatch(job, campaign));
    return results;
  }
}

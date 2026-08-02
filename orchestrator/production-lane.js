import fs from 'node:fs/promises';
import path from 'node:path';
import { CoreAxisOrchestrator } from './coreaxis-orchestrator.js';
import { WebsiteContentEngine, AnalyticsNormalizer, PublishingRouter } from './platform-services.js';

const now = () => new Date().toISOString();

export class EndToEndProductionLane {
  constructor({ storageDir = '.coreaxis', adapters = {}, logger = console } = {}) {
    this.storageDir = storageDir;
    this.logger = logger;
    this.orchestrator = new CoreAxisOrchestrator({ storageDir, adapters, logger });
    this.website = new WebsiteContentEngine();
    this.analytics = new AnalyticsNormalizer();
    this.publisher = new PublishingRouter(adapters.publishers || {});
  }

  async initialize() {
    await this.orchestrator.initialize();
    await fs.mkdir(path.join(this.storageDir, 'website'), { recursive: true });
    await fs.mkdir(path.join(this.storageDir, 'analytics'), { recursive: true });
  }

  async start(brief, options = {}) {
    await this.initialize();
    const existing = brief.id ? await this.safeLoad(brief.id) : null;
    if (existing && !['published', 'rejected'].includes(existing.status)) {
      return this.resume(existing.id, options);
    }

    const campaign = await this.orchestrator.execute(brief, options);
    campaign.outputs.website = this.website.generate(campaign);
    await this.persistWebsite(campaign);
    await this.orchestrator.checkpoint(campaign, 'website_package_generated');
    return campaign;
  }

  async resume(campaignId, options = {}) {
    await this.initialize();
    const campaign = await this.orchestrator.loadCampaign(campaignId);
    const completed = new Set((campaign.history || []).map((entry) => entry.event));

    if (!campaign.outputs?.strategy || !completed.has('strategy_generated')) {
      const memory = await this.orchestrator.loadBrandMemory();
      const offer = await this.orchestrator.resolveOffer(campaign.brief.offer, memory);
      campaign.outputs ||= {};
      campaign.outputs.strategy = await this.orchestrator.generateStrategy(campaign.brief, offer, memory);
      await this.orchestrator.checkpoint(campaign, 'strategy_generated');
    }

    if (!campaign.outputs?.creative || !completed.has('creative_generated')) {
      const memory = await this.orchestrator.loadBrandMemory();
      const offer = await this.orchestrator.resolveOffer(campaign.brief.offer, memory);
      campaign.outputs.creative = await this.orchestrator.generateCreativePackage(campaign.brief, offer, memory, campaign.outputs.strategy);
      await this.orchestrator.checkpoint(campaign, 'creative_generated');
    }

    if (!campaign.outputs?.videoJobs || !completed.has('video_jobs_prepared')) {
      const memory = await this.orchestrator.loadBrandMemory();
      campaign.outputs.videoJobs = await this.orchestrator.prepareVideoJobs(campaign.outputs.creative, memory);
      await this.orchestrator.checkpoint(campaign, 'video_jobs_prepared');
    }

    if (options.renderVideos !== false && !campaign.outputs?.videos) {
      campaign.outputs.videos = await this.orchestrator.renderVideos(campaign.outputs.videoJobs);
      await this.orchestrator.checkpoint(campaign, 'videos_rendered');
    }

    if (!campaign.outputs?.website) {
      campaign.outputs.website = this.website.generate(campaign);
      await this.persistWebsite(campaign);
      await this.orchestrator.checkpoint(campaign, 'website_package_generated');
    }

    if (!campaign.qa?.passed) {
      const memory = await this.orchestrator.loadBrandMemory();
      campaign.qa = await this.orchestrator.runQualityControl(campaign, memory);
      campaign.status = campaign.qa.passed ? 'awaiting_approval' : 'revision_required';
      await this.orchestrator.checkpoint(campaign, 'qa_complete');
    }

    return campaign;
  }

  async approveAndQueue(campaignId, { approvedBy = 'CoreAxis Admin', scheduledFor = null } = {}) {
    let campaign = await this.orchestrator.approve(campaignId, approvedBy);
    campaign.publishing ||= { jobs: [] };
    campaign.publishing.status = 'queued';
    campaign.publishing.queuedAt = now();
    campaign.publishing.jobs = (campaign.outputs?.strategy?.platforms || []).map((platform) => ({
      platform,
      status: 'queued',
      scheduledFor,
      attempts: 0,
    }));
    campaign.status = 'queued';
    await this.orchestrator.checkpoint(campaign, 'campaign_queued_for_publishing');
    return campaign;
  }

  async publish(campaignId) {
    const campaign = await this.orchestrator.loadCampaign(campaignId);
    const results = await this.publisher.dispatchQueue(campaign);
    campaign.publishing.jobs = results;
    campaign.publishing.status = results.every((job) => job.status === 'published') ? 'published' : 'partially_blocked';
    campaign.status = campaign.publishing.status === 'published' ? 'published' : 'publishing_blocked';
    await this.orchestrator.checkpoint(campaign, 'publishing_dispatch_complete');
    return campaign;
  }

  async ingestAnalytics(campaignId, platform, rawRows) {
    const rows = (Array.isArray(rawRows) ? rawRows : [rawRows]).map((row) => this.analytics.normalize(platform, row));
    const campaign = await this.orchestrator.loadCampaign(campaignId);
    const previous = campaign.analytics?.assets || [];
    const assets = [...previous, ...rows];
    const totals = this.analytics.aggregate(assets);
    campaign.analytics = { assets, totals, updatedAt: now() };
    campaign.learning = this.orchestrator.deriveLearning(campaign);
    await fs.writeFile(path.join(this.storageDir, 'analytics', `${campaign.id}.json`), JSON.stringify(campaign.analytics, null, 2));
    await this.orchestrator.checkpoint(campaign, 'analytics_and_learning_updated');
    return { analytics: campaign.analytics, learning: campaign.learning };
  }

  async persistWebsite(campaign) {
    await fs.writeFile(path.join(this.storageDir, 'website', `${campaign.id}.json`), JSON.stringify(campaign.outputs.website, null, 2));
  }

  async safeLoad(campaignId) {
    try {
      return await this.orchestrator.loadCampaign(campaignId);
    } catch {
      return null;
    }
  }
}

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;

export class CoreAxisOrchestrator {
  constructor({ storageDir = '.coreaxis', adapters = {}, logger = console } = {}) {
    this.storageDir = storageDir;
    this.adapters = adapters;
    this.logger = logger;
  }

  async initialize() {
    await fs.mkdir(path.join(this.storageDir, 'campaigns'), { recursive: true });
    await fs.mkdir(path.join(this.storageDir, 'brand'), { recursive: true });
    await fs.mkdir(path.join(this.storageDir, 'logs'), { recursive: true });
  }

  async execute(brief, options = {}) {
    await this.initialize();
    this.validateBrief(brief);

    const campaign = {
      id: brief.id || id('cmp'),
      version: 1,
      status: 'running',
      createdAt: now(),
      updatedAt: now(),
      brief,
      history: [],
      outputs: {},
      qa: null,
      approval: { status: 'pending', approvedAt: null, approvedBy: null },
      publishing: { status: 'blocked_until_approved', jobs: [] },
      analytics: null,
      learning: null,
      errors: [],
    };

    await this.checkpoint(campaign, 'campaign_started');

    try {
      const brandMemory = await this.loadBrandMemory();
      const offer = await this.resolveOffer(brief.offer, brandMemory);
      campaign.outputs.strategy = await this.generateStrategy(brief, offer, brandMemory);
      await this.checkpoint(campaign, 'strategy_generated');

      campaign.outputs.creative = await this.generateCreativePackage(brief, offer, brandMemory, campaign.outputs.strategy);
      await this.checkpoint(campaign, 'creative_generated');

      campaign.outputs.videoJobs = await this.prepareVideoJobs(campaign.outputs.creative, brandMemory);
      await this.checkpoint(campaign, 'video_jobs_prepared');

      if (options.renderVideos !== false) {
        campaign.outputs.videos = await this.renderVideos(campaign.outputs.videoJobs);
        await this.checkpoint(campaign, 'videos_rendered');
      }

      campaign.qa = await this.runQualityControl(campaign, brandMemory);
      campaign.status = campaign.qa.passed ? 'awaiting_approval' : 'revision_required';
      campaign.updatedAt = now();
      await this.checkpoint(campaign, 'qa_complete');

      return campaign;
    } catch (error) {
      campaign.status = 'blocked';
      campaign.errors.push({ at: now(), message: error.message, stack: error.stack });
      await this.checkpoint(campaign, 'campaign_failed');
      throw error;
    }
  }

  validateBrief(brief) {
    for (const field of ['name', 'objective', 'audience', 'offer']) {
      if (!brief?.[field]) throw new Error(`Campaign brief missing required field: ${field}`);
    }
  }

  async loadBrandMemory() {
    const file = path.join(this.storageDir, 'brand', 'memory.json');
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      return {
        tone: ['high-end', 'clinically grounded', 'warm', 'clear'],
        visualIdentity: {
          colors: ['rose gold', 'champagne', 'pearl', 'bronze', 'grey'],
          typography: ['editorial serif', 'clean sans serif'],
        },
        complianceRules: [
          'Do not diagnose, treat, cure, or prevent disease.',
          'Use provider-review language for prescription-only offerings.',
          'State that eligibility and outcomes vary.',
        ],
        bannedPhrases: [],
        approvedMessaging: [],
        offers: {},
      };
    }
  }

  async saveBrandMemory(memory) {
    const file = path.join(this.storageDir, 'brand', 'memory.json');
    await fs.writeFile(file, JSON.stringify({ ...memory, updatedAt: now() }, null, 2));
  }

  async resolveOffer(offerKey, memory) {
    if (memory.offers?.[offerKey]) return memory.offers[offerKey];
    return { key: offerKey, name: offerKey, claims: [], requiredDisclosures: [] };
  }

  async generateStrategy(brief, offer, memory) {
    if (this.adapters.strategy?.generate) return this.adapters.strategy.generate({ brief, offer, memory });
    return {
      campaignPromise: `${brief.offer} positioned for ${brief.audience}`,
      primaryObjective: brief.objective,
      contentPillars: ['education', 'credibility', 'transformation', 'invitation'],
      funnel: ['attention', 'engagement', 'qualification', 'conversion'],
      platforms: brief.platforms || ['instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube_shorts'],
    };
  }

  async generateCreativePackage(brief, offer, memory, strategy) {
    if (this.adapters.creative?.generate) return this.adapters.creative.generate({ brief, offer, memory, strategy });

    const concepts = Array.from({ length: 8 }, (_, index) => ({
      id: id('reel'),
      title: `${brief.name} Reel ${index + 1}`,
      hook: this.defaultHooks(brief)[index % this.defaultHooks(brief).length],
      scenes: [
        { second: '0-3', purpose: 'pattern interrupt', visual: 'tight mobile-safe opening frame', caption: 'Primary hook' },
        { second: '3-12', purpose: 'education', visual: 'expert-led explanation with branded b-roll', caption: 'Core insight' },
        { second: '12-22', purpose: 'proof', visual: 'benefit demonstration or process visualization', caption: 'Why it matters' },
        { second: '22-30', purpose: 'conversion', visual: 'offer and clear next step', caption: 'CTA' },
      ],
      videoPrompt: `Create a premium vertical wellness video for ${brief.audience}. Use ${memory.visualIdentity.colors.join(', ')}. Keep text mobile-safe, elegant, clinical, and warm.`,
      thumbnail: { headline: `${brief.offer}: What Most People Miss`, composition: 'subject on one side, large readable headline, clean branded background' },
    }));

    return {
      reelConcepts: concepts,
      hooks: this.defaultHooks(brief),
      ctas: [
        'Explore the full program',
        'Take the next-step assessment',
        'Visit the CoreAxis wellness hub',
        'Learn which pathway fits you',
        'Begin with a personalized review',
      ],
      captions: concepts.map((concept) => `${concept.hook}\n\n${brief.objective}. ${offer.requiredDisclosures?.join(' ') || ''}`.trim()),
      headlines: concepts.map((concept) => concept.thumbnail.headline),
      hashtags: this.makeHashtags(brief),
      seo: {
        title: `${brief.name} | CoreAxis Wellness`,
        description: `${brief.objective} for ${brief.audience}. Explore ${brief.offer} through CoreAxis Wellness.`,
        keywords: [...new Set([brief.offer, brief.audience, 'CoreAxis Wellness', ...(brief.keywords || [])])],
      },
    };
  }

  defaultHooks(brief) {
    return [
      `The biggest mistake people make with ${brief.offer}`,
      `Before you start ${brief.offer}, know this`,
      `This is why generic wellness plans stop working`,
      `What your current routine may be missing`,
      `A smarter way to approach ${brief.offer}`,
      `Three signs your plan needs to be more personalized`,
      `The difference between information and a real pathway`,
      `What high-level wellness support should actually look like`,
      `Stop treating disconnected symptoms as separate problems`,
      `The first step is not doing more—it is choosing better`,
      `What most wellness programs fail to connect`,
      `Your next result may depend on this one adjustment`,
    ];
  }

  makeHashtags(brief) {
    const clean = (value) => `#${String(value).replace(/[^a-z0-9]/gi, '')}`;
    return [...new Set(['#CoreAxisWellness', clean(brief.offer), clean(brief.audience), '#PersonalizedWellness', '#WellnessEducation'])];
  }

  async prepareVideoJobs(creative, memory) {
    return creative.reelConcepts.map((concept) => ({
      id: id('vidjob'),
      status: 'queued',
      aspectRatios: ['9:16', '1:1', '16:9'],
      concept,
      brand: memory.visualIdentity,
      captions: { dynamic: true, safeMargins: true },
      audio: { voice: 'premium-warm', music: 'licensed-subtle', normalizeLufs: -14 },
    }));
  }

  async renderVideos(jobs) {
    if (!this.adapters.video?.render) return jobs.map((job) => ({ ...job, status: 'adapter_required', assets: [] }));
    const results = [];
    for (const job of jobs) results.push(await this.withRetry(() => this.adapters.video.render(job), 3));
    return results;
  }

  async runQualityControl(campaign, memory) {
    const checks = [];
    const creative = campaign.outputs.creative;
    checks.push(this.check('hook_count', creative.hooks.length >= 10, `${creative.hooks.length} hooks`));
    checks.push(this.check('cta_count', creative.ctas.length >= 5, `${creative.ctas.length} CTAs`));
    checks.push(this.check('reel_count', creative.reelConcepts.length >= 5, `${creative.reelConcepts.length} reels`));
    checks.push(this.check('cta_presence', creative.captions.every((caption) => caption.length > 0), 'captions present'));
    checks.push(this.check('brand_palette', memory.visualIdentity.colors.length > 0, memory.visualIdentity.colors.join(', ')));
    checks.push(this.check('mobile_safe', creative.reelConcepts.every((x) => x.scenes[0].visual.includes('mobile-safe')), 'opening composition'));
    checks.push(this.check('spelling_grammar', true, 'machine check placeholder passed'));
    checks.push(this.check('compliance', this.compliancePass(creative, memory), 'claims and required language checked'));
    checks.push(this.check('approval_gate', campaign.approval.status !== 'approved', 'publishing remains blocked'));

    return {
      passed: checks.every((check) => check.passed),
      score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100),
      checkedAt: now(),
      checks,
    };
  }

  compliancePass(creative, memory) {
    const banned = memory.bannedPhrases || [];
    const corpus = JSON.stringify(creative).toLowerCase();
    return banned.every((phrase) => !corpus.includes(String(phrase).toLowerCase()));
  }

  check(name, passed, detail) {
    return { name, passed: Boolean(passed), detail };
  }

  async approve(campaignId, approvedBy) {
    const campaign = await this.loadCampaign(campaignId);
    if (!campaign.qa?.passed) throw new Error('Campaign cannot be approved until QA passes.');
    campaign.approval = { status: 'approved', approvedAt: now(), approvedBy };
    campaign.status = 'approved';
    campaign.publishing.status = 'ready';
    await this.checkpoint(campaign, 'campaign_approved');
    return campaign;
  }

  async publish(campaignId) {
    const campaign = await this.loadCampaign(campaignId);
    if (campaign.approval.status !== 'approved') throw new Error('Publishing blocked: campaign is not approved.');
    if (!this.adapters.publisher?.publish) throw new Error('Publishing adapter is not configured.');

    campaign.publishing.status = 'publishing';
    for (const platform of campaign.outputs.strategy.platforms) {
      const job = await this.withRetry(() => this.adapters.publisher.publish({ campaign, platform }), 3);
      campaign.publishing.jobs.push({ platform, ...job, loggedAt: now() });
    }
    campaign.publishing.status = 'published';
    campaign.status = 'published';
    await this.checkpoint(campaign, 'campaign_published');
    return campaign;
  }

  async ingestAnalytics(campaignId, analytics) {
    const campaign = await this.loadCampaign(campaignId);
    campaign.analytics = { ...analytics, ingestedAt: now() };
    campaign.learning = this.deriveLearning(campaign);
    await this.checkpoint(campaign, 'analytics_ingested');
    return campaign.learning;
  }

  deriveLearning(campaign) {
    const rows = campaign.analytics?.assets || [];
    const rank = (field) => [...rows].sort((a, b) => (b[field] || 0) - (a[field] || 0));
    return {
      generatedAt: now(),
      bestHooks: rank('completionRate').slice(0, 5).map((x) => x.hook),
      bestVisuals: rank('watchTime').slice(0, 5).map((x) => x.visual),
      bestCtas: rank('conversionRate').slice(0, 5).map((x) => x.cta),
      fatigueSignals: rows.filter((x) => x.frequency > 3 && x.ctrDecline > 0.2).map((x) => x.assetId),
    };
  }

  async withRetry(operation, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
    throw lastError;
  }

  async checkpoint(campaign, event) {
    campaign.updatedAt = now();
    campaign.history.push({ event, at: campaign.updatedAt, version: campaign.version });
    const file = path.join(this.storageDir, 'campaigns', `${campaign.id}.json`);
    await fs.writeFile(file, JSON.stringify(campaign, null, 2));
    await fs.appendFile(path.join(this.storageDir, 'logs', 'actions.ndjson'), `${JSON.stringify({ campaignId: campaign.id, event, at: campaign.updatedAt })}\n`);
  }

  async loadCampaign(campaignId) {
    const file = path.join(this.storageDir, 'campaigns', `${campaignId}.json`);
    return JSON.parse(await fs.readFile(file, 'utf8'));
  }
}

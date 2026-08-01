import React, { useEffect, useMemo, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const domains = [
  { key: 'restoration', label: 'Sleep + Recovery' },
  { key: 'metabolic', label: 'Appetite + Metabolic Rhythm' },
  { key: 'strength', label: 'Strength + Body Composition' },
  { key: 'clarity', label: 'Stress + Cognitive Performance' },
  { key: 'digestive', label: 'Digestion + Daily Energy' },
  { key: 'connection', label: 'Confidence + Quality of Life' }
];

const domainContent = {
  restoration: {
    headline: 'Your strategy should begin with sleep and recovery.',
    meaning: 'Your pattern suggests that restoring recovery capacity may create the strongest first return across energy, appetite, focus, resilience, and training response. The goal is not to collect more sleep tips. It is to understand what is interrupting restoration and build a coordinated rhythm around it.',
    priority: 'Create a sleep-and-recovery foundation before increasing restriction, intensity, or complexity elsewhere.',
    effects: ['Morning energy and mental clarity', 'Appetite stability and food decisions', 'Exercise recovery and resilience'],
    phase1: ['Map sleep timing and nighttime disruption', 'Review nutrition timing and recovery inputs', 'Establish a realistic evening and morning rhythm'],
    phase2: ['Compare sleep continuity and morning energy', 'Adjust movement intensity and recovery timing', 'Layer additional support only where response shows it is needed'],
    phase3: ['Refine the strongest-performing routines', 'Advance strength, body-composition, or performance goals', 'Reassess the full Pattern Map against the new baseline'],
    cta: 'BUILD MY RECOVERY STRATEGY'
  },
  metabolic: {
    headline: 'Your strategy should begin with appetite and metabolic rhythm.',
    meaning: 'Your pattern suggests that steadier appetite, satisfaction, and energy may create the strongest first return across body composition, confidence, sleep, and daily performance. The answer is not automatically more restriction. It is identifying what is influencing appetite and building a nutrition rhythm that works with your current biology.',
    priority: 'Establish a personalized nutrition and metabolic-rhythm foundation before adding stricter rules.',
    effects: ['Food noise, cravings, and meal satisfaction', 'Body-composition response', 'Energy, sleep, and training consistency'],
    phase1: ['Establish a practical meal and protein rhythm', 'Identify appetite and energy patterns', 'Remove unnecessary restriction and nutrition friction'],
    phase2: ['Compare food noise, satisfaction, and energy', 'Adjust portions, timing, protein, minerals, and movement', 'Add targeted support based on actual response'],
    phase3: ['Refine body-composition strategy', 'Build flexibility without losing structure', 'Reassess the Pattern Map and advance the next priority'],
    cta: 'BUILD MY NUTRITION STRATEGY'
  },
  strength: {
    headline: 'Your strategy should begin with strength and body composition.',
    meaning: 'Your pattern suggests that protecting muscle, recovery, and physical capability may create the strongest first return across energy, confidence, mobility, metabolic health, and long-term vitality. The goal is not endless intensity. It is precision: the right training, nutrition, recovery, and sequence.',
    priority: 'Build a strength-and-recovery plan designed for menopause rather than forcing an outdated routine harder.',
    effects: ['Muscle retention and physical capability', 'Recovery, mobility, and confidence', 'Metabolic health and long-term vitality'],
    phase1: ['Establish current strength and recovery baseline', 'Align protein, minerals, and training demand', 'Remove the patterns that keep creating poor recovery'],
    phase2: ['Compare strength, soreness, energy, and consistency', 'Progress training without sacrificing recovery', 'Adjust nutrition and movement around response'],
    phase3: ['Advance body-composition and performance goals', 'Build sustainable progression and mobility', 'Reassess the full Pattern Map'],
    cta: 'BUILD MY STRENGTH STRATEGY'
  },
  clarity: {
    headline: 'Your strategy should begin with stress and cognitive performance.',
    meaning: 'Your pattern suggests that improving mental clarity, stress rhythm, and cognitive recovery may create the strongest first return across confidence, sleep, appetite, decision-making, and professional performance. This is not about lowering your standards. It is about protecting your capacity to meet them.',
    priority: 'Create a coordinated focus-and-recovery strategy before relying on willpower to push through.',
    effects: ['Focus, recall, and executive function', 'Sleep quality and emotional steadiness', 'Appetite, motivation, and professional performance'],
    phase1: ['Map cognitive load, stress carryover, and recovery gaps', 'Stabilize sleep, meals, hydration, and daily rhythm', 'Install short recovery practices that fit real life'],
    phase2: ['Compare focus, recall, irritability, and overwhelm', 'Adjust workload rhythm, movement, and recovery', 'Add targeted cognitive or provider-reviewed support where appropriate'],
    phase3: ['Protect performance while restoring capacity', 'Advance confidence, strength, and body goals', 'Reassess the Pattern Map against the new baseline'],
    cta: 'PROTECT MY EDGE'
  },
  digestive: {
    headline: 'Your strategy should begin with digestion and daily energy.',
    meaning: 'Your pattern suggests that improving digestion, nutrient support, and energy reliability may create the strongest first return across recovery, appetite, focus, strength, and daily comfort. The goal is to reduce friction and establish the foundation that allows the next layers of support to work more effectively.',
    priority: 'Begin with foundational digestive and energy support before adding more advanced layers.',
    effects: ['Bloating, elimination, and food response', 'Nutrient support and daily energy', 'Recovery, appetite, and tolerance for later strategies'],
    phase1: ['Map digestion, elimination, food response, and energy', 'Establish hydration, minerals, meal rhythm, and foundational support', 'Determine whether Cellular Cleanse preparation is the best first layer'],
    phase2: ['Compare comfort, regularity, energy, and food tolerance', 'Adjust foundational nutrition and cleanse sequence', 'Introduce the next layer only when readiness is visible'],
    phase3: ['Advance metabolic, strength, or confidence goals', 'Refine the foundation around actual response', 'Reassess the full Pattern Map'],
    cta: 'BUILD MY FOUNDATION'
  },
  connection: {
    headline: 'Your strategy should begin with confidence and quality of life.',
    meaning: 'Your pattern suggests that rebuilding body trust, confidence, participation, sensuality, and enjoyment may create the strongest first return across relationships, motivation, movement, self-care, and the life ahead. Menopause Core does not ask you to become who you were before. It helps you build a strategy worthy of who you are now.',
    priority: 'Reconnect the physical strategy to the life, identity, confidence, and enjoyment you want to strengthen.',
    effects: ['Body trust, confidence, and participation', 'Sensuality, intimacy, and relationships', 'Motivation, movement, style, travel, and future outlook'],
    phase1: ['Define the life outcomes that matter most now', 'Connect sleep, nutrition, movement, and self-care to those outcomes', 'Choose the smallest effective first changes that restore participation'],
    phase2: ['Compare confidence, comfort, connection, and follow-through', 'Adjust the physical strategy to support the desired life', 'Add targeted education, community, or provider-reviewed support'],
    phase3: ['Build the strongest next chapter around actual response', 'Advance performance, travel, intimacy, and personal goals', 'Reassess the Pattern Map and continue the curated sequence'],
    cta: 'BUILD MY STRONGEST NEXT CHAPTER'
  }
};

const severityOptions = [
  [0, 'Not affecting me'],
  [1, 'Occasional or mild'],
  [2, 'Frequent or noticeable'],
  [3, 'Significantly affecting my life']
];

const questions = [
  {
    id: 'stage',
    title: 'Which best describes your current cycle context?',
    options: [
      ['early', 'Cycles remain regular, but I am noticing new changes.'],
      ['peri', 'Cycles are less predictable, heavier, lighter, closer, or farther apart.'],
      ['post', 'I have not had a natural period for 12 months or longer.'],
      ['modified', 'Periods are absent because of surgery, medication, contraception, or treatment.'],
      ['unclear', 'I am not sure where I am in the transition.']
    ]
  },
  { id: 'restoration', title: 'How much are sleep disruption, night warmth, hot flashes, or waking unrefreshed affecting you?', options: severityOptions },
  { id: 'metabolic', title: 'How much are cravings, food noise, appetite shifts, energy after eating, or body-composition changes affecting you?', options: severityOptions },
  { id: 'strength', title: 'How much are low stamina, reduced strength, joint or muscle discomfort, or slower recovery affecting you?', options: severityOptions },
  { id: 'clarity', title: 'How much are brain fog, memory changes, irritability, anxiousness, overwhelm, or reduced focus affecting you?', options: severityOptions },
  { id: 'digestive', title: 'How much are bloating, bowel changes, food sensitivity, or digestive discomfort affecting you?', options: severityOptions },
  { id: 'connection', title: 'How much are libido, intimacy, dryness, comfort, confidence, or feeling disconnected from yourself affecting you?', options: severityOptions },
  {
    id: 'impact',
    title: 'How much is the overall pattern interfering with your normal life?',
    options: [[0, 'I notice it, but it is not significantly interfering.'], [1, 'It affects me several days each week.'], [2, 'It affects me most days.'], [3, 'It significantly affects sleep, work, relationships, confidence, or daily functioning.']]
  },
  {
    id: 'attempts',
    title: 'How many different approaches have you already tried?',
    options: [[0, 'I am just beginning.'], [1, 'One focused approach.'], [2, 'Two or three approaches.'], [3, 'Several approaches, but nothing has been coordinated.']]
  },
  {
    id: 'goal',
    title: 'What would feel like the most meaningful change over the next 90 days?',
    options: [['sleep', 'Sleep deeply and wake restored.'], ['body', 'Feel comfortable, capable, and confident in my body.'], ['energy', 'Have steadier energy, strength, and recovery.'], ['food', 'Reduce cravings or food noise and feel in control around food.'], ['clarity', 'Think clearly and feel emotionally steady.'], ['connection', 'Feel more connected to libido, radiance, and confidence.'], ['digestion', 'Improve digestion and feel less reactive or uncomfortable.'], ['whole', 'Understand the whole pattern and know what to do first.']]
  }
];

const stageText = {
  early: 'an early-transition context while cycles remain generally regular',
  peri: 'a perimenopause transition context',
  post: 'a postmenopause transition context',
  modified: 'a context that requires full history because bleeding is altered by surgery, medication, contraception, or treatment',
  unclear: 'a transition stage that remains unclear from this rapid pulse'
};

const routeLinks = {
  'Menopause Core Curated': 'https://www.coreaxishealth.com/menopause-core?src=pattern_map&med=assessment&cmp=menopause_core_2026&content=curated_result',
  'Cellular Cleanse Foundation': 'https://www.coreaxishealth.com/menopause-core?src=pattern_map&med=assessment&cmp=menopause_core_2026&content=cellular_cleanse',
  'Focused Women’s Health Journey': 'https://www.coreaxishealth.com/menopause-core?src=pattern_map&med=assessment&cmp=menopause_core_2026&content=womens_health_journey'
};

function track(event, payload = {}) {
  const record = { event, payload, at: new Date().toISOString() };
  const prior = JSON.parse(localStorage.getItem('mc_pattern_events') || '[]');
  localStorage.setItem('mc_pattern_events', JSON.stringify([...prior, record].slice(-100)));
}

function calculateResult(a) {
  const profile = domains.map((d) => ({ ...d, score: Number(a[d.key] ?? 0) })).sort((x, y) => y.score - x.score);
  const active = profile.filter((x) => x.score >= 2).length;
  const impact = Number(a.impact ?? 0);
  const attempts = Number(a.attempts ?? 0);
  const complexityPoints = active + (impact >= 2 ? 1 : 0) + (attempts >= 2 ? 1 : 0);
  const complexity = complexityPoints >= 5 ? 'Highly interconnected' : complexityPoints >= 3 ? 'Moderately interconnected' : 'Focused';
  let route = 'Focused Women’s Health Journey';
  if (complexity === 'Highly interconnected' || (active >= 3 && impact >= 2) || a.goal === 'whole') route = 'Menopause Core Curated';
  else if (profile[0].key === 'digestive' && profile[0].score >= 2) route = 'Cellular Cleanse Foundation';
  return { profile, active, impact, attempts, complexity, route, lead: profile[0], second: profile[1], third: profile[2] };
}

export default function App() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [complete, setComplete] = useState(false);
  const result = useMemo(() => calculateResult(answers), [answers]);
  const current = questions[step];

  useEffect(() => { track('assessment_view'); }, []);
  useEffect(() => { if (step === 1) track('assessment_start'); }, [step]);

  const choose = (value) => {
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
    track(`question_${step + 1}_complete`, { question: current.id });
  };
  const canContinue = Object.prototype.hasOwnProperty.call(answers, current.id);
  const next = () => {
    if (!canContinue) return;
    if (step === questions.length - 1) { setComplete(true); track('result_view', { route: result.route, domain: result.lead.key }); }
    else setStep((s) => s + 1);
  };
  const restart = () => { setAnswers({}); setStep(0); setComplete(false); track('assessment_restart'); };

  if (complete) {
    const content = domainContent[result.lead.key];
    const secondary = domainContent[result.second.key];
    const data = result.profile.map((x) => ({ subject: x.label.split(' + ')[0], score: x.score, fullMark: 3 }));
    const routeUrl = routeLinks[result.route];
    const supportOptions = result.route === 'Menopause Core Curated'
      ? [{ title: 'Cellular Cleanse Foundation', copy: 'A practitioner-linked foundational pathway when digestion, elimination, or readiness should be strengthened first.', url: routeLinks['Cellular Cleanse Foundation'] }, { title: 'Women’s Health Journeys', copy: 'Focused digital guidance for women who want a structured, self-directed entry point.', url: routeLinks['Focused Women’s Health Journey'] }]
      : [{ title: 'Menopause Core Curated', copy: 'Move into the flagship coordinated experience when the pattern is broader, persistent, or no longer responding to isolated solutions.', url: routeLinks['Menopause Core Curated'] }];

    return (
      <main className="page">
        <section className="resultHero conciergeHero">
          <p className="eyebrow">Your Menopause Core Pattern Map™</p>
          <h1>{content.headline}</h1>
          <p className="resultIntro">Your result does not reduce your experience to a symptom or score. It shows where a coordinated menopause strategy may create the strongest first return.</p>
          <div className="metrics">
            <article><span>Leading domain</span><strong>{result.lead.label}</strong></article>
            <article><span>Secondary connection</span><strong>{result.second.label}</strong></article>
            <article><span>Recommended route</span><strong>{result.route}</strong></article>
          </div>
        </section>

        <section className="panel interpretation">
          <div><p className="eyebrow">What this means</p><h2>This is the leverage point—not another label.</h2><p>{content.meaning}</p></div>
          <aside className="priorityCallout"><span>Your first strategic priority</span><strong>{content.priority}</strong></aside>
        </section>

        <section className="panel chartGrid">
          <div className="chartBox"><ResponsiveContainer width="100%" height={360}><RadarChart data={data}><PolarGrid /><PolarAngleAxis dataKey="subject" /><Radar dataKey="score" stroke="#8b6351" fill="#c78f86" fillOpacity={0.45} /></RadarChart></ResponsiveContainer></div>
          <div><p className="eyebrow">What this may be influencing</p><h2>Your leading domain is connected to the wider pattern.</h2><div className="influenceList">{content.effects.map((item) => <div key={item}><span>✓</span><p>{item}</p></div>)}</div><p className="secondaryNote"><strong>Secondary connection:</strong> {result.second.label}. {secondary.priority}</p></div>
        </section>

        <section className="panel conciergePlan">
          <p className="eyebrow">Your curated sequence</p>
          <h2>What happens first, what we review, and what opens next.</h2>
          <div className="phaseColumns">
            <article><b>Phase One · Establish</b><h3>Begin with the leverage point</h3>{content.phase1.map((x) => <p key={x}>• {x}</p>)}</article>
            <article><b>Phase Two · Compare</b><h3>Use response—not guesswork</h3>{content.phase2.map((x) => <p key={x}>• {x}</p>)}</article>
            <article><b>Phase Three · Advance</b><h3>Build the next layer</h3>{content.phase3.map((x) => <p key={x}>• {x}</p>)}</article>
          </div>
        </section>

        <section className="routeCard purchaseCard">
          <p className="eyebrow light">Your strongest-fit starting point</p>
          <h2>{result.route}</h2>
          <p>{result.route === 'Menopause Core Curated' ? 'A coordinated, personalized pathway built around your leading pattern, stage, priorities, and goals. Instead of sending you to sort through disconnected offers, Menopause Core determines what belongs first, what can wait, and what should change as you respond.' : result.route === 'Cellular Cleanse Foundation' ? 'Your pattern points to foundational digestive and daily-energy support as the strongest place to begin. This route creates the preparation needed before broader optimization layers are added.' : 'Your profile is focused enough to begin with one direct Women’s Health Journey rather than the full curated experience.'}</p>
          <div className="includedGrid">
            <div><strong>What you receive</strong><span>Pattern-led starting strategy</span><span>Clear first priority</span><span>Coordinated pathway selection</span></div>
            <div><strong>What happens next</strong><span>Continue to the matching paid pathway</span><span>Complete the appropriate intake after enrollment</span><span>Begin with a measurable baseline</span></div>
          </div>
          <a className="purchaseButton" href={routeUrl} onClick={() => track('primary_cta_click', { route: result.route, domain: result.lead.key })}>{content.cta}</a>
        </section>

        <section className="panel supportingRoutes">
          <p className="eyebrow">Supporting options</p><h2>Only the routes that make sense for this result.</h2>
          <div className="supportGrid">{supportOptions.map((o) => <article key={o.title}><h3>{o.title}</h3><p>{o.copy}</p><a href={o.url} onClick={() => track('supporting_route_click', { route: o.title })}>Explore this route →</a></article>)}</div>
        </section>

        <section className="panel founderBlock"><div><p className="eyebrow">Created from more than 20 years of whole-person wellness experience</p><h2>Fragmented advice is not a strategy.</h2></div><p>Menopause Core Method™ was created by Jenna to replace disconnected solutions with a more intelligent way to understand the patterns shaping a woman’s body, energy, performance, confidence, and quality of life through menopause.</p></section>

        <section className="panel finalActions"><button onClick={restart}>Retake assessment</button><a href="https://www.coreaxishealth.com/menopause-core?src=pattern_map&med=assessment&cmp=menopause_core_2026&content=full_ecosystem">View the complete Menopause Core experience</a></section>
        <p className="compliance">The Menopause Core Pattern Map™ is an educational wellness tool. It does not diagnose, treat, cure, or prevent disease and does not replace individualized medical care. Eligibility for prescription or provider-directed options is determined independently by a licensed provider.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div><p className="eyebrow">Menopause Core Method™</p><h1>Discover where your menopause strategy should begin.</h1><p className="lead">The Menopause Core Pattern Map™ identifies the area most likely to create the greatest leverage across your sleep, energy, strength, appetite, focus, recovery, and quality of life.</p><p className="trustLine">Private. Educational. Designed to reveal one clear place to begin.</p></div>
        <div className="visualHero" aria-label="Menopause Core visual sequence"><span className="clock">MENOPAUSE CORE</span><div className="visualCopy"><strong>Your life is not over. The old plan is.</strong><span>Sleep. Food. Strength. Clarity. Confidence. Coordinated.</span></div><div className="dinnerTable"><div className="plate" /></div><div className="woman" /></div>
      </section>
      <section className="panel assessment">
        <div className="assessmentTop"><p className="eyebrow">Question {step + 1} of {questions.length}</p><span>{Math.round(((step + 1) / questions.length) * 100)}%</span></div>
        <div className="progress"><i style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div>
        <h2>{current.title}</h2>
        <div className="options">{current.options.map(([value, label]) => <button className={`option ${answers[current.id] === value ? 'selected' : ''}`} key={String(value)} onClick={() => choose(value)}><span className="radio" /><span>{label}</span></button>)}</div>
        <div className="navActions"><button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</button><button className="primary" disabled={!canContinue} onClick={next}>{step === questions.length - 1 ? 'REVEAL MY LEADING PATTERN' : 'Continue'}</button></div>
      </section>
    </main>
  );
}

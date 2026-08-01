import React, { useMemo, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const domains = [
  { key: 'restoration', label: 'Restoration & temperature' },
  { key: 'metabolic', label: 'Metabolic response' },
  { key: 'strength', label: 'Strength & recovery' },
  { key: 'clarity', label: 'Clarity & emotional steadiness' },
  { key: 'connection', label: 'Radiance, libido & comfort' },
  { key: 'digestive', label: 'Digestive & foundational response' }
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
  ...domains.map((d) => ({
    id: d.key,
    title: {
      restoration: 'How much are sleep disruption, night warmth, hot flashes, or waking unrefreshed affecting you?',
      metabolic: 'How much are cravings, food noise, appetite shifts, energy after eating, or body-composition changes affecting you?',
      strength: 'How much are low stamina, reduced strength, joint or muscle discomfort, or slower recovery affecting you?',
      clarity: 'How much are brain fog, memory changes, irritability, anxiousness, overwhelm, or reduced focus affecting you?',
      connection: 'How much are libido, intimacy, dryness, comfort, confidence, skin, or hair changes affecting you?',
      digestive: 'How much are bloating, bowel changes, food sensitivity, or digestive discomfort affecting you?'
    }[d.key],
    options: [
      [0, 'Not affecting me'],
      [1, 'Occasional or mild'],
      [2, 'Frequent or noticeable'],
      [3, 'Significantly affecting my life']
    ]
  })),
  {
    id: 'impact',
    title: 'How much is the overall pattern interfering with your normal life?',
    options: [
      [0, 'I notice it, but it is not significantly interfering.'],
      [1, 'It affects me several days each week.'],
      [2, 'It affects me most days.'],
      [3, 'It significantly affects sleep, work, relationships, confidence, or daily functioning.']
    ]
  },
  {
    id: 'attempts',
    title: 'How many different approaches have you already tried?',
    options: [
      [0, 'I am just beginning.'],
      [1, 'One focused approach.'],
      [2, 'Two or three approaches.'],
      [3, 'Several approaches, but nothing has been coordinated.']
    ]
  },
  {
    id: 'goal',
    title: 'What would feel like the most meaningful change over the next 90 days?',
    options: [
      ['sleep', 'Sleep deeply and wake restored.'],
      ['body', 'Feel comfortable, capable, and confident in my body.'],
      ['energy', 'Have steadier energy, strength, and recovery.'],
      ['food', 'Reduce cravings or food noise and feel in control around food.'],
      ['clarity', 'Think clearly and feel emotionally steady.'],
      ['connection', 'Feel more connected to libido, radiance, and confidence.'],
      ['digestion', 'Improve digestion and feel less reactive or uncomfortable.'],
      ['whole', 'Understand the whole pattern and know what to do first.']
    ]
  },
  {
    id: 'safety',
    title: 'Before we show your result, do any of these apply?',
    options: [
      ['none', 'None of these apply.'],
      ['postpartum', 'I am pregnant, recently postpartum, or nursing.'],
      ['urgent', 'I have unexplained bleeding, severe pelvic pain, fainting, chest pain, sudden neurological symptoms, or another urgent concern.'],
      ['medical', 'I am currently being evaluated or treated for a significant medical condition.']
    ]
  }
];

const stageText = {
  early: 'an early-transition context while cycles remain generally regular',
  peri: 'a perimenopause transition context',
  post: 'a postmenopause transition context',
  modified: 'a context that requires full history because bleeding is altered by surgery, medication, contraception, or treatment',
  unclear: 'a transition stage that remains unclear from this rapid pulse'
};

function calculateResult(a) {
  const profile = domains.map((d) => ({ ...d, score: Number(a[d.key] ?? 0) })).sort((x, y) => y.score - x.score);
  const active = profile.filter((x) => x.score >= 2).length;
  const impact = Number(a.impact ?? 0);
  const attempts = Number(a.attempts ?? 0);
  const complexityPoints = active + (impact >= 2 ? 1 : 0) + (attempts >= 2 ? 1 : 0);
  const complexity = complexityPoints >= 5 ? 'Highly interconnected' : complexityPoints >= 3 ? 'Moderately interconnected' : 'Focused';

  let route = 'Focused Women’s Health Journey';
  if (a.safety === 'urgent') route = 'Immediate medical evaluation';
  else if (a.safety === 'postpartum' || a.safety === 'medical') route = 'Practitioner review before activation';
  else if (complexity === 'Highly interconnected' || (active >= 3 && impact >= 2) || a.goal === 'whole') route = 'Menopause Core Method™';
  else if (profile[0].key === 'digestive' && profile[0].score >= 2) route = 'Cellular Cleanse Foundation';

  return { profile, active, impact, attempts, complexity, route, lead: profile[0], second: profile[1], third: profile[2] };
}

export default function App() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [complete, setComplete] = useState(false);
  const result = useMemo(() => calculateResult(answers), [answers]);
  const current = questions[step];

  const choose = (value) => setAnswers((prev) => ({ ...prev, [current.id]: value }));
  const canContinue = Object.prototype.hasOwnProperty.call(answers, current.id);

  const next = () => {
    if (!canContinue) return;
    if (step === questions.length - 1) setComplete(true);
    else setStep((s) => s + 1);
  };

  const restart = () => {
    setAnswers({});
    setStep(0);
    setComplete(false);
  };

  if (complete) {
    const data = result.profile.map((x) => ({ subject: x.label.split(' ')[0], score: x.score, fullMark: 3 }));
    const goalCopy = {
      sleep: 'restorative sleep and steadier daily rhythm',
      body: 'greater confidence, capacity, and comfort in your body',
      energy: 'steadier energy, strength, and recovery',
      food: 'less food noise and more stable appetite signals',
      clarity: 'clearer thinking and greater emotional steadiness',
      connection: 'greater confidence, comfort, libido, and connection',
      digestion: 'better digestive comfort and lower reactivity',
      whole: 'a coordinated understanding of what should happen first'
    }[answers.goal];

    return (
      <main className="page">
        <section className="resultHero">
          <p className="eyebrow">Your Menopause Core Pattern Map</p>
          <h1>Your leading pattern is {result.lead.label}.</h1>
          <p>Your answers reflect {stageText[answers.stage]}. {result.lead.label} is carrying the greatest burden, with {result.second.label.toLowerCase()} as the strongest supporting influence. Your selected 90-day priority is {goalCopy}.</p>
          <div className="metrics">
            <article><span>Leading domain</span><strong>{result.lead.label}</strong></article>
            <article><span>Complexity</span><strong>{result.complexity}</strong></article>
            <article><span>Recommended start</span><strong>{result.route}</strong></article>
          </div>
        </section>

        <section className="panel chartGrid">
          <div className="chartBox">
            <ResponsiveContainer width="100%" height={360}>
              <RadarChart data={data}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <Radar dataKey="score" stroke="#8b6351" fill="#c78f86" fillOpacity={0.45} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="eyebrow">Six-domain profile</p>
            <h2>Your complete pattern—not one answer renamed.</h2>
            <div className="bars">
              {result.profile.map((x) => (
                <div className="barRow" key={x.key}>
                  <span>{x.label}</span>
                  <div className="barTrack"><i style={{ width: `${(x.score / 3) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel futureGrid">
          <article className="state now">
            <p className="eyebrow light">Where the burden is now</p>
            <h2>{result.lead.label}</h2>
            <p>{result.lead.label} and {result.second.label.toLowerCase()} are creating the strongest current pressure.</p>
          </article>
          <div className="arrow">→</div>
          <article className="state next">
            <p className="eyebrow light">Future direction</p>
            <h2>{goalCopy}</h2>
            <p>The first phase centers on {result.lead.label.toLowerCase()}, then coordinates {result.second.label.toLowerCase()} with measurable checkpoints.</p>
          </article>
        </section>

        <section className="panel">
          <p className="eyebrow">Priority sequence</p>
          <h2>What happens first, next, and then.</h2>
          <div className="sequence">
            {[result.lead, result.second, result.third].map((x, i) => (
              <article key={x.key}>
                <b>{['First', 'Next', 'Then'][i]}</b>
                <h3>{x.label}</h3>
                <p>{i === 0 ? 'Address the leading burden and establish the baseline.' : i === 1 ? 'Coordinate the strongest supporting influence.' : 'Advance this layer after earlier response is visible.'}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">30 / 60 / 90 accountability horizon</p>
          <div className="sequence">
            <article><b>First 30 days</b><h3>Establish the baseline</h3><p>Build the first sequence and identify early response signals.</p></article>
            <article><b>By 60 days</b><h3>Compare response</h3><p>Review sleep, appetite, energy, strength, recovery, and selected goals.</p></article>
            <article><b>By 90 days</b><h3>Refine the strategy</h3><p>Continue what works, change what does not, and advance the next layer.</p></article>
          </div>
        </section>

        <section className="routeCard">
          <p className="eyebrow light">Your recommended starting point</p>
          <h2>{result.route}</h2>
          <p>{result.route === 'Menopause Core Method™' ? 'Several domains are active or significantly affecting daily life. A coordinated plan is a stronger fit than assembling unrelated options.' : result.route === 'Cellular Cleanse Foundation' ? 'Digestive or foundational response is leading, making foundational preparation the strongest first phase.' : result.route === 'Focused Women’s Health Journey' ? 'One domain is clearly leading and the overall profile is focused, making a direct targeted pathway appropriate.' : result.route === 'Immediate medical evaluation' ? 'Your response indicates a concern that should be evaluated promptly before a wellness pathway is activated.' : 'Your responses indicate that review should occur before a personalized pathway is activated.'}</p>
          <div className="routeActions">
            <a href="https://www.coreaxishealth.com/menopause-core">Continue to Menopause Core</a>
            <button onClick={restart}>Retake assessment</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Menopause Core Method™</p>
          <h1>See the pattern. Know where to begin.</h1>
          <p className="lead">Complete the multidomain Pattern Map and receive a visual profile, priority sequence, accountability horizon, and one curated starting recommendation.</p>
        </div>
        <div className="visualHero" aria-label="Menopause Core visual sequence">
          <span className="clock">3:00 A.M.</span>
          <div className="visualCopy"><strong>Your life is not over. The old plan is.</strong><span>Sleep. Food. Strength. Clarity. Confidence. Coordinated.</span></div>
          <div className="dinnerTable"><div className="plate" /></div>
          <div className="woman" />
        </div>
      </section>

      <section className="panel assessment">
        <div className="assessmentTop"><p className="eyebrow">Question {step + 1} of {questions.length}</p><span>{Math.round(((step + 1) / questions.length) * 100)}%</span></div>
        <div className="progress"><i style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div>
        <h2>{current.title}</h2>
        <div className="options">
          {current.options.map(([value, label]) => (
            <button className={`option ${answers[current.id] === value ? 'selected' : ''}`} key={String(value)} onClick={() => choose(value)}>
              <span className="radio" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="navActions">
          <button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</button>
          <button className="primary" disabled={!canContinue} onClick={next}>{step === questions.length - 1 ? 'Show my Pattern Map' : 'Continue'}</button>
        </div>
      </section>
    </main>
  );
}

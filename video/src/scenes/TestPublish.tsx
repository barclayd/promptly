import { IconBolt, IconCheck, IconClock, IconLoader2, IconPlayerPlayFilled, IconRocket, IconSparkles } from '@tabler/icons-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Cursor } from '../components/Cursor';
import { Feature } from '../components/Feature';
import { Burst, Confetti, Float, Shockwave, Sparkles } from '../components/Fx';
import { Eyebrow, Kinetic } from '../components/Kinetic';
import { Badge, Btn, INPUT_ROWS, JsonTree, Panel, pressAt, Shimmer, StreamText } from '../components/ui';
import { ease, kf, pop, pulse, springs, tw } from '../lib/motion';
import { mono, stage, useTokens } from '../lib/theme';

export const RESPONSE = `# Aurora Smart Desk Lamp
Your workspace, lit the way you actually need it.

Aurora reads the natural light in your room and adjusts its brightness automatically throughout the day — so your eyes stay comfortable whether it's 7 a.m. or midnight. No fussing with settings during a deadline.

The base doubles as a wireless charger, keeping your phone ready without another cable cluttering your desk.

The LED is rated for 40,000 hours. Buy it once, use it for years.

**Key Features**
- Adaptive brightness that follows daylight
- Wireless charging base
- 40,000-hour LED lifespan`;

/** Top-left title used by the wide shots. */
export const TopTitle = ({ n, label, text, accent, grad, at = 2, out }: { n: string; label: string; text: string; accent: string[]; grad: [string, string]; at?: number; out?: number }) => (
  <div style={{ position: 'absolute', left: 150, top: 80, display: 'flex', flexDirection: 'column', gap: 18 }}>
    <Eyebrow n={n} label={label} start={at - 1} out={out} />
    <Kinetic text={text} start={at} size={80} variant="rise" align="left" accent={accent} gradient={grad} stagger={0.7} out={out} outStagger={0.2} />
  </div>
);

export const TestShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const run = 14;
  const streamAt = 30;
  const done = 104;
  const pp = pop(f, 0, springs.bouncy);
  const running = f >= run && f < streamAt;
  const progress = tw(f, run, done, 0, 1, ease.inOutCubic);
  return (
    <AbsoluteFill>
      <TopTitle n="05" label="TEST" text="See real output instantly." accent={['real', 'output']} grad={['#DDD6FE', '#8B5CF6']} />
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 245,
          transform: `translateY(${(1 - pp) * 200}px) scale(${0.9 + 0.1 * pp})`,
          opacity: tw(f, 0, 6),
        }}
      >
        <Float rx={4} ry={-3} drift={0.5}>
          <div style={{ position: 'relative' }}>
            <Panel w={1620} h={715} glow={stage.violet} style={{ display: 'flex' }}>
              <div style={{ width: 470, borderRight: `1px solid ${t.border}`, padding: 30, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ fontSize: 26, fontWeight: 700 }}>Test</div>
                <div style={{ display: 'flex', gap: 10, fontSize: 17, color: t.muted }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 9, border: `1px solid ${t.border}` }}>
                    <IconSparkles size={17} color="#D97757" /> Claude Sonnet 4.6
                  </span>
                  <span style={{ padding: '6px 12px', borderRadius: 9, border: `1px solid ${t.border}` }}>0.70</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.subtle, letterSpacing: '0.1em', marginTop: 8 }}>INPUT DATA</div>
                <div style={{ border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 18px', background: t.input }}>
                  <JsonTree rows={INPUT_ROWS} size={19} reveal={tw(f, 2, 12, 0, 1, ease.linear)} />
                </div>
                <div style={{ flex: 1 }} />
                <Btn size={24} press={pressAt(f, run)} style={{ width: '100%', boxSizing: 'border-box' }}>
                  {running ? <IconLoader2 size={24} style={{ transform: `rotate(${f * 18}deg)` }} /> : <IconPlayerPlayFilled size={22} />}
                  {running ? 'Running…' : 'Run test'}
                </Btn>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '22px 32px', borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 24, fontWeight: 700, flex: 1 }}>Response</span>
                  {f >= done
                    ? [
                        [<IconClock key="c" size={18} />, '2.4s'],
                        [<IconBolt key="b" size={18} />, '412 tokens'],
                      ].map(([icon, label], i) => {
                        const p = pop(f, done + i * 4, springs.bouncy);
                        return (
                          <span
                            key={i}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 17,
                              color: t.muted,
                              padding: '6px 12px',
                              borderRadius: 999,
                              border: `1px solid ${t.border}`,
                              transform: `scale(${p})`,
                            }}
                          >
                            {icon}
                            {label}
                          </span>
                        );
                      })
                    : null}
                  {f >= done ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 17,
                        fontWeight: 600,
                        color: '#10B981',
                        transform: `scale(${pop(f, done + 8, springs.bouncy)})`,
                      }}
                    >
                      <IconCheck size={18} stroke={3} /> Completed
                    </span>
                  ) : null}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      bottom: -1,
                      height: 3,
                      width: `${progress * 100}%`,
                      background: `linear-gradient(90deg, ${stage.indigo}, ${stage.pink})`,
                      boxShadow: `0 0 16px ${stage.violet}`,
                      opacity: f < done + 6 ? 1 : 0,
                    }}
                  />
                </div>
                <div style={{ padding: '26px 36px', flex: 1, overflow: 'hidden' }}>
                  {running ? <Shimmer size={24}>Generating response…</Shimmer> : null}
                  {f >= streamAt ? <StreamText text={RESPONSE} start={streamAt} cps={280} size={21} lineHeight={1.5} /> : null}
                </div>
              </div>
            </Panel>
            <Cursor path={[{ f: 0, x: 420, y: 820 }, { f: 11, x: 260, y: 694 }]} clicks={[run]} show={[0, 30]} />
            <Burst x={250} y={694} at={run} count={20} speed={14} life={20} seed="run" />
            <Sparkles at={done + 6} items={[{ x: 1500, y: 40 }, { x: 1590, y: 90, s: 0.7 }, { x: 1440, y: 110, s: 0.5 }]} />
          </div>
        </Float>
      </div>
    </AbsoluteFill>
  );
};

/** Odometer digit that rolls from one value to another. */
const Reel = ({ from, to, at, size = 56 }: { from: number; to: number; at: number; size?: number }) => {
  const f = useCurrentFrame();
  const t = useTokens();
  const pos = from + (to - from) * tw(f, at, at + 14, 0, 1, ease.outBack);
  const land = pulse(f, at + 10, 5);
  return (
    <div
      style={{
        width: size * 1.25,
        height: size * 1.5,
        borderRadius: 14,
        border: `1px solid ${land > 0.1 ? stage.indigo : t.border}`,
        background: t.input,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: `0 0 ${30 * land}px rgba(99,102,241,${0.6 * land})`,
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: -pos * size * 1.5 }}>
        {Array.from({ length: 11 }, (_, d) => (
          <div
            key={d}
            style={{ height: size * 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: size, fontWeight: 700 }}
          >
            {d % 10}
          </div>
        ))}
      </div>
    </div>
  );
};

export const PublishShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const click = 30;
  const stamp = pop(f, click + 3, springs.bouncy);
  return (
    <Feature n="06" label="PUBLISH" title={'Ship versions,\nnot deploys.'} accent={['versions']} grad={['#A7F3D0', '#10B981']} sub={'Live over the API the\nsecond you hit publish.'}>
      <div style={{ position: 'relative' }}>
        <Panel w={740} glow={stage.green}>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em' }}>Publish version</div>
            <div style={{ fontSize: 20, color: t.muted, lineHeight: 1.5 }}>
              Publishing makes this version available for production use and accessible via the PromptlyCMS API.
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>Version</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <Reel from={1} to={2} at={6} />
              <span style={{ fontSize: 50, fontWeight: 800, color: t.subtle }}>.</span>
              <Reel from={1} to={0} at={9} />
              <span style={{ fontSize: 50, fontWeight: 800, color: t.subtle }}>.</span>
              <Reel from={0} to={10} at={12} />
            </div>
            <div style={{ fontSize: 18, color: '#F59E0B', opacity: tw(f, 18, 24), transform: `translateY(${(1 - tw(f, 18, 26)) * 10}px)` }}>
              Major version bump - schema fields changed
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14 }}>
              <Btn variant="outline" size={22}>
                Cancel
              </Btn>
              <Btn size={22} press={pressAt(f, click)}>
                <IconRocket size={22} /> Publish
              </Btn>
            </div>
          </div>
          {/* Success state wipes up over the dialog */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: t.card,
              clipPath: `circle(${tw(f, click + 1, click + 14, 0, 140, ease.outQuint)}% at 86% 88%)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 22,
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 999,
                background: 'rgba(16,185,129,0.15)',
                border: '2px solid rgba(16,185,129,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${stamp}) rotate(${(1 - stamp) * -60}deg)`,
                boxShadow: `0 0 ${60 * pulse(f, click + 4, 10)}px rgba(16,185,129,0.8)`,
              }}
            >
              <IconCheck size={70} color="#10B981" stroke={3} />
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', transform: `scale(${pop(f, click + 6, springs.bouncy)})` }}>
              v2.0.0 is live
            </div>
            <div style={{ display: 'flex', gap: 10, opacity: tw(f, click + 10, click + 16) }}>
              <Badge kind="published" size={18} />
              <Badge kind="live" size={18} />
            </div>
          </div>
        </Panel>
        <Shockwave x={370} y={260} at={click + 3} size={1100} color="rgba(52,211,153,0.8)" />
        <Confetti x={370} y={300} at={click + 3} count={70} seed="pub" spread={1.2} />
        <Cursor path={[{ f: 10, x: 820, y: 620 }, { f: 26, x: 640, y: 530 }]} clicks={[click]} show={[8, 40]} />
      </div>
    </Feature>
  );
};

type Col = { v: string; badges: ('draft' | 'live' | 'baseline' | 'published')[]; lead: string; body: string; hi: string[] };
const COLS: Col[] = [
  {
    v: 'Latest',
    badges: ['draft'],
    lead: 'Your desk, lit the way your day actually moves.',
    body: 'Aurora reads the light in your room and adjusts its brightness to match — softer in the morning, sharper when you need to focus, easier on your eyes by evening. No manual tweaking.',
    hi: ['your day actually moves.', 'softer in the morning, sharper when you need to focus,', 'No manual tweaking.'],
  },
  {
    v: 'v1.1.0',
    badges: ['live', 'baseline'],
    lead: 'Your desk, lit the way you actually need it.',
    body: "Aurora reads the room. Its adaptive brightness shifts with natural daylight, so your eyes stay comfortable whether you're on a 7 a.m. call or grinding through an evening deadline.",
    hi: [],
  },
  {
    v: 'v1.0.0',
    badges: ['published'],
    lead: 'Light That Works as Hard as You Do',
    body: 'Your workspace deserves more than a lamp. It deserves intelligence. Introducing the Aurora Smart Desk Lamp — the premium lighting companion engineered for the way modern professionals work.',
    hi: ['Light That Works as Hard as You Do', 'It deserves intelligence.', 'the premium lighting companion engineered'],
  },
];

const Highlighted = ({ text, hi, at }: { text: string; hi: string[]; at: number }) => {
  const f = useCurrentFrame();
  const parts: { s: string; h: boolean }[] = [];
  let rest = text;
  for (const h of hi) {
    const i = rest.indexOf(h);
    if (i < 0) continue;
    parts.push({ s: rest.slice(0, i), h: false }, { s: h, h: true });
    rest = rest.slice(i + h.length);
  }
  parts.push({ s: rest, h: false });
  let k = 0;
  return (
    <>
      {parts.map((p, i) => {
        if (!p.h) return <span key={i}>{p.s}</span>;
        const w = tw(f, at + k * 5, at + k * 5 + 10, 0, 100, ease.outQuint);
        k++;
        return (
          <span
            key={i}
            style={{
              backgroundImage: 'linear-gradient(rgba(250,204,21,0.32), rgba(250,204,21,0.32))',
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${w}% 100%`,
              borderRadius: 4,
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
              color: w > 50 ? '#FDE68A' : undefined,
            }}
          >
            {p.s}
          </span>
        );
      })}
    </>
  );
};

export const CompareShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  return (
    <AbsoluteFill>
      <TopTitle n="07" label="COMPARE" text="Diff every version." accent={['every', 'version']} grad={['#FEF08A', '#EAB308']} />
      <div style={{ position: 'absolute', left: 150, top: 245, display: 'flex', gap: 24 }}>
        {COLS.map((c, i) => {
          const p = pop(f, i * 3, springs.bouncy);
          return (
            <div key={c.v} style={{ transform: `translateY(${(1 - p) * 240}px) rotateX(${(1 - p) * 30}deg)`, opacity: tw(f, i * 3, i * 3 + 6) }}>
              <Panel w={524} h={700} glow={i === 1 ? stage.green : stage.orange}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 26px', borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 24, fontWeight: 700, marginRight: 4 }}>{c.v}</span>
                  {c.badges.map((b) => (
                    <Badge key={b} kind={b} size={15} />
                  ))}
                </div>
                <div style={{ padding: '24px 28px', fontSize: 21, lineHeight: 1.6, color: t.muted }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: '-0.01em', marginBottom: 14, lineHeight: 1.25 }}>
                    Aurora Smart Desk Lamp
                  </div>
                  <div style={{ color: t.text, fontWeight: 600, marginBottom: 14 }}>
                    <Highlighted text={c.lead} hi={c.hi} at={12 + i * 4} />
                  </div>
                  <Highlighted text={c.body} hi={c.hi} at={16 + i * 4} />
                  {i === 1 ? (
                    <div style={{ marginTop: 22, fontSize: 15, fontFamily: mono, color: '#10B981', letterSpacing: '0.1em' }}>REFERENCE</div>
                  ) : null}
                </div>
              </Panel>
            </div>
          );
        })}
      </div>
      {/* Scanning line that sweeps the columns as the diff resolves */}
      <div
        style={{
          position: 'absolute',
          top: 245,
          height: 700,
          width: 3,
          left: kf(f, [10, 40], [150, 1770], ease.inOutCubic),
          background: 'linear-gradient(180deg, transparent, #FDE047, transparent)',
          boxShadow: '0 0 30px #FACC15',
          opacity: kf(f, [8, 12, 36, 42], [0, 1, 1, 0]),
        }}
      />
    </AbsoluteFill>
  );
};

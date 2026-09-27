import { IconFileText, IconPuzzle, IconSparkles, IconStack2 } from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Burst, Shockwave } from '../components/Fx';
import { Eyebrow, Kinetic } from '../components/Kinetic';
import { Badge, Panel, RefChip, Var, VarChip } from '../components/ui';
import { ease, kf, lerp, pop, pulse, springs, tw, typed } from '../lib/motion';
import { mono, sans, stage, useTokens } from '../lib/theme';

// Local frames: 0 = 10s. Phases land on the 2-second accents in the track.
const P1 = 0;
const P2 = 60;
const P3 = 120;
const P4 = 180;
const P5 = 240;

const GREEN = { fg: '#34D399', bg: 'rgba(16,185,129,0.14)', bd: 'rgba(16,185,129,0.45)' };

export const SnipChip = ({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: size * 0.35,
      padding: `${size * 0.2}px ${size * 0.55}px`,
      borderRadius: size * 0.45,
      background: GREEN.bg,
      border: `1px solid ${GREEN.bd}`,
      color: GREEN.fg,
      fontSize: size,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <IconPuzzle size={size * 0.95} stroke={2} />
    {name}
  </span>
);

const Head = ({ icon, color, kind, title, right }: { icon: ReactNode; color: string; kind: string; title: string; right?: ReactNode }) => {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '22px 28px',
        borderBottom: `1px solid ${t.border}`,
        background: t.cardHead,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: `${color}22`,
          border: `1px solid ${color}66`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, letterSpacing: '0.2em', fontWeight: 700, color }}>{kind}</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>
      </div>
      {right}
    </div>
  );
};

const SNIPPET_TEXT =
  'Write like Acme: warm, confident and plain-spoken. Use short sentences, active verbs and concrete detail. Avoid jargon, hype and exclamation marks.';

const SnippetCard = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  return (
    <Panel w={600} glow={stage.green}>
      <Head icon={<IconPuzzle size={30} />} color="#10B981" kind="SNIPPET" title="Brand Voice" right={<Badge kind="published" size={16} />} />
      <div style={{ padding: 28, fontSize: 23, lineHeight: 1.55, color: t.muted, minHeight: 190 }}>
        {typed(SNIPPET_TEXT, f, 8, 130)}
      </div>
    </Panel>
  );
};

const PromptCard = ({ chipAt }: { chipAt: number }) => {
  const f = useCurrentFrame();
  const t = useTokens();
  const c1 = pop(f, chipAt, springs.bouncy);
  const c2 = pop(f, chipAt + 6, springs.bouncy);
  return (
    <Panel w={780} glow={stage.blue}>
      <Head icon={<IconFileText size={30} />} color="#3B82F6" kind="PROMPT" title="Product Description Writer" right={<Badge kind="published" size={16} />} />
      <div style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, height: 40 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.12em', color: t.subtle, marginRight: 6 }}>SYSTEM PROMPT</span>
          <SnipChip name="Brand Voice" style={{ transform: `scale(${c1})`, opacity: Math.min(1, c1 * 2) }} />
          <SnipChip name="Safety Guardrails" style={{ transform: `scale(${c2})`, opacity: Math.min(1, c2 * 2) }} />
        </div>
        <div
          style={{
            background: t.input,
            border: `1px solid ${t.border}`,
            borderRadius: 14,
            padding: '20px 22px',
            fontFamily: mono,
            fontSize: 22,
            lineHeight: 1.65,
          }}
        >
          Write a product description for <Var name="product_name" at={P2 + 16} />, aimed at <Var name="audience" at={P2 + 22} />. Keep the tone{' '}
          <Var name="tone" at={P2 + 28} />.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 18, fontSize: 18, color: t.muted }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}` }}>
            <IconSparkles size={18} color="#D97757" /> Claude Sonnet 4.6
          </span>
          <span style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}` }}>Temperature 0.7</span>
        </div>
      </div>
    </Panel>
  );
};

const ComposerCard = ({ refAt }: { refAt: number }) => {
  const f = useCurrentFrame();
  const t = useTokens();
  const refs = ['Product Description Writer', 'Launch Email Writer', 'Social Post Generator'];
  const heads = ['Product page', 'Launch email', 'Social posts'];
  return (
    <Panel w={860} glow={stage.violet}>
      <Head icon={<IconStack2 size={30} />} color="#8B5CF6" kind="COMPOSER" title="Product Launch Kit" right={<Badge kind="draft" size={16} />} />
      <div style={{ padding: '26px 32px 30px' }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
          Launch kit: <VarChip name="product_name" size={24} />
        </div>
        <div style={{ fontSize: 20, color: t.muted, margin: '10px 0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          Everything the team needs for launch day on <VarChip name="launch_date" size={17} />
        </div>
        {refs.map((r, i) => {
          const p = pop(f, refAt + i * 7, springs.bouncy);
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{heads[i]}</span>
              <RefChip name={r} size={19} style={{ transform: `scale(${p})`, opacity: Math.min(1, p * 2) }} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

const PHASES: {
  at: number;
  end: number;
  n?: string;
  label?: string;
  title: string;
  accent: string[];
  grad: [string, string];
  sub?: string;
  size?: number;
}[] = [
  { at: P1, end: P2, n: '01', label: 'SNIPPETS', title: 'Snippets', accent: ['Snippets'], grad: ['#A7F3D0', '#10B981'], sub: 'Reusable blocks of text.\nWrite your brand voice once.' },
  { at: P2, end: P3, n: '02', label: 'PROMPTS', title: 'Prompts', accent: ['Prompts'], grad: ['#BFDBFE', '#3B82F6'], sub: 'Versioned instructions\nwith typed variables.' },
  { at: P3, end: P4, n: '03', label: 'COMPOSERS', title: 'Composers', accent: ['Composers'], grad: ['#DDD6FE', '#8B5CF6'], sub: 'Many prompts, stitched\ninto one document.' },
  { at: P4, end: P5, title: 'Build once.', accent: ['once'], grad: ['#FDE68A', '#F59E0B'], sub: 'Snippets live in prompts.\nPrompts live in composers.', size: 150 },
];

const LeftCopy = () => {
  const f = useCurrentFrame();
  return (
    <>
      {PHASES.map((p) =>
        f >= p.at - 1 && f < p.end ? (
          <div
            key={p.title}
            style={{ position: 'absolute', left: 150, top: 540, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 26 }}
          >
            {p.label ? <Eyebrow n={p.n} label={p.label} start={p.at + 1} out={p.end - 8} /> : null}
            <Kinetic
              text={p.title}
              start={p.at + 2}
              size={p.size ?? 120}
              variant="rise"
              align="left"
              accent={p.accent}
              gradient={p.grad}
              out={p.end - 9}
              stagger={1.2}
            />
            {p.sub ? (
              <Kinetic
                text={p.sub}
                start={p.at + 9}
                size={36}
                weight={500}
                variant="blur"
                align="left"
                color={stage.dim}
                stagger={0.35}
                outStagger={0.15}
                out={p.end - 10}
                tracking={-0.01}
                lineHeight={1.35}
              />
            ) : null}
          </div>
        ) : null,
      )}
    </>
  );
};

/** Card that pops in, then collapses toward a dock point inside the next card. */
const card = (f: number, inAt: number, dockAt: number, dock: [number, number]): CSSProperties => {
  const p = pop(f, inAt, springs.bouncy);
  const d = tw(f, dockAt, dockAt + 9, 0, 1, ease.inExpo);
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    transform: `translate(-50%, -50%) translate(${dock[0] * d}px, ${dock[1] * d}px) scale(${(0.7 + 0.3 * p) * (1 - 0.88 * d)}) rotateX(${(1 - p) * 25}deg)`,
    opacity: Math.min(1, p * 2) * (1 - tw(f, dockAt + 6, dockAt + 9)),
  };
};

const Stack = () => {
  const f = useCurrentFrame();
  const iso = tw(f, P4, P4 + 18, 0, 1, ease.inOutExpo);
  const t = f / 30;
  const exit = tw(f, P5 - 4, P5 + 6, 0, 1, ease.inExpo);
  const zP = 160 * pop(f, P4 + 6, springs.heavy);
  const zS = 320 * pop(f, P4 + 12, springs.heavy);
  const inP = tw(f, P4 + 6, P4 + 16);
  const inS = tw(f, P4 + 12, P4 + 22);
  const cx = lerp(1290, 1250, iso);
  return (
    <div
      style={{
        position: 'absolute',
        left: cx,
        top: lerp(540, 610, iso) - exit * 1100,
        opacity: 1 - exit,
        transformStyle: 'preserve-3d',
        transform: `perspective(2600px) rotateX(${lerp(6 + Math.sin(t * 0.8) * 1.5, 54, iso)}deg) rotateY(${lerp(-12 + Math.cos(t * 0.6) * 2, 0, iso)}deg) rotateZ(${-34 * iso}deg) scale(${lerp(1, 0.7, iso) * (1 - exit * 0.3)})`,
      }}
    >
      {f < P4 + 60 ? (
        <div style={{ ...card(f, P3 - 4, 9999, [0, 0]), transformStyle: 'preserve-3d' }}>
          <ComposerCard refAt={P3 + 3} />
        </div>
      ) : null}
      {f < P3 + 12 ? (
        <div style={card(f, P2 - 6, P3 - 8, [-250, 60])}>
          <PromptCard chipAt={P2 + 3} />
        </div>
      ) : null}
      {f < P2 + 12 ? (
        <div style={card(f, P1 + 2, P2 - 8, [-110, -60])}>
          <SnippetCard />
        </div>
      ) : null}
      {/* Exploded view: the layers return as planes stacked above the composer */}
      {f >= P4 + 6 ? (
        <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translateZ(${zP + (1 - inP) * 600}px)`, opacity: inP }}>
          <PromptCard chipAt={-999} />
        </div>
      ) : null}
      {f >= P4 + 12 ? (
        <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translateZ(${zS + (1 - inS) * 600}px)`, opacity: inS }}>
          <SnippetCard />
        </div>
      ) : null}
    </div>
  );
};

const PROMPT_NAMES = [
  'Support Reply',
  'Launch Email Writer',
  'Social Post Generator',
  'SEO Meta Writer',
  'Onboarding Email',
  'FAQ Answerer',
  'Release Notes',
  'Ad Copy Variants',
  'Review Summariser',
  'Blog Outline',
  'Push Notification',
  'Sales Follow-up',
  'Chatbot Greeting',
  'Product Description Writer',
];

const CW = 320;
const CH = 140;
const GAP = 28;
const GX = (1920 - (CW * 5 + GAP * 4)) / 2;
const GY = 390;
const SRC = { x: GX + 2 * (CW + GAP) + CW / 2, y: GY + (CH + GAP) + CH / 2 };

const Reuse = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  if (f < P5 - 2) return null;
  const cells = Array.from({ length: 15 }, (_, i) => i).filter((i) => i !== 7);
  const withPos = cells.map((c, i) => {
    const col = c % 5;
    const row = Math.floor(c / 5);
    const x = GX + col * (CW + GAP);
    const y = GY + row * (CH + GAP);
    return { name: PROMPT_NAMES[i], x, y, dist: Math.hypot(x + CW / 2 - SRC.x, y + CH / 2 - SRC.y) };
  });
  const order = [...withPos].sort((a, b) => a.dist - b.dist).map((c) => c.name);
  const src = pop(f, P5 + 4, springs.bouncy);
  return (
    <AbsoluteFill>
      {withPos.map((c, i) => {
        const rank = order.indexOf(c.name);
        const st = P5 + 8 + rank * 1.4;
        const land = st + 11;
        const cp = pop(f, land, springs.bouncy);
        const glow = pulse(f, land, 8);
        const e = pop(f, P5 + i * 0.8, springs.snappy);
        return (
          <div
            key={c.name}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y,
              width: CW,
              height: CH,
              borderRadius: 16,
              background: t.card,
              border: `1px solid ${glow > 0.05 ? `rgba(52,211,153,${0.3 + glow * 0.7})` : t.border}`,
              boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 ${40 * glow}px rgba(16,185,129,${0.5 * glow})`,
              padding: '18px 20px',
              fontFamily: sans,
              color: t.text,
              transform: `translateY(${(1 - e) * 60}px) scale(${(0.9 + e * 0.1) * (1 + glow * 0.04)})`,
              opacity: Math.min(1, e * 1.5),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, fontWeight: 700, whiteSpace: 'nowrap' }}>
              <IconFileText size={20} color={t.ref} /> {c.name}
            </div>
            <div style={{ height: 8, width: '80%', borderRadius: 4, background: t.hover, margin: '12px 0 8px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 8, width: 70, borderRadius: 4, background: t.hover }} />
              <SnipChip name="Brand Voice" size={14} style={{ transform: `scale(${cp})`, opacity: f >= land ? 1 : 0 }} />
            </div>
          </div>
        );
      })}
      {/* Flying copies of the snippet */}
      {withPos.map((c) => {
        const rank = order.indexOf(c.name);
        const st = P5 + 8 + rank * 1.4;
        const p = tw(f, st, st + 11, 0, 1, ease.inOutCubic);
        if (p <= 0 || p >= 1) return null;
        const tx = c.x + 20 + 78 + 60;
        const ty = c.y + CH - 32;
        const x = lerp(SRC.x, tx, p);
        const y = lerp(SRC.y, ty, p) - Math.sin(p * Math.PI) * 90;
        return (
          <div key={c.name} style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${1.3 - p * 0.5}) rotate(${Math.sin(p * Math.PI) * 12}deg)` }}>
            <SnipChip name="Brand Voice" size={14} style={{ boxShadow: '0 0 24px rgba(16,185,129,0.8)' }} />
          </div>
        );
      })}
      {withPos.map((c) => {
        const rank = order.indexOf(c.name);
        return <Burst key={c.name} x={c.x + 158} y={c.y + CH - 32} at={P5 + 19 + rank * 1.4} count={10} speed={9} life={16} size={3} colors={['#34D399', '#A7F3D0', '#fff']} seed={c.name} />;
      })}
      <div
        style={{
          position: 'absolute',
          left: SRC.x,
          top: SRC.y,
          transform: `translate(-50%, -50%) scale(${src * (1 + pulse(f, P5 + 8, 6) * 0.15)})`,
        }}
      >
        <SnipChip name="Brand Voice" size={30} style={{ boxShadow: `0 0 ${50 + 40 * pulse(f, P5 + 8, 10)}px rgba(16,185,129,0.7)`, padding: '10px 22px' }} />
      </div>
      <Shockwave x={SRC.x} y={SRC.y} at={P5 + 8} size={900} color="rgba(52,211,153,0.8)" />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 110, display: 'flex', justifyContent: 'center' }}>
        <Kinetic text="Reuse everywhere." start={P5 + 2} size={140} variant="rise" accent={['everywhere']} gradient={['#A7F3D0', '#10B981']} stagger={1} />
      </div>
    </AbsoluteFill>
  );
};

export const Explainer = () => {
  const f = useCurrentFrame();
  // Small camera kick on each phase accent.
  const kick = [P2, P3, P4, P5].reduce((m, a) => m + pulse(f, a, 5), 0);
  return (
    <AbsoluteFill style={{ fontFamily: sans, transform: `scale(${1 + kick * 0.012})` }}>
      <LeftCopy />
      <Stack />
      <Burst x={1120} y={480} at={P2 + 3} count={16} speed={12} life={20} colors={['#34D399', '#fff']} seed="dock1" />
      <Burst x={1300} y={590} at={P3 + 3} count={16} speed={12} life={20} colors={['#60A5FA', '#fff']} seed="dock2" />
      <Reuse />
      {/* Beat-synced dim of the grid while the title lands */}
      <AbsoluteFill style={{ background: stage.bg, opacity: kf(f, [P5 - 4, P5, P5 + 4], [0, 0.4, 0]), pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

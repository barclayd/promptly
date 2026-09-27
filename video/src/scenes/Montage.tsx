import { IconAbc, IconBraces, IconCheck, IconChevronDown, IconGripVertical, IconList, IconListDetails, IconPlus } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useCurrentFrame } from 'remotion';
import { Cursor } from '../components/Cursor';
import { Feature, Field } from '../components/Feature';
import { Burst } from '../components/Fx';
import { Btn, Caret, Panel, pressAt, stag, Var } from '../components/ui';
import { ease, kf, pop, pulse, springs, tw, typed } from '../lib/motion';
import { mono, stage, useTokens } from '../lib/theme';

// Each shot is 60 frames (2s) with local 0 on the downbeat.

export const CreateShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const name = typed('Product Description Writer', f, 8, 50);
  const desc = typed('Turns raw product specs into on-brand, SEO-ready copy.', f, 26, 95);
  const click = 50;
  return (
    <Feature n="01" label="CREATE" title={'Start in\nseconds.'} accent={['seconds']} grad={['#C7D2FE', '#6366F1']} sub="Name it, describe it, go.">
      <div style={{ position: 'relative' }}>
        <Panel w={780}>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em' }}>Create a new prompt</div>
              <div style={{ fontSize: 20, color: t.muted, marginTop: 8 }}>Create a new prompt. Click save when you're done.</div>
            </div>
            <Field label="Name" focus={kf(f, [6, 10, 24, 28], [0, 1, 1, 0])}>
              {name}
              {f >= 6 && f < 26 ? <Caret /> : null}
            </Field>
            <Field label="Description" focus={kf(f, [24, 28, 46, 50], [0, 1, 1, 0])} style={{ fontSize: 20 }}>
              <span style={{ fontSize: 20 }}>{desc}</span>
              {f >= 26 && f < 48 ? <Caret /> : null}
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginTop: 6 }}>
              <Btn variant="outline" size={22}>
                Cancel
              </Btn>
              <Btn size={22} press={pressAt(f, click)}>
                {f >= click + 2 ? <IconCheck size={22} stroke={3} /> : null}
                Create
              </Btn>
            </div>
          </div>
        </Panel>
        <Burst x={690} y={480} at={click} count={18} speed={12} life={18} seed="create" />
        <Cursor path={[{ f: 24, x: 900, y: 640 }, { f: 46, x: 700, y: 484 }]} clicks={[click]} show={[20, 70]} />
      </div>
    </Feature>
  );
};

// User message with typed ${variables}. The first variable is picked from autocomplete.
const EDIT = 'Write a product description for ${product_name} aimed at ${audience}. Highlight ${features} in a ${tone} voice.';
const PRE = 32; // chars before the first ${
const V1_END = PRE + '${product_name}'.length;
const shownAt = (f: number) => {
  if (f < 4) return 0;
  if (f < 12) return Math.min(PRE, Math.floor((f - 4) * 4));
  if (f < 22) return PRE + 2; // "${" typed, autocomplete open
  if (f < 24) return V1_END;
  return Math.min(EDIT.length, V1_END + Math.floor((f - 24) * 2.8));
};
const frameFor = (n: number) => (n <= V1_END ? 22 : 24 + (n - V1_END) / 2.8);

const renderEdit = (n: number) => {
  const out: ReactNode[] = [];
  const re = /\$\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null = re.exec(EDIT);
  while (m) {
    const start = m.index;
    const end = start + m[0].length;
    if (start >= n) break;
    out.push(EDIT.slice(last, start));
    if (end <= n) out.push(<Var key={start} name={m[1]} at={Math.ceil(frameFor(end))} />);
    else out.push(<span key={start} style={{ color: '#F5A524' }}>{EDIT.slice(start, n)}</span>);
    last = end;
    m = re.exec(EDIT);
  }
  if (last < n) out.push(EDIT.slice(last, n));
  return out;
};

export const EditShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const n = shownAt(f);
  const ac = pop(f, 12, springs.snappy) * (1 - tw(f, 22, 26));
  const vars: [string, string, ReactNode][] = [
    ['product_name', 'String', <IconAbc key="a" size={20} />],
    ['features', 'Array', <IconList key="b" size={20} />],
    ['audience', 'String', <IconAbc key="c" size={20} />],
    ['tone', 'String', <IconAbc key="d" size={20} />],
  ];
  return (
    <Feature side="left" n="02" label="EDIT" title={'Variables that\njust work.'} accent={['Variables']} grad={['#FDE68A', '#F59E0B']} sub={'Type ${ and pick from your schema.'}>
      <Panel w={820} glow={stage.orange}>
        <div style={{ display: 'flex', gap: 8, padding: '18px 24px 0', borderBottom: `1px solid ${t.border}` }}>
          {['System Prompt', 'User Message'].map((tab, i) => (
            <div
              key={tab}
              style={{
                padding: '10px 18px 14px',
                fontSize: 20,
                fontWeight: 600,
                color: i === 1 ? t.text : t.subtle,
                borderBottom: i === 1 ? `2px solid ${t.text}` : '2px solid transparent',
              }}
            >
              {tab}
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', padding: 30, minHeight: 330, fontFamily: mono, fontSize: 25, lineHeight: 1.75 }}>
          {renderEdit(n)}
          {n < EDIT.length ? <Caret h={1.1} /> : null}
          {ac > 0.01 ? (
            <div
              style={{
                position: 'absolute',
                left: 470,
                top: 84,
                width: 300,
                borderRadius: 14,
                background: t.cardHead,
                border: `1px solid ${t.border}`,
                boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
                padding: 8,
                transform: `scale(${ac})`,
                transformOrigin: 'top left',
                opacity: Math.min(1, ac * 2),
                fontFamily: 'inherit',
              }}
            >
              {vars.map(([v, ty, icon], i) => (
                <div
                  key={v}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 19,
                    background: i === 0 ? `rgba(245,165,36,${0.12 + 0.12 * pulse(f, 20, 4)})` : undefined,
                    color: i === 0 ? t.variable : t.muted,
                  }}
                >
                  {icon}
                  <span style={{ flex: 1 }}>{v}</span>
                  <span style={{ fontSize: 14, color: t.subtle }}>{ty}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Panel>
    </Feature>
  );
};

const FIELDS: [string, string, string, ReactNode][] = [
  ['product_name', 'String', '#60A5FA', <IconAbc key="a" size={22} />],
  ['features', 'Array', '#A78BFA', <IconListDetails key="b" size={22} />],
  ['audience', 'String', '#60A5FA', <IconAbc key="c" size={22} />],
  ['tone', 'Enum', '#F472B6', <IconBraces key="d" size={22} />],
];

const CODE = [
  ['z', '.object({'],
  ['  product_name: ', 'z.string().min(1),'],
  ['  features: ', 'z.array(z.string()),'],
  ['  audience: ', 'z.string(),'],
  ['  tone: ', "z.enum(['premium', 'playful']),"],
  ['', '})'],
];

export const SchemaShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const code = tw(f, 26, 34);
  return (
    <Feature n="03" label="SCHEMA BUILDER" title={'Typed inputs.\nZero guesswork.'} accent={['Typed']} grad={['#FBCFE8', '#EC4899']} sub="Every field validated with Zod.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: 800 }}>
        <Panel w={800} glow={stage.pink}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 26px', borderBottom: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>Schema Builder</span>
            <Btn variant="outline" size={18}>
              <IconPlus size={18} /> Add field
            </Btn>
          </div>
          <div style={{ padding: '10px 18px 18px' }}>
            {FIELDS.map(([name, type, col, icon], i) => {
              const hit = pulse(f, 4 + i * 4, 6);
              return (
                <div
                  key={name}
                  style={{
                    ...stag(f, 3, i, 4, 50),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 12px',
                    borderRadius: 12,
                    background: hit > 0.05 ? `rgba(236,72,153,${0.12 * hit})` : undefined,
                    borderBottom: i < 3 ? `1px solid ${t.border}` : undefined,
                  }}
                >
                  <IconGripVertical size={22} color={t.subtle} />
                  <span style={{ fontFamily: mono, fontSize: 22, flex: 1 }}>{name}</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 14px',
                      borderRadius: 999,
                      fontSize: 17,
                      fontWeight: 600,
                      color: col,
                      background: `${col}1F`,
                      border: `1px solid ${col}55`,
                    }}
                  >
                    {icon}
                    {type}
                  </span>
                  <span style={{ fontSize: 16, color: t.muted, marginLeft: 16 }}>Required</span>
                  <div style={{ width: 44, height: 26, borderRadius: 999, background: stage.indigo, position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: 3 + 18 * tw(f, 10 + i * 4, 16 + i * 4, 0, 1, ease.outBack),
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: '#fff',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel w={800} glow={stage.indigo} style={{ transform: `translateY(${(1 - code) * 80}px)`, opacity: code }}>
          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${t.border}`, fontSize: 18, fontWeight: 600, color: t.muted }}>Generated Code</div>
          <div style={{ padding: '16px 24px', fontFamily: mono, fontSize: 19, lineHeight: 1.6 }}>
            {CODE.map(([k, v], i) => {
              const o = tw(f, 28 + i * 3, 34 + i * 3);
              return (
                <div key={i} style={{ opacity: o, transform: `translateX(${(1 - o) * -20}px)`, whiteSpace: 'pre' }}>
                  <span style={{ color: '#E5E7EB' }}>{k}</span>
                  <span style={{ color: i === 0 || i === 5 ? '#E5E7EB' : '#C084FC' }}>{v}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </Feature>
  );
};

const PROVIDERS: { name: string; color: string; models: string[] }[] = [
  { name: 'Anthropic', color: '#D97757', models: ['Claude Opus 4.7', 'Claude Sonnet 4.6', 'Claude Haiku 4.5'] },
  { name: 'OpenAI', color: '#10A37F', models: ['GPT-5.5', 'GPT-5.4 Mini'] },
  { name: 'Google', color: '#4285F4', models: ['Gemini 3 Pro'] },
];
const FLAT = PROVIDERS.flatMap((p) => p.models);

const Dot = ({ color, letter }: { color: string; letter: string }) => (
  <span
    style={{
      width: 26,
      height: 26,
      borderRadius: 7,
      background: color,
      color: '#fff',
      fontSize: 15,
      fontWeight: 800,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {letter}
  </span>
);

export const ModelShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  // Highlight hops on the half-beats, then lands on Sonnet.
  const hops: [number, string][] = [
    [8, 'GPT-5.5'],
    [13, 'Gemini 3 Pro'],
    [18, 'Claude Opus 4.7'],
    [23, 'Claude Sonnet 4.6'],
  ];
  const cur = [...hops].reverse().find(([at]) => f >= at)?.[1];
  const pick = 28;
  const open = pop(f, 4, springs.snappy) * (1 - tw(f, pick + 2, pick + 8, 0, 1, ease.inExpo));
  const selected = f >= pick ? 'Claude Sonnet 4.6' : 'GPT-5.4 Mini';
  const temp = kf(f, [34, 50], [0.3, 0.7], ease.inOutCubic);
  const sliderW = 560;
  // Panel shrinks as the dropdown closes so the slider rides up under the picker.
  const h = 700 - 370 * tw(f, pick + 1, pick + 8, 0, 1, ease.inOutCubic);
  return (
    <Feature side="left" n="04" label="MODEL SETTINGS" title={'Any model.\nYour settings.'} accent={['model']} grad={['#A5F3FC', '#22D3EE']} sub={'Claude, GPT and Gemini,\nswitched in a click.'}>
      <div style={{ position: 'relative' }}>
        <Panel w={680} h={h} glow={stage.cyan} style={{ padding: 34 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.subtle, letterSpacing: '0.1em', marginBottom: 12 }}>MODEL</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 18px',
              borderRadius: 12,
              border: `1px solid ${open > 0.1 ? stage.indigo : t.border}`,
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            <Dot color={selected.startsWith('Claude') ? '#D97757' : '#10A37F'} letter={selected.startsWith('Claude') ? 'A' : 'O'} />
            <span style={{ flex: 1, transform: `translateY(${pulse(f, pick, 4) * -6}px)` }}>{selected}</span>
            <IconChevronDown size={22} style={{ transform: `rotate(${open * 180}deg)` }} />
          </div>
          <div
            style={{
              marginTop: 10,
              borderRadius: 14,
              border: `1px solid ${t.border}`,
              background: t.cardHead,
              padding: 10,
              transform: `scaleY(${open})`,
              transformOrigin: 'top',
              opacity: Math.min(1, open * 1.5),
              height: 400,
            }}
          >
            {PROVIDERS.map((p) => (
              <div key={p.name}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.subtle, padding: '8px 12px 4px', letterSpacing: '0.08em' }}>{p.name.toUpperCase()}</div>
                {p.models.map((m) => {
                  const on = cur === m;
                  const i = FLAT.indexOf(m);
                  return (
                    <div
                      key={m}
                      style={{
                        ...stag(f, 5, i, 1.2, 16),
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 12px',
                        borderRadius: 9,
                        fontSize: 20,
                        background: on ? t.hover : undefined,
                        boxShadow: on ? `inset 3px 0 0 ${p.color}` : undefined,
                      }}
                    >
                      <Dot color={p.color} letter={p.name[0]} />
                      <span style={{ flex: 1 }}>{m}</span>
                      {m === 'Claude Sonnet 4.6' && f >= pick ? <IconCheck size={20} /> : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 34, right: 34, bottom: 44, opacity: tw(f, pick + 5, pick + 10) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: t.subtle, letterSpacing: '0.1em' }}>TEMPERATURE</span>
              <span style={{ fontFamily: mono, fontSize: 30, fontWeight: 700, transform: `scale(${1 + pulse(f, 50, 5) * 0.2})` }}>{temp.toFixed(2)}</span>
            </div>
            <div style={{ position: 'relative', height: 10, width: sliderW + 52, borderRadius: 999, background: t.hover }}>
              <div style={{ position: 'absolute', inset: 0, width: (temp / 1) * (sliderW + 52), borderRadius: 999, background: `linear-gradient(90deg, ${stage.cyan}, ${stage.indigo})` }} />
              <div
                style={{
                  position: 'absolute',
                  top: -11,
                  left: temp * (sliderW + 52) - 16,
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: '#fff',
                  boxShadow: `0 0 0 ${6 + pulse(f, 34, 8) * 8}px rgba(99,102,241,0.3)`,
                }}
              />
            </div>
          </div>
        </Panel>
        <Cursor
          path={[
            { f: 16, x: 500, y: 330 },
            { f: 26, x: 300, y: 256 },
            { f: 32, x: 34 + 0.3 * 612 + 6, y: 285 },
            { f: 50, x: 34 + 0.7 * 612 + 6, y: 285 },
          ]}
          clicks={[pick, 34]}
          show={[12, 70]}
        />
      </div>
    </Feature>
  );
};

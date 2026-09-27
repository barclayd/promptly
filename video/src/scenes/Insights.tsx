import {
  IconActivity,
  IconArrowBackUp,
  IconBrandSpeedtest,
  IconEdit,
  IconFileText,
  IconLayoutGrid,
  IconLogout,
  IconMoon,
  IconPlus,
  IconPuzzle,
  IconRocket,
  IconSearch,
  IconSettings,
  IconSun,
  IconUsers,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Cursor } from '../components/Cursor';
import { Feature } from '../components/Feature';
import { Burst, Float, Shockwave } from '../components/Fx';
import { Kinetic } from '../components/Kinetic';
import { Kbd, Panel, stag } from '../components/ui';
import { ease, kf, pop, pulse, springs, tw, typed } from '../lib/motion';
import { dark, light, stage, ThemeCtx, type Tokens, useTokens } from '../lib/theme';

// ---------- 09 Analytics ----------

const DAYS = 27;
const SERIES = Array.from({ length: DAYS }, (_, i) => 900 + i * 55 + random(`d${i}`) * 700 + (i % 7 > 4 ? -500 : 0));
const MAX = Math.max(...SERIES);

const Stat = ({ icon, label, value, children, at }: { icon: ReactNode; label: string; value: ReactNode; children?: ReactNode; at: number }) => {
  const f = useCurrentFrame();
  const t = useTokens();
  return (
    <div
      style={{
        flex: 1,
        height: 190,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        background: t.cardHead,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
        ...stag(f, at, 0, 0, 60),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: t.muted, fontWeight: 600 }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {children}
    </div>
  );
};

const Gauge = ({ p }: { p: number }) => {
  const t = useTokens();
  const len = Math.PI * 44;
  return (
    <svg width={110} height={60} style={{ position: 'absolute', right: 18, top: 70 }}>
      <path d="M 11 55 A 44 44 0 0 1 99 55" fill="none" stroke={t.border} strokeWidth={10} strokeLinecap="round" />
      <path
        d="M 11 55 A 44 44 0 0 1 99 55"
        fill="none"
        stroke="url(#gg)"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - p)}
      />
      <defs>
        <linearGradient id="gg" x1="0" x2="1">
          <stop offset="0" stopColor={stage.indigo} />
          <stop offset="1" stopColor={stage.pink} />
        </linearGradient>
      </defs>
    </svg>
  );
};

const Chart = ({ at }: { at: number }) => {
  const f = useCurrentFrame();
  const t = useTokens();
  const W = 856;
  const H = 250;
  const pts = SERIES.map((v, i) => [(i / (DAYS - 1)) * W, H - (v / MAX) * (H - 20)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const p = tw(f, at, at + 26, 0, 1, ease.inOutCubic);
  const headX = p * W;
  const idx = Math.min(DAYS - 1, Math.floor(p * (DAYS - 1)));
  return (
    <div style={{ position: 'relative' }}>
      <svg width={W} height={H + 30} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4F46E5" stopOpacity={0.45} />
            <stop offset="1" stopColor="#4F46E5" stopOpacity={0} />
          </linearGradient>
          <clipPath id="reveal">
            <rect x={-4} y={-20} width={headX + 4} height={H + 40} />
          </clipPath>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke={t.border} strokeDasharray="4 6" opacity={tw(f, at - 6, at)} />
        ))}
        <g clipPath="url(#reveal)">
          <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#area)" />
          <path d={line} fill="none" stroke="#6366F1" strokeWidth={4} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 10px rgba(99,102,241,0.8))' }} />
        </g>
        {p > 0 && p < 1 ? <circle cx={headX} cy={pts[idx][1]} r={8} fill="#fff" style={{ filter: 'drop-shadow(0 0 12px #818CF8)' }} /> : null}
        {['Sep 1', 'Sep 8', 'Sep 15', 'Sep 22', 'Sep 27'].map((d, i) => (
          <text key={d} x={(i / 4) * W} y={H + 26} fill={t.subtle} fontSize={15} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} opacity={tw(f, at + i * 3, at + i * 3 + 8)}>
            {d}
          </text>
        ))}
      </svg>
    </div>
  );
};

export const AnalyticsShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const calls = Math.round(51936 * tw(f, 12, 44, 0, 1, ease.outQuint));
  return (
    <Feature side="left" n="09" label="ANALYTICS" title={'Know what’s\nrunning.'} accent={['running.']} grad={['#C7D2FE', '#6366F1']} sub={'Usage, members and API\ncalls at a glance.'}>
      <Panel w={920} h={620} style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Stat icon={<IconFileText size={18} />} label="Prompts" value={Math.round(8 * tw(f, 6, 20))} at={4}>
            <Gauge p={tw(f, 6, 26, 0, 0.8, ease.outQuint)} />
          </Stat>
          <Stat icon={<IconUsers size={18} />} label="Team Members" value="1" at={7} />
          <Stat icon={<IconActivity size={18} />} label="API Calls" value={calls.toLocaleString('en-US')} at={10}>
            <div style={{ fontSize: 15, color: '#10B981', fontWeight: 700, opacity: tw(f, 40, 46), transform: `scale(${pop(f, 40, springs.bouncy)})`, transformOrigin: 'left' }}>
              ▲ 18% vs August
            </div>
          </Stat>
        </div>
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 16, padding: '18px 16px 10px', flex: 1, opacity: tw(f, 14, 20) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
            <span>API Calls</span>
            <span style={{ color: t.muted, fontWeight: 500 }}>September 2026</span>
          </div>
          <Chart at={18} />
        </div>
      </Panel>
    </Feature>
  );
};

// ---------- 10 Search ----------

const RESULTS = [
  { group: 'E-commerce', icon: IconFileText, name: 'Product Description Writer', desc: 'Turns raw product specs into on-brand, SEO-ready copy.' },
  { group: 'E-commerce', icon: IconFileText, name: 'Product Review Summariser', desc: 'Condenses hundreds of reviews into pros, cons and a verdict.' },
  { group: 'Composers', icon: IconLayoutGrid, name: 'Product Launch Kit', desc: 'Page copy, email and socials for every launch.' },
  { group: 'Snippets', icon: IconPuzzle, name: 'Brand Voice', desc: 'Warm, confident and never salesy.' },
];

export const SearchShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const OPEN = 16;
  const keysOut = tw(f, OPEN - 2, OPEN + 6, 0, 1, ease.inExpo);
  const dp = pop(f, OPEN, springs.bouncy);
  const q = typed('product', f, OPEN + 6, 60);
  const hl = f < 38 ? 0 : f < 46 ? 1 : 2;
  let lastGroup = '';
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 70, width: '100%' }}>
        <Kinetic text="Find anything." start={2} size={96} variant="rise" accent={['anything.']} gradient={['#A5F3FC', '#22D3EE']} stagger={0.8} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 470,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: 28,
          transform: `translateY(${-keysOut * 120}px) scale(${1 - keysOut * 0.5})`,
          opacity: 1 - keysOut,
        }}
      >
        <Kbd at={8} size={150}>
          ⌘
        </Kbd>
        <Kbd at={12} size={150}>
          K
        </Kbd>
      </div>
      <Shockwave x={960} y={545} at={12} size={600} color="rgba(34,211,238,0.6)" />
      {f >= OPEN - 1 ? (
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 290,
            transform: `translateX(-50%) translateY(${(1 - dp) * 80}px) scale(${0.85 + 0.15 * dp})`,
            transformOrigin: 'top center',
            opacity: Math.min(1, dp * 2),
          }}
        >
          <Float rx={3} ry={0} drift={0.4}>
            <Panel w={1080} glow={stage.cyan}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 30px', borderBottom: `1px solid ${t.border}`, fontSize: 32 }}>
                <IconSearch size={32} color={t.muted} />
                <span>{q}</span>
                <span style={{ width: 3, height: 36, background: stage.cyan, opacity: Math.floor(f / 8) % 2 ? 0.2 : 1 }} />
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 17, color: t.subtle, border: `1px solid ${t.border}`, borderRadius: 6, padding: '3px 8px' }}>ESC</span>
              </div>
              <div style={{ padding: '14px 16px 20px', position: 'relative' }}>
                {RESULTS.map((r, i) => {
                  const head = r.group !== lastGroup;
                  lastGroup = r.group;
                  const Icon = r.icon;
                  return (
                    <div key={r.name} style={stag(f, OPEN + 14, i, 2.5, 30)}>
                      {head ? <div style={{ fontSize: 16, fontWeight: 600, color: t.subtle, padding: '12px 14px 8px' }}>{r.group}</div> : null}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          padding: '14px 16px',
                          borderRadius: 12,
                          background: i === hl ? t.hover : 'transparent',
                          boxShadow: i === hl ? `inset 3px 0 0 ${stage.cyan}` : undefined,
                          transform: i === hl ? `scale(${1 + pulse(f, hl === 0 ? OPEN + 16 : hl === 1 ? 38 : 46, 6) * 0.02})` : undefined,
                        }}
                      >
                        <Icon size={26} color={t.muted} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 24, fontWeight: 600 }}>
                            <mark style={{ background: 'rgba(34,211,238,0.22)', color: 'inherit', borderRadius: 4, padding: '0 2px' }}>{r.name.slice(0, 7)}</mark>
                            {r.name.slice(7)}
                          </span>
                          <span style={{ fontSize: 18, color: t.muted }}>{r.desc}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </Float>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------- 11 Activity ----------

const PILL: Record<string, [string, string]> = {
  Edited: ['#60A5FA', 'rgba(59,130,246,0.16)'],
  Published: ['#34D399', 'rgba(16,185,129,0.16)'],
  Created: ['#A78BFA', 'rgba(139,92,246,0.16)'],
  Restored: ['#FBBF24', 'rgba(245,158,11,0.16)'],
};
const ACTION_ICON = { Edited: IconEdit, Published: IconRocket, Created: IconPlus, Restored: IconArrowBackUp };

const ROWS: { name: string; action: keyof typeof ACTION_ICON; who: string; time: string }[] = [
  { name: 'Product Description Writer', action: 'Edited', who: 'Alex Morgan via Claude Code', time: '17:34' },
  { name: 'Product Launch Kit', action: 'Published', who: 'Alex Morgan', time: '17:21' },
  { name: 'Launch Email Writer', action: 'Created', who: 'Alex Morgan via Cursor', time: '16:58' },
  { name: 'Support Reply Drafter', action: 'Restored', who: 'Alex Morgan', time: '16:40' },
  { name: 'Social Post Generator', action: 'Published', who: 'Alex Morgan via Codex', time: '16:12' },
  { name: 'Brand Voice', action: 'Edited', who: 'Alex Morgan', time: '15:47' },
  { name: 'Product Review Summariser', action: 'Created', who: 'Alex Morgan via Claude Code', time: '15:03' },
  { name: 'Weekly Digest', action: 'Edited', who: 'Alex Morgan', time: '14:26' },
  { name: 'Onboarding Email Series', action: 'Published', who: 'Alex Morgan', time: '13:55' },
];

export const ActivityShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const scroll = kf(f, [26, 56], [0, 3 * 92], ease.inOutCubic);
  const tab = f < 30 ? 0 : f < 44 ? 1 : 2;
  const tabX = kf(f, [29, 33, 43, 47], [0, 1, 1, 2], ease.outExpo);
  const TABS = ['All changes', 'Prompts', 'Composers'];
  const TW = [150, 106, 128];
  const left = [0, TW[0] + 8, TW[0] + TW[1] + 16];
  const tabLeft = tabX < 1 ? left[0] + (left[1] - left[0]) * tabX : left[1] + (left[2] - left[1]) * (tabX - 1);
  const tabW = tabX < 1 ? TW[0] + (TW[1] - TW[0]) * tabX : TW[1] + (TW[2] - TW[1]) * (tabX - 1);
  return (
    <Feature side="right" n="11" label="ACTIVITY LOG" title={'Every change,\ntracked.'} accent={['tracked.']} grad={['#FDE68A', '#F59E0B']} sub={'Who changed what, when —\nand one click to restore.'}>
      <Panel w={900} h={640} glow={stage.orange}>
        <div style={{ padding: '24px 28px 16px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconActivity size={28} /> Activity
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 8, fontSize: 18, fontWeight: 600 }}>
            <div style={{ position: 'absolute', left: tabLeft, width: tabW, top: 0, bottom: 0, borderRadius: 10, background: t.hover, border: `1px solid ${t.border}` }} />
            {TABS.map((l, i) => (
              <span key={l} style={{ position: 'relative', width: TW[i], textAlign: 'center', padding: '9px 0', color: i === tab ? t.text : t.muted }}>
                {l}
              </span>
            ))}
          </div>
        </div>
        <div style={{ height: 500, overflow: 'hidden', position: 'relative' }}>
          <div style={{ transform: `translateY(${-scroll}px)` }}>
            {ROWS.map((r, i) => {
              const rp = pop(f, 6 + i * 2.2, springs.snappy);
              const [fg, bg] = PILL[r.action];
              const Icon = ACTION_ICON[r.action];
              return (
                <div
                  key={r.name}
                  style={{
                    height: 92,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    padding: '0 28px',
                    borderBottom: `1px solid ${t.border}`,
                    transform: `translateX(${(1 - rp) * 80}px)`,
                    opacity: tw(f, 6 + i * 2.2, 12 + i * 2.2),
                  }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop(f, 8 + i * 2.2, springs.jelly)})` }}>
                    <Icon size={24} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 21, fontWeight: 700 }}>
                      {r.name}
                      <span style={{ fontSize: 14, fontWeight: 700, color: fg, background: bg, padding: '3px 9px', borderRadius: 999 }}>{r.action}</span>
                    </div>
                    <span style={{ fontSize: 16, color: t.muted }}>{r.who}</span>
                  </div>
                  <span style={{ fontSize: 16, color: t.subtle, fontVariantNumeric: 'tabular-nums' }}>27 Sept 2026, {r.time} UTC</span>
                </div>
              );
            })}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, background: `linear-gradient(transparent, ${t.card})` }} />
        </div>
      </Panel>
    </Feature>
  );
};

// ---------- 12 Theme ----------

// Frames (local) where the theme flips. First is the real click; the rest
// accelerate with the snare roll into the drop.
const FLIPS = [18, 32, 38, 42, 45, 47, 48.5, 49.5, 50.5];

const MiniApp = ({ tk, menu }: { tk: Tokens; menu: number }) => (
  <ThemeCtx.Provider value={tk}>
    <div style={{ width: 1400, height: 760, display: 'flex', background: tk.bg, color: tk.text, borderRadius: 22, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width: 280, background: tk.sidebar, borderRight: `1px solid ${tk.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 800, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6366F1,#EC4899)' }} /> Promptly
        </div>
        {[
          [IconBrandSpeedtest, 'Dashboard'],
          [IconFileText, 'Prompts'],
          [IconLayoutGrid, 'Composers'],
          [IconPuzzle, 'Snippets'],
          [IconActivity, 'Activity'],
          [IconSettings, 'Settings'],
        ].map(([I, l], i) => {
          const Icon = I as typeof IconFileText;
          return (
            <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 19, padding: '10px 12px', borderRadius: 10, background: i === 1 ? tk.hover : undefined, color: i === 1 ? tk.text : tk.muted }}>
              <Icon size={21} /> {l as string}
            </div>
          );
        })}
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, background: menu > 0 ? tk.hover : undefined }}>
          <div style={{ width: 38, height: 38, borderRadius: 99, background: 'linear-gradient(135deg,#22D3EE,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>A</div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 16 }}>
            <b>Alex Morgan</b>
            <span style={{ color: tk.muted, fontSize: 14 }}>Acme Inc.</span>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: 34 }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 24 }}>Prompts</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {['Product Description Writer', 'Launch Email Writer', 'Social Post Generator', 'Support Reply Drafter', 'Product Review Summariser', 'Weekly Digest'].map((n, i) => (
            <div key={n} style={{ border: `1px solid ${tk.border}`, background: tk.card, borderRadius: 16, padding: 20, height: 150, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <IconFileText size={24} color={tk.muted} />
              <b style={{ fontSize: 19 }}>{n}</b>
              <div style={{ height: 8, width: `${60 + ((i * 17) % 30)}%`, borderRadius: 4, background: tk.border }} />
              <div style={{ height: 8, width: '45%', borderRadius: 4, background: tk.border }} />
            </div>
          ))}
        </div>
      </div>
      {menu > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 22,
            bottom: 86,
            width: 280,
            background: tk.card,
            border: `1px solid ${tk.border}`,
            borderRadius: 14,
            padding: 8,
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            transform: `translateY(${(1 - menu) * 20}px) scale(${0.9 + 0.1 * menu})`,
            transformOrigin: 'bottom left',
            opacity: menu,
            fontSize: 18,
          }}
        >
          {[
            [IconSettings, 'Settings'],
            [tk.mode === 'dark' ? IconSun : IconMoon, 'Toggle Theme'],
            [IconLogout, 'Log out'],
          ].map(([I, l], i) => {
            const Icon = I as typeof IconSun;
            return (
              <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 9, background: i === 1 ? tk.hover : undefined }}>
                <Icon size={20} /> {l as string}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  </ThemeCtx.Provider>
);

export const ThemeShot = () => {
  const f = useCurrentFrame();
  const flips = FLIPS.filter((x) => f >= x).length;
  const last = FLIPS[flips - 1] ?? -99;
  // Base = theme before the latest flip; top = theme after, wiped in from the toggle.
  const isLight = (n: number) => n % 2 === 1;
  const base = isLight(Math.max(0, flips - 1)) ? light : dark;
  const top = isLight(flips) ? light : dark;
  const wipeLen = flips <= 1 ? 12 : Math.max(2, 7 - flips);
  const r = flips === 0 ? 0 : tw(f, last, last + wipeLen, 0, 1, ease.inOutCubic) * 1700;
  const menu = f < 8 ? 0 : f < 18 ? pop(f, 8, springs.snappy) : 1 - tw(f, 18, 24);
  const ap = pop(f, 0, springs.bouncy);
  const roll = tw(f, 30, 52, 0, 1, ease.inQuad);
  const shake = roll * 6 * Math.sin(f * 2.3);
  // Toggle click point in MiniApp coords.
  const cx = 150;
  const cy = 626;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 36, width: '100%' }}>
        <Kinetic text="Light or dark. Your call." start={2} size={84} variant="rise" accent={['Light', 'dark.']} gradient={['#FDE68A', '#F8FAFC']} stagger={0.7} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 610,
          transform: `translate(-50%, -50%) translateY(${(1 - ap) * 200}px) scale(${(0.9 + 0.1 * ap) * (0.88 + roll * 0.1)}) translateX(${shake}px)`,
          opacity: tw(f, 0, 6),
          filter: `drop-shadow(0 40px 100px rgba(0,0,0,0.6))`,
        }}
      >
        <div style={{ position: 'relative' }}>
          <MiniApp tk={base} menu={flips === 0 ? menu : 0} />
          {flips > 0 ? (
            <div style={{ position: 'absolute', inset: 0, clipPath: `circle(${r}px at ${cx}px ${cy}px)` }}>
              <MiniApp tk={top} menu={flips === 1 ? Math.max(0, menu) : 0} />
            </div>
          ) : null}
          <Cursor
            path={[
              { f: 0, x: 700, y: 400 },
              { f: 7, x: 150, y: 700 },
              { f: 14, x: cx, y: cy },
            ]}
            clicks={[8, FLIPS[0]]}
            show={[0, 28]}
          />
          <Burst x={cx} y={cy} at={FLIPS[0]} count={18} colors={['#FDE68A', '#fff']} seed="theme" />
        </div>
      </div>
    </AbsoluteFill>
  );
};

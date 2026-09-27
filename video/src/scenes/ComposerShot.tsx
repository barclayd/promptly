import {
  IconAlignLeft,
  IconBold,
  IconCheck,
  IconFileText,
  IconH1,
  IconHighlight,
  IconLetterCase,
  IconLink,
  IconList,
  IconPlayerPlayFilled,
  IconPlus,
  IconQuote,
  IconRocket,
  IconTable,
} from '@tabler/icons-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Cursor } from '../components/Cursor';
import { Burst, Float } from '../components/Fx';
import { Badge, Btn, Panel, pressAt, RefChip, Shimmer, StreamText, VarChip } from '../components/ui';
import { pop, pulse, springs, tw } from '../lib/motion';
import { stage, useTokens } from '../lib/theme';
import { TopTitle } from './TestPublish';

// 120 frames. Phases on the beat grid: build (0), run (45), pin (90).
const RUN = 45;
const PIN = 90;

const SECTIONS = [
  {
    head: 'Product page',
    ref: 'Product Description Writer',
    pin: 'v2.0.0',
    out: '**Work smarter, feel better — all day long.**\nYour home office deserves lighting that works as hard as you do. Aurora adjusts its brightness to match natural daylight, reducing eye strain during marathon work sessions.',
    cps: 330,
    done: 76,
  },
  {
    head: 'Launch email',
    ref: 'Launch Email Writer',
    pin: 'v1.3.0',
    out: '**Subject: Work smarter with light that adapts to your day**\nHi there, introducing Aurora Smart Desk Lamp — the lamp that thinks like you do. Aurora launches October 14. Be among the first.',
    cps: 300,
    done: 80,
  },
  {
    head: 'Social posts',
    ref: 'Social Post Generator',
    pin: 'v1.1.0',
    out: '**Post 1**\nSay goodbye to eye strain! Aurora adapts its brightness to natural daylight. Launching October 14. #RemoteWork',
    cps: 260,
    done: 84,
  },
];

const TOOLS = [IconH1, IconList, IconBold, IconLink, IconLetterCase, IconHighlight, IconAlignLeft, IconQuote, IconTable];

export const ComposerShot = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const pp = pop(f, 0, springs.bouncy);
  const published = f >= PIN + 4;
  return (
    <AbsoluteFill>
      {f < RUN ? <TopTitle n="08" label="COMPOSERS" text="Many prompts. One document." accent={['One', 'document']} grad={['#DDD6FE', '#8B5CF6']} out={RUN - 8} /> : null}
      {f >= RUN - 1 && f < PIN ? (
        <TopTitle n="08" label="TEST THE WHOLE KIT" text="Run them all in parallel." accent={['parallel']} grad={['#A5F3FC', '#22D3EE']} at={RUN + 1} out={PIN - 8} />
      ) : null}
      {f >= PIN - 1 ? <TopTitle n="08" label="PUBLISH" text="Pin versions. Stay stable." accent={['Pin', 'versions']} grad={['#BFDBFE', '#3B82F6']} at={PIN + 1} /> : null}

      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 245,
          transform: `translateY(${(1 - pp) * 220}px) scale(${0.9 + 0.1 * pp})`,
          opacity: tw(f, 0, 6),
        }}
      >
        <Float rx={4} ry={-3} drift={0.5}>
          <div style={{ position: 'relative' }}>
            <Panel w={1620} h={715} glow={stage.violet} style={{ display: 'flex' }}>
              {/* Editor */}
              <div style={{ width: 830, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 26px', borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 24, fontWeight: 700 }}>Product Launch Kit</span>
                  <Badge kind={published ? 'published' : 'draft'} size={15} style={{ transform: `scale(${1 + pulse(f, PIN + 4, 5) * 0.3})` }} />
                  <span style={{ flex: 1 }} />
                  <Btn size={18} press={pressAt(f, PIN)}>
                    <IconRocket size={18} /> Publish
                  </Btn>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderBottom: `1px solid ${t.border}` }}>
                  {TOOLS.map((Icon, i) => {
                    const p = pop(f, 3 + i * 1.2, springs.bouncy);
                    return (
                      <div key={i} style={{ width: 40, height: 40, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, transform: `scale(${p})` }}>
                        <Icon size={22} />
                      </div>
                    );
                  })}
                  <span style={{ flex: 1 }} />
                  {['Add prompt', 'Add variable'].map((l, i) => (
                    <span
                      key={l}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 16,
                        fontWeight: 600,
                        padding: '7px 12px',
                        borderRadius: 9,
                        border: `1px solid ${t.border}`,
                        transform: `scale(${pop(f, 14 + i * 2, springs.bouncy) * (1 - pressAt(f, 12) * 0.1)})`,
                      }}
                    >
                      <IconPlus size={16} /> {l}
                    </span>
                  ))}
                </div>
                <div style={{ padding: '26px 34px' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
                    Launch kit: <VarChip name="product_name" size={24} />
                  </div>
                  <div style={{ fontSize: 20, color: t.muted, margin: '12px 0 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    Everything the team needs for launch day on <VarChip name="launch_date" size={17} />
                  </div>
                  {SECTIONS.map((s, i) => {
                    const at = 12 + i * 7;
                    const p = pop(f, at, springs.bouncy);
                    const pinP = pop(f, PIN + 4 + i * 4, springs.bouncy);
                    return (
                      <div key={s.ref} style={{ padding: '14px 0', borderTop: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: 23, fontWeight: 700, marginBottom: 12 }}>{s.head}</div>
                        <div style={{ transform: `translateY(${(1 - p) * -50}px) scale(${0.6 + 0.4 * p})`, transformOrigin: 'left center', opacity: Math.min(1, p * 2) }}>
                          <RefChip name={s.ref} size={20} pin={f >= PIN + 4 + i * 4 ? s.pin : undefined} pinP={pinP} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Output */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '18px 26px', borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 24, fontWeight: 700, flex: 1 }}>Response</span>
                  <Btn size={18} variant="outline" press={pressAt(f, RUN)}>
                    <IconPlayerPlayFilled size={16} /> Test
                  </Btn>
                </div>
                <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                  {f < RUN + 2 ? (
                    <div style={{ margin: 'auto', color: t.subtle, fontSize: 20 }}>Run a test to see the combined output</div>
                  ) : (
                    SECTIONS.map((s, i) => {
                      const inP = pop(f, RUN + 2 + i * 2, springs.snappy);
                      const streamAt = RUN + 8 + i * 2;
                      const done = f >= s.done;
                      return (
                        <div
                          key={s.ref}
                          style={{
                            flex: 1,
                            border: `1px solid ${done ? 'rgba(16,185,129,0.45)' : t.border}`,
                            borderRadius: 14,
                            padding: '14px 18px',
                            background: t.cardHead,
                            transform: `translateX(${(1 - inP) * 120}px)`,
                            opacity: Math.min(1, inP * 2),
                            boxShadow: `0 0 ${36 * pulse(f, s.done, 8)}px rgba(16,185,129,0.6)`,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 18, fontWeight: 700 }}>
                            <IconFileText size={18} color={t.ref} />
                            <span style={{ flex: 1 }}>{s.head}</span>
                            {done ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#10B981', fontSize: 16, transform: `scale(${pop(f, s.done, springs.bouncy)})` }}>
                                <IconCheck size={17} stroke={3} /> Done
                              </span>
                            ) : (
                              <Shimmer size={16}>Running…</Shimmer>
                            )}
                          </div>
                          {f >= streamAt ? <StreamText text={s.out} start={streamAt} cps={s.cps} size={16} lineHeight={1.45} /> : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Panel>
            {SECTIONS.map((s, i) => (
              <Burst key={s.ref} x={140} y={392 + i * 106} at={12 + i * 7} count={14} speed={10} life={16} colors={['#60A5FA', '#fff']} seed={`ref${i}`} />
            ))}
            {SECTIONS.map((s, i) => (
              <Burst key={`p${s.ref}`} x={420} y={392 + i * 106} at={PIN + 4 + i * 4} count={12} speed={9} life={16} colors={['#93C5FD', '#fff']} seed={`pin${i}`} />
            ))}
            <Cursor
              path={[
                { f: 30, x: 1200, y: 400 },
                { f: 42, x: 1540, y: 40 },
                { f: 58, x: 1300, y: 300 },
                { f: 86, x: 730, y: 40 },
              ]}
              clicks={[RUN, PIN]}
              show={[28, 110]}
            />
          </div>
        </Float>
      </div>
    </AbsoluteFill>
  );
};

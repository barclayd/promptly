import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Burst, Flash, Shockwave } from '../components/Fx';
import { Kinetic } from '../components/Kinetic';
import { Logo } from '../components/Logo';
import { ease, kf, pulse, s, tw } from '../lib/motion';
import { mono, sans, stage } from '../lib/theme';

const CX = 960;
const CY = 540;

type Tok = [string, string];
const K = '#C084FC';
const STR = '#FBBF24';
const CMT = '#6B7280';
const FN = '#60A5FA';
const W = '#E5E7EB';
const RED = '#F87171';
const GRN = '#34D399';

// Hard-coded prompt debris, the "before" picture.
const CARDS: { x: number; y: number; r: number; lines: Tok[][] }[] = [
  { x: 330, y: 170, r: -6, lines: [[[ 'const ', K], ['SYSTEM_PROMPT', FN], [' = ', W], ['"You are a helpful…"', STR]]] },
  { x: 1560, y: 150, r: 5, lines: [[['prompt', FN], [' = ', W], ['f"Summarise {ticket}…"', STR]]] },
  { x: 250, y: 470, r: 4, lines: [[['// TODO: do NOT touch this prompt', CMT]]] },
  { x: 1650, y: 430, r: -4, lines: [[['- tone: "friendly"', RED]], [['+ tone: "premium"', GRN]]] },
  { x: 380, y: 800, r: -3, lines: [[['git commit -m ', W], ['"prompt v17 final_FINAL"', STR]]] },
  { x: 1540, y: 790, r: 6, lines: [[['{ role: ', W], ['"system"', STR], [', content: ', W], ['"…"', STR], [' }', W]]] },
  { x: 960, y: 110, r: 2, lines: [[['temperature', FN], [': ', W], ['0.7', '#F472B6'], [', ', W], ['// ???', CMT]]] },
  { x: 900, y: 960, r: -2, lines: [[['deploy #482 ', W], ['— fix typo in prompt', CMT]]] },
  { x: 120, y: 640, r: -8, lines: [[['PROMPT_V2_NEW_real.txt', W]]] },
  { x: 1800, y: 620, r: 7, lines: [[['const ', K], ['msg', FN], [' = `Write about ${x}`', STR]]] },
];

const HIT1 = s(4);
const SUCK = s(7.1);
const GAP = s(7.75);
const DROP = s(8);

const CodeCard = ({ i }: { i: number }) => {
  const f = useCurrentFrame();
  const c = CARDS[i];
  const at = HIT1 + (i % 5) * 3 + Math.floor(i / 5) * 30;
  // Fly in from the nearest edge.
  const fromX = c.x < CX ? -500 : 500;
  const inP = tw(f, at, at + 14, 0, 1, ease.outExpo);
  // Rising panic: shake grows with the riser.
  const shakeAmt = kf(f, [s(5.8), SUCK], [0, 9]);
  const sx = (random(`sx${i}${f}`) - 0.5) * shakeAmt;
  const sy = (random(`sy${i}${f}`) - 0.5) * shakeAmt;
  // Sucked into the centre.
  const suck = tw(f, SUCK + i, GAP - 2, 0, 1, ease.inExpo);
  const x = c.x + fromX * (1 - inP) + (CX - c.x) * suck + sx;
  const y = c.y + (CY - c.y) * suck + sy;
  const rot = c.r * (1 - inP) * 4 + c.r + suck * (i % 2 ? 220 : -220);
  const sc = (0.8 + inP * 0.2) * (1 - suck * 0.95);
  const o = inP * (1 - tw(f, GAP - 6, GAP, 0, 1));
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${sc})`,
        opacity: o * 0.92,
        filter: `blur(${(1 - inP) * 16 + suck * 10}px)`,
        padding: '16px 22px',
        borderRadius: 14,
        background: 'rgba(17,17,24,0.82)',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        fontFamily: mono,
        fontSize: 27,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      {c.lines.map((line, li) => (
        <div key={li}>
          {line.map(([t, col], ti) => (
            <span key={ti} style={{ color: col }}>
              {t}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

/** Text streams racing into the centre just before the drop. */
const Streams = () => {
  const f = useCurrentFrame();
  if (f < SUCK || f > DROP + 2) return null;
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="stR" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#E0E7FF" />
        </linearGradient>
        <linearGradient id="stL" x1="1" x2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#E0E7FF" />
        </linearGradient>
      </defs>
      {Array.from({ length: 34 }, (_, i) => {
        const left = i % 2 === 0;
        const st = SUCK + random(`st${i}`) * 14;
        const p = tw(f, st, GAP, 0, 1, ease.inExpo);
        if (p <= 0) return null;
        const y = CY + (random(`sy${i}`) - 0.5) * 900 * (1 - p);
        const len = 200 + random(`sl${i}`) * 500;
        const head = left ? -len + (CX + len) * p : 1920 + len - (1920 - CX + len) * p;
        const x1 = left ? head - len * (1 - p * 0.8) : head;
        const w = left ? head - x1 : len * (1 - p * 0.8);
        return (
          <rect
            key={i}
            x={left ? x1 : head}
            y={y}
            width={Math.max(0, w)}
            height={2 + random(`sh${i}`) * 3}
            rx={2}
            fill={left ? 'url(#stR)' : 'url(#stL)'}
            opacity={0.8}
          />
        );
      })}
      {/* Collapsed line that holds through the gap, then opens into the logo */}
      {f >= GAP - 3 ? (
        <rect
          x={CX - kf(f, [GAP - 3, GAP, DROP], [0, 520, 40]) / 2}
          y={CY - 1.5}
          width={kf(f, [GAP - 3, GAP, DROP], [0, 520, 40])}
          height={3}
          fill="#fff"
          style={{ filter: 'drop-shadow(0 0 12px #A5B4FC)' }}
        />
      ) : null}
    </svg>
  );
};

export const Intro = () => {
  const f = useCurrentFrame();

  // Word hits, each with an RGB split that decays after the beat.
  const split = pulse(f, HIT1, 5) + pulse(f, s(5), 5) + pulse(f, s(6), 5) + pulse(f, s(6.5), 4) + pulse(f, s(7), 4);
  const rgb = `${split * 10}px 0 rgba(255,40,90,${0.8 * Math.min(1, split)}), ${-split * 10}px 0 rgba(0,220,255,${0.8 * Math.min(1, split)})`;

  // Camera shake on the drop.
  const shake = pulse(f, DROP, 7) * 22;
  const camX = (random(`cx${f}`) - 0.5) * shake;
  const camY = (random(`cy${f}`) - 0.5) * shake;

  // Lockup exit: zoom through at the end of the scene.
  const exitP = tw(f, s(9.62), s(10), 0, 1, ease.inExpo);
  const lockupDim = f < DROP ? 0 : 1;

  return (
    <AbsoluteFill style={{ fontFamily: sans }}>
      {/* Hook */}
      {f < s(3.9) ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Kinetic text="Every AI feature" start={9} size={128} variant="rise" out={s(2.5)} />
          <Kinetic text="runs on a prompt." start={30} size={128} variant="rise" accent={['prompt']} out={s(2.55)} />
        </AbsoluteFill>
      ) : null}
      {f >= s(2.7) && f < HIT1 ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Kinetic
            text="So where do yours live?"
            start={s(2.8)}
            size={76}
            weight={600}
            variant="blur"
            stagger={1}
            color={stage.dim}
            out={s(3.75)}
            outStagger={0.4}
          />
        </AbsoluteFill>
      ) : null}

      {/* Chaos */}
      {f >= HIT1 && f < DROP ? (
        <AbsoluteFill>
          {CARDS.map((_, i) => (
            <CodeCard key={i} i={i} />
          ))}
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              textShadow: rgb,
              opacity: 1 - tw(f, SUCK + 4, GAP - 2, 0, 1, ease.inExpo),
              transform: `scale(${1 - tw(f, SUCK + 4, GAP - 2, 0, 0.6, ease.inExpo)})`,
            }}
          >
            {f < s(5) ? <Kinetic text="Hard-coded." start={HIT1} size={170} weight={900} variant="slam" stagger={1} /> : null}
            {f >= s(5) && f < s(6) ? (
              <Kinetic text="Copy-pasted." start={s(5)} size={170} weight={900} variant="slam" stagger={1} />
            ) : null}
            {f >= s(6) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Kinetic text="Redeployed" start={s(6)} size={170} weight={900} variant="slam" stagger={1} />
                <div style={{ display: 'flex', gap: 30 }}>
                  <Kinetic text="for every" start={s(6.5)} size={110} weight={800} variant="drop" stagger={1} color={stage.dim} />
                  <Kinetic
                    text="tweak."
                    start={s(7)}
                    size={110}
                    weight={900}
                    variant="slam"
                    stagger={1}
                    accent={['tweak']}
                    gradient={['#FCA5A5', '#EF4444']}
                  />
                </div>
              </div>
            ) : null}
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      <Streams />

      {/* Drop: logo lockup */}
      {f >= DROP - 1 ? (
        <AbsoluteFill
          style={{
            transform: `translate(${camX}px, ${camY}px) scale(${1 + exitP * 3})`,
            filter: exitP > 0 ? `blur(${exitP * 30}px)` : undefined,
            opacity: lockupDim * (1 - exitP),
          }}
        >
          <Shockwave x={CX} y={440} at={DROP} size={1500} />
          <Shockwave x={CX} y={440} at={DROP + 4} size={1000} color="rgba(236,72,153,0.8)" />
          <Burst x={CX} y={440} at={DROP} count={60} speed={40} seed="drop" />
          <div style={{ position: 'absolute', left: CX - 170, top: 440 - 170 - 40 }}>
            <Logo size={340} start={DROP} pStart={DROP + 3} rowStagger={0.32} rowDur={6} sheenAt={s(8.9)} glow={0.6 + pulse(f, DROP, 10)} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 650, display: 'flex', justifyContent: 'center' }}>
            <Kinetic text="Promptly" start={s(8.3)} size={150} weight={800} variant="wide" stagger={1.2} tracking={-0.04} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 830, display: 'flex', justifyContent: 'center' }}>
            <Kinetic
              text="The CMS for AI prompts."
              start={s(8.75)}
              size={52}
              weight={600}
              variant="blur"
              stagger={0.8}
              color={stage.dim}
              accent={['AI', 'prompts']}
              gradient={['#E0E7FF', '#C084FC']}
              tracking={-0.01}
            />
          </div>
        </AbsoluteFill>
      ) : null}

      <Flash at={DROP} decay={3} max={0.85} />
    </AbsoluteFill>
  );
};

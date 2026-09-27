import { IconArrowRight } from '@tabler/icons-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Burst, Flash, Shockwave, Sparkles } from '../components/Fx';
import { Kinetic } from '../components/Kinetic';
import { Logo } from '../components/Logo';
import { ease, pop, pulse, springs, tw } from '../lib/motion';
import { sans, stage } from '../lib/theme';

// 180 frames from 54s. Four words on the beat, lockup on the 56s downbeat.
const WORDS: { w: string; g: [string, string] }[] = [
  { w: 'Write.', g: ['#A5B4FC', '#6366F1'] },
  { w: 'Test.', g: ['#C4B5FD', '#8B5CF6'] },
  { w: 'Compose.', g: ['#F9A8D4', '#EC4899'] },
  { w: 'Ship.', g: ['#67E8F9', '#22D3EE'] },
];
const LOCK = 60;

export const Outro = () => {
  const f = useCurrentFrame();
  const wi = Math.min(3, Math.floor(f / 15));
  const punch = pulse(f, wi * 15, 6);
  const cta = pop(f, LOCK + 18, springs.bouncy);
  const fade = 1 - tw(f, 158, 177, 0, 1, ease.inOutCubic);
  return (
    <AbsoluteFill style={{ fontFamily: sans, opacity: fade }}>
      {f < LOCK ? (
        <AbsoluteFill style={{ justifyContent: 'center', transform: `scale(${1 + punch * 0.06 + (f / LOCK) * 0.08})` }}>
          <Kinetic key={wi} text={WORDS[wi].w} start={wi * 15} size={280} weight={900} variant="slam" gradient={WORDS[wi].g} accent={[WORDS[wi].w]} stagger={0.6} />
          <Shockwave x={960} y={540} at={wi * 15} size={900} color={`${WORDS[wi].g[1]}cc`} />
          <Burst x={960} y={540} at={wi * 15} count={24} speed={22} life={18} colors={[WORDS[wi].g[1], '#fff']} seed={`w${wi}`} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill>
          <div
            style={{
              position: 'absolute',
              left: 960,
              top: 330,
              width: 1100,
              height: 1100,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(99,102,241,0.35), rgba(236,72,153,0.12) 40%, transparent 65%)',
              opacity: tw(f, LOCK, LOCK + 20) * (0.8 + 0.2 * Math.sin(f / 9)),
            }}
          />
          <div style={{ position: 'absolute', left: 960 - 130, top: 110 }}>
            <Logo size={260} start={LOCK} pStart={LOCK + 3} rowStagger={0.3} rowDur={6} sheenAt={LOCK + 24} glow={0.6 + pulse(f, LOCK, 10)} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 410, display: 'flex', justifyContent: 'center' }}>
            <Kinetic text="Promptly" start={LOCK + 4} size={150} weight={800} variant="wide" stagger={1.2} tracking={-0.04} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 590, display: 'flex', justifyContent: 'center' }}>
            <Kinetic text="The CMS for AI prompts." start={LOCK + 10} size={52} weight={600} variant="blur" color={stage.dim} stagger={0.8} tracking={-0.015} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 710, display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 18,
                padding: '26px 44px',
                borderRadius: 999,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6 50%, #EC4899)',
                boxShadow: `0 20px 80px rgba(139,92,246,${0.5 + 0.3 * Math.sin(f / 7)}), inset 0 1px 0 rgba(255,255,255,0.35)`,
                color: '#fff',
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                transform: `scale(${cta})`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              Start free
              <IconArrowRight size={40} stroke={2.6} style={{ transform: `translateX(${Math.max(0, Math.sin((f - LOCK) / 6)) * 8}px)` }} />
              <span style={{ fontWeight: 600, opacity: 0.9 }}>app.promptlycms.com</span>
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 120,
                  left: `${-20 + tw(f, LOCK + 34, LOCK + 54, 0, 1, ease.inOutCubic) * 130}%`,
                  background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.5), transparent)',
                }}
              />
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 870, display: 'flex', justifyContent: 'center' }}>
            <Kinetic text="14-day free trial · No card required" start={LOCK + 26} size={30} weight={500} variant="rise" color={stage.dim} stagger={0.5} tracking={0} />
          </div>
          <Sparkles
            at={LOCK + 6}
            items={[
              { x: 760, y: 150, s: 1.2 },
              { x: 1170, y: 210, s: 0.9 },
              { x: 700, y: 360, s: 0.7 },
              { x: 1230, y: 400, s: 1.1 },
              { x: 1480, y: 760, s: 0.8 },
              { x: 440, y: 740, s: 1 },
              { x: 1110, y: 90, s: 0.6 },
            ]}
          />
          <Shockwave x={960} y={240} at={LOCK} size={1500} />
          <Burst x={960} y={240} at={LOCK} count={48} speed={34} seed="lock" />
          <Burst x={960} y={770} at={LOCK + 18} count={20} speed={16} life={16} colors={['#F9A8D4', '#fff']} seed="cta" />
        </AbsoluteFill>
      )}
      <Flash at={LOCK} decay={3} max={0.85} />
    </AbsoluteFill>
  );
};

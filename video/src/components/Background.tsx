import { AbsoluteFill, interpolateColors, random, useCurrentFrame } from 'remotion';
import { BEAT, beatPulse, kf, pulse, s } from '../lib/motion';
import { HEIGHT, stage, WIDTH } from '../lib/theme';

const DUST = Array.from({ length: 70 }, (_, i) => ({
  x: random(`dx${i}`) * WIDTH,
  y: random(`dy${i}`) * HEIGHT,
  r: 0.6 + random(`dr${i}`) * 1.8,
  speed: 0.15 + random(`ds${i}`) * 0.6,
  phase: random(`dp${i}`) * Math.PI * 2,
  depth: random(`dd${i}`),
}));

// Global energy curve that follows the music structure.
const energyAt = (f: number) =>
  kf(
    f,
    [0, s(4), s(7.75), s(8), s(20), s(44), s(47.75), s(48), s(54), s(58), s(60)],
    [0.25, 0.4, 0.85, 1, 0.8, 0.75, 1, 1, 0.85, 0.7, 0.4],
  );

const kickAt = (f: number) =>
  beatPulse(f, s(4), s(7.75), BEAT, 5) * 0.4 +
  beatPulse(f, s(8), s(20), BEAT, 6) +
  beatPulse(f, s(20), s(44), BEAT, 5) * 0.7 +
  beatPulse(f, s(44), s(46), BEAT, 5) * 0.6 +
  beatPulse(f, s(48), s(54), BEAT, 6) +
  beatPulse(f, s(54), s(56), BEAT, 6) * 0.6;

export const Background = () => {
  const f = useCurrentFrame();
  const energy = energyAt(f);
  const kick = kickAt(f);
  const drop = pulse(f, s(8), 18) + pulse(f, s(48), 18);

  // Palette drifts from indigo (story) → violet/pink (drops) → cyan (MCP).
  const c1 = interpolateColors(f, [0, s(8), s(20), s(44), s(48), s(54), s(60)], [
    stage.indigo,
    stage.violet,
    stage.indigo,
    stage.violet,
    stage.pink,
    stage.indigo,
    stage.indigo,
  ]);
  const c2 = interpolateColors(f, [0, s(8), s(28), s(36), s(48), s(60)], [
    stage.violet,
    stage.pink,
    stage.blue,
    stage.violet,
    stage.cyan,
    stage.violet,
  ]);
  const c3 = interpolateColors(f, [0, s(20), s(40), s(48), s(60)], [
    '#1E1B4B',
    stage.cyan,
    stage.pink,
    stage.indigo,
    '#312E81',
  ]);

  const t = f / 30;
  const blob = (
    color: string,
    x: number,
    y: number,
    size: number,
    alpha: number,
  ) => (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        opacity: alpha,
        filter: 'blur(40px)',
        mixBlendMode: 'screen',
      }}
    />
  );

  const gridAlpha = (0.05 + energy * 0.07 + kick * 0.06) * kf(f, [0, s(3.5), s(4.2)], [0.3, 0.3, 1]);
  const gridShift = (f * 0.6) % 80;

  return (
    <AbsoluteFill style={{ background: stage.bg, overflow: 'hidden' }}>
      {blob(c1, WIDTH * 0.22 + Math.sin(t * 0.5) * 180, HEIGHT * 0.3 + Math.cos(t * 0.4) * 120, 1300, 0.34 * energy + kick * 0.1)}
      {blob(c2, WIDTH * 0.8 + Math.cos(t * 0.45) * 200, HEIGHT * 0.72 + Math.sin(t * 0.6) * 110, 1200, 0.3 * energy + kick * 0.08)}
      {blob(c3, WIDTH * 0.55 + Math.sin(t * 0.3 + 2) * 260, HEIGHT * 0.1 + Math.cos(t * 0.5) * 90, 1000, 0.22 * energy)}
      {blob('#FFFFFF', WIDTH / 2, HEIGHT / 2, 1400, drop * 0.25)}

      {/* Grid, radially masked so it melts into the edges */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          backgroundPosition: `${gridShift}px ${gridShift * 0.5}px`,
          opacity: gridAlpha,
          maskImage: 'radial-gradient(ellipse 70% 65% at 50% 50%, black 10%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 65% at 50% 50%, black 10%, transparent 75%)',
        }}
      />

      {/* Floating dust with parallax depth */}
      <svg width={WIDTH} height={HEIGHT} style={{ position: 'absolute', inset: 0 }}>
        {DUST.map((d, i) => {
          const y = (((d.y - f * d.speed * (0.6 + energy)) % HEIGHT) + HEIGHT) % HEIGHT;
          const x = d.x + Math.sin(t * 0.7 + d.phase) * 20 * d.depth;
          const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + d.phase));
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={d.r * (1 + kick * 0.4 * d.depth)}
              fill="#fff"
              opacity={tw * (0.15 + d.depth * 0.45) * (0.5 + energy * 0.5)}
            />
          );
        })}
      </svg>

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 85% 80% at 50% 50%, transparent 45%, rgba(0,0,0,0.75) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Film grain + subtle scanline shimmer, rendered above everything. */
export const Grain = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.09 }}>
      <svg width={WIDTH} height={HEIGHT}>
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={Math.floor(f / 2) % 50}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

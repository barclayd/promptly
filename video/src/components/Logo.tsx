import { Img, staticFile, useCurrentFrame } from 'remotion';
import { ease, pop, springs, tw } from '../lib/motion';

// The P in the logo is set as 41 rows of tiny text (512px source, ~4.8px pitch).
const P = { x0: 174, x1: 334, y0: 174, pitch: 4.82, rows: 41 };

type Props = {
  size: number;
  /** Frame the page pops in. Pass -999 to show immediately. */
  start: number;
  /** Frame the P rows start typing in. */
  pStart?: number;
  rowStagger?: number;
  rowDur?: number;
  sheenAt?: number;
  glow?: number;
};

export const Logo = ({
  size,
  start,
  pStart = start + 6,
  rowStagger = 0.45,
  rowDur = 7,
  sheenAt,
  glow = 0,
}: Props) => {
  const f = useCurrentFrame();
  const k = size / 512;
  const p = pop(f, start, springs.bouncy);
  const sheen = sheenAt === undefined ? -1 : tw(f, sheenAt, sheenAt + 18, 0, 1, ease.inOutCubic);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        transform: `scale(${p}) rotate(${(1 - p) * -14}deg)`,
        filter: glow > 0 ? `drop-shadow(0 0 ${40 * glow}px rgba(165,180,252,${0.6 * glow}))` : undefined,
      }}
    >
      <Img src={staticFile('img/logo-page.png')} style={{ position: 'absolute', inset: 0, width: size, height: size }} />
      {Array.from({ length: P.rows }, (_, r) => {
        const at = pStart + r * rowStagger;
        const w = tw(f, at, at + rowDur, 0, 1, ease.outQuint);
        if (w <= 0) return null;
        const top = (P.y0 + r * P.pitch) * k;
        return (
          <div
            key={r}
            style={{
              position: 'absolute',
              left: P.x0 * k,
              top,
              width: (P.x1 - P.x0) * k * w,
              height: P.pitch * k + 0.5,
              overflow: 'hidden',
            }}
          >
            <Img
              src={staticFile('img/logo-p.png')}
              style={{ position: 'absolute', left: -P.x0 * k, top: -top, width: size, height: size }}
            />
          </div>
        );
      })}
      {sheen > 0 && sheen < 1 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            maskImage: `url(${staticFile('img/logo-page.png')})`,
            WebkitMaskImage: `url(${staticFile('img/logo-page.png')})`,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
            background: `linear-gradient(110deg, transparent ${sheen * 160 - 40}%, rgba(255,255,255,0.9) ${sheen * 160 - 25}%, transparent ${sheen * 160 - 10}%)`,
            mixBlendMode: 'overlay',
          }}
        />
      ) : null}
    </div>
  );
};

/** Row geometry, exposed so the intro can fly text streams into the exact P rows. */
export const pRow = (r: number, size: number) => {
  const k = size / 512;
  return { x: P.x0 * k, y: (P.y0 + r * P.pitch) * k, w: (P.x1 - P.x0) * k, h: P.pitch * k };
};
export const P_ROWS = P.rows;

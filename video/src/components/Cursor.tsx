import { useCurrentFrame } from 'remotion';
import { ease, kf, pulse, tw } from '../lib/motion';

type Key = { f: number; x: number; y: number };

const posAt = (path: Key[], f: number) => {
  if (f <= path[0].f) return { x: path[0].x, y: path[0].y, v: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (f <= b.f) {
      const t = ease.inOutCubic((f - a.f) / (b.f - a.f));
      // Gentle arc so moves feel hand-driven rather than robotic.
      const arc = Math.sin(t * Math.PI) * Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      const v = Math.sin(t * Math.PI);
      return { x: a.x + (b.x - a.x) * t + (nx / len) * arc, y: a.y + (b.y - a.y) * t + (ny / len) * arc, v };
    }
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y, v: 0 };
};

export const Cursor = ({
  path,
  clicks = [],
  show = [path[0].f - 6, path[path.length - 1].f + 30],
  scale = 1.3,
}: {
  path: Key[];
  clicks?: number[];
  show?: [number, number];
  scale?: number;
}) => {
  const f = useCurrentFrame();
  const { x, y, v } = posAt(path, f);
  const vis = kf(f, [show[0], show[0] + 6, show[1] - 6, show[1]], [0, 1, 1, 0]);
  if (vis <= 0) return null;
  const press = clicks.reduce((m, c) => Math.max(m, kf(f, [c - 3, c, c + 5], [0, 1, 0])), 0);

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 50 }}>
      {clicks.map((c) => {
        const r = tw(f, c, c + 16, 0, 1, ease.outExpo);
        if (f < c || r >= 1) return null;
        const p = posAt(path, c);
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: p.x - 40,
              top: p.y - 40,
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: `${3 * (1 - r)}px solid rgba(255,255,255,${0.9 * (1 - r)})`,
              transform: `scale(${0.2 + r * 1.3})`,
              boxShadow: `0 0 30px rgba(165,180,252,${0.6 * pulse(f, c, 6)})`,
            }}
          />
        );
      })}
      <svg
        width={28 * scale}
        height={34 * scale}
        viewBox="0 0 28 34"
        style={{
          position: 'absolute',
          left: x - 3 * scale,
          top: y - 2 * scale,
          opacity: vis,
          transform: `scale(${1 - press * 0.18}) rotate(${-v * 6}deg)`,
          transformOrigin: '3px 2px',
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.45))',
        }}
      >
        <path
          d="M3 2 L3 26 L9.5 20 L14 30.5 L18.2 28.7 L13.8 18.5 L22.5 18.5 Z"
          fill="#fff"
          stroke="#0A0A0A"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

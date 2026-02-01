import { useEffect, useState } from 'react';

type ConfettiBurstProps = {
  active: boolean;
  className?: string;
};

const COLORS = [
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#22c55e', // green
  '#3b82f6', // blue
];

const PARTICLE_COUNT = 12;

type Particle = {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
  delay: number;
};

export const ConfettiBurst = ({ active, className }: ConfettiBurstProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (active) {
      const newParticles: Particle[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        newParticles.push({
          id: i,
          x: (Math.random() - 0.5) * 100,
          y: Math.random() * -60 - 20,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          rotation: Math.random() * 360,
          scale: 0.5 + Math.random() * 0.5,
          delay: Math.random() * 0.15,
        });
      }
      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
      }, 1500);

      return () => clearTimeout(timer);
    }
    setParticles([]);
  }, [active]);

  if (!active && particles.length === 0) return null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className || ''}`}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle absolute left-1/2 top-1/2"
          style={
            {
              '--x': `${p.x}px`,
              '--y': `${p.y}px`,
              '--rotation': `${p.rotation}deg`,
              '--scale': p.scale,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties
          }
        >
          <div
            className="size-2 rounded-sm"
            style={{ backgroundColor: p.color }}
          />
        </div>
      ))}
    </div>
  );
};

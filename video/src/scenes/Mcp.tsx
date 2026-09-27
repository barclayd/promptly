import { IconBolt, IconCode, IconEdit, IconMessageChatbot, IconPointer, IconSparkles, IconTerminal2 } from '@tabler/icons-react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Burst, Flash, Float, Shockwave } from '../components/Fx';
import { Logo } from '../components/Logo';
import { Panel } from '../components/ui';
import { ease, lerp, pop, pulse, springs, tw, typed } from '../lib/motion';
import { mono, stage, useTokens } from '../lib/theme';
import { TopTitle } from './TestPublish';

// 180 frames from DROP B (48s). Hub (0) → terminal (66) → tools (112) → activity (150).
const SPLIT = 62;
const TYPE = 76;
const TOOLS_AT = 112;
const ROW_AT = 150;
const E = 7.5; // eighth note

const CLIENTS = [
  { name: 'Claude Code', Icon: IconTerminal2, color: '#D97757' },
  { name: 'Cursor', Icon: IconPointer, color: '#E4E4E7' },
  { name: 'Codex', Icon: IconCode, color: '#10A37F' },
  { name: 'ChatGPT', Icon: IconMessageChatbot, color: '#74AA9C' },
  { name: 'Claude', Icon: IconSparkles, color: '#F0A68A' },
];

const TOOLS = [
  'create_prompt',
  'update_prompt',
  'test_prompt',
  'publish_prompt',
  'compare_tests',
  'validate_prompt',
  'create_composer',
  'test_composer',
  'publish_composer',
  'search_content',
  'list_changes',
  'restore_change',
];
const toolColor = (n: string) => (n.includes('composer') ? stage.violet : n.includes('prompt') || n.includes('tests') ? stage.indigo : stage.cyan);

const CMD = `claude mcp add-json promptly '{"type":"http","url":"https://app.promptlycms.com/mcp","oauth":{"scopes":"mcp:read mcp:write mcp:publish mcp:run"}}'`;

const R = 330;
const C = 450;

const Hub = () => {
  const f = useCurrentFrame();
  const pos = CLIENTS.map((_, i) => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    return { x: C + Math.cos(a) * R, y: C + Math.sin(a) * R };
  });
  return (
    <div style={{ position: 'relative', width: 900, height: 900 }}>
      <svg width={900} height={900} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {pos.map((p, i) => {
          const at = 4 + i * E;
          const draw = tw(f, at, at + 10, 0, 1, ease.outQuint);
          const len = R - 150;
          const ux = (p.x - C) / R;
          const uy = (p.y - C) / R;
          const x1 = C + ux * 130;
          const y1 = C + uy * 130;
          const x2 = C + ux * (130 + len * draw);
          const y2 = C + uy * (130 + len * draw);
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(165,180,252,0.35)" strokeWidth={3} strokeDasharray="8 10" strokeDashoffset={-f * 1.5} />
              {[0, 0.5].map((off) => {
                if (draw < 1) return null;
                // Packets travel both ways: requests in, responses out.
                const k = ((f - at) / 24 + off + random(`pk${i}`)) % 1;
                const dir = off ? 1 - k : k;
                const d = 130 + len * dir;
                return <circle key={off} cx={C + ux * d} cy={C + uy * d} r={6} fill={off ? stage.cyan : '#fff'} style={{ filter: `drop-shadow(0 0 10px ${off ? stage.cyan : '#A5B4FC'})` }} opacity={Math.sin(k * Math.PI)} />;
              })}
            </g>
          );
        })}
      </svg>
      {[0, 1, 2].map((k) => {
        const ph = ((f + k * 10) % 30) / 30;
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: C,
              top: C,
              width: 260,
              height: 260,
              borderRadius: 999,
              border: '2px solid rgba(165,180,252,0.5)',
              transform: `translate(-50%, -50%) scale(${0.8 + ph * 0.9})`,
              opacity: (1 - ph) * tw(f, 6, 14),
            }}
          />
        );
      })}
      <div style={{ position: 'absolute', left: C - 120, top: C - 130 }}>
        <Logo size={240} start={-2} pStart={1} rowStagger={0.25} rowDur={5} sheenAt={20} glow={0.5 + pulse(f, 0, 12)} />
      </div>
      {pos.map((p, i) => {
        const { name, Icon, color } = CLIENTS[i];
        const at = 4 + i * E;
        const pp = pop(f, at + 8, springs.jelly);
        const hot = name === 'Claude Code' ? pulse(f, ROW_AT - 4, 10) : 0;
        return (
          <div key={name} style={{ position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%, -50%) scale(${pp * (1 + hot * 0.25)})` }}>
            <div
              style={{
                width: 124,
                height: 124,
                borderRadius: 30,
                background: 'linear-gradient(160deg, #1C1C24, #0E0E14)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: `0 20px 50px rgba(0,0,0,0.6), 0 0 ${30 + hot * 60}px ${color}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
              }}
            >
              <Icon size={60} stroke={1.6} />
            </div>
            <div style={{ position: 'absolute', top: 138, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 24, fontWeight: 700, color: stage.white }}>{name}</div>
            <Burst x={62} y={62} at={at + 8} count={12} speed={9} life={14} colors={[color, '#fff']} seed={`cl${i}`} />
          </div>
        );
      })}
    </div>
  );
};

const Terminal = () => {
  const f = useCurrentFrame();
  const shown = typed(CMD, f, TYPE, 190);
  const done = shown.length === CMD.length;
  const urlStart = CMD.indexOf('https');
  const urlEnd = CMD.indexOf('/mcp') + 4;
  return (
    <div style={{ width: 760, borderRadius: 18, overflow: 'hidden', background: '#0B0B10', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 18px', background: '#15151C', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <span key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c }} />
        ))}
        <span style={{ flex: 1, textAlign: 'center', color: stage.dim, fontSize: 17, fontFamily: mono }}>~/acme-store — zsh</span>
      </div>
      <div style={{ padding: '20px 24px', fontFamily: mono, fontSize: 21, lineHeight: 1.55, color: stage.white, minHeight: 250, wordBreak: 'break-all' }}>
        <span style={{ color: '#34D399' }}>❯ </span>
        <span>{shown.slice(0, urlStart)}</span>
        <span style={{ color: stage.cyan }}>{shown.slice(urlStart, urlEnd)}</span>
        <span>{shown.slice(urlEnd)}</span>
        {!done ? <span style={{ display: 'inline-block', width: 11, height: 24, background: stage.white, verticalAlign: 'middle' }} /> : null}
        {f >= 104 ? <div style={{ color: stage.dim, marginTop: 10, opacity: tw(f, 104, 108) }}>Added HTTP MCP server promptly to local config</div> : null}
        {f >= 108 ? (
          <div style={{ color: '#34D399', fontWeight: 700, transform: `translateX(${(1 - pop(f, 108, springs.bouncy)) * -30}px)`, opacity: tw(f, 108, 112) }}>
            ✓ promptly connected · 12 tools
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const Mcp = () => {
  const f = useCurrentFrame();
  const t = useTokens();
  const split = tw(f, SPLIT, SPLIT + 16, 0, 1, ease.inOutExpo);
  const hubX = lerp(960, 530, split);
  const hubS = lerp(1, 0.8, split);
  const shake = pulse(f, 0, 7) * 18;
  const tp = pop(f, SPLIT + 6, springs.bouncy);
  const rp = pop(f, ROW_AT, springs.bouncy);
  return (
    <AbsoluteFill style={{ transform: `translate(${(random(`mx${f}`) - 0.5) * shake}px, ${(random(`my${f}`) - 0.5) * shake}px)` }}>
      <TopTitle n="13" label="MCP" text="Works where you work." accent={['you', 'work.']} grad={['#FBCFE8', '#EC4899']} at={3} />
      <div style={{ position: 'absolute', left: hubX, top: 620, transform: `translate(-50%, -50%) scale(${hubS})` }}>
        <Hub />
      </div>
      <Shockwave x={960} y={620} at={0} size={1600} />
      <Shockwave x={960} y={620} at={4} size={1000} color="rgba(236,72,153,0.8)" />
      <Burst x={960} y={620} at={0} count={50} speed={36} seed="dropB" />

      {f >= SPLIT ? (
        <div style={{ position: 'absolute', left: 1030, top: 260, transform: `translateX(${(1 - tp) * 900}px) rotate(${(1 - tp) * 6}deg)`, opacity: tw(f, SPLIT + 4, SPLIT + 10) }}>
          <Float rx={3} ry={-6} drift={0.5}>
            <Terminal />
          </Float>
        </div>
      ) : null}

      {f >= TOOLS_AT - 2 ? (
        <div style={{ position: 'absolute', left: 1030, top: 640, width: 780, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {TOOLS.map((n, i) => {
            const at = TOOLS_AT + i * 1.6;
            const p = pop(f, at, springs.jelly);
            const c = toolColor(n);
            return (
              <div
                key={n}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 12,
                  fontFamily: mono,
                  fontSize: 19,
                  color: stage.white,
                  background: `${c}26`,
                  border: `1px solid ${c}66`,
                  boxShadow: `0 0 ${24 * pulse(f, at + 2, 6)}px ${c}`,
                  transform: `translateY(${(1 - p) * 40}px) scale(${p})`,
                  opacity: Math.min(1, p * 2),
                }}
              >
                <IconBolt size={17} color={c} />
                {n}
              </div>
            );
          })}
        </div>
      ) : null}

      {f >= ROW_AT - 1 ? (
        <div style={{ position: 'absolute', left: 150, top: 950, transform: `translateY(${(1 - rp) * 80}px) scale(${0.9 + 0.1 * rp})`, transformOrigin: 'left center', opacity: tw(f, ROW_AT, ROW_AT + 5) }}>
          <Panel radius={16} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px', width: 760 }} glow={stage.pink}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(59,130,246,0.16)', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconEdit size={22} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>Product Description Writer · Edited</span>
              <span style={{ fontSize: 16, color: t.muted }}>
                via <b style={{ color: '#D97757' }}>Claude Code</b> · just now
              </span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#34D399', background: 'rgba(16,185,129,0.16)', padding: '4px 10px', borderRadius: 99 }}>Draft saved</span>
          </Panel>
        </div>
      ) : null}
      <Flash at={0} decay={3} max={0.85} />
    </AbsoluteFill>
  );
};


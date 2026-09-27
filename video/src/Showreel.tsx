import type { ComponentType } from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Background, Grain } from './components/Background';
import { Shot } from './components/Fx';
import { s } from './lib/motion';
import { stage } from './lib/theme';
import { ComposerShot } from './scenes/ComposerShot';
import { Explainer } from './scenes/Explainer';
import { ActivityShot, AnalyticsShot, SearchShot, ThemeShot } from './scenes/Insights';
import { Intro } from './scenes/Intro';
import { Mcp } from './scenes/Mcp';
import { CreateShot, EditShot, ModelShot, SchemaShot } from './scenes/Montage';
import { Outro } from './scenes/Outro';
import { CompareShot, PublishShot, TestShot } from './scenes/TestPublish';

type Move = 'whipL' | 'whipR' | 'zoomIn' | 'zoomOut' | 'rise' | 'drop' | 'flip' | 'fade' | 'none';

// Every shot starts on a downbeat; the +6 tail lets its exit overlap the next entrance.
const TAIL = 6;
const SHOTS: [ComponentType, number, number, Move, Move][] = [
  [Explainer, 10, 10, 'none', 'zoomIn'],
  [CreateShot, 20, 2, 'zoomIn', 'whipL'],
  [EditShot, 22, 2, 'whipL', 'flip'],
  [SchemaShot, 24, 2, 'flip', 'whipR'],
  [ModelShot, 26, 2, 'whipR', 'zoomOut'],
  [TestShot, 28, 4, 'zoomOut', 'rise'],
  [PublishShot, 32, 2, 'rise', 'whipL'],
  [CompareShot, 34, 2, 'whipL', 'zoomIn'],
  [ComposerShot, 36, 4, 'zoomIn', 'whipR'],
  [AnalyticsShot, 40, 2, 'whipR', 'flip'],
  [SearchShot, 42, 2, 'flip', 'drop'],
  [ActivityShot, 44, 2, 'drop', 'zoomIn'],
  [Mcp, 48, 6, 'none', 'none'],
  [Outro, 54, 6, 'none', 'none'],
];

// [hit time (s), sfx, volume]. Offsets below line each file's transient up with the hit.
const PEAK: Record<string, number> = {
  whoosh_in: 0.4405,
  whoosh_out: 0.029,
  swoosh_short: 0.0977,
  sparkle: 0.5438,
  success: 0.2561,
  riser_short: 0.9741,
  swipe: 0.1482,
  data_blips: 0.5143,
};
const ticks = (from: number, to: number, every = 0.12, vol = 0.22): [number, string, number][] =>
  Array.from({ length: Math.floor((to - from) / every) + 1 }, (_, i) => [from + i * every, `tick${(i % 4) + 1}`, vol]);

const SFX: [number, string, number][] = [
  // Intro
  [0.3, 'swoosh_short', 0.35],
  [1.0, 'swoosh_short', 0.35],
  [2.8, 'swoosh_short', 0.3],
  [4.0, 'impact_small', 0.5],
  [4.0, 'glitch', 0.45],
  [4.05, 'swipe', 0.3],
  [5.0, 'impact_small', 0.5],
  [5.0, 'glitch', 0.45],
  [6.0, 'impact_small', 0.5],
  [6.5, 'pop', 0.4],
  [7.0, 'impact_small', 0.55],
  [7.0, 'glitch', 0.55],
  [7.75, 'riser_short', 0.5],
  [8.0, 'impact_big', 0.55],
  [8.0, 'bass_drop', 0.4],
  [9.0, 'sparkle', 0.35],
  [10.0, 'whoosh_in', 0.55],
  // Explainer
  [10.05, 'pop', 0.45],
  [12.0, 'swoosh_short', 0.45],
  [12.05, 'pop2', 0.45],
  [12.53, 'tick1', 0.3],
  [12.73, 'tick2', 0.3],
  [12.93, 'tick3', 0.3],
  [14.0, 'swoosh_short', 0.45],
  [14.05, 'pop3', 0.45],
  [16.0, 'whoosh_out', 0.45],
  [18.0, 'impact_small', 0.6],
  [18.5, 'data_blips', 0.35],
  [20.0, 'whoosh_in', 0.6],
  // Create / Edit / Schema / Model
  ...ticks(20.27, 20.8),
  ...ticks(20.87, 21.5, 0.1, 0.16),
  [21.67, 'click', 0.7],
  [21.7, 'pop', 0.5],
  [22.0, 'swipe', 0.55],
  [22.4, 'pop2', 0.4],
  ...ticks(22.1, 23.4, 0.14, 0.16),
  [24.0, 'swoosh_short', 0.45],
  ...[24.2, 24.3, 24.4, 24.5].map((t, i): [number, string, number] => [t, ['pop3', 'pop2'][i % 2], 0.3]),
  [24.95, 'data_blips', 0.3],
  [26.0, 'swipe', 0.55],
  ...[26.27, 26.43, 26.6, 26.77].map((t, i): [number, string, number] => [t, `tick${i + 1}`, 0.35]),
  [26.93, 'click', 0.7],
  ...ticks(27.13, 27.67, 0.07, 0.14),
  // Test / Publish / Compare
  [28.0, 'impact_big', 0.7],
  [28.47, 'click', 0.7],
  [29.0, 'data_blips', 0.35],
  [31.47, 'success', 0.55],
  [32.0, 'swoosh_short', 0.45],
  [33.0, 'click', 0.7],
  [33.0, 'impact_small', 0.45],
  [33.05, 'success', 0.55],
  [34.0, 'swipe', 0.55],
  [34.35, 'riser_short', 0.25],
  [36.0, 'whoosh_in', 0.5],
  // Composer
  [36.0, 'impact_big', 0.7],
  [36.4, 'pop', 0.45],
  [36.63, 'pop2', 0.45],
  [36.87, 'pop3', 0.45],
  [37.5, 'click', 0.7],
  [37.7, 'data_blips', 0.3],
  [38.53, 'tick1', 0.35],
  [38.67, 'tick2', 0.35],
  [38.8, 'tick3', 0.35],
  [39.0, 'click', 0.7],
  [39.13, 'pop', 0.4],
  [39.27, 'pop2', 0.4],
  [39.4, 'pop3', 0.4],
  // Analytics / Search / Activity / Theme
  [40.0, 'swipe', 0.55],
  [40.6, 'data_blips', 0.35],
  [42.0, 'swoosh_short', 0.45],
  [42.27, 'click', 0.8],
  [42.4, 'click', 0.8],
  [42.55, 'swoosh_short', 0.35],
  ...ticks(42.73, 42.95, 0.04, 0.2),
  [43.27, 'tick1', 0.3],
  [43.53, 'tick2', 0.3],
  [44.0, 'swoosh_short', 0.45],
  ...ticks(44.2, 44.5, 0.075, 0.2),
  [46.0, 'whoosh_out', 0.4],
  [46.27, 'click', 0.7],
  [46.6, 'toggle', 0.8],
  ...[47.07, 47.27, 47.4, 47.5, 47.57, 47.62].map((t): [number, string, number] => [t, 'toggle', 0.45]),
  // MCP
  [48.0, 'impact_big', 0.45],
  [48.0, 'bass_drop', 0.4],
  ...[48.4, 48.65, 48.9, 49.15, 49.4].map((t, i): [number, string, number] => [t, ['pop', 'pop2', 'pop3'][i % 3], 0.45]),
  [50.07, 'whoosh_out', 0.45],
  ...ticks(50.53, 51.35, 0.07, 0.14),
  [51.6, 'success', 0.55],
  [51.8, 'data_blips', 0.35],
  [53.0, 'pop', 0.5],
  [54.0, 'whoosh_in', 0.5],
  // Outro
  [54.0, 'impact_small', 0.8],
  [54.5, 'impact_small', 0.8],
  [55.0, 'impact_small', 0.8],
  [55.5, 'impact_small', 0.85],
  [56.0, 'impact_big', 0.9],
  [56.2, 'sparkle', 0.5],
  [56.6, 'pop', 0.5],
];

export const Showreel = () => (
  <AbsoluteFill style={{ background: stage.bg }}>
    <Background />
    <Sequence durationInFrames={s(10)}>
      <Intro />
    </Sequence>
    {SHOTS.map(([C, at, len, enter, exit]) => {
      const dur = s(len) + (exit === 'none' ? 0 : TAIL);
      return (
        <Sequence key={at} from={s(at)} durationInFrames={dur}>
          <Shot dur={dur} enter={enter} exit={exit} inLen={enter === 'none' ? 1 : 10} push={len > 4 ? 0 : 0.04}>
            <C />
          </Shot>
        </Sequence>
      );
    })}
    {/* Theme ends on the snare roll; hard cut to black for the gap before DROP B. */}
    <Sequence from={s(46)} durationInFrames={Math.round(s(47.75)) - s(46)}>
      <Shot dur={60} enter="zoomIn" exit="none">
        <ThemeShot />
      </Shot>
    </Sequence>
    <Sequence from={Math.round(s(47.75))} durationInFrames={s(48) - Math.round(s(47.75))}>
      <AbsoluteFill style={{ background: '#000' }} />
    </Sequence>
    <Grain />
    <Audio src={staticFile('audio/music.wav')} />
    {SFX.map(([t, name, volume], i) => (
      <Sequence key={i} from={Math.max(0, Math.round((t - (PEAK[name] ?? 0)) * 30))} durationInFrames={s(3)}>
        <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

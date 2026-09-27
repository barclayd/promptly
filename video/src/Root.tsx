import { Composition } from 'remotion';
import { DURATION, FPS, HEIGHT, WIDTH } from './lib/theme';
import { Showreel } from './Showreel';

export const Root = () => (
  <Composition id="Showreel" component={Showreel} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
);

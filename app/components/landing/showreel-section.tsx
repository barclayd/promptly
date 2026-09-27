import {
  IconMaximize,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { AnimatedWrapper } from './animated-wrapper';

// Hosted on R2 (bucket: promptly-media), edge cached via media.promptlycms.com.
// Files are immutable - upload a re-cut under a new version folder instead.
const BASE = 'https://media.promptlycms.com/showreel/v1';

type AppleVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitPresentationMode?: string;
};

const play = (v: HTMLVideoElement) => v.play().catch(() => {}); // e.g. iOS Low Power Mode blocks autoplay

// Fullscreen or picture-in-picture: the native player owns playback, so
// scrolling the page underneath (e.g. on rotate) mustn't pause it.
const isDetached = (v: AppleVideo) =>
  document.fullscreenElement === v ||
  document.pictureInPictureElement === v ||
  (v.webkitPresentationMode ?? 'inline') !== 'inline';

// Apple's native player on iOS/iPadOS/macOS Safari (iPhone has no Fullscreen
// API; this is the one that rotates to landscape), the standard API elsewhere.
const enterFullscreen = (v: AppleVideo) => {
  try {
    if (v.webkitEnterFullscreen) {
      v.webkitEnterFullscreen(); // throws InvalidStateError if it can't
      return;
    }
  } catch {
    // fall through to the standard API
  }
  v.requestFullscreen?.().catch(() => {});
};

const DETACH_EVENTS = [
  'fullscreenchange',
  'webkitpresentationmodechanged',
  'enterpictureinpicture',
  'leavepictureinpicture',
];

const controlClass =
  'rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md hover:bg-black/75 hover:text-white';

export const ShowreelSection = () => {
  const video = useRef<AppleVideo>(null);
  const wantsPlay = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  // Autoplays while half on screen, and hands playback to the native player
  // while fullscreen or picture-in-picture.
  const attach = useCallback((v: AppleVideo | null) => {
    if (!v) return;
    video.current = v;
    v.muted = true; // React doesn't render the `muted` attribute, and autoplay needs it
    // Reduced motion: never autoplay, wait for an explicit play.
    wantsPlay.current = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let inView = false;

    const sync = () => {
      if (isDetached(v)) return;
      if (inView && wantsPlay.current) play(v);
      else v.pause();
    };
    const onDetachChange = () => {
      const detached = isDetached(v);
      v.controls = detached; // native controls while fullscreen, ours inline
      if (!detached) {
        wantsPlay.current = !v.paused; // respect a pause made in the native player
        sync();
      }
    };
    for (const ev of DETACH_EVENTS) v.addEventListener(ev, onDetachChange);

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: 0.5 },
    );
    observer.observe(v);

    return () => {
      observer.disconnect();
      for (const ev of DETACH_EVENTS) v.removeEventListener(ev, onDetachChange);
    };
  }, []);

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    wantsPlay.current = v.paused;
    if (v.paused) play(v);
    else v.pause();
  };

  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.paused) {
      wantsPlay.current = true;
      play(v);
    }
  };

  const expand = () => {
    const v = video.current;
    if (!v) return;
    wantsPlay.current = true;
    play(v);
    enterFullscreen(v);
  };

  return (
    <section
      id="demo"
      className="py-24 lg:py-32 bg-muted/30 overflow-hidden"
      aria-labelledby="showreel-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedWrapper className="text-center mb-12">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1.5 bg-indigo-500/10 border-indigo-200 dark:border-indigo-800"
          >
            <span className="text-indigo-600 dark:text-indigo-400">
              See it in action
            </span>
          </Badge>
          <h2
            id="showreel-heading"
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
          >
            Promptly in 60 seconds
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Write, test, compose and ship your prompts from one place.
          </p>
        </AnimatedWrapper>

        <AnimatedWrapper delay={200}>
          <div className="relative aspect-video overflow-hidden rounded-xl sm:rounded-2xl border bg-black shadow-2xl shadow-indigo-500/10">
            <video
              ref={attach}
              className="absolute inset-0 h-full w-full cursor-pointer"
              poster={`${BASE}/reel-poster.jpg`}
              muted
              loop
              playsInline
              preload="none"
              aria-label="Promptly product showreel"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              // Mute can also change from the native player's controls.
              onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
              // On touch, tapping a small inline video means "let me see it".
              onClick={() =>
                matchMedia('(pointer: coarse)').matches
                  ? expand()
                  : togglePlay()
              }
            >
              <source
                src={`${BASE}/reel-720.mp4`}
                type="video/mp4"
                media="(max-width: 767px)"
              />
              <source src={`${BASE}/reel-1080.mp4`} type="video/mp4" />
            </video>
            <div className="absolute right-3 bottom-3 flex gap-2 sm:right-4 sm:bottom-4">
              <Button
                size="icon"
                variant="ghost"
                className={controlClass}
                aria-label={playing ? 'Pause' : 'Play'}
                onClick={togglePlay}
              >
                {playing ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={controlClass}
                aria-label="Sound"
                aria-pressed={!muted}
                onClick={toggleSound}
              >
                {muted ? <IconVolumeOff /> : <IconVolume />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={controlClass}
                aria-label="Fullscreen"
                onClick={expand}
              >
                <IconMaximize />
              </Button>
            </div>
          </div>
        </AnimatedWrapper>
      </div>
    </section>
  );
};

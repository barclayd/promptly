import type * as React from 'react';
import { ShineText } from '~/components/ui/shine-text';
import { type DiffOp, isSpace } from '~/lib/prompt-diff';

const VAR_RE = /^\$\{[^}]+\}$/;

/**
 * Deterministic tiny PRNG from a string → stable per-token variation so the
 * marker looks hand-applied (non-uniform) but doesn't jitter between renders.
 */
const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

const Mark = ({
  text,
  idx,
  children,
}: {
  text: string;
  idx: number;
  children?: React.ReactNode;
}) => {
  const r1 = hashStr(`${text}:${idx}`);
  const r2 = hashStr(`a${idx}${text}`);
  const ang = 99 + Math.round(r1 * 14); // 99–113deg sweep
  const rot = (r2 * 1.8 - 0.9).toFixed(2); // -0.9 to +0.9 deg
  const s1 = (0.6 + r1 * 1.6).toFixed(1); // soft start stop
  const s2 = (95 + r2 * 3).toFixed(1); // soft end stop
  return (
    <mark
      className="cv-hl"
      style={
        {
          '--ang': `${ang}deg`,
          '--rot': `${rot}deg`,
          '--s1': `${s1}%`,
          '--s2': `${s2}%`,
        } as React.CSSProperties
      }
    >
      {children ?? text}
    </mark>
  );
};

type DiffTextProps = {
  ops: DiffOp[];
  /** Render without highlighter marks (full-text mode / baseline card). */
  plain?: boolean;
  /** Append a blinking cursor (streaming output). */
  streaming?: boolean;
};

/**
 * Renders a token op-list with hand-drawn highlighter marks over inserted
 * words. Deleted tokens are omitted; `${variable}` tokens keep the product's
 * shine treatment.
 */
export const DiffText = ({
  ops,
  plain = false,
  streaming = false,
}: DiffTextProps) => {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.type === 'delete') continue;

    const space = isSpace(op.text);

    // Variable token always gets the product's shine treatment
    if (VAR_RE.test(op.text)) {
      if (op.type === 'insert' && !plain) {
        out.push(
          <Mark key={i} text={op.text} idx={i}>
            <ShineText>{op.text}</ShineText>
          </Mark>,
        );
      } else {
        out.push(<ShineText key={i}>{op.text}</ShineText>);
      }
      continue;
    }

    if (op.type === 'insert' && !plain && !space) {
      out.push(<Mark key={i} text={op.text} idx={i} />);
    } else {
      out.push(<span key={i}>{op.text}</span>);
    }
  }
  return (
    <>
      {out}
      {streaming && <span className="cv-stream-cursor" />}
    </>
  );
};

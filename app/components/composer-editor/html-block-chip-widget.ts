import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';

type ChipKind = 'variable' | 'prompt';

class ChipWidget extends WidgetType {
  constructor(
    readonly kind: ChipKind,
    readonly label: string,
  ) {
    super();
  }

  eq(other: ChipWidget) {
    return other.kind === this.kind && other.label === this.label;
  }

  toDOM() {
    const wrapper = document.createElement('span');
    wrapper.className = `html-block-chip html-block-chip-${this.kind}`;
    wrapper.contentEditable = 'false';
    wrapper.dataset.chipKind = this.kind;
    wrapper.textContent = this.label;
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

const VARIABLE_REGEX =
  /<span\b[^>]*\bdata-variable-ref(?:="[^"]*")?[^>]*\bdata-field-path="([^"]+)"[^>]*><\/span>/g;
const VARIABLE_REGEX_ALT =
  /<span\b[^>]*\bdata-field-path="([^"]+)"[^>]*\bdata-variable-ref(?:="[^"]*")?[^>]*><\/span>/g;
const PROMPT_REGEX =
  /<span\b[^>]*\bdata-prompt-ref(?:="[^"]*")?[^>]*\bdata-prompt-name="([^"]+)"[^>]*><\/span>/g;
const PROMPT_REGEX_ALT =
  /<span\b[^>]*\bdata-prompt-name="([^"]+)"[^>]*\bdata-prompt-ref(?:="[^"]*")?[^>]*><\/span>/g;
// Fallback when name is missing — show id instead
const PROMPT_ID_REGEX =
  /<span\b[^>]*\bdata-prompt-ref(?:="[^"]*")?[^>]*\bdata-prompt-id="([^"]+)"[^>]*><\/span>/g;

const collectMatches = (
  source: string,
  regex: RegExp,
  kind: ChipKind,
): Array<{ from: number; to: number; widget: ChipWidget }> => {
  const out: Array<{ from: number; to: number; widget: ChipWidget }> = [];
  for (const match of source.matchAll(regex)) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    out.push({ from, to, widget: new ChipWidget(kind, match[1]) });
  }
  return out;
};

const buildDecorations = (view: EditorView): DecorationSet => {
  const text = view.state.doc.toString();
  const matches = [
    ...collectMatches(text, VARIABLE_REGEX, 'variable'),
    ...collectMatches(text, VARIABLE_REGEX_ALT, 'variable'),
    ...collectMatches(text, PROMPT_REGEX, 'prompt'),
    ...collectMatches(text, PROMPT_REGEX_ALT, 'prompt'),
  ];

  // Track ranges already covered by name-bearing prompt matches so we
  // don't double-decorate when the alt regex below also catches them.
  const covered = new Set<number>();
  for (const m of matches) covered.add(m.from);

  for (const m of collectMatches(text, PROMPT_ID_REGEX, 'prompt')) {
    if (!covered.has(m.from)) {
      matches.push(m);
      covered.add(m.from);
    }
  }

  matches.sort((a, b) => a.from - b.from);

  const builder = new RangeSetBuilder<Decoration>();
  let lastEnd = -1;
  for (const m of matches) {
    if (m.from < lastEnd) continue;
    builder.add(
      m.from,
      m.to,
      Decoration.replace({ widget: m.widget, inclusive: false }),
    );
    lastEnd = m.to;
  }
  return builder.finish();
};

export const chipDecorationsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of(
        (view) => view.plugin(plugin)?.decorations ?? Decoration.none,
      ),
  },
);

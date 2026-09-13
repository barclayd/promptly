# Landing Page

The landing page (`app/routes/landing.tsx`) is a marketing page with complex animations showcasing the product.

## Directory Structure
```
app/components/landing/
├── hero-section.tsx          # Main hero with copy + demo
├── hero-demo/
│   ├── index.ts              # Exports all demo components
│   ├── hero-demo-stack.tsx   # Window carousel orchestrator
│   ├── demo-window-frame.tsx # Reusable window chrome
│   ├── demo-editor-window.tsx
│   ├── demo-testing-window.tsx
│   ├── demo-ide-window.tsx
│   ├── demo-output-window.tsx
│   └── animations/
│       ├── typing-text.tsx   # Character-by-character typing
│       ├── blinking-cursor.tsx
│       ├── code-block.tsx    # Syntax-highlighted typing
│       ├── variable-badge.tsx
│       ├── confetti-burst.tsx
│       └── number-ticker.tsx # Animated counter
├── how-it-works/
│   ├── index.ts              # Exports step components
│   ├── how-it-works-step.tsx # Reusable step card with visual
│   ├── static-editor-window.tsx  # Static prompt editor preview
│   ├── static-ide-window.tsx     # Static code preview
│   └── animated-version-history.tsx # Version timeline animation
├── collaborative-editor-demo.tsx # Real-time collab demo (Solution section)
├── multi-language-ide-demo.tsx   # Language tabs IDE demo (Solution section)
├── animated-wrapper.tsx      # Scroll-triggered fade-in
├── social-proof-badge.tsx    # Avatar stack + rating
├── feature-card.tsx          # Feature grid cards
├── navigation.tsx
├── pain-points-section.tsx
├── solution-section.tsx      # Tab-based: Editors/Developers/Business
├── features-grid-section.tsx
├── how-it-works-section.tsx  # 3-step workflow with visual demos
├── audience-section.tsx
├── cost-section.tsx
├── social-proof-section.tsx
├── pricing-section.tsx
├── faq-section.tsx
└── footer-section.tsx
```

## Hero Section Architecture

The hero (`hero-section.tsx`) is a two-column layout:
- **Left column**: Animated copy with staggered entrance (badge → heading → paragraph → social proof → CTAs)
- **Right column**: `HeroDemoStack` - the rotating window carousel

All left-column elements use `AnimatedWrapper` with increasing delays (0ms → 400ms) for cascading fade-in.

## Hero Demo Stack (Window Carousel)

**File:** `app/components/landing/hero-demo/hero-demo-stack.tsx`

The centerpiece is a 4-window rotating carousel demonstrating the product workflow:

### Window Stack System
Windows are layered using CSS transforms based on position:
```
Position 0 (Front):     scale(1), rotate(0°)     - Active, full opacity
Position 1 (Back-Right): scale(0.92), rotate(2°)  - Partially visible
Position 2 (Back-Left):  scale(0.88), rotate(-2°) - Dimmed
Position 3 (Hidden):     scale(0.84), rotate(0°)  - Not visible
```

All transitions use `duration-500 ease-out`.

### Timing Constants
```typescript
WINDOW_DURATION = 10500  // Each window active for 10.5s
FINAL_WINDOW_PAUSE = 2000 // Extra pause after output window
WINDOW_COUNT = 4
```

### Window Cycle (repeats ~45s)
1. **Editor Window** (0-10.5s): Shows prompt being typed with variable badges
2. **Testing Window** (10.5-21s): Dropdown selections → run button → output preview
3. **IDE Window** (21-31.5s): Code typing with syntax highlighting
4. **Output Window** (31.5-44s): Word streaming + cost ticker + confetti

### State Management
- `activeIndex`: Which window is at position 0
- `isPaused`: Carousel pauses on hover
- Position calculation: `(windowIndex - activeIndex + WINDOW_COUNT) % WINDOW_COUNT`

### Reset Behavior
When a window becomes inactive, it resets its internal state after 600ms (allows exit animations to complete).

## Individual Window Animations

### DemoEditorWindow
- Segments typed at 40ms per character
- Variable badges appear with 530ms delay using `badge-pop` animation
- Auto-save indicator shows after typing completes

### DemoTestingWindow
Animation phases (sequential):
1. `select-company` → dropdown opens → value selected (1.3s)
2. `select-user` → dropdown opens → value selected (1.3s)
3. `select-plan` → dropdown opens → value selected (1.3s)
4. `click-run` → button highlights
5. `running` → spinner state
6. Output preview appears, 3s pause for reading

### DemoIdeWindow
- `CodeBlock` types at 24ms per character
- Syntax highlighting via token types (keywords=purple, strings=emerald, functions=yellow)
- Auto-scrolls during typing
- `onComplete` callback triggers next window

### DemoOutputWindow
- Words stream at 67ms intervals (word-by-word, not character)
- `NumberTicker` animates cost from $0 to final value
- `ConfettiBurst` triggers when complete (12 particles, 1.2s)
- Gets extra 2s pause due to longer animation

## Solution Section

**File:** `app/components/landing/solution-section.tsx`

Tab-based section showcasing the product for three audiences:

### Tab Structure
- **For Editors**: `CollaborativeEditorDemo` - shows real-time collaboration
- **For Developers**: `MultiLanguageIdeDemo` - shows SDK code in multiple languages
- **For Business**: Static cost overview visualization

### CollaborativeEditorDemo (`collaborative-editor-demo.tsx`)
Demonstrates real-time collaboration with multiple cursors:
- Three collaborators (Sarah, Alex, Jordan) with color-coded cursors
- Typing animation with cursor movement
- Label popups showing collaborator names
- Controlled by `isVisible` prop from parent tab state

### MultiLanguageIdeDemo (`multi-language-ide-demo.tsx`)
Shows SDK usage across different languages:
- Language tabs: TypeScript, Python, Go, Swift
- Syntax-highlighted code snippets for each language
- Copy button functionality
- Controlled by `isVisible` prop from parent tab state

## How It Works Section

**File:** `app/components/landing/how-it-works-section.tsx`

Three-step workflow with modular visual components:

### Component Structure
- `HowItWorksStep` - Reusable card with step number, title, description, and visual slot
- Step visuals are selected based on `visual` field in data:
  - `'editor'` → `StaticEditorWindow`
  - `'code'` → `StaticIdeWindow`
  - `'iterate'` → `AnimatedVersionHistory`

### StaticEditorWindow
Non-animated prompt editor preview showing:
- Window chrome (traffic lights)
- Prompt text with variable badges
- Auto-save indicator

### StaticIdeWindow
Non-animated IDE preview showing:
- Language tabs
- Syntax-highlighted TypeScript code
- SDK usage example

### AnimatedVersionHistory
Animated version timeline that cycles through versions:
- Shows 3 versions at a time, sliding in new versions
- "Live" badge with pulsing animation on current version
- `animate-version-slide-in` for entrance animation
- `animate-live-pulse` for live indicator

## Animation Utilities

### NumberTicker (`animations/number-ticker.tsx`)
Animated number counter with:
- `value`: Target number
- `from`: Starting number (default 0)
- `delay`: Delay before animation starts (default 0, only on first render)
- `duration`: Animation duration in ms (default 1000)
- Uses `requestAnimationFrame` with ease-out-cubic easing

### AnimatedWrapper (`animated-wrapper.tsx`)
Scroll-triggered fade-in wrapper:
```tsx
<AnimatedWrapper delay={100} direction="up">
  {content}
</AnimatedWrapper>
```
- Directions: `up` (default), `left`, `right`
- Uses `useInView` hook with IntersectionObserver
- `triggerOnce: true` - only animates once

### useInView Hook (`app/hooks/use-in-view.ts`)
Uses **ref callback pattern** (not useEffect) for intersection detection:
```tsx
const { ref, isInView } = useInView({ threshold: 0.1, triggerOnce: true });
```

## CSS Animations

**File:** `app/app.css`

Key keyframes:
```css
@keyframes fade-in-up        /* Section/element entrance */
@keyframes fade-in-left      /* Section entrance */
@keyframes fade-in-right     /* Section entrance */
@keyframes badge-pop         /* Bouncy scale 0→1.15→1 entrance */
@keyframes dropdown-slide    /* Dropdown: translateY(-8px)→0 */
@keyframes confetti-fall     /* Particle trajectory */
@keyframes label-enter       /* Label bounce in */
@keyframes label-exit        /* Label scale out */
@keyframes blink             /* Cursor blinking */
@keyframes version-slide-in  /* Version history: translateY(20px)→0 with overshoot */
@keyframes live-pulse        /* Pulsing glow for "live" badge */
@keyframes step-activate     /* Step number scale bounce */
@keyframes pulse-glow-red    /* Red pulsing box-shadow for urgency CTAs */
```

### Reusable animation classes
- `.animate-fade-in-up` — 0.6s ease-out, use with `opacity-0` initial state
- `.animate-badge-pop` — Bouncy scale entrance. **Initial state is built into the class** (`transform: scale(0); opacity: 0;`), so do NOT add Tailwind `opacity-0` or `scale-0` alongside it
- `.animate-pulse-glow-red` — Red pulsing glow for urgent CTAs (e.g., last-day trial warning)

### Staggered entrance pattern for modals/dialogs

Use this pattern for orchestrated modal entrances (see `trial-expiry-modal.tsx`, `upgrade-gate-modal.tsx`):

```typescript
// Helper to generate staggered animation delay styles
const stagger = (base: number, i: number, step = 60) => ({
  animationDelay: `${base + i * step}ms`,
  animationFillMode: 'forwards' as const,
});

// Usage: elements start invisible, animate in with increasing delays
<div className="opacity-0 animate-fade-in-up" style={stagger(80, 0)}>Title</div>
<div className="opacity-0 animate-fade-in-up" style={stagger(160, 0)}>Description</div>
{items.map((item, i) => (
  <div className="opacity-0 animate-fade-in-up" style={stagger(400, i)}>...</div>
))}
```

**Timing map example (trial expiry modal):**
- 0ms — Icon badge-pop
- 80ms — Title fade-in-up
- 160ms — Description fade-in-up
- 300ms — Date pill badge-pop
- 400ms+ — Content items stagger (60ms each)
- 700ms — CTA fade-in-up
- 800ms — Secondary CTA fade-in-up

### CSS animation gotcha: Tailwind utilities vs `animation-fill-mode: forwards`

**CRITICAL**: Never combine Tailwind utility classes (`opacity-0`, `scale-0`) with CSS animations that use `forwards` fill mode if the animation changes the same property via `transform`. Tailwind utilities can override the animation's final state due to CSS specificity.

**Wrong:**
```tsx
// Tailwind's opacity-0 overrides the animation's final opacity: 1
<div className="opacity-0 scale-0 animate-badge-pop" style={stagger(0, 0)}>
```

**Right — for fade-in-up** (uses `opacity` property, which Tailwind's `opacity-0` matches):
```tsx
// Works because animate-fade-in-up animates opacity directly
// and animationFillMode: 'forwards' holds the final state
<div className="opacity-0 animate-fade-in-up" style={stagger(80, 0)}>
```

**Right — for badge-pop** (initial state baked into the CSS class):
```tsx
// .animate-badge-pop already sets transform: scale(0); opacity: 0;
// No Tailwind utilities needed — just apply the class
<div className="animate-badge-pop" style={stagger(0, 0)}>
```

**Why it works differently:** `animate-fade-in-up` animates `opacity` and `transform` as separate properties, and Tailwind's `opacity-0` gets overridden by the animation's `forwards` fill. But `animate-badge-pop` uses `transform: scale()` in its keyframes — if you also apply Tailwind's `scale-0` (which uses the separate `scale` CSS property, not `transform`), they don't interact and the animation can't override it.

**Rule of thumb:** If a CSS animation class needs specific initial state, define that initial state **in the CSS class itself** (like `.animate-badge-pop` does), not via Tailwind utilities.

### NumberTicker for tangible numbers

The `NumberTicker` component (`~/components/landing/hero-demo/animations/number-ticker`) animates a number from 0 to a target value. Reuse it anywhere you want numbers to feel tangible:

```tsx
<NumberTicker value={283} duration={800} delay={460} />
```

Good for: loss counts in warning modals, usage statistics, pricing numbers.

## Making Changes Safely

### Adding a new section
1. Create component in `app/components/landing/`
2. Import and add to `app/routes/landing.tsx`
3. Wrap content in `AnimatedWrapper` for entrance animation

### Modifying window animations
1. Each window manages its own animation state internally
2. Windows receive `isActive` prop from `HeroDemoStack`
3. Use `onComplete` callback to signal animation finished
4. Reset state when `isActive` becomes false (with 600ms delay)

### Adjusting timing
- **Window duration**: Change `WINDOW_DURATION` in `hero-demo-stack.tsx`
- **Transition speed**: Modify `duration-500` classes on window containers
- **Typing speed**: Adjust `charDelay` prop on `TypingText`/`CodeBlock`
- **NumberTicker speed**: Use `duration` and `delay` props

### Adding new animations
1. Define keyframes in `app/app.css`
2. Add Tailwind animation class in the CSS file
3. Apply class conditionally based on component state

## Performance Notes
- `useInView` with `triggerOnce` prevents re-triggering animations
- Carousel pauses on hover to reduce animation load
- All timeouts are cleaned up on unmount
- CSS transforms are GPU-accelerated (scale, rotate, translate)

## Mobile Overflow Prevention

The landing page uses multiple layers of overflow protection to prevent horizontal scrolling on mobile (especially iOS Safari):

**Root-level protection** (`app/app.css`):
```css
html,
body {
  @apply h-full bg-background;
  overflow-x: hidden;
}
```

**Page-level protection** (`app/routes/landing.tsx`):
```tsx
<div className="min-h-screen bg-background overflow-x-hidden">
```

**Common overflow culprits to watch for:**
1. **Large background blur elements** - Gradients with fixed widths (e.g., `w-[600px]`) can extend beyond viewport
2. **Code blocks with `overflow-x-auto`** - Change to `overflow-hidden` for demo code that doesn't need scrolling
3. **Absolute/fixed positioned elements** - Check that they're properly contained

**Testing mobile overflow:**
```js
// Run in Chrome DevTools at 375px width
const hasOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
console.log('Has horizontal overflow:', hasOverflow,
  'Difference:', document.documentElement.scrollWidth - document.documentElement.clientWidth);
```

**Verification checklist:**
1. Test at 375px (iPhone) and 320px (smallest common mobile)
2. Test both light and dark modes
3. Scroll entire page - no horizontal scroll should be possible


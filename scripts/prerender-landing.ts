/**
 * Pre-render the landing page as a static asset.
 *
 * This script fetches the landing page HTML from a local wrangler dev server,
 * applies performance optimizations (critical CSS inlining, modulepreload
 * stripping, resource hints), and saves it to build/client/index.html.
 *
 * Usage:
 *   bun run scripts/prerender-landing.ts
 *
 * Prerequisites:
 *   Run `bun run build && bunx wrangler dev` first (port 8787)
 *
 * After running, deploy with `bunx wrangler deploy` to upload the static asset.
 */

import Beasties from 'beasties';

// IMPORTANT: Always pre-render from local wrangler dev (8787).
// - Do NOT use Vite dev server (5173) — it injects HMR scripts that break in production.
// - Do NOT fetch from production — promptlycms.com serves the Pages static site,
//   so fetching from it is circular and may capture Cloudflare edge modifications.
const targetUrl = 'http://localhost:8787/';
const buildClientPath = './build/client';

// Modulepreload links to keep (entry point and its direct deps)
const KEEP_MODULEPRELOAD_PATTERNS = [
  /entry\.client/,
  /jsx-runtime/,
  /jsx-dev-runtime/,
  /root-/,
  /landing-/,
  /chunk-/,
];

/**
 * Strip non-essential <link rel="modulepreload"> tags.
 * Keeps only entry.client, jsx-runtime, root, and landing chunks.
 * The rest load on-demand during hydration.
 */
const stripModulepreloads = (html: string): string => {
  return html.replace(
    /<link\s+rel="modulepreload"[^>]*href="([^"]*)"[^>]*\/?>/gi,
    (match, href: string) => {
      const filename = href.split('/').pop() ?? '';
      const keep = KEEP_MODULEPRELOAD_PATTERNS.some((pattern) =>
        pattern.test(filename),
      );
      return keep ? match : '';
    },
  );
};

/**
 * Fix React Router's fog-of-war lazy route discovery.
 * Replace "mode":"lazy" with "mode":"initial" in __reactRouterContext
 * and strip data-discover attributes — the static Pages deployment
 * has no server to serve /__manifest requests.
 */
const fixRouteDiscovery = (html: string): string => {
  // Fix the route discovery mode in the serialized context
  let result = html.replace(
    /"routeDiscovery"\s*:\s*\{\s*"mode"\s*:\s*"lazy"\s*\}/g,
    '"routeDiscovery":{"mode":"initial"}',
  );
  // Strip data-discover attributes from links
  result = result.replace(/\s+data-discover="true"/g, '');
  return result;
};

/**
 * Remove below-fold image preloads (user avatar images).
 * Keep logo preloads which are above-fold.
 */
const stripBelowFoldPreloads = (html: string): string => {
  return html.replace(
    /<link\s+rel="preload"\s+as="image"[^>]*href="[^"]*user-[^"]*"[^>]*\/?>/gi,
    '',
  );
};

/**
 * Add missing resource hints for the image CDN.
 */
const addResourceHints = (html: string): string => {
  const hints = [
    '<link rel="preconnect" href="https://images.keepfre.sh"/>',
    '<link rel="dns-prefetch" href="https://images.keepfre.sh"/>',
  ];

  // Insert before the first <link> tag in <head>
  const insertPoint = html.indexOf('<link');
  if (insertPoint === -1) return html;
  return `${html.slice(0, insertPoint)}${hints.join('\n    ')}\n    ${html.slice(insertPoint)}`;
};

/**
 * Inject @font-face into the inline critical CSS.
 * Beasties doesn't extract @font-face rules, so the font definition
 * only applies when the deferred external stylesheet loads — causing
 * a font swap that shifts every text element on the page (high CLS).
 *
 * We use font-display: optional here so the browser either uses Inter
 * immediately (font is preloaded, so it's usually available) or stays
 * on the system fallback with zero layout shift.
 */
const inlineFontFace = (html: string): string => {
  const fontFaceRule = `@font-face{font-family:"Inter";font-style:normal;font-weight:100 900;font-display:optional;src:url("/fonts/inter-latin.woff2") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`;

  // Prepend to the first inline <style> block that Beasties created
  return html.replace(/<style>([\s\S]*?)<\/style>/, (_match, content) => {
    return `<style>${fontFaceRule}${content}</style>`;
  });
};

/**
 * Clean up empty lines left by stripped tags.
 */
const cleanEmptyLines = (html: string): string => {
  return html.replace(/\n\s*\n\s*\n/g, '\n\n');
};

const main = async () => {
  console.log(`\n🚀 Pre-rendering landing page from: ${targetUrl}\n`);

  // Fetch the landing page HTML
  console.log('📥 Fetching HTML...');
  const response = await fetch(targetUrl, {
    headers: {
      // Request as a new visitor (no session cookie)
      'User-Agent': 'Prerender-Bot/1.0',
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    console.error(
      `❌ Failed to fetch: ${response.status} ${response.statusText}`,
    );
    process.exit(1);
  }

  let html = await response.text();
  console.log(`✅ Fetched ${html.length.toLocaleString()} bytes\n`);

  // Validate it looks like a valid landing page
  if (!html.includes('<!DOCTYPE html>') || !html.includes('Promptly')) {
    console.error('❌ Response does not look like a valid landing page');
    process.exit(1);
  }

  // --- Phase 1a: Critical CSS inlining with Beasties ---
  console.log('🎨 Inlining critical CSS...');
  const beasties = new Beasties({
    path: buildClientPath,
    preload: 'media',
    compress: true,
    keyframes: 'critical',
    inlineFonts: false,
    pruneSource: false,
    reduceInlineStyles: true,
  });
  html = await beasties.process(html);
  console.log('✅ Critical CSS inlined\n');

  // --- Phase 1b: Strip non-essential modulepreload links ---
  console.log('📦 Stripping non-essential modulepreloads...');
  const modulepreloadsBefore = (html.match(/rel="modulepreload"/g) ?? [])
    .length;
  html = stripModulepreloads(html);
  const modulepreloadsAfter = (html.match(/rel="modulepreload"/g) ?? []).length;
  console.log(
    `✅ Modulepreloads: ${modulepreloadsBefore} → ${modulepreloadsAfter}\n`,
  );

  // --- Phase 1c: Fix /__manifest request flood ---
  console.log('🗺️  Fixing route discovery mode...');
  html = fixRouteDiscovery(html);
  console.log('✅ Route discovery set to "initial"\n');

  // --- Phase 1d: Remove below-fold image preloads ---
  console.log('🖼️  Removing below-fold image preloads...');
  html = stripBelowFoldPreloads(html);
  console.log('✅ Below-fold preloads removed\n');

  // --- Phase 1e: Add missing resource hints ---
  console.log('🔗 Adding resource hints...');
  html = addResourceHints(html);
  console.log('✅ Resource hints added\n');

  // --- Phase 1f: Inline @font-face into critical CSS ---
  console.log('🔤 Inlining @font-face into critical CSS...');
  html = inlineFontFace(html);
  console.log('✅ @font-face inlined (font-display: optional)\n');

  // Final cleanup
  html = cleanEmptyLines(html);

  // Save to build/client/index.html for direct CDN serving
  const staticAssetPath = `${buildClientPath}/index.html`;
  await Bun.write(staticAssetPath, html);
  console.log(`💾 Saved to ${staticAssetPath}`);

  console.log(`\n✅ Pre-rendered landing page ready!`);
  console.log(`   Path: ${staticAssetPath}`);
  console.log(`   Size: ${(html.length / 1024).toFixed(1)} KB`);
  console.log(`\n📌 Next step: Run 'bunx wrangler deploy' to upload\n`);
};

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

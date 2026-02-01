/**
 * Pre-render the landing page as a static asset.
 *
 * This script fetches the landing page HTML from a running server
 * and saves it to build/client/index.html for direct CDN serving.
 *
 * Usage:
 *   bun run scripts/prerender-landing.ts [--local|--production]
 *
 * Prerequisites:
 *   - Local: Run `bun run build && bunx wrangler dev` first (port 8787)
 *   - Production: Deploy first, then run with --production flag
 *
 * Options:
 *   --local       Fetch from localhost:8787 (wrangler dev) - default
 *   --production  Fetch from production URL
 *
 * After running, deploy with `bunx wrangler deploy` to upload the static asset.
 */

// IMPORTANT: Use wrangler dev (8787) NOT Vite dev server (5173)
// Vite serves development HTML with HMR scripts that won't work in production
const LANDING_URL_LOCAL = 'http://localhost:8787/';
const LANDING_URL_PROD = 'https://promptlycms.com/';

const isProduction = process.argv.includes('--production');
const targetUrl = isProduction ? LANDING_URL_PROD : LANDING_URL_LOCAL;

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

  const html = await response.text();
  console.log(`✅ Fetched ${html.length.toLocaleString()} bytes\n`);

  // Validate it looks like a valid landing page
  if (!html.includes('<!DOCTYPE html>') || !html.includes('Promptly')) {
    console.error('❌ Response does not look like a valid landing page');
    process.exit(1);
  }

  // Save to build/client/index.html for direct CDN serving
  const staticAssetPath = './build/client/index.html';
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

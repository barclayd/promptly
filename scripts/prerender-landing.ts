/**
 * Pre-render the landing page and upload to Cloudflare KV.
 *
 * This script fetches the landing page HTML from a running server
 * and uploads it to KV for instant serving to unauthenticated users.
 *
 * Usage:
 *   bun run scripts/prerender-landing.ts [--local|--production]
 *
 * Prerequisites:
 *   - Local: Run `bun run build && bunx wrangler dev` first (port 8787)
 *   - Production: Deploy first, then run with --production flag
 *
 * Options:
 *   --local       Fetch from localhost:8787 (wrangler dev) and upload to local KV (default)
 *   --production  Fetch from production URL and upload to production KV
 */

// IMPORTANT: Use wrangler dev (8787) NOT Vite dev server (5173)
// Vite serves development HTML with HMR scripts that won't work in production
const LANDING_URL_LOCAL = 'http://localhost:8787/';
const LANDING_URL_PROD = 'https://promptlycms.com/';
const KV_KEY = 'landing-page';

const isProduction = process.argv.includes('--production');
const targetUrl = isProduction ? LANDING_URL_PROD : LANDING_URL_LOCAL;

const main = async () => {
  console.log(`\n🚀 Pre-rendering landing page from: ${targetUrl}\n`);

  // Clear existing KV entry first to force SSR fallback
  // This ensures we capture fresh HTML, not stale pre-rendered content
  console.log('🗑️  Clearing existing KV entry...');
  const kvFlag = isProduction ? '' : '--local';
  const deleteProc = Bun.spawn(
    [
      'bunx',
      'wrangler',
      'kv',
      'key',
      'delete',
      '--binding=PRERENDER_CACHE',
      KV_KEY,
      ...(kvFlag ? [kvFlag] : []),
    ],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  await deleteProc.exited;
  // Ignore delete errors (key may not exist)

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

  // Save to a local file for inspection
  const outputPath = './build/prerendered-landing.html';
  await Bun.write(outputPath, html);
  console.log(`💾 Saved to ${outputPath}\n`);

  // Upload to KV using wrangler
  console.log('☁️  Uploading to Cloudflare KV...');
  const proc = Bun.spawn(
    [
      'bunx',
      'wrangler',
      'kv',
      'key',
      'put',
      '--binding=PRERENDER_CACHE',
      KV_KEY,
      '--path',
      outputPath,
      ...(kvFlag ? [kvFlag] : []),
    ],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`❌ Failed to upload to KV (exit code: ${exitCode})`);
    process.exit(1);
  }

  console.log(`\n✅ Successfully pre-rendered and uploaded to KV!`);
  console.log(`   Key: ${KV_KEY}`);
  console.log(`   Size: ${(html.length / 1024).toFixed(1)} KB`);
  console.log(`   Environment: ${isProduction ? 'production' : 'local'}\n`);
};

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

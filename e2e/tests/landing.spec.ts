import { expect, test } from '@playwright/test';

test('landing page displays for unauthenticated users', async ({ page }) => {
  await page.goto('/');

  // Should see the hero section
  await expect(
    page.getByRole('heading', {
      name: /your prompts don't belong in your codebase/i,
    }),
  ).toBeVisible();

  // Should see the navigation (in header)
  const nav = page.getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'P Promptly' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Start free' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Log in' }).first(),
  ).toBeVisible();

  // Should see section headings
  await expect(
    page.getByRole('heading', { name: /the pain of prompts in code/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /prompts deserve their own home/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /everything you need/i }),
  ).toBeVisible();
});

test('landing page navigation links work', async ({ page }) => {
  await page.goto('/');

  // Target the header navigation specifically
  const nav = page.getByRole('navigation');

  // Click on Features link in header nav
  await nav.getByRole('link', { name: 'Features' }).click();
  await expect(page).toHaveURL(/#features/);

  // Click on Pricing link
  await nav.getByRole('link', { name: 'Pricing' }).click();
  await expect(page).toHaveURL(/#pricing/);

  // Click on FAQ link
  await nav.getByRole('link', { name: 'FAQ' }).click();
  await expect(page).toHaveURL(/#faq/);
});

test('pricing section displays three tiers', async ({ page }) => {
  await page.goto('/');

  // Scroll to pricing section
  await page
    .getByRole('heading', { name: /simple, transparent pricing/i })
    .scrollIntoViewIfNeeded();

  // Should see three pricing tiers
  await expect(
    page.getByRole('heading', { name: 'Free', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Pro', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Team', exact: true }),
  ).toBeVisible();

  // Popular badge on Pro tier
  await expect(page.getByText('Most Popular')).toBeVisible();
});

test('FAQ accordion expands and collapses', async ({ page }) => {
  await page.goto('/');

  // Scroll to FAQ section
  const faqSection = page.getByRole('heading', {
    name: /frequently asked questions/i,
  });
  await faqSection.scrollIntoViewIfNeeded();

  // Find the first FAQ trigger
  const firstFaq = page.getByRole('button', {
    name: /what is promptly/i,
  });
  await expect(firstFaq).toBeVisible();

  // Click to expand
  await firstFaq.click();

  // Content should be visible
  await expect(
    page.getByText(/prompt management platform that lets teams create/i),
  ).toBeVisible();

  // Click to collapse
  await firstFaq.click();

  // Content should be hidden (accordion collapses)
  await expect(
    page.getByText(/prompt management platform that lets teams create/i),
  ).toBeHidden();
});

test('CTA buttons link to signup and login', async ({ page }) => {
  await page.goto('/');

  // Check Start free button in hero links to signup (external app subdomain)
  const heroStartFree = page.getByRole('link', { name: 'Start free' }).first();
  await expect(heroStartFree).toHaveAttribute(
    'href',
    'https://app.promptlycms.com/sign-up',
  );

  // Check Log in button links to login (external app subdomain)
  const loginButton = page.getByRole('link', { name: 'Log in' }).first();
  await expect(loginButton).toHaveAttribute(
    'href',
    'https://app.promptlycms.com/login',
  );
});

test('mobile menu opens and closes', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');

  // Mobile menu button should be visible
  const menuButton = page.getByRole('button', { name: 'Open menu' });
  await expect(menuButton).toBeVisible();

  // Click to open mobile menu
  await menuButton.click();

  // Mobile menu overlay should show nav links (using second navigation region)
  const mobileNav = page.getByRole('navigation').nth(1);
  await expect(
    mobileNav.getByRole('link', { name: /Features/i }),
  ).toBeVisible();
  await expect(mobileNav.getByRole('link', { name: /Pricing/i })).toBeVisible();

  // Close button should be visible
  const closeButton = page.getByRole('button', { name: 'Close menu' }).first();
  await expect(closeButton).toBeVisible();

  // Click to close
  await closeButton.click();

  // Mobile menu should be closed - the overlay becomes pointer-events-none
  // Wait for animation to complete, then verify menu button is clickable again
  await page.waitForTimeout(600);
  await expect(menuButton).toBeVisible();
  // Clicking menu button should reopen the menu (proves it's closed)
  await menuButton.click();
  await expect(
    mobileNav.getByRole('link', { name: /Features/i }),
  ).toBeVisible();
});

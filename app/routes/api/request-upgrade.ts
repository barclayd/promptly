import { render } from '@react-email/render';
import { nanoid } from 'nanoid';
import { data } from 'react-router';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { z } from 'zod';
import { orgContext, sessionContext } from '~/context';
import { UpgradeRequestEmail } from '~/emails/upgrade-request';
import { getResourceCounts } from '~/lib/subscription.server';
import type { Route } from './+types/request-upgrade';

const requestUpgradeSchema = z.object({
  context: z.string().max(50).default('general'),
  personalNote: z.string().max(280).optional(),
});

interface AdminRow {
  id: string;
  name: string;
  email: string;
}

interface SubscriptionRow {
  stripe_customer_id: string | null;
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();
  const rawData = {
    context: formData.get('context') ?? 'general',
    personalNote: formData.get('personalNote') || undefined,
  };

  const result = requestUpgradeSchema.safeParse(rawData);
  if (!result.success) {
    return data({ success: false, error: 'Invalid request' }, { status: 400 });
  }

  const session = context.get(sessionContext);
  if (!session?.user) {
    return data(
      { success: false, error: 'Not authenticated' },
      { status: 401 },
    );
  }

  const org = context.get(orgContext);
  if (!org) {
    return data(
      { success: false, error: 'No organization found' },
      { status: 400 },
    );
  }

  const db = context.cloudflare.env.promptly;
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  // Rate limit: 1 email per org per 24h
  const recentRequest = await db
    .prepare(
      `SELECT id FROM upgrade_request
       WHERE organization_id = ? AND sent_at > ? AND status = 'pending'
       LIMIT 1`,
    )
    .bind(org.organizationId, twentyFourHoursAgo)
    .first<{ id: string }>();

  if (recentRequest) {
    // Still store the request for tracking, but don't send another email
    await db
      .prepare(
        `INSERT INTO upgrade_request (id, organization_id, requester_user_id, admin_user_id, context, personal_note, status, created_at, updated_at)
         VALUES (?, ?, ?, '', ?, ?, 'pending', ?, ?)`,
      )
      .bind(
        nanoid(),
        org.organizationId,
        session.user.id,
        result.data.context,
        result.data.personalNote ?? null,
        now,
        now,
      )
      .run();

    return data({ success: true, alreadyNotified: true });
  }

  // Find org owner (or first admin)
  const admin = await db
    .prepare(
      `SELECT u.id, u.name, u.email FROM member m JOIN user u ON u.id = m.user_id
       WHERE m.organization_id = ? AND m.role IN ('owner', 'admin')
       ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END LIMIT 1`,
    )
    .bind(org.organizationId)
    .first<AdminRow>();

  if (!admin) {
    return data({ success: false, error: 'No admin found' }, { status: 400 });
  }

  // Get resource counts for the email
  const resourceCounts = await getResourceCounts(db, org.organizationId);

  // Pre-generate Stripe Checkout URL
  const env = context.cloudflare.env;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Get or create Stripe customer
  const subscriptionRow = await db
    .prepare(
      'SELECT stripe_customer_id FROM subscription WHERE organization_id = ? LIMIT 1',
    )
    .bind(org.organizationId)
    .first<SubscriptionRow>();

  let customerId = subscriptionRow?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: admin.email,
      name: admin.name,
      metadata: { userId: admin.id, organizationId: org.organizationId },
    });
    customerId = customer.id;
  }

  const baseURL = env.BETTER_AUTH_URL;
  let checkoutUrl: string;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${baseURL}/dashboard?upgraded=true`,
      cancel_url: `${baseURL}/settings`,
      expires_at: Math.floor(now / 1000) + 24 * 60 * 60, // 24h expiry
      metadata: {
        userId: admin.id,
        plan: 'pro',
        organizationId: org.organizationId,
      },
    });
    checkoutUrl = checkoutSession.url ?? `${baseURL}/settings`;
  } catch (error) {
    console.error('Failed to create Stripe checkout session:', error);
    return data(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }

  // Store the upgrade request
  const requestId = nanoid();
  await db
    .prepare(
      `INSERT INTO upgrade_request (id, organization_id, requester_user_id, admin_user_id, context, personal_note, status, checkout_url, sent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    )
    .bind(
      requestId,
      org.organizationId,
      session.user.id,
      admin.id,
      result.data.context,
      result.data.personalNote ?? null,
      checkoutUrl,
      now,
      now,
      now,
    )
    .run();

  // Render and send email
  const resendApiKey = env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.log('Resend API key not configured, skipping email');
    console.log('Checkout URL:', checkoutUrl);
    return data({ success: true, alreadyNotified: false });
  }

  try {
    const emailHtml = await render(
      UpgradeRequestEmail({
        adminName: admin.name ?? 'there',
        requesterName: session.user.name ?? 'A team member',
        requesterEmail: session.user.email,
        personalNote: result.data.personalNote,
        workspaceName: org.organizationName,
        promptCount: resourceCounts.promptCount,
        memberCount: resourceCounts.memberCount,
        freeLimits: { prompts: 3, members: 1 },
        context: result.data.context,
        checkoutUrl,
        settingsUrl: `${baseURL}/settings`,
      }),
    );

    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: 'Promptly <hello@info.promptlycms.com>',
      to: admin.email,
      subject: `${session.user.name ?? 'A team member'} requested a Pro upgrade`,
      html: emailHtml,
    });
  } catch (error) {
    console.error('Failed to send upgrade request email:', error);
    // Don't fail the request — the upgrade_request record is already stored
  }

  return data({ success: true, alreadyNotified: false });
};

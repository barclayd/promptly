import { render } from '@react-email/render';
import { betterAuth } from 'better-auth';
import { apiKey, organization } from 'better-auth/plugins';
import { CamelCasePlugin, Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { RouterContextProvider } from 'react-router';
import { Resend } from 'resend';
import { InvitationEmail } from '~/emails/invitation';
import { UpgradeConfirmedEmail } from '~/emails/upgrade-confirmed';
import { trialStripe } from '~/plugins/trial-stripe';
import { hashPassword, verifyPassword } from './password.server';

type Database = Record<string, string>;

export const getAuth = (ctx: Readonly<RouterContextProvider>) => {
  const baseURL = ctx.cloudflare.env.BETTER_AUTH_URL;
  const resendApiKey = ctx.cloudflare.env.RESEND_API_KEY;

  return betterAuth({
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    baseURL,
    trustedOrigins: [baseURL],
    socialProviders: {
      google: {
        clientId: ctx.cloudflare.env.GOOGLE_CLIENT_ID,
        clientSecret: ctx.cloudflare.env.GOOGLE_CLIENT_SECRET,
      },
    },
    secret: ctx.cloudflare.env.BETTER_AUTH_SECRET,
    database: {
      db: new Kysely<Database>({
        dialect: new D1Dialect({ database: ctx.cloudflare.env.promptly }),
        plugins: [new CamelCasePlugin()],
      }),
      type: 'sqlite',
    },
    plugins: [
      apiKey({
        defaultPrefix: 'promptly_',
        enableMetadata: true,
        rateLimit: {
          enabled: false,
        },
        startingCharactersConfig: {
          // Store prefix (9 chars) + 4 unique characters = 13 total
          charactersLength: 13,
        },
      }),
      trialStripe({
        stripeSecretKey: ctx.cloudflare.env.STRIPE_SECRET_KEY,
        stripeWebhookSecret: ctx.cloudflare.env.STRIPE_WEBHOOK_SECRET,
        trial: { days: 14, plan: 'pro' },
        freePlan: {
          name: 'free',
          limits: { prompts: 3, teamMembers: 1, apiCalls: 5000 },
        },
        plans: [
          {
            name: 'pro',
            priceId: ctx.cloudflare.env.STRIPE_PRICE_ID,
            limits: { prompts: -1, teamMembers: 5, apiCalls: 50000 },
          },
        ],
        hooks: {
          async onSubscriptionChange(userId, plan, status) {
            if (status !== 'active' || plan === 'free') return;

            const db = ctx.cloudflare.env.promptly;

            // Find the user's org
            const member = await db
              .prepare(
                'SELECT organization_id FROM member WHERE user_id = ? LIMIT 1',
              )
              .bind(userId)
              .first<{ organization_id: string }>();
            if (!member) return;

            const orgId = member.organization_id;

            // Find pending upgrade_requests for this org
            const pending = await db
              .prepare(
                `SELECT ur.id, ur.requester_user_id, u.name, u.email
                 FROM upgrade_request ur JOIN user u ON u.id = ur.requester_user_id
                 WHERE ur.organization_id = ? AND ur.status = 'pending'`,
              )
              .bind(orgId)
              .all<{
                id: string;
                requester_user_id: string;
                name: string;
                email: string;
              }>();

            if (!pending.results?.length) return;

            // Get org name
            const org = await db
              .prepare('SELECT name FROM organization WHERE id = ?')
              .bind(orgId)
              .first<{ name: string }>();

            const now = Date.now();

            // Mark all as fulfilled
            await db
              .prepare(
                `UPDATE upgrade_request SET status = 'fulfilled', fulfilled_at = ?, updated_at = ? WHERE organization_id = ? AND status = 'pending'`,
              )
              .bind(now, now, orgId)
              .run();

            // Send confirmation emails (deduplicated by email)
            if (!resendApiKey) return;

            const resend = new Resend(resendApiKey);
            const seenEmails = new Set<string>();

            for (const req of pending.results) {
              if (seenEmails.has(req.email)) continue;
              seenEmails.add(req.email);

              try {
                const emailHtml = await render(
                  UpgradeConfirmedEmail({
                    requesterName: req.name ?? 'there',
                    workspaceName: org?.name ?? 'Your workspace',
                    dashboardUrl: `${baseURL}/dashboard`,
                  }),
                );

                await resend.emails.send({
                  from: 'Promptly <hello@info.promptlycms.com>',
                  to: req.email,
                  subject: 'Your workspace has been upgraded to Pro',
                  html: emailHtml,
                });
              } catch (error) {
                console.error(
                  'Failed to send upgrade confirmation email:',
                  error,
                );
              }
            }
          },
        },
      }),
      organization({
        async sendInvitationEmail(data) {
          // Skip email sending if no API key is configured
          if (!resendApiKey) {
            console.log('Resend API key not configured, skipping email');
            console.log('Invitation link:', `${baseURL}/invite/${data.id}`);
            return;
          }

          const resend = new Resend(resendApiKey);
          const inviteLink = `${baseURL}/invite/${data.id}`;

          try {
            const emailHtml = await render(
              InvitationEmail({
                inviterName: data.inviter.user.name ?? 'A team member',
                inviterEmail: data.inviter.user.email,
                organizationName: data.organization.name,
                role: data.role,
                inviteLink,
              }),
            );

            await resend.emails.send({
              from: 'Promptly <hello@info.promptlycms.com>',
              to: data.email,
              subject: `${data.inviter.user.name} invited you to join ${data.organization.name} on Promptly`,
              html: emailHtml,
            });
          } catch (error) {
            console.error('Failed to send invitation email:', error);
            // Don't throw - we still want the invitation to be created
          }
        },
      }),
    ],
  });
};

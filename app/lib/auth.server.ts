import { render } from '@react-email/render';
import { betterAuth } from 'better-auth';
import { apiKey, organization } from 'better-auth/plugins';
import { CamelCasePlugin, Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { RouterContextProvider } from 'react-router';
import { Resend } from 'resend';
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
            await resend.emails.send({
              from: 'Promptly <hello@info.promptlycms.com>',
              to: data.email,
              subject: `${data.inviter.user.name} invited you to join ${data.organization.name} on Promptly`,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
                    <tr>
                      <td align="center">
                        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                          <!-- Header -->
                          <tr>
                            <td style="background: linear-gradient(135deg, #1f2937 0%, #111827 100%); padding: 32px; text-align: center;">
                              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Promptly</h1>
                            </td>
                          </tr>
                          <!-- Content -->
                          <tr>
                            <td style="padding: 32px;">
                              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 600;">You're invited to join ${data.organization.name}</h2>
                              <p style="margin: 0 0 24px; color: #6b7280; font-size: 15px; line-height: 1.6;">
                                <strong style="color: #111827;">${data.inviter.user.name}</strong> has invited you to collaborate on ${data.organization.name}. Click the button below to accept the invitation and get started.
                              </p>
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center">
                                    <a href="${inviteLink}" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500; padding: 12px 32px; border-radius: 8px;">Accept Invitation</a>
                                  </td>
                                </tr>
                              </table>
                              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
                                If you didn't expect this invitation, you can ignore this email.
                              </p>
                            </td>
                          </tr>
                          <!-- Footer -->
                          <tr>
                            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                &copy; ${new Date().getFullYear()} Promptly. All rights reserved.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
              `,
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

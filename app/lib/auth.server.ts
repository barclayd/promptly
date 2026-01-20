import { betterAuth } from 'better-auth';
import { createAuthMiddleware, getOAuthState } from 'better-auth/api';
import { organization } from 'better-auth/plugins';
import { CamelCasePlugin, Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { nanoid } from 'nanoid';
import type { RouterContextProvider } from 'react-router';
import { Resend } from 'resend';

type Database = Record<string, string>;

export const getAuth = (ctx: RouterContextProvider) => {
  const baseURL = ctx.cloudflare.env.BETTER_AUTH_URL;
  const resendApiKey = ctx.cloudflare.env.RESEND_API_KEY;

  return betterAuth({
    emailAndPassword: {
      enabled: true,
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
    hooks: {
      after: createAuthMiddleware(async (hookCtx) => {
        // Only run on OAuth callback for new users
        // Path format is /callback/:id (e.g., /callback/google)
        if (!hookCtx.path.startsWith('/callback/')) {
          return;
        }

        const newSession = hookCtx.context.newSession;
        if (!newSession?.user?.id || !newSession?.session?.id) {
          return; // Not a new user, just a sign-in
        }

        try {
          // Check if this is an invite flow
          try {
            const oauthState = await getOAuthState();
            if (
              oauthState &&
              typeof oauthState === 'object' &&
              'callbackURL' in oauthState &&
              typeof oauthState.callbackURL === 'string' &&
              oauthState.callbackURL.includes('/invite/')
            ) {
              return; // Skip - invite flow handles org membership
            }
          } catch {
            // State not available, continue with org creation
          }

          // Create default organization for new OAuth user
          const adapter = hookCtx.context.adapter;
          const orgId = hookCtx.context.generateId({ model: 'organization' });
          const slug = nanoid(10);

          await adapter.create({
            model: 'organization',
            data: {
              id: orgId,
              name: `${newSession.user.name}'s Workspace`,
              slug,
              createdAt: new Date(),
            },
          });

          // Add user as owner
          await adapter.create({
            model: 'member',
            data: {
              id: hookCtx.context.generateId({ model: 'member' }),
              userId: newSession.user.id,
              organizationId: orgId,
              role: 'owner',
              createdAt: new Date(),
            },
          });

          // Set as active organization on the session
          await adapter.update({
            model: 'session',
            where: [{ field: 'id', value: newSession.session.id }],
            update: { activeOrganizationId: orgId },
          });
        } catch (error) {
          console.error('Failed to create default organization for OAuth user:', error);
          // Don't throw - let the user continue even if org creation fails
        }
      }),
    },
    plugins: [
      organization({
        async sendInvitationEmail(data) {
          // Skip email sending if no API key is configured
          if (!resendApiKey) {
            console.log('Resend API key not configured, skipping email');
            console.log(
              'Invitation link:',
              `${baseURL}/invite/${data.id}`,
            );
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

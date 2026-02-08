import { render } from '@react-email/render';
import { InvitationEmail } from '../app/emails/invitation';
import { UpgradeConfirmedEmail } from '../app/emails/upgrade-confirmed';
import { UpgradeRequestEmail } from '../app/emails/upgrade-request';

const upgradeRequestHtml = await render(
  UpgradeRequestEmail({
    adminName: 'Daniel',
    requesterName: 'Sarah Chen',
    requesterEmail: 'sarah@acme.com',
    personalNote:
      "Hey Daniel, I really need Pro to keep building out our onboarding prompts — I hit the 3-prompt limit yesterday and I'm blocked.",
    workspaceName: 'Acme Corp',
    promptCount: 3,
    memberCount: 2,
    freeLimits: { prompts: 3, members: 1 },
    context: 'prompt_limit',
    checkoutUrl: 'https://checkout.stripe.com/example',
    settingsUrl: 'https://app.promptlycms.com/settings',
  }),
);

const upgradeConfirmedHtml = await render(
  UpgradeConfirmedEmail({
    requesterName: 'Sarah',
    workspaceName: 'Acme Corp',
    dashboardUrl: 'https://app.promptlycms.com/dashboard',
  }),
);

const invitationHtml = await render(
  InvitationEmail({
    inviterName: 'Daniel Barclay',
    inviterEmail: 'daniel@acme.com',
    organizationName: 'Acme Corp',
    role: 'member',
    inviteLink: 'https://app.promptlycms.com/invite/abc123',
  }),
);

await Bun.write('/tmp/email-upgrade-request.html', upgradeRequestHtml);
await Bun.write('/tmp/email-upgrade-confirmed.html', upgradeConfirmedHtml);
await Bun.write('/tmp/email-invitation.html', invitationHtml);

console.log('Wrote email previews:');
console.log('  /tmp/email-upgrade-request.html');
console.log('  /tmp/email-upgrade-confirmed.html');
console.log('  /tmp/email-invitation.html');

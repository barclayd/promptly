import { render } from '@react-email/render';
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

await Bun.write('/tmp/email-upgrade-request.html', upgradeRequestHtml);
await Bun.write('/tmp/email-upgrade-confirmed.html', upgradeConfirmedHtml);

console.log('Wrote email previews:');
console.log('  /tmp/email-upgrade-request.html');
console.log('  /tmp/email-upgrade-confirmed.html');

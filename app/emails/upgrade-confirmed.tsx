import { Hr, Section, Text } from '@react-email/components';
import { EmailButton } from './components/email-button';
import { EmailLayout } from './components/email-layout';

export interface UpgradeConfirmedEmailProps {
  requesterName: string;
  workspaceName: string;
  dashboardUrl: string;
}

export const UpgradeConfirmedEmail = ({
  requesterName,
  workspaceName,
  dashboardUrl,
}: UpgradeConfirmedEmailProps) => (
  <EmailLayout preview={`${workspaceName} has been upgraded to Pro!`}>
    <Text style={heading}>{workspaceName} is now on Pro!</Text>

    <Text style={paragraph}>
      Hey {requesterName}, great news &mdash; your workspace admin upgraded to
      Promptly Pro. You now have access to the full experience.
    </Text>

    <Hr style={divider} />

    <Text style={unlockHeading}>What's unlocked</Text>

    <Text style={featureItem}>&#x2705; Unlimited prompts</Text>
    <Text style={featureItem}>&#x2705; Up to 5 team members</Text>
    <Text style={featureItem}>&#x2705; 50,000 API calls/mo</Text>

    <Hr style={divider} />

    <Section style={ctaSection}>
      <EmailButton href={dashboardUrl}>Open Promptly</EmailButton>
    </Section>
  </EmailLayout>
);

const heading: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#111827',
  fontSize: '20px',
  fontWeight: 600,
};

const paragraph: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#6b7280',
  fontSize: '15px',
  lineHeight: '1.6',
};

const divider: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
};

const unlockHeading: React.CSSProperties = {
  margin: '0 0 12px',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const featureItem: React.CSSProperties = {
  margin: '0 0 6px',
  color: '#374151',
  fontSize: '14px',
  lineHeight: '1.5',
};

const ctaSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '8px 0',
};

export default UpgradeConfirmedEmail;

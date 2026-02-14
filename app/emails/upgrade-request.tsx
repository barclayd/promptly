import { Hr, Link, Section, Text } from '@react-email/components';
import { EmailButton } from './components/email-button';
import { EmailLayout } from './components/email-layout';

export interface UpgradeRequestEmailProps {
  adminName: string;
  requesterName: string;
  requesterEmail: string;
  personalNote?: string;
  workspaceName: string;
  promptCount: number;
  memberCount: number;
  freeLimits: { prompts: number; members: number };
  context: string;
  checkoutUrl: string;
  settingsUrl: string;
}

const CONTEXT_COPY: Record<string, string> = {
  prompt_limit:
    'Your team has reached the 3-prompt limit on the Free plan and can\u2019t create new prompts.',
  trial_expiry: 'Your workspace\u2019s trial is ending soon.',
  trial_expired:
    'Your workspace\u2019s trial has expired and the team is limited to the Free plan.',
  winback:
    'Your workspace is on the Free plan and the team wants to unlock Pro features.',
  mid_trial: 'Your workspace is on a trial and the team is enjoying Pro.',
  usage_threshold: 'Your workspace is approaching its resource limits.',
  cancelled:
    'Your workspace subscription was cancelled and the team wants Pro back.',
  payment_failed:
    'There\u2019s a payment issue on your workspace and the team needs it resolved.',
  read_only: 'Your workspace is in read-only mode on the Free plan.',
  plan_comparison: 'A team member compared plans and wants to upgrade.',
  usage_limit: 'Your workspace is running low on capacity.',
  'invalid-api-key':
    'The API key configured for your workspace appears to be invalid or expired. Update it in Settings \u203A LLM API Keys.',
  general: 'A team member would like to upgrade your workspace to Pro.',
};

export const UpgradeRequestEmail = ({
  adminName,
  requesterName,
  requesterEmail,
  personalNote,
  workspaceName,
  promptCount,
  memberCount,
  freeLimits,
  context,
  checkoutUrl,
  settingsUrl,
}: UpgradeRequestEmailProps) => {
  const contextLine = CONTEXT_COPY[context] ?? CONTEXT_COPY.general;
  const isApiKeyContext = context === 'invalid-api-key';
  const promptsAtLimit =
    freeLimits.prompts > 0 && promptCount >= freeLimits.prompts;
  const membersAtLimit =
    freeLimits.members > 0 && memberCount >= freeLimits.members;

  if (isApiKeyContext) {
    return (
      <EmailLayout
        preview={`${requesterName} reports an invalid API key in ${workspaceName}`}
      >
        <Text style={greeting}>Hi {adminName},</Text>

        <Text style={paragraph}>
          <strong>{requesterName}</strong> from <strong>{workspaceName}</strong>{' '}
          ran into an API key issue while testing a prompt.
        </Text>

        <Text style={contextText}>{contextLine}</Text>

        <Hr style={divider} />

        <Section style={ctaSection}>
          <EmailButton href={`${settingsUrl}?tab=llm-api-keys`}>
            Update API Key
          </EmailButton>
        </Section>

        <Hr style={divider} />

        <Text style={footerNote}>
          You're receiving this because {requesterName} ({requesterEmail})
          reported an API key issue in {workspaceName}.
        </Text>
      </EmailLayout>
    );
  }

  return (
    <EmailLayout
      preview={`${requesterName} requested a Pro upgrade for ${workspaceName}`}
    >
      <Text style={greeting}>Hi {adminName},</Text>

      <Text style={paragraph}>
        <strong>{requesterName}</strong> from <strong>{workspaceName}</strong>{' '}
        is requesting an upgrade to Promptly Pro.
      </Text>

      {personalNote && (
        <Section style={noteBlock}>
          <Text style={noteText}>&ldquo;{personalNote}&rdquo;</Text>
          <Text style={noteAttribution}>&mdash; {requesterName}</Text>
        </Section>
      )}

      <Text style={contextText}>{contextLine}</Text>

      <Hr style={divider} />

      {/* Usage stats */}
      <Text style={statsHeading}>Your workspace</Text>

      <Section style={statRow}>
        <Text style={statLabel}>Prompts created</Text>
        <Text style={promptsAtLimit ? statValueWarn : statValue}>
          {promptCount}
          {promptsAtLimit ? ` / ${freeLimits.prompts} (at limit)` : ''}
        </Text>
      </Section>

      <Section style={statRow}>
        <Text style={statLabel}>Team members</Text>
        <Text style={membersAtLimit ? statValueWarn : statValue}>
          {memberCount}
          {membersAtLimit ? ` / ${freeLimits.members} (at limit)` : ''}
        </Text>
      </Section>

      <Hr style={divider} />

      {/* CTA */}
      <Section style={ctaSection}>
        <EmailButton href={checkoutUrl}>
          Upgrade to Pro &mdash; $29/mo
        </EmailButton>
      </Section>

      <Text style={finePrint}>
        One workspace, unlimited for your whole team. No per-seat pricing.
        Cancel anytime.
      </Text>

      <Text style={secondaryLink}>
        Or upgrade anytime at{' '}
        <Link href={settingsUrl} style={link}>
          your settings page
        </Link>
      </Text>

      <Hr style={divider} />

      <Text style={footerNote}>
        You're receiving this because {requesterName} ({requesterEmail})
        requested an upgrade for {workspaceName}.
      </Text>
    </EmailLayout>
  );
};

const greeting: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#111827',
  fontSize: '15px',
  lineHeight: '1.6',
};

const paragraph: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#6b7280',
  fontSize: '15px',
  lineHeight: '1.6',
};

const noteBlock: React.CSSProperties = {
  margin: '0 0 16px',
  padding: '12px 16px',
  backgroundColor: '#f9fafb',
  borderLeft: '3px solid #d1d5db',
  borderRadius: '0 6px 6px 0',
};

const noteText: React.CSSProperties = {
  margin: '0 0 4px',
  color: '#374151',
  fontSize: '14px',
  lineHeight: '1.5',
  fontStyle: 'italic',
};

const noteAttribution: React.CSSProperties = {
  margin: 0,
  color: '#9ca3af',
  fontSize: '13px',
};

const contextText: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
};

const divider: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
};

const statsHeading: React.CSSProperties = {
  margin: '0 0 12px',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const statRow: React.CSSProperties = {
  margin: '0 0 8px',
};

const statLabel: React.CSSProperties = {
  margin: 0,
  color: '#6b7280',
  fontSize: '14px',
  display: 'inline',
};

const statValue: React.CSSProperties = {
  margin: 0,
  color: '#111827',
  fontSize: '14px',
  fontWeight: 600,
  display: 'inline',
  float: 'right' as const,
};

const statValueWarn: React.CSSProperties = {
  ...statValue,
  color: '#d97706',
};

const ctaSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '8px 0',
};

const finePrint: React.CSSProperties = {
  margin: '16px 0 0',
  color: '#9ca3af',
  fontSize: '13px',
  textAlign: 'center' as const,
  lineHeight: '1.5',
};

const secondaryLink: React.CSSProperties = {
  margin: '12px 0 0',
  color: '#9ca3af',
  fontSize: '13px',
  textAlign: 'center' as const,
};

const link: React.CSSProperties = {
  color: '#4f46e5',
  textDecoration: 'underline',
};

const footerNote: React.CSSProperties = {
  margin: 0,
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '1.5',
};

export default UpgradeRequestEmail;

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { roleDescriptions } from '~/lib/validations/team';

export interface InvitationEmailProps {
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  role: string;
  inviteLink: string;
}

export const InvitationEmail = ({
  inviterName,
  inviterEmail,
  organizationName,
  role,
  inviteLink,
}: InvitationEmailProps) => (
  <Html>
    <Head />
    <Preview>Join {inviterName} on Promptly</Preview>
    <Body style={body}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img
            src="https://images.keepfre.sh/app/icons/promptly/promptly.png"
            alt="Promptly"
            width={180}
            height={180}
            style={logo}
          />
        </Section>

        <Section style={contentSection}>
          <Heading style={heading}>
            Join <strong>{organizationName}</strong> on{' '}
            <strong>Promptly</strong>
          </Heading>

          <Text style={paragraph}>
            <strong>{inviterName}</strong> (
            <Link href={`mailto:${inviterEmail}`} style={emailLink}>
              {inviterEmail}
            </Link>
            ) has invited you to the <strong>{organizationName}</strong> team on{' '}
            <strong>Promptly</strong>.
          </Text>

          <Section style={ctaSection}>
            <Button href={inviteLink} style={button}>
              Accept Invitation
            </Button>
          </Section>

          <Text style={fallbackText}>
            or copy and paste this URL into your browser:{' '}
            <Link href={inviteLink} style={emailLink}>
              {inviteLink}
            </Link>
          </Text>

          <Hr style={divider} />

          <Text style={finePrint}>
            {roleDescriptions[role]
              ? `You've been invited as a role that ${roleDescriptions[role].toLowerCase()}. `
              : ''}
            If you were not expecting this invitation, you can ignore this
            email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const body: React.CSSProperties = {
  margin: 0,
  padding: 0,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  backgroundColor: '#ffffff',
};

const container: React.CSSProperties = {
  maxWidth: '465px',
  margin: '40px auto',
  border: '1px solid #eaeaea',
  borderRadius: '8px',
  overflow: 'hidden',
};

const headerSection: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
  padding: '22px 0',
  textAlign: 'center' as const,
};

const contentSection: React.CSSProperties = {
  padding: '0 20px 20px',
};

const logo: React.CSSProperties = {
  margin: '0 auto',
  display: 'block',
};

const heading: React.CSSProperties = {
  margin: '30px 0',
  padding: 0,
  textAlign: 'center' as const,
  fontSize: '24px',
  fontWeight: 'normal',
  color: '#000000',
};

const paragraph: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#000000',
  fontSize: '14px',
  lineHeight: '24px',
};

const emailLink: React.CSSProperties = {
  color: '#2563eb',
  textDecoration: 'none',
};

const ctaSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#000000',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 600,
  padding: '12px 20px',
  borderRadius: '5px',
};

const fallbackText: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#000000',
  fontSize: '14px',
  lineHeight: '24px',
};

const divider: React.CSSProperties = {
  border: '1px solid #eaeaea',
  margin: '26px 0',
  width: '100%',
};

const finePrint: React.CSSProperties = {
  margin: 0,
  color: '#666666',
  fontSize: '12px',
  lineHeight: '24px',
};

export default InvitationEmail;

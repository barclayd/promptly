import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export const EmailLayout = ({ preview, children }: EmailLayoutProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={body}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Img
            src="https://images.keepfre.sh/app/icons/promptly/promptly.png"
            alt="Promptly"
            width={80}
            height={80}
            style={headerLogo}
          />
          <Text style={headerText}>Promptly</Text>
        </Section>

        {/* Content */}
        <Section style={content}>{children}</Section>

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            &copy; {new Date().getFullYear()} Promptly. All rights reserved.
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
  backgroundColor: '#f4f4f5',
};

const container: React.CSSProperties = {
  maxWidth: '480px',
  margin: '0 auto',
  padding: '40px 20px',
};

const header: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
  padding: '32px',
  textAlign: 'center' as const,
  borderRadius: '12px 12px 0 0',
};

const headerLogo: React.CSSProperties = {
  margin: '0 auto 12px',
  display: 'block',
};

const headerText: React.CSSProperties = {
  margin: 0,
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 600,
};

const content: React.CSSProperties = {
  padding: '32px',
  backgroundColor: '#ffffff',
};

const footer: React.CSSProperties = {
  padding: '24px 32px',
  backgroundColor: '#f9fafb',
  borderTop: '1px solid #e5e7eb',
  borderRadius: '0 0 12px 12px',
};

const footerText: React.CSSProperties = {
  margin: 0,
  color: '#9ca3af',
  fontSize: '12px',
  textAlign: 'center' as const,
};

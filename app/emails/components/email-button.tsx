import { Button } from '@react-email/components';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

export const EmailButton = ({ href, children }: EmailButtonProps) => (
  <Button href={href} style={button}>
    {children}
  </Button>
);

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#111827',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: 500,
  padding: '12px 32px',
  borderRadius: '8px',
};

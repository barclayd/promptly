import { IconBrandGithub, IconBrandX } from '@tabler/icons-react';
import { Button } from '~/components/ui/button';

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Documentation', href: '/docs' },
    { label: 'Changelog', href: '/changelog' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Security', href: '/security' },
  ],
};

export const FooterSection = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 bg-card">
      {/* CTA Banner */}
      <div className="py-16 bg-gradient-to-b from-muted/50 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to take control of your prompts?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join hundreds of teams already shipping AI features faster with
            Promptly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="shadow-lg shadow-primary/25">
              <a href="https://app.promptlycms.com/sign-up">Start free</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://app.promptlycms.com/login">Log in</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="size-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="font-semibold text-lg tracking-tight">
                Promptly
              </span>
            </a>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              The CMS for AI prompts. Manage, test, and deploy prompts without
              touching code.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="text-muted-foreground hover:text-foreground"
              >
                <a
                  href="https://github.com/promptly"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconBrandGithub className="size-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="text-muted-foreground hover:text-foreground"
              >
                <a
                  href="https://x.com/promptly"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconBrandX className="size-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} Promptly. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Made with care for teams shipping AI.
          </p>
        </div>
      </div>
    </footer>
  );
};

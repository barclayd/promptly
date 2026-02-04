import { IconArrowRight, IconMenu2, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

const navLinks = [
  {
    label: 'Features',
    href: '#features',
    description: 'What makes Promptly special',
  },
  {
    label: 'Pricing',
    href: '#pricing',
    description: 'Plans for every team size',
  },
  { label: 'FAQ', href: '#faq', description: 'Common questions answered' },
];

type NavigationProps = {
  isAuthenticated?: boolean;
};

export const Navigation = ({ isAuthenticated = false }: NavigationProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ref callback for scroll listener - no useEffect
  const scrollRef = (node: HTMLElement | null) => {
    if (!node) return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  };

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <>
      <header
        ref={scrollRef}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm'
            : 'bg-transparent',
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative size-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="font-semibold text-lg tracking-tight">
                Promptly
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <Button asChild className="shadow-lg shadow-primary/25">
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <a href="https://app.promptlycms.com/login">Log in</a>
                  </Button>
                  <Button asChild className="shadow-lg shadow-primary/25">
                    <a href="https://app.promptlycms.com/sign-up">Start free</a>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Trigger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden relative size-10 flex items-center justify-center rounded-lg hover:bg-accent/50 transition-colors"
              aria-label="Open menu"
            >
              <IconMenu2 className="size-5" />
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Menu - Full Screen Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-[100] md:hidden transition-all duration-500',
          mobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
      >
        {/* Backdrop with blur */}
        <button
          type="button"
          className={cn(
            'absolute inset-0 bg-background/95 backdrop-blur-xl transition-all duration-500 cursor-default',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={closeMobileMenu}
          onKeyDown={(e) => e.key === 'Escape' && closeMobileMenu()}
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Gradient orbs for visual interest */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className={cn(
              'absolute -top-32 -right-32 size-64 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-3xl transition-all duration-700 delay-100',
              mobileOpen
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-20',
            )}
          />
          <div
            className={cn(
              'absolute -bottom-32 -left-32 size-64 rounded-full bg-gradient-to-br from-pink-500/20 to-orange-500/20 blur-3xl transition-all duration-700 delay-200',
              mobileOpen
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-20',
            )}
          />
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-16">
            <div
              className={cn(
                'flex items-center gap-2 transition-all duration-500 delay-75',
                mobileOpen
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-4',
              )}
            >
              <div className="relative size-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="font-semibold text-lg tracking-tight">
                Promptly
              </span>
            </div>
            <button
              type="button"
              onClick={closeMobileMenu}
              className={cn(
                'size-10 flex items-center justify-center rounded-full bg-accent/50 hover:bg-accent transition-all duration-500 delay-75',
                mobileOpen
                  ? 'opacity-100 rotate-0 scale-100'
                  : 'opacity-0 rotate-90 scale-75',
              )}
              aria-label="Close menu"
            >
              <IconX className="size-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 flex flex-col justify-center px-6 -mt-16">
            <nav className="space-y-2">
              {navLinks.map((link, index) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className={cn(
                    'group block py-4 transition-all',
                    mobileOpen
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 -translate-x-8',
                  )}
                  style={{
                    transitionDuration: '500ms',
                    transitionDelay: mobileOpen
                      ? `${150 + index * 75}ms`
                      : '0ms',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-semibold text-foreground group-hover:text-indigo-500 transition-colors">
                        {link.label}
                      </span>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {link.description}
                      </p>
                    </div>
                    <IconArrowRight className="size-5 text-muted-foreground/50 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="mt-4 h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
                </a>
              ))}
            </nav>
          </div>

          {/* CTAs at bottom */}
          <div className="px-6 pb-8 space-y-3">
            {isAuthenticated ? (
              <Button
                asChild
                size="lg"
                className={cn(
                  'w-full h-14 text-base shadow-lg shadow-primary/25 transition-all',
                  mobileOpen
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4',
                )}
                style={{
                  transitionDuration: '500ms',
                  transitionDelay: mobileOpen ? '400ms' : '0ms',
                }}
              >
                <Link to="/dashboard" onClick={closeMobileMenu}>
                  Go to Dashboard
                  <IconArrowRight className="size-5 ml-2" />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  size="lg"
                  className={cn(
                    'w-full h-14 text-base shadow-lg shadow-primary/25 transition-all',
                    mobileOpen
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4',
                  )}
                  style={{
                    transitionDuration: '500ms',
                    transitionDelay: mobileOpen ? '400ms' : '0ms',
                  }}
                >
                  <a
                    href="https://app.promptlycms.com/sign-up"
                    onClick={closeMobileMenu}
                  >
                    Start free
                    <IconArrowRight className="size-5 ml-2" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  size="lg"
                  className={cn(
                    'w-full h-14 text-base transition-all',
                    mobileOpen
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4',
                  )}
                  style={{
                    transitionDuration: '500ms',
                    transitionDelay: mobileOpen ? '475ms' : '0ms',
                  }}
                >
                  <a
                    href="https://app.promptlycms.com/login"
                    onClick={closeMobileMenu}
                  >
                    Log in
                  </a>
                </Button>
              </>
            )}

            {/* Trust indicator */}
            <p
              className={cn(
                'text-center text-xs text-muted-foreground pt-2 transition-all',
                mobileOpen
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4',
              )}
              style={{
                transitionDuration: '500ms',
                transitionDelay: mobileOpen ? '550ms' : '0ms',
              }}
            >
              No credit card required
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

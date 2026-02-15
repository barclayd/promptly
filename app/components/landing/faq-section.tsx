import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import { faqs } from '~/lib/landing-data';
import { AnimatedWrapper } from './animated-wrapper';

const linkClass =
  'text-indigo-600 dark:text-indigo-400 hover:underline font-medium';

const integrationAnswer = (
  <>
    Promptly provides a REST API and a TypeScript SDK available as an npm
    package (
    <a
      href="https://www.npmjs.com/package/@promptlycms/prompts"
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
    >
      @promptlycms/prompts
    </a>
    ). Install it, create a client, and fetch prompts by name at runtime. See{' '}
    <a
      href="https://docs.promptlycms.com"
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
    >
      docs.promptlycms.com
    </a>{' '}
    for guides, API reference, and examples.
  </>
);

const richAnswers: Record<string, React.ReactNode> = {
  'How can I integrate PromptlyCMS into my codebase?': integrationAnswer,
};

export const FAQSection = () => {
  return (
    <section id="faq" className="py-24 lg:py-32 bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <AnimatedWrapper className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about Promptly.
          </p>
        </AnimatedWrapper>

        <AnimatedWrapper delay={200}>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq) => (
              <AccordionItem
                key={faq.question}
                value={faq.question}
                className="border-border/50"
              >
                <AccordionTrigger className="text-left text-base font-medium hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  {richAnswers[faq.question] ?? faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimatedWrapper>
      </div>
    </section>
  );
};

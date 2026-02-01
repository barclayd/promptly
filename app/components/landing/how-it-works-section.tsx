import { workflowSteps } from '~/lib/landing-data';
import { AnimatedWrapper } from './animated-wrapper';
import {
  AnimatedVersionHistory,
  HowItWorksStep,
  StaticEditorWindow,
  StaticIdeWindow,
} from './how-it-works';

export const HowItWorksSection = () => {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedWrapper className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            How it works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in minutes, not months. Three steps to prompt management
            bliss.
          </p>
        </AnimatedWrapper>

        <div className="grid lg:grid-cols-3 gap-8 lg:gap-6">
          {workflowSteps.map((step, index) => (
            <HowItWorksStep
              key={step.step}
              step={step.step}
              title={step.title}
              description={step.description}
              isLastStep={index === workflowSteps.length - 1}
            >
              <StepVisual visual={step.visual} />
            </HowItWorksStep>
          ))}
        </div>
      </div>
    </section>
  );
};

const StepVisual = ({ visual }: { visual: string }) => {
  if (visual === 'editor') {
    return <StaticEditorWindow />;
  }

  if (visual === 'code') {
    return <StaticIdeWindow />;
  }

  // iterate - animated version history
  return <AnimatedVersionHistory />;
};

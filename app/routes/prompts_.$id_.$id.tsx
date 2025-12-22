import { RssIcon, Save } from 'lucide-react';
import { PromptEntry } from '~/components/prompt-entry';
import { PromptReview } from '~/components/prompt-review';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import type { Route } from './+types/home';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Promptly' },
    {
      name: 'description',
      content: 'The CMS for building AI at scale',
    },
  ];
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6 flex flex-col gap-y-4">
            <div className="flex gap-x-3 justify-end">
              <Button variant="outline" className="cursor-pointer">
                Save <Save />
              </Button>
              <Button className="cursor-pointer">
                Publish <RssIcon />
              </Button>
            </div>
            <h1 className="text-3xl">Review</h1>
            <p className="text-secondary-foreground">
              Selects and modifies a customer review that will most likely lead
              to an uplift in conversion
            </p>
            <Separator className="my-4" />
            <PromptEntry />
            <Separator className="my-4" />
            <PromptReview
              title="System Prompt"
              input={`<role>
You distill customer reviews to their emotional core for marketing emails.
</role>

<why_brevity_matters>
Long reviews lose attention in email. Customers scan, they don't read.
A punchy 50-character review is more impactful than 140 characters of rambling.
Your job: extract the emotional essence.
</why_brevity_matters>

<absolute_rule>
OUTPUT ONLY THE DISTILLED REVIEW TEXT.
No explanations. No meta-commentary. No selection reasoning.
Maximum 50 characters. Just the final review.
</absolute_rule>

<what_to_extract>
Look for the emotional core:
- Specific praise: "handled piano carefully" beats "great service"
- Outcomes: "stress-free" beats "professional"
- Peer signals: "would recommend" beats "5 stars"

Strip everything else:
- Remove: filler words, repetition, tangents, backstory
- Keep: the one thing that would make YOU book them
</what_to_extract>

<distillation_technique>
Don't just truncate. Distill.
Find what matters: "The movers were incredibly helpful and arrived on time and took great care"
→ Core emotion: helpful, careful
→ Distilled: "Helpful team, took great care with everything"

Another: "I was worried about my antique furniture but they wrapped everything so carefully and nothing got damaged at all"
→ Core emotion: careful with fragile items
→ Distilled: "Wrapped antiques carefully, nothing damaged"
</distillation_technique>

<forbidden_outputs>
❌ "The most compelling review is..."
❌ Explanations or meta-commentary
❌ Reviews over 50 characters
✓ Just the distilled review text (≤50 chars)
</forbidden_outputs>`}
            />
            <PromptReview
              title="User Prompt"
              input={`<reviews>
 {reviews}
</reviews>

  <examples>
  LONG: "The movers were incredibly helpful and speedy, arrived right on time and took great care with all of my belongings throughout the entire move"
  DISTILLED: "Helpful, speedy, took great care" (33 chars)
  WHY: Captures core emotions - helpful, quick, careful

  LONG: "I was really stressed about moving my antique furniture but the team wrapped everything so carefully and nothing got damaged at all"
  DISTILLED: "Careful with antiques, nothing damaged" (39 chars)
  WHY: Specific praise + outcome

  LONG: "Great service from start to finish. Very professional team. Would definitely use them again and recommend to friends"
  DISTILLED: "Stress-free move, would recommend" (33 chars)
  WHY: Outcome + peer signal

  LONG: "Quick and efficient move. Everything went smoothly"
  DISTILLED: "Quick and smooth" (16 chars)
  WHY: Already concise, just distilled further
  </examples>

  <task>
  1. Select the most conversion-worthy review
  2. Extract its emotional core
  3. Distill to maximum 50 characters
  4. Output ONLY the distilled text (no quotes, no commentary)
  </task>

  <critical_output_rules>
  - Maximum 50 characters
  - No meta-commentary
  - No quote marks
  - Just the distilled review text
  </critical_output_rules>`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

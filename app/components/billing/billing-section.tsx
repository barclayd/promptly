'use client';

import { CurrentPlanCard } from './current-plan-card';
import { PlanComparison } from './plan-comparison';
import { UsageSummary } from './usage-summary';

export const BillingSection = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="text-sm font-medium text-foreground">Current Plan</div>
        <CurrentPlanCard />
      </div>
      <div className="space-y-3">
        <div className="text-sm font-medium text-foreground">Usage</div>
        <UsageSummary />
      </div>
      <div className="space-y-3">
        <div className="text-sm font-medium text-foreground">Compare Plans</div>
        <PlanComparison />
      </div>
    </div>
  );
};

import {
  IconChartBar,
  IconCrown,
  IconFileText,
  IconUsers,
} from '@tabler/icons-react';
import { useState, useSyncExternalStore } from 'react';
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from 'recharts';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { ChartConfig } from '~/components/ui/chart';
import { ChartContainer } from '~/components/ui/chart';
import { UpgradeGateModal } from '~/components/upgrade-gate-modal';
import { orgContext } from '~/context';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import type { Route } from './+types/analytics';

const emptySubscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Analytics | Promptly' },
  {
    name: 'description',
    content: 'View analytics and insights for your prompts',
  },
];

export const loader = async ({ context }: Route.LoaderArgs) => {
  const org = context.get(orgContext);

  if (!org) {
    throw new Response('Unauthorized', { status: 403 });
  }

  return null;
};

const getUsageColor = (percentage: number): string => {
  if (percentage >= 0.8) return 'hsl(0 84% 60%)';
  if (percentage >= 0.6) return 'hsl(38 92% 50%)';
  return 'hsl(160 84% 39%)';
};

// --- Stacked semicircle chart for Prompts ---

type PromptsMeterProps = {
  count: number;
  limit: number;
  canManageBilling: boolean;
  onUpgradeClick: () => void;
};

const PromptsMeter = ({
  count,
  limit,
  canManageBilling,
  onUpgradeClick,
}: PromptsMeterProps) => {
  const isClient = useIsClient();
  const isUnlimited = limit === -1;
  const isAtLimit = !isUnlimited && count >= limit;

  // For stacked chart: show "used" and "remaining" segments
  // When unlimited, show a full bar representing the count
  const used = count;
  const remaining = isUnlimited
    ? Math.max(count, 1)
    : Math.max(limit - count, 0);

  const chartData = [{ used, remaining }];

  const chartConfig = {
    used: {
      label: 'Used',
      color: isUnlimited
        ? 'hsl(243 75% 59%)' // indigo-500
        : getUsageColor(count / limit),
    },
    remaining: {
      label: 'Remaining',
      color: isUnlimited
        ? 'hsl(243 75% 59% / 0.25)' // indigo-500 faded
        : 'hsl(var(--muted))',
    },
  } satisfies ChartConfig;

  const centerLabel = isUnlimited ? 'Unlimited' : `of ${limit}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <IconFileText className="size-4" />
          Prompts
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 pb-6">
        {isClient ? (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square w-full max-w-[250px]"
          >
            <RadialBarChart
              data={chartData}
              endAngle={180}
              innerRadius={80}
              outerRadius={130}
            >
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) - 16}
                            className="fill-foreground text-2xl font-bold"
                          >
                            {count.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 4}
                            className="fill-muted-foreground text-sm"
                          >
                            {centerLabel}
                          </tspan>
                        </text>
                      );
                    }
                    return null;
                  }}
                />
              </PolarRadiusAxis>
              <RadialBar
                dataKey="used"
                stackId="a"
                cornerRadius={5}
                fill="var(--color-used)"
                className="stroke-transparent stroke-2"
              />
              <RadialBar
                dataKey="remaining"
                fill="var(--color-remaining)"
                stackId="a"
                cornerRadius={5}
                className="stroke-transparent stroke-2"
              />
            </RadialBarChart>
          </ChartContainer>
        ) : (
          <div className="aspect-square max-w-[250px] w-full" />
        )}

        <div className="text-center -mt-8">
          {isAtLimit ? (
            canManageBilling ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={onUpgradeClick}
              >
                <IconCrown className="size-3.5" />
                Upgrade to create unlimited prompts
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask your admin to unlock unlimited prompts
              </p>
            )
          ) : isUnlimited ? (
            <p className="text-sm text-muted-foreground">
              No limit on your plan
            </p>
          ) : (
            (() => {
              const percentage = count / limit;
              if (percentage >= 0.8) {
                return canManageBilling ? (
                  <p className="text-sm text-amber-500">
                    Only {remaining} prompt{remaining === 1 ? '' : 's'} left —
                    upgrade for unlimited
                  </p>
                ) : (
                  <p className="text-sm text-amber-500">
                    Only {remaining} prompt{remaining === 1 ? '' : 's'} left
                  </p>
                );
              }
              if (percentage >= 0.6) {
                return (
                  <p className="text-sm text-amber-500">
                    {remaining} remaining — running low
                  </p>
                );
              }
              return (
                <p className="text-sm text-muted-foreground">
                  {remaining} remaining
                </p>
              );
            })()
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// --- Radial ring chart for Team Members ---

type TeamMeterProps = {
  count: number;
  limit: number;
  canManageBilling: boolean;
  onUpgradeClick: () => void;
};

const TeamMeter = ({
  count,
  limit,
  canManageBilling,
  onUpgradeClick,
}: TeamMeterProps) => {
  const isClient = useIsClient();
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : limit === 0 ? 1 : count / limit;
  const isAtLimit = !isUnlimited && count >= limit;

  // Mirror shadcn reference: startAngle=0 (3 o'clock), endAngle = percentage * 360
  const endAngle = percentage * 360;

  const chartConfig = {
    members: {
      label: 'Team Members',
    },
    usage: {
      label: 'Usage',
      color: getUsageColor(percentage),
    },
  } satisfies ChartConfig;

  const chartData = [
    { name: 'usage', value: count, fill: 'var(--color-usage)' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <IconUsers className="size-4" />
          Team Members
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 pb-6">
        {isClient ? (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square w-full max-w-[250px]"
          >
            <RadialBarChart
              data={chartData}
              startAngle={0}
              endAngle={endAngle}
              innerRadius={90}
              outerRadius={100}
            >
              <PolarGrid
                gridType="circle"
                radialLines={false}
                stroke="none"
                className="first:fill-muted last:fill-background"
                polarRadius={[100, 90]}
              />
              <RadialBar dataKey="value" cornerRadius={10} />
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-4xl font-bold"
                          >
                            {count}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 24}
                            className="fill-muted-foreground"
                          >
                            of {limit}
                          </tspan>
                        </text>
                      );
                    }
                    return null;
                  }}
                />
              </PolarRadiusAxis>
            </RadialBarChart>
          </ChartContainer>
        ) : (
          <div className="aspect-square w-full max-w-[250px] mx-auto" />
        )}

        <div className="text-center">
          {isAtLimit ? (
            canManageBilling ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={onUpgradeClick}
              >
                <IconCrown className="size-3.5" />
                Upgrade to invite more team members
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask your admin to add more seats
              </p>
            )
          ) : (
            (() => {
              const remaining = limit - count;
              if (percentage >= 0.8) {
                return canManageBilling ? (
                  <p className="text-sm text-red-500">
                    Only {remaining} seat{remaining === 1 ? '' : 's'} left —
                    upgrade for more
                  </p>
                ) : (
                  <p className="text-sm text-red-500">
                    Only {remaining} seat{remaining === 1 ? '' : 's'} left
                  </p>
                );
              }
              if (percentage >= 0.6) {
                return (
                  <p className="text-sm text-amber-500">
                    {remaining} seat{remaining === 1 ? '' : 's'} remaining —
                    filling up
                  </p>
                );
              }
              return (
                <p className="text-sm text-muted-foreground">
                  {remaining} seat{remaining === 1 ? '' : 's'} remaining
                </p>
              );
            })()
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Analytics = () => {
  const { promptCount, promptLimit, memberCount, memberLimit } =
    useResourceLimits();
  const { canManageBilling } = useCanManageBilling();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeResource, setUpgradeResource] = useState<'prompts' | 'team'>(
    'prompts',
  );

  const handleUpgradeClick = (resource: 'prompts' | 'team') => {
    setUpgradeResource(resource);
    setUpgradeModalOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2 bg-muted/40 dark:bg-background">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Analytics
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Monitor your workspace usage and resource limits
                </p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconChartBar className="size-5" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <PromptsMeter
                count={promptCount}
                limit={promptLimit}
                canManageBilling={canManageBilling}
                onUpgradeClick={() => handleUpgradeClick('prompts')}
              />
              <TeamMeter
                count={memberCount}
                limit={memberLimit}
                canManageBilling={canManageBilling}
                onUpgradeClick={() => handleUpgradeClick('team')}
              />
            </div>
          </div>
        </div>
      </div>

      <UpgradeGateModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        resource={upgradeResource}
        current={upgradeResource === 'prompts' ? promptCount : memberCount}
        limit={upgradeResource === 'prompts' ? promptLimit : memberLimit}
      />
    </div>
  );
};

export default Analytics;

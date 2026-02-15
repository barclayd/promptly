import {
  IconApi,
  IconChartBar,
  IconFileText,
  IconUsers,
} from '@tabler/icons-react';
import { useState, useSyncExternalStore } from 'react';
import { useLoaderData } from 'react-router';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpIcon } from '~/components/ui/arrow-up-icon';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import type { ChartConfig } from '~/components/ui/chart';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart';
import { UpgradeGateModal } from '~/components/upgrade-gate-modal';
import { orgContext } from '~/context';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import {
  type DailyApiUsage,
  getDailyApiUsage,
} from '~/lib/subscription.server';
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

  const db = context.cloudflare.env.promptly;
  const dailyApiUsage = await getDailyApiUsage(db, org.organizationId);

  return { dailyApiUsage };
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
                <ArrowUpIcon size={14} />
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
                <ArrowUpIcon size={14} />
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

// --- Radial ring chart for API Calls ---

type ApiCallsMeterProps = {
  count: number;
  limit: number;
  canManageBilling: boolean;
  onUpgradeClick: () => void;
};

const ApiCallsMeter = ({
  count,
  limit,
  canManageBilling,
  onUpgradeClick,
}: ApiCallsMeterProps) => {
  const isClient = useIsClient();
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : limit === 0 ? 1 : count / limit;
  const isAtLimit = !isUnlimited && count >= limit;

  const endAngle = percentage * 360;

  const chartConfig = {
    apiCalls: {
      label: 'API Calls',
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
          <IconApi className="size-4" />
          API Calls
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
                            {count.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 24}
                            className="fill-muted-foreground"
                          >
                            {isUnlimited
                              ? 'Unlimited'
                              : `of ${limit.toLocaleString()}`}
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
                <ArrowUpIcon size={14} />
                Upgrade for more API calls
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask your admin to upgrade for more API calls
              </p>
            )
          ) : isUnlimited ? (
            <p className="text-sm text-muted-foreground">
              No limit on your plan
            </p>
          ) : (
            (() => {
              const remaining = limit - count;
              if (percentage >= 0.8) {
                return canManageBilling ? (
                  <p className="text-sm text-red-500">
                    Only {remaining.toLocaleString()} call
                    {remaining === 1 ? '' : 's'} left — upgrade for more
                  </p>
                ) : (
                  <p className="text-sm text-red-500">
                    Only {remaining.toLocaleString()} call
                    {remaining === 1 ? '' : 's'} left
                  </p>
                );
              }
              if (percentage >= 0.6) {
                return (
                  <p className="text-sm text-amber-500">
                    {remaining.toLocaleString()} remaining — running low
                  </p>
                );
              }
              return (
                <p className="text-sm text-muted-foreground">
                  {remaining.toLocaleString()} remaining this month
                </p>
              );
            })()
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// --- Area chart for daily API calls ---

type ApiCallsChartProps = {
  data: DailyApiUsage[];
  limit: number;
  totalCount: number;
};

const apiChartConfig = {
  count: {
    label: 'API Calls',
    color: 'hsl(243 75% 59%)',
  },
} satisfies ChartConfig;

const ApiCallsChart = ({ data, limit, totalCount }: ApiCallsChartProps) => {
  const isClient = useIsClient();
  const isUnlimited = limit === -1;

  const monthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconApi className="size-4" />
          API Calls
        </CardTitle>
        <CardDescription>
          <span className="tabular-nums font-medium text-foreground">
            {totalCount.toLocaleString()}
          </span>
          {isUnlimited ? (
            <span> calls this month</span>
          ) : (
            <span> of {limit.toLocaleString()} this month</span>
          )}
          {' \u00B7 '}
          {monthLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isClient ? (
          hasData ? (
            <ChartContainer
              config={apiChartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="fillApiCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-count)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-count)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value: string) => {
                    const date = new Date(`${value}T00:00:00`);
                    return date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={48}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`
                  }
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) =>
                        new Date(`${value}T00:00:00`).toLocaleDateString(
                          'en-US',
                          {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          },
                        )
                      }
                      indicator="dot"
                    />
                  }
                />
                {!isUnlimited && (
                  <ReferenceLine
                    y={limit}
                    stroke="hsl(0 84% 60%)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  >
                    <Label
                      value="Plan limit"
                      position="insideTopRight"
                      className="fill-red-500/60 text-[11px]"
                    />
                  </ReferenceLine>
                )}
                <Area
                  dataKey="count"
                  type="monotone"
                  fill="url(#fillApiCalls)"
                  stroke="var(--color-count)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center">
              <div className="text-center">
                <IconApi className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No API calls this month yet
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Usage will appear here as your API keys are used
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="h-[250px] w-full" />
        )}
      </CardContent>
    </Card>
  );
};

// --- Main page ---

type UpgradeResource = 'prompts' | 'team' | 'api-calls';

const Analytics = () => {
  const { dailyApiUsage } = useLoaderData<typeof loader>();
  const {
    promptCount,
    promptLimit,
    memberCount,
    memberLimit,
    apiCallCount,
    apiCallLimit,
  } = useResourceLimits();
  const { canManageBilling } = useCanManageBilling();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeResource, setUpgradeResource] =
    useState<UpgradeResource>('prompts');

  const handleUpgradeClick = (resource: UpgradeResource) => {
    setUpgradeResource(resource);
    setUpgradeModalOpen(true);
  };

  const getUpgradeCurrent = () => {
    if (upgradeResource === 'prompts') return promptCount;
    if (upgradeResource === 'team') return memberCount;
    return apiCallCount;
  };

  const getUpgradeLimit = () => {
    if (upgradeResource === 'prompts') return promptLimit;
    if (upgradeResource === 'team') return memberLimit;
    return apiCallLimit;
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
              <ApiCallsMeter
                count={apiCallCount}
                limit={apiCallLimit}
                canManageBilling={canManageBilling}
                onUpgradeClick={() => handleUpgradeClick('api-calls')}
              />
            </div>

            <div className="mt-6">
              <ApiCallsChart
                data={dailyApiUsage}
                limit={apiCallLimit}
                totalCount={apiCallCount}
              />
            </div>
          </div>
        </div>
      </div>

      <UpgradeGateModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        resource={upgradeResource}
        current={getUpgradeCurrent()}
        limit={getUpgradeLimit()}
      />
    </div>
  );
};

export default Analytics;

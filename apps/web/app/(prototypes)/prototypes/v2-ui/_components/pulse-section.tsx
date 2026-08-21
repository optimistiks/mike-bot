"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/8bit/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/8bit/card";

const chartConfig = {
  events: {
    label: "События",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const data = [
  { date: "01.08", events: 54 },
  { date: "03.08", events: 87 },
  { date: "05.08", events: 63 },
  { date: "07.08", events: 112 },
  { date: "09.08", events: 48 },
  { date: "11.08", events: 96 },
  { date: "13.08", events: 74 },
  { date: "15.08", events: 129 },
  { date: "17.08", events: 58 },
  { date: "19.08", events: 103 },
  { date: "21.08", events: 91 },
];

export function PulseSection() {
  return (
    <section aria-labelledby="pulse-title">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="pulse-title">Пульс чата</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={chartConfig}
            className="min-h-64 w-full"
            initialDimension={{ width: 760, height: 300 }}
          >
            <AreaChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                minTickGap={48}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={38}
                tickCount={4}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Area
                dataKey="events"
                type="step"
                fill="var(--color-events)"
                fillOpacity={0.24}
                stroke="var(--color-events)"
                strokeWidth={3}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </section>
  );
}

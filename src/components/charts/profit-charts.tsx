"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { monthLabel } from "@/server/services/goals";

/**
 * Gráfico mensal: receita (verde) vs despesa (vermelho) + linha de lucro.
 * Client component (recharts exige DOM).
 */
export function MonthlyProfitChart({
  data,
}: {
  data: { month: string; revenue: number; expense: number; profit: number }[];
}) {
  const chartData = data.map((point) => ({
    ...point,
    label: monthLabel(point.month),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" vertical={false} />
          <XAxis dataKey="label" stroke="hsl(218 15% 65%)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(218 15% 65%)" fontSize={11} tickLine={false} axisLine={false} width={64} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
          <Tooltip
            cursor={{ fill: "hsl(222 40% 12% / 0.4)" }}
            contentStyle={{
              backgroundColor: "hsl(224 40% 7%)",
              border: "1px solid hsl(222 30% 16%)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(210 40% 98%)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" name="Receita" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Despesa" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontais simples para receita por produto. */
export function ProductRevenueChart({
  data,
}: {
  data: { productName: string; revenue: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" vertical={false} />
          <XAxis
            dataKey="productName"
            stroke="hsl(218 15% 65%)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={0}
            tickFormatter={(value: string) => value.slice(0, 14)}
          />
          <YAxis stroke="hsl(218 15% 65%)" fontSize={11} tickLine={false} axisLine={false} width={64} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(224 40% 7%)",
              border: "1px solid hsl(222 30% 16%)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Receita"
            stroke="hsl(217 91% 60%)"
            strokeWidth={2}
            dot={{ fill: "hsl(187 92% 53%)", r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

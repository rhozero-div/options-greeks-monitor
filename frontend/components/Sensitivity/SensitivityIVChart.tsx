"use client";

import { useState, useEffect } from "react";
import { fetchSensitivityIV } from "@/lib/api";
import { SensitivityIVResponse } from "@/lib/types";
import { RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface SensitivityIVChartProps {
  symbol: string;
  portfolioId?: string;
}

export default function SensitivityIVChart({ symbol, portfolioId }: SensitivityIVChartProps) {
  const [data, setData] = useState<SensitivityIVResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    loadData();
  }, [symbol, portfolioId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSensitivityIV(symbol, portfolioId);
      setData(result);
    } catch (err) {
      setError("Failed to load IV sensitivity data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-gray-500">{error || "No data available"}</p>
        <button onClick={loadData} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (data.aggregated.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">No positions for {symbol}</p>
      </div>
    );
  }

  const { base_spot, base_iv_put, iv_values } = data;
  const ivMin = Math.min(...iv_values);
  const ivMax = Math.max(...iv_values);

  const formatIV = (val: number) => `${val > 0 ? "+" : ""}${val.toFixed(0)}%`;
  const formatValue = (val: number) => {
    if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    return val.toFixed(0);
  };

  const chartTheme = {
    gridColor: "#374151",
    tickColor: "#9CA3AF",
    tooltipBg: "#1F2937",
    lineColors: ["#06B6D4", "#10B981", "#F59E0B", "#EF4444"],
  };

  const commonProps = {
    data: data.aggregated,
    margin: { top: 10, right: 30, left: 0, bottom: 0 },
  };

  const yAxisProps = {
    tickFormatter: formatValue,
    tick: { fill: chartTheme.tickColor, fontSize: 11 },
    axisLine: { stroke: chartTheme.gridColor },
    tickLine: { stroke: chartTheme.gridColor },
    width: 60,
  };

  const xAxisProps = {
    dataKey: "iv_pct",
    tickFormatter: formatIV,
    tick: { fill: chartTheme.tickColor, fontSize: 11 },
    axisLine: { stroke: chartTheme.gridColor },
    tickLine: { stroke: chartTheme.gridColor },
    label: { value: "IV %", position: "insideBottomRight", offset: -10, fill: chartTheme.tickColor },
  };

  const tooltipProps = {
    contentStyle: { backgroundColor: chartTheme.tooltipBg, border: "none", borderRadius: "8px" },
    labelFormatter: (val: number) => {
      const point = data.aggregated.find((d) => d.iv_pct === val);
      const ivActual = point?.iv || 0;
      return `IV: ${(ivActual * 100).toFixed(1)}% (${formatIV(val)})`;
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{symbol} IV Sensitivity</h2>
          <p className="text-sm text-gray-500 mt-1">
            Spot: ${base_spot.toFixed(2)} Fixed | IV Range: {(ivMin * 100).toFixed(1)}% ~ {(ivMax * 100).toFixed(1)}%
          </p>
        </div>
        <button onClick={loadData} className="btn btn-ghost">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="card">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Portfolio Value</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip {...tooltipProps} formatter={(val: number) => [`$${formatValue(val)}`, "Value"]} />
            <ReferenceLine x={0} stroke="#06B6D4" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="total_value"
              stroke="#06B6D4"
              strokeWidth={2}
              dot={false}
              name="Portfolio Value"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Delta</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} formatter={(val: number) => [val.toFixed(2), "Delta"]} />
              <ReferenceLine x={0} stroke="#06B6D4" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="net_delta" stroke="#10B981" strokeWidth={2} dot={false} name="Delta" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Gamma</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} formatter={(val: number) => [val.toFixed(4), "Gamma"]} />
              <ReferenceLine x={0} stroke="#06B6D4" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="net_gamma" stroke="#F59E0B" strokeWidth={2} dot={false} name="Gamma" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Vega</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} formatter={(val: number) => [val.toFixed(2), "Vega"]} />
              <ReferenceLine x={0} stroke="#06B6D4" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="net_vega" stroke="#EF4444" strokeWidth={2} dot={false} name="Vega" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Theta</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} formatter={(val: number) => [val.toFixed(2), "Theta"]} />
              <ReferenceLine x={0} stroke="#06B6D4" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="net_theta" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Theta" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Vanna</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} formatter={(val: number) => [val.toFixed(2), "Vanna"]} />
              <ReferenceLine x={0} stroke="#06B6D4" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="net_vanna" stroke="#EC4899" strokeWidth={2} dot={false} name="Vanna" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Volga</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} formatter={(val: number) => [val.toFixed(4), "Volga"]} />
              <ReferenceLine x={0} stroke="#06B6D4" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="net_volga" stroke="#14B8A6" strokeWidth={2} dot={false} name="Volga" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

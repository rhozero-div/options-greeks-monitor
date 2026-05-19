"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { fetchSensitivity3D } from "@/lib/api";
import { Sensitivity3DResponse } from "@/lib/types";
import { RefreshCw } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Sensitivity3DChartProps {
  symbol: string;
  portfolioId?: string;
}

const GREEK_CONFIGS = [
  { key: "value_matrix", label: "Portfolio Value", color: "Turbo", unit: "$" },
  { key: "delta_matrix", label: "Delta", color: "Greens", unit: "" },
  { key: "gamma_matrix", label: "Gamma", color: "Oranges", unit: "" },
  { key: "vega_matrix", label: "Vega", color: "Blues", unit: "" },
  { key: "theta_matrix", label: "Theta", color: "Purples", unit: "" },
  { key: "vanna_matrix", label: "Vanna", color: "Pinkyl", unit: "" },
  { key: "volga_matrix", label: "Volga", color: "Tealgrn", unit: "" },
] as const;

export default function Sensitivity3DChart({ symbol, portfolioId }: Sensitivity3DChartProps) {
  const [data, setData] = useState<Sensitivity3DResponse | null>(null);
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
      const result = await fetchSensitivity3D(symbol, portfolioId);
      setData(result);
    } catch (err) {
      setError("Failed to load 3D sensitivity data");
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

  const { spot_values, iv_values, base_spot, base_iv_put } = data;

  const ivTickCount = 5;
  const ivMin = Math.min(...iv_values);
  const ivMax = Math.max(...iv_values);
  const ivTickStep = (ivMax - ivMin) / (ivTickCount - 1);
  const ivTicks = Array.from({ length: ivTickCount }, (_, i) => ivMin + i * ivTickStep);
  const ivTickText = ivTicks.map((v) => `${(v * 100).toFixed(1)}%`);

  const plotlyLayout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#9CA3AF", size: 11 },
    margin: { l: 0, r: 0, t: 30, b: 0 },
    scene: {
      xaxis: {
        title: { text: "Spot", font: { color: "#9CA3AF" } },
        tickformat: "$,.0f",
        backgroundcolor: "rgba(31,41,55,0.8)",
        gridcolor: "#374151",
        tickcolor: "#9CA3AF",
      },
      yaxis: {
        title: { text: "IV", font: { color: "#9CA3AF" } },
        tickvals: ivTicks,
        ticktext: ivTickText,
        backgroundcolor: "rgba(31,41,55,0.8)",
        gridcolor: "#374151",
        tickcolor: "#9CA3AF",
      },
      zaxis: {
        backgroundcolor: "rgba(31,41,55,0.8)",
        gridcolor: "#374151",
        tickcolor: "#9CA3AF",
      },
      camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
    },
    showlegend: false,
  } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{symbol} 3D Sensitivity</h2>
          <p className="text-sm text-gray-500 mt-1">
            Spot: ${base_spot.toFixed(2)} | IV: {(base_iv_put * 100).toFixed(1)}% | Grid: {spot_values.length}×{iv_values.length}
          </p>
        </div>
        <button onClick={loadData} className="btn btn-ghost">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {GREEK_CONFIGS.map((config) => {
          const matrix = data[config.key as keyof Sensitivity3DResponse] as number[][];
          if (!matrix || matrix.length === 0) return null;

          const flatValues = matrix.flat();
          const minVal = Math.min(...flatValues);
          const maxVal = Math.max(...flatValues);

          const trace: Partial<Plotly.PlotData> = {
            type: "surface",
            x: spot_values,
            y: iv_values,
            z: matrix,
            colorscale: config.color,
            showscale: true,
            colorbar: {
              len: 0.6,
              thickness: 12,
              tickformat: config.key === "value_matrix" ? "$,.0f" : ".3f",
              tickfont: { color: "#9CA3AF", size: 10 },
              title: { font: { color: "#9CA3AF", size: 10 } },
            },
            hovertemplate: `Spot: $%{x:.2f}<br>IV: %{y:.1%}<br>${config.label}: $%{z:.4f}<extra></extra>`,
            zmin: minVal,
            zmax: maxVal,
          };

          return (
            <div key={config.key} className="card">
              <h3 className="text-sm font-medium text-gray-400 mb-2">{config.label}</h3>
              <Plot
                data={[trace]}
                layout={plotlyLayout}
                style={{ width: "100%", height: "280px" }}
                config={{
                  displayModeBar: true,
                  modeBarButtonsToRemove: ["lasso2d", "select2d"] as any,
                  displaylogo: false,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

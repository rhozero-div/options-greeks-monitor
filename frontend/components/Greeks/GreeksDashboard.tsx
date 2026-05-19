"use client";

import { GreeksPortfolio, PriceData, GreeksDetailResponse, OptionGreeksDetail, UnderlyingGreeksSummary, EtfStockPositionDetail } from "@/lib/types";
import { Activity, TrendingUp, Zap, Clock, Target } from "lucide-react";
import clsx from "clsx";

const SYMBOL_ORDER = ["VOO", "QQQ", "GLD", "USO", "TLT"];

interface GreeksDashboardProps {
  greeks: GreeksPortfolio | null;
  loading: boolean;
  prices?: PriceData;
  greeksDetail?: GreeksDetailResponse | null;
}

function GreekCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
}) {
  const isPositive = value >= 0;

  return (
    <div className="card p-4 transition-all">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={clsx(
          "greeks-value text-2xl",
          isPositive ? "greeks-positive" : "greeks-negative"
        )}
      >
        {isPositive ? "+" : ""}
        {value.toFixed(4)}
      </div>
      <div className="text-gray-500 text-xs mt-1 mono">{unit}</div>
    </div>
  );
}

function SecondaryGreekRow({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <div
        className={clsx(
          "mono font-medium",
          value >= 0 ? "text-accent" : "text-accent-red"
        )}
      >
        {value >= 0 ? "+" : ""}
        {value.toFixed(6)}
      </div>
    </div>
  );
}

export default function GreeksDashboard({
  greeks,
  loading,
  prices = {},
  greeksDetail,
}: GreeksDashboardProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-surface-light rounded w-1/3"></div>
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-surface-light rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!greeks) {
    return (
      <div className="card text-center py-12 text-gray-500">
        No Greeks data available. Add positions to see Greeks.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-accent" />
          Portfolio Greeks
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <GreekCard
            label="Delta"
            value={greeks.net_delta}
            unit="$/price move"
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <GreekCard
            label="Gamma"
            value={greeks.net_gamma}
            unit="$/price move²"
            icon={<Zap className="w-4 h-4" />}
          />
          <GreekCard
            label="Theta"
            value={greeks.net_theta}
            unit="$/day"
            icon={<Clock className="w-4 h-4" />}
          />
          <GreekCard
            label="Vega"
            value={greeks.net_vega}
            unit="$/1% IV"
            icon={<Target className="w-4 h-4" />}
          />
          <GreekCard
            label="Rho"
            value={greeks.net_rho}
            unit="$/bps"
            icon={<Activity className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <GreekCard
            label="Vanna"
            value={greeks.total_vanna}
            unit="$/1% vol"
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <GreekCard
            label="Volga"
            value={greeks.total_dvega_dvol}
            unit="$/1% vol"
            icon={<Zap className="w-4 h-4" />}
          />
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Total Premium</div>
              <div className="mono text-lg">${greeks.total_premium.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-gray-400">Unrealized P&L</div>
              <div className={clsx("mono text-lg", (greeks.total_unrealized_pnl || 0) >= 0 ? "text-accent" : "text-accent-red")}>
                {(greeks.total_unrealized_pnl || 0) >= 0 ? "+" : ""}{greeks.total_unrealized_pnl.toFixed(0)}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Nominal Exposure</div>
              <div className="mono text-lg">${greeks.total_nominal.toFixed(0)}</div>
            </div>
          </div>
          {greeks.stock_delta !== 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-4 pt-4 border-t border-border/50">
              <div>
                <div className="text-gray-400">Stock Delta</div>
                <div className={clsx("mono text-lg", (greeks.stock_delta || 0) >= 0 ? "text-accent" : "text-accent-red")}>
                  {(greeks.stock_delta || 0) >= 0 ? "+" : ""}{(greeks.stock_delta || 0).toFixed(0)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {greeksDetail && greeksDetail.underlyings.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            Underlying Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-border/30">
                  <th className="text-left py-2 pr-4">Symbol</th>
                  <th className="text-right py-2 px-2">Spot</th>
                  <th className="text-right py-2 px-2">Net Delta</th>
                  <th className="text-right py-2 px-2">Net Gamma</th>
                  <th className="text-right py-2 px-2">Net Theta</th>
                  <th className="text-right py-2 px-2">Net Vega</th>
                  <th className="text-center py-2 pl-2">Pos</th>
                  <th className="text-right py-2 pl-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {([...greeksDetail.underlyings] as UnderlyingGreeksSummary[])
                  .sort((a, b) => {
                    const aIdx = SYMBOL_ORDER.indexOf(a.symbol);
                    const bIdx = SYMBOL_ORDER.indexOf(b.symbol);
                    const aOrder = aIdx === -1 ? 999 : aIdx;
                    const bOrder = bIdx === -1 ? 999 : bIdx;
                    return aOrder - bOrder;
                  })
                  .map((und: UnderlyingGreeksSummary) => (
                  <tr key={und.symbol} className="border-b border-border/20">
                    <td className="py-2 pr-4 font-medium text-cyan-400">{und.symbol}</td>
                    <td className="py-2 px-2 text-right mono text-yellow-400">
                      ${prices[und.symbol]?.toFixed(2) || und.spot_price.toFixed(2)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono", und.net_delta >= 0 ? "text-accent" : "text-accent-red")}>
                      {und.net_delta >= 0 ? "+" : ""}{und.net_delta.toFixed(2)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono", und.net_gamma >= 0 ? "text-accent" : "text-accent-red")}>
                      {und.net_gamma >= 0 ? "+" : ""}{und.net_gamma.toFixed(4)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono", und.net_theta >= 0 ? "text-accent" : "text-accent-red")}>
                      {und.net_theta >= 0 ? "+" : ""}{und.net_theta.toFixed(2)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono", und.net_vega >= 0 ? "text-accent" : "text-accent-red")}>
                      {und.net_vega >= 0 ? "+" : ""}{und.net_vega.toFixed(2)}
                    </td>
                    <td className="py-2 pl-2 text-center">{und.position_count}</td>
                    <td className={clsx("py-2 pl-2 text-right mono font-medium", (und.unrealized_pnl || 0) >= 0 ? "text-accent" : "text-accent-red")}>
                      {(und.unrealized_pnl || 0) >= 0 ? "+" : ""}{(und.unrealized_pnl || 0).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {greeksDetail && greeksDetail.options.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            Position Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-border/30">
                  <th className="text-left py-2 pr-3">Symbol</th>
                  <th className="text-center py-2 px-1">Type</th>
                  <th className="text-right py-2 px-2">Strike</th>
                  <th className="text-left py-2 px-2">Expiry</th>
                  <th className="text-right py-2 px-2">Spot</th>
                  <th className="text-right py-2 px-2">IV</th>
                  <th className="text-center py-2 px-1">Qty</th>
                  <th className="text-right py-2 px-2">Delta</th>
                  <th className="text-right py-2 px-2">Gamma</th>
                  <th className="text-right py-2 px-2">Theta</th>
                  <th className="text-right py-2 px-2">Vega</th>
                  <th className="text-right py-2 px-2">Value</th>
                  <th className="text-right py-2 px-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {([...greeksDetail.options] as OptionGreeksDetail[])
                  .sort((a, b) => {
                    const aIdx = SYMBOL_ORDER.indexOf(a.symbol);
                    const bIdx = SYMBOL_ORDER.indexOf(b.symbol);
                    const aOrder = aIdx === -1 ? 999 : aIdx;
                    const bOrder = bIdx === -1 ? 999 : bIdx;
                    if (aOrder !== bOrder) return aOrder - bOrder;
                    if (b.strike !== a.strike) return b.strike - a.strike;
                    return a.expiration.localeCompare(b.expiration);
                  })
                  .map((opt: OptionGreeksDetail) => (
                  <tr key={opt.position_id} className="border-b border-border/20">
                    <td className="py-2 pr-3 font-medium text-cyan-400">{opt.symbol}</td>
                    <td className="py-2 px-1 text-center text-gray-300">{opt.option_type.toUpperCase()}</td>
                    <td className="py-2 px-2 text-right mono">${opt.strike.toFixed(1)}</td>
                    <td className="py-2 px-2 text-left text-gray-400 text-xs">{opt.expiration.slice(0, 10)}</td>
                    <td className="py-2 px-2 text-right mono text-yellow-400">${opt.spot_price.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right mono text-yellow-400">{(opt.iv * 100).toFixed(1)}%</td>
                    <td className={clsx("py-2 px-1 text-center mono font-medium", opt.side === "long" ? "text-accent" : "text-accent-red")}>
                      {opt.side === "long" ? "+" : ""}{opt.quantity}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono", opt.delta >= 0 ? "text-accent" : "text-accent-red")}>
                      {opt.delta >= 0 ? "+" : ""}{opt.delta.toFixed(2)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono", opt.gamma >= 0 ? "text-accent" : "text-accent-red")}>
                      {opt.gamma >= 0 ? "+" : ""}{opt.gamma.toFixed(4)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono", opt.theta >= 0 ? "text-accent" : "text-accent-red")}>
                      {opt.theta >= 0 ? "+" : ""}{opt.theta.toFixed(2)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono", opt.vega >= 0 ? "text-accent" : "text-accent-red")}>
                      {opt.vega >= 0 ? "+" : ""}{opt.vega.toFixed(2)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono font-medium", opt.current_value >= 0 ? "text-accent" : "text-accent-red")}>
                      {opt.current_value >= 0 ? "+" : ""}${opt.current_value.toFixed(0)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono font-medium", opt.pnl >= 0 ? "text-accent" : "text-accent-red")}>
                      {opt.pnl >= 0 ? "+" : ""}{opt.pnl.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {greeksDetail && greeksDetail.etf_stocks && greeksDetail.etf_stocks.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            ETF / Stock Holdings
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-border/30">
                  <th className="text-left py-2 pr-3">Symbol</th>
                  <th className="text-center py-2 px-2">Type</th>
                  <th className="text-center py-2 px-1">Side</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Entry</th>
                  <th className="text-right py-2 px-2">Current</th>
                  <th className="text-right py-2 px-2">Value</th>
                  <th className="text-right py-2 px-2">P&L</th>
                  <th className="text-right py-2 px-2">Delta</th>
                </tr>
              </thead>
              <tbody>
                {([...greeksDetail.etf_stocks] as EtfStockPositionDetail[])
                  .sort((a, b) => {
                    const aIdx = SYMBOL_ORDER.indexOf(a.symbol);
                    const bIdx = SYMBOL_ORDER.indexOf(b.symbol);
                    const aOrder = aIdx === -1 ? 999 : aIdx;
                    const bOrder = bIdx === -1 ? 999 : bIdx;
                    return aOrder - bOrder;
                  })
                  .map((etf: EtfStockPositionDetail) => (
                  <tr key={etf.position_id} className="border-b border-border/20">
                    <td className="py-2 pr-3 font-medium text-cyan-400">{etf.symbol}</td>
                    <td className="py-2 px-2 text-center text-gray-400 text-xs uppercase">{etf.asset_type}</td>
                    <td className={clsx("py-2 px-1 text-center font-medium", etf.side === "long" ? "text-accent" : "text-accent-red")}>
                      {etf.side.toUpperCase()}
                    </td>
                    <td className="py-2 px-2 text-right mono">{etf.quantity}</td>
                    <td className="py-2 px-2 text-right mono text-gray-400">${etf.entry_price.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right mono text-yellow-400">${etf.spot_price.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right mono">${etf.current_value.toFixed(0)}</td>
                    <td className={clsx("py-2 px-2 text-right mono font-medium", etf.pnl >= 0 ? "text-accent" : "text-accent-red")}>
                      {etf.pnl >= 0 ? "+" : ""}{etf.pnl.toFixed(0)}
                    </td>
                    <td className={clsx("py-2 px-2 text-right mono", etf.delta >= 0 ? "text-accent" : "text-accent-red")}>
                      {etf.delta >= 0 ? "+" : ""}{etf.delta.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-medium mb-4 text-gray-400">Secondary Greeks</h3>
        <div className="divide-y divide-border/30">
          <SecondaryGreekRow
            label="Charm (Δt)"
            value={greeks.total_charm}
            description="Delta decay over time"
          />
          <SecondaryGreekRow
            label="Speed (ΓΔ)"
            value={greeks.total_speed}
            description="Gamma change per $1 move"
          />
          <SecondaryGreekRow
            label="Color (Γt)"
            value={greeks.total_color}
            description="Gamma decay over time"
          />
          <SecondaryGreekRow
            label="DvegaDvol"
            value={greeks.total_dvega_dvol}
            description="Vega change per vol change"
          />
          <SecondaryGreekRow
            label="Vanna"
            value={greeks.total_vanna}
            description="Delta change per vol change"
          />
        </div>
      </div>

      {Math.abs(greeks.net_delta) > 50 && (
        <div className="card border-accent-yellow/30 bg-accent-yellow/5">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-accent-yellow flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-accent-yellow">Delta Alert</div>
              <div className="text-sm text-gray-400 mt-1">
                Net Delta exposure is {greeks.net_delta.toFixed(2)}.
                {greeks.net_delta > 0
                  ? " Consider buying puts or selling calls to hedge."
                  : " Consider buying calls or selling puts to hedge."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

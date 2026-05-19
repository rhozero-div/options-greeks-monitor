"use client";

import { useState, useEffect, Fragment } from "react";
import { fetchScenarios, createScenario, updateScenario, deleteScenario, calculateScenario } from "@/lib/api";
import { Scenario, ScenarioCalculationResult, SymbolShift } from "@/lib/types";
import { RefreshCw, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";

interface ScenarioTab {
  id: string;
  name: string;
  shifts: { [symbol: string]: SymbolShift };
}

interface ScenarioPageProps {
  prices: { [key: string]: number };
  portfolioId?: string | null;
}

export default function ScenarioPage({ prices, portfolioId }: ScenarioPageProps) {
  const [tabs, setTabs] = useState<ScenarioTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("current");
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<{ [tabId: string]: ScenarioCalculationResult | null }>({});
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const symbols = Object.keys(prices);

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const saved: Scenario[] = await fetchScenarios();
      const scenarioTabs: ScenarioTab[] = saved.map((s) => ({
        id: s.id,
        name: s.name,
        shifts: s.shifts,
      }));
      const allTabs = [{ id: "current", name: "Current", shifts: buildCurrentShifts() }, ...scenarioTabs];
      setTabs(allTabs);
      setActiveTabId("current");
    } catch (err) {
      console.error("Failed to load scenarios:", err);
      setTabs([{ id: "current", name: "Current", shifts: buildCurrentShifts() }]);
      setActiveTabId("current");
    } finally {
      setLoading(false);
    }
  };

  function buildCurrentShifts(): { [symbol: string]: SymbolShift } {
    const shifts: { [symbol: string]: SymbolShift } = {};
    symbols.forEach((s) => {
      shifts[s] = { spot_chg: 0, iv_chg: 0 };
    });
    return shifts;
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleSpotChange = (symbol: string, value: string) => {
    const num = parseFloat(value) || 0;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, shifts: { ...t.shifts, [symbol]: { ...t.shifts[symbol], spot_chg: num / 100 } } }
          : t
      )
    );
  };

  const handleIvChange = (symbol: string, value: string) => {
    const num = parseFloat(value) || 0;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, shifts: { ...t.shifts, [symbol]: { ...t.shifts[symbol], iv_chg: num / 100 } } }
          : t
      )
    );
  };

  const handleSaveShifts = async () => {
    if (activeTab.id === "current") return;
    try {
      await updateScenario(activeTab.id, { shifts: activeTab.shifts });
    } catch (err) {
      console.error("Failed to save shifts:", err);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const result = await calculateScenario({
        name: activeTab.name,
        shifts: activeTab.shifts,
      }, portfolioId);
      setResults((prev) => ({ ...prev, [activeTabId]: result }));
    } catch (err) {
      console.error("Calculation failed:", err);
    } finally {
      setCalculating(false);
    }
  };

  const handleAddScenario = async () => {
    try {
      const shifts = buildCurrentShifts();
      const created = await createScenario({ name: "New Scenario", shifts });
      setTabs((prev) => [
        ...prev,
        { id: created.id, name: created.name, shifts: created.shifts },
      ]);
      setActiveTabId(created.id);
    } catch (err) {
      console.error("Failed to create scenario:", err);
    }
  };

  const handleSaveName = async (id: string, name: string) => {
    if (!name?.trim()) { setEditingTabId(null); return; }
    try {
      const updated = await updateScenario(id, { name: name.trim() });
      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, name: updated.name } : t))
      );
    } catch (err) {
      console.error("Failed to save name:", err);
    }
    setEditingTabId(null);
  };

  const handleDeleteScenario = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteScenario(id);
      setTabs((prev) => prev.filter((t) => t.id !== id));
      if (activeTabId === id) {
        setActiveTabId("current");
        setResults((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to delete scenario:", err);
    }
  };

  const formatPct = (v: number) => {
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}%`;
  };

  const formatDollarAbs = (v: number) => {
    const sign = v >= 0 ? "+" : "-";
    return `${sign}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  const currentResult = results[activeTabId];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((tab) => (
          <div key={tab.id} className="flex items-center gap-1">
            <button
              onClick={() => {
                if (editingTabId === tab.id) return;
                setActiveTabId(tab.id);
              }}
              onDoubleClick={() => {
                if (tab.id === "current") return;
                setEditingTabId(tab.id);
              }}
              className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                activeTabId === tab.id
                  ? "bg-accent text-white"
                  : "bg-surface-light text-gray-400 hover:text-white"
              }`}
            >
              {tab.id === "current" ? (
                <span>{tab.name}</span>
              ) : editingTabId === tab.id ? (
                <input
                  type="text"
                  autoFocus
                  defaultValue={tab.name}
                  onBlur={(e) => handleSaveName(tab.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName(tab.id, (e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setEditingTabId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent outline-none w-20 text-white"
                />
              ) : (
                <span onDoubleClick={() => setEditingTabId(tab.id)}>{tab.name}</span>
              )}
            </button>
            {tab.id !== "current" && (
              <button
                onClick={(e) => handleDeleteScenario(tab.id, e)}
                className="text-gray-500 hover:text-accent-red transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddScenario}
          className="flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-surface-light text-gray-400 hover:text-white transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {activeTab && (
        <div className="card">
          <div className="mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-border text-xs">
                  <th className="text-left py-2 px-3">Symbol</th>
                  <th className="text-right py-2 px-3">Spot</th>
                  <th className="text-right py-2 px-3">Spot Chg %</th>
                  <th className="text-right py-2 px-3">IV Chg %</th>
                </tr>
              </thead>
              <tbody>
                {symbols.map((sym) => {
                  const shift = activeTab.shifts[sym] || { spot_chg: 0, iv_chg: 0 };
                  return (
                    <tr key={sym} className="border-b border-border/50 hover:bg-surface-light/30">
                      <td className="py-2 px-3 font-medium">{sym}</td>
                      <td className="py-2 px-3 text-right mono text-gray-400">
                        ${prices[sym]?.toFixed(2) || "—"}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {activeTab.id === "current" ? (
                          <span className="mono text-gray-500">—</span>
                        ) : (
                          <input
                            type="number"
                            step="1"
                            defaultValue={Math.round(shift.spot_chg * 100)}
                            onChange={(e) => handleSpotChange(sym, e.target.value)}
                            onBlur={handleSaveShifts}
                            className="input w-20 text-right mono"
                          />
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {activeTab.id === "current" ? (
                          <span className="mono text-gray-500">—</span>
                        ) : (
                          <input
                            type="number"
                            step="1"
                            defaultValue={Math.round(shift.iv_chg * 100)}
                            onChange={(e) => handleIvChange(sym, e.target.value)}
                            onBlur={handleSaveShifts}
                            className="input w-20 text-right mono"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {activeTab.id !== "current" && (
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="btn btn-primary w-full mb-4"
            >
              {calculating ? "Calculating..." : "Calculate Scenario"}
            </button>
          )}

          {currentResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <div className="card bg-surface-light p-3">
                  <div className="text-gray-400 text-xs mb-1">Current Value</div>
                  <div className="mono text-base font-medium">
                    ${currentResult.portfolio_current_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="card bg-surface-light p-3">
                  <div className="text-gray-400 text-xs mb-1">Scenario Value</div>
                  <div className="mono text-base font-medium">
                    ${currentResult.portfolio_scenario_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="card bg-surface-light p-3">
                  <div className="text-gray-400 text-xs mb-1">P&L</div>
                  <div className={`mono text-base font-bold flex items-center gap-1 ${currentResult.portfolio_pnl >= 0 ? "text-accent" : "text-accent-red"}`}>
                    {currentResult.portfolio_pnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {formatDollarAbs(currentResult.portfolio_pnl)}
                  </div>
                </div>
                <div className="card bg-surface-light p-3">
                  <div className="text-gray-400 text-xs mb-1">P&L %</div>
                  <div className={`mono text-base font-bold ${currentResult.portfolio_pnl_pct >= 0 ? "text-accent" : "text-accent-red"}`}>
                    {formatPct(currentResult.portfolio_pnl_pct)}
                  </div>
                </div>
                <div className="card bg-surface-light p-3">
                  <div className="text-gray-400 text-xs mb-1">Curr Delta</div>
                  <div className={`mono text-base font-bold ${currentResult.portfolio_delta >= 0 ? "text-accent" : "text-accent-red"}`}>
                    {currentResult.portfolio_delta >= 0 ? "+" : ""}{currentResult.portfolio_delta.toFixed(2)}
                  </div>
                </div>
                <div className="card bg-surface-light p-3">
                  <div className="text-gray-400 text-xs mb-1">Scen Delta</div>
                  <div className={`mono text-base font-bold ${currentResult.portfolio_scenario_delta >= 0 ? "text-accent" : "text-accent-red"}`}>
                    {currentResult.portfolio_scenario_delta >= 0 ? "+" : ""}{currentResult.portfolio_scenario_delta.toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Per-Symbol Breakdown</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-border text-xs">
                      <th className="text-left py-2 px-3">Symbol</th>
                      <th className="text-right py-2 px-3">Curr Delta</th>
                      <th className="text-right py-2 px-3">Scen Delta</th>
                      <th className="text-right py-2 px-3">Delta Chg</th>
                      <th className="text-right py-2 px-3">Current Value</th>
                      <th className="text-right py-2 px-3">Scenario Value</th>
                      <th className="text-right py-2 px-3">P&L</th>
                      <th className="text-right py-2 px-3">P&L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentResult.by_symbol.map((item) => (
                      <Fragment key={item.symbol}>
                        <tr
                          className="border-b border-border/50 hover:bg-surface-light/30 cursor-pointer"
                          onClick={() => setExpandedSymbol(expandedSymbol === item.symbol ? null : item.symbol)}
                        >
                          <td className="py-2 px-3 font-medium">
                            <span className="mr-2">{expandedSymbol === item.symbol ? "▼" : "▶"}</span>
                            {item.symbol}
                          </td>
                          <td className={`py-2 px-3 text-right mono font-medium ${item.delta >= 0 ? "text-accent" : "text-accent-red"}`}>
                            {item.delta >= 0 ? "+" : ""}{item.delta.toFixed(2)}
                          </td>
                          <td className={`py-2 px-3 text-right mono font-medium ${item.scenario_delta >= 0 ? "text-accent" : "text-accent-red"}`}>
                            {item.scenario_delta >= 0 ? "+" : ""}{item.scenario_delta.toFixed(2)}
                          </td>
                          <td className={`py-2 px-3 text-right mono font-medium ${item.scenario_delta - item.delta >= 0 ? "text-accent" : "text-accent-red"}`}>
                            {item.scenario_delta - item.delta >= 0 ? "+" : ""}{(item.scenario_delta - item.delta).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right mono text-gray-400">
                            ${item.current_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2 px-3 text-right mono text-gray-400">
                            ${item.scenario_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`py-2 px-3 text-right mono font-medium ${item.pnl >= 0 ? "text-accent" : "text-accent-red"}`}>
                            {formatDollarAbs(item.pnl)}
                          </td>
                          <td className={`py-2 px-3 text-right mono font-medium ${item.pnl_pct >= 0 ? "text-accent" : "text-accent-red"}`}>
                            {formatPct(item.pnl_pct)}
                          </td>
                        </tr>
                        {expandedSymbol === item.symbol && item.by_position.length > 0 && (
                          <tr key={`${item.symbol}-positions`} className="bg-surface-light/30">
                            <td colSpan={8} className="py-2 px-6">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 border-b border-border/30">
                                    <th className="text-left py-1 px-2">Position</th>
                                    <th className="text-right py-1 px-2">Type</th>
                                    <th className="text-right py-1 px-2">Qty</th>
                                    <th className="text-right py-1 px-2">Curr Delta</th>
                                    <th className="text-right py-1 px-2">Scen Delta</th>
                                    <th className="text-right py-1 px-2">Entry</th>
                                    <th className="text-right py-1 px-2">Current Value</th>
                                    <th className="text-right py-1 px-2">Scenario Value</th>
                                    <th className="text-right py-1 px-2">P&L</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.by_position.map((pos) => (
                                    <tr key={pos.position_id} className="border-b border-border/20 hover:bg-surface-light/50">
                                      <td className="py-1 px-2">
                                        {pos.asset_type === "option"
                                          ? `${pos.symbol} ${pos.expiration?.slice(5)} ${pos.option_type?.toUpperCase()[0]} ${pos.strike}`
                                          : `${pos.symbol} ${pos.side === "long" ? "Long" : "Short"}`}
                                      </td>
                                      <td className="py-1 px-2 text-right text-gray-400">
                                        {pos.asset_type === "option"
                                          ? `${pos.option_type?.toUpperCase()} ${pos.strike}`
                                          : pos.asset_type.toUpperCase()}
                                      </td>
                                      <td className={`py-1 px-2 text-right mono ${pos.side === "long" ? "text-accent" : "text-accent-red"}`}>
                                        {pos.side === "long" ? "+" : "-"}{pos.quantity}
                                      </td>
                                      <td className={`py-1 px-2 text-right mono font-medium ${pos.delta >= 0 ? "text-accent" : "text-accent-red"}`}>
                                        {pos.delta >= 0 ? "+" : ""}{pos.delta.toFixed(2)}
                                      </td>
                                      <td className={`py-1 px-2 text-right mono font-medium ${pos.scenario_delta >= 0 ? "text-accent" : "text-accent-red"}`}>
                                        {pos.scenario_delta >= 0 ? "+" : ""}{pos.scenario_delta.toFixed(2)}
                                      </td>
                                      <td className="py-1 px-2 text-right mono text-gray-400">
                                        ${pos.entry_price.toFixed(2)}
                                      </td>
                                      <td className="py-1 px-2 text-right mono text-gray-400">
                                        ${pos.current_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                      </td>
                                      <td className="py-1 px-2 text-right mono text-gray-400">
                                        ${pos.scenario_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                      </td>
                                      <td className={`py-1 px-2 text-right mono font-medium ${pos.pnl >= 0 ? "text-accent" : "text-accent-red"}`}>
                                        {formatDollarAbs(pos.pnl)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab.id === "current" && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Create a new scenario tab to configure spot/IV changes and calculate P&L.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

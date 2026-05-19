"use client";

import { useState, useEffect } from "react";
import { fetchIV, setIV, fetchSettings, setRiskFreeRate, fetchPositions, fetchIVOverrides, setIVOverrides } from "@/lib/api";
import { Save, RefreshCw } from "lucide-react";

const SYMBOLS = ["VOO", "QQQ", "GLD", "USO", "TLT"];

interface IVData {
  [symbol: string]: {
    call: number;
    put: number;
  };
}

interface DividendYields {
  [symbol: string]: number;
}

interface Position {
  id: string;
  symbol: string;
  asset_type: string;
  option_type: string | null;
  strike: number | null;
  expiration: string | null;
  quantity: number;
  side: string;
  entry_price: number;
  status: string;
}

interface ContractIV {
  [key: string]: {
    call: number;
    put: number;
  };
}

interface Overrides {
  [symbol: string]: {
    [expiry: string]: {
      [strike: string]: {
        call: number;
        put: number;
      };
    };
  };
}

function contractKey(symbol: string, expiry: string, strike: number, optionType: string) {
  return `${symbol}|${expiry}|${strike}|${optionType}`;
}

export default function ParametersPage() {
  const [activeTab, setActiveTab] = useState<"iv" | "contract">("iv");
  const [ivData, setIvData] = useState<IVData>({});
  const [riskFreeRate, setRiskFreeRateState] = useState(0.05);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [positions, setPositions] = useState<Position[]>([]);
  const [contractIvData, setContractIvData] = useState<ContractIV>({});
  const [contractOverrides, setContractOverrides] = useState<Overrides>({});
  const [dividendYields, setDividendYields] = useState<DividendYields>({});
  const [irxRate, setIrxRate] = useState<number | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [ivResult, settingsResult, positionsResult, overridesResult] = await Promise.all([
        fetchIV(),
        fetchSettings(),
        fetchPositions(),
        fetchIVOverrides(),
      ]);
      setIvData(ivResult.iv);
      setIrxRate(settingsResult.risk_free_rate_irx);
      setRiskFreeRateState(settingsResult.risk_free_rate_fallback ?? 0.05);
      setDividendYields(settingsResult.dividend_yields || {});

      const openPositions = (positionsResult as Position[]).filter((p: Position) => p.status === "open" && p.asset_type === "option");
      setPositions(openPositions);

      setContractOverrides(overridesResult.overrides || {});

      const merged: ContractIV = {};
      const defaults = settingsResult.iv as IVData;
      for (const pos of openPositions) {
        const expiry = (pos.expiration || "").slice(0, 10);
        const strike = String(pos.strike || "");
        const optType = pos.option_type || "put";
        const key = contractKey(pos.symbol, expiry, pos.strike || 0, optType);

        const override = overridesResult.overrides?.[pos.symbol]?.[expiry]?.[strike];
        if (override) {
          merged[key] = { call: override.call, put: override.put };
        } else {
          const sym = pos.symbol.toUpperCase();
          merged[key] = {
            call: defaults[sym]?.call ?? 0.2,
            put: defaults[sym]?.put ?? 0.2,
          };
        }
      }
      setContractIvData(merged);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSymbolLevel = async () => {
    setError(null);
    for (const symbol of SYMBOLS) {
      if (ivData[symbol]?.call === 0 || ivData[symbol]?.put === 0) {
        setError("IV cannot be 0. Please enter a value greater than 0.");
        return;
      }
    }
    if (riskFreeRate <= 0 || riskFreeRate > 1) {
      setError("Risk-free rate must be between 0 and 1.");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      for (const symbol of SYMBOLS) {
        if (ivData[symbol]) {
          await setIV(symbol, "call", ivData[symbol].call);
          await setIV(symbol, "put", ivData[symbol].put);
        }
      }
      await setRiskFreeRate(riskFreeRate);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContractLevel = async () => {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const newOverrides: Overrides = {};
      for (const [key, iv] of Object.entries(contractIvData)) {
        const [symbol, expiry, strikeStr, optionType] = key.split("|");
        const strike = strikeStr;
        if (!newOverrides[symbol]) newOverrides[symbol] = {};
        if (!newOverrides[symbol][expiry]) newOverrides[symbol][expiry] = {};
        newOverrides[symbol][expiry][strike] = iv;
      }
      await setIVOverrides(newOverrides);
      setContractOverrides(newOverrides);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save contract IV:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleContractIvChange = (key: string, type: "call" | "put", value: string) => {
    const num = parseFloat(value) || 0;
    setContractIvData((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [type]: Math.min(5, Math.max(0, num)),
      },
    }));
  };

  const handleChange = (symbol: string, type: "call" | "put", value: string) => {
    const num = parseFloat(value) || 0;
    setIvData((prev) => ({
      ...prev,
      [symbol]: {
        ...prev[symbol],
        [type]: Math.min(5, num),
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("iv")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "iv"
              ? "text-white border-b-2 border-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Symbol IV
        </button>
        <button
          onClick={() => setActiveTab("contract")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "contract"
              ? "text-white border-b-2 border-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Contract IV
        </button>
      </div>

      {activeTab === "iv" && (
        <>
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Implied Volatility Settings</h2>
                <p className="text-sm text-gray-500 mt-1">
                  IV values are used for Greeks calculation. Enter IV as decimal (e.g., 0.20 for 20%).
                </p>
              </div>
              <button
                onClick={handleSaveSymbolLevel}
                disabled={saving}
                className="btn btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-light">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Symbol</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Dividend Yield</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Call IV</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Put IV</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Call IV %</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Put IV %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SYMBOLS.map((symbol) => (
                    <tr key={symbol} className="hover:bg-surface-light/50 transition-colors">
                      <td className="px-4 py-4">
                        <span className="font-mono font-semibold text-white">{symbol}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-gray-300 font-mono">
                          {dividendYields[symbol] ? (dividendYields[symbol] * 100).toFixed(2) + "%" : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          value={ivData[symbol]?.call ?? 0.2}
                          onChange={(e) => handleChange(symbol, "call", e.target.value)}
                          className="input w-full text-center"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          value={ivData[symbol]?.put ?? 0.2}
                          onChange={(e) => handleChange(symbol, "put", e.target.value)}
                          className="input w-full text-center"
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-gray-400 font-mono">
                          {((ivData[symbol]?.call || 0) * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-gray-400 font-mono">
                          {((ivData[symbol]?.put || 0) * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Risk-Free Rate</h2>
              <p className="text-sm text-gray-500 mt-1">
                Risk-free interest rate used in Black-Scholes option pricing.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">^IRX:</span>
                <span className="text-accent font-mono font-semibold">
                  {irxRate !== null ? (irxRate * 100).toFixed(2) + "%" : "N/A"}
                </span>
                <span className="text-xs text-gray-600">(live)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Fallback:</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  value={riskFreeRate}
                  onChange={(e) => setRiskFreeRateState(parseFloat(e.target.value) || 0)}
                  className="input w-24 text-center"
                />
                <span className="text-gray-400">= {(riskFreeRate * 100).toFixed(2)}%</span>
                <span className="text-xs text-gray-600">(Fallback to manually input rate if ^IRX unavailable)</span>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "contract" && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Per-Contract IV Settings</h2>
              <p className="text-sm text-gray-500 mt-1">
                Override IV for specific contracts. These take precedence over Symbol IV in Greeks calculations.
              </p>
            </div>
            <button
              onClick={handleSaveContractLevel}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

                  {positions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No open option positions. Add positions in the Positions tab.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-light">
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-400">Symbol</th>
                    <th className="px-3 py-3 text-center text-sm font-medium text-gray-400">Expiry</th>
                    <th className="px-3 py-3 text-center text-sm font-medium text-gray-400">Strike</th>
                    <th className="px-3 py-3 text-center text-sm font-medium text-gray-400">Type</th>
                    <th className="px-3 py-3 text-center text-sm font-medium text-gray-400">Call IV</th>
                    <th className="px-3 py-3 text-center text-sm font-medium text-gray-400">Put IV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {([...positions] as Position[])
                    .sort((a, b) => {
                      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
                      if ((b.strike || 0) !== (a.strike || 0)) return (b.strike || 0) - (a.strike || 0);
                      return (a.expiration || "").localeCompare(b.expiration || "");
                    })
                    .map((pos) => {
                    const expiry = (pos.expiration || "").slice(0, 10);
                    const strike = pos.strike || 0;
                    const optType = pos.option_type || "put";
                    const key = contractKey(pos.symbol, expiry, strike, optType);
                    return (
                      <tr key={pos.id} className="hover:bg-surface-light/50 transition-colors">
                        <td className="px-3 py-3">
                          <span className="font-mono font-semibold text-white">{pos.symbol}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-gray-300 font-mono text-sm">{expiry}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-gray-300 font-mono">{strike}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            optType === "call" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          }`}>
                            {optType.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="5"
                            value={contractIvData[key]?.call ?? 0.2}
                            onChange={(e) => handleContractIvChange(key, "call", e.target.value)}
                            className="input w-full text-center text-sm"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="5"
                            value={contractIvData[key]?.put ?? 0.2}
                            onChange={(e) => handleContractIvChange(key, "put", e.target.value)}
                            className="input w-full text-center text-sm"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
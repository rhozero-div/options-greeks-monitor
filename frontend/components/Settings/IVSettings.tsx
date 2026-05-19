"use client";

import { useState, useEffect } from "react";

const SYMBOLS = ["VOO", "QQQ", "GLD", "USO"];

interface IVData {
  [symbol: string]: {
    call: number;
    put: number;
  };
}

interface IVSettingsProps {
  onClose: () => void;
  onSave: () => void;
}

export default function IVSettings({ onClose, onSave }: IVSettingsProps) {
  const [ivData, setIvData] = useState<IVData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIV();
  }, []);

  const fetchIV = async () => {
    try {
      const res = await fetch("/api/v1/iv");
      const data = await res.json();
      setIvData(data.iv);
    } catch (err) {
      console.error("Failed to fetch IV:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const symbol of SYMBOLS) {
        if (ivData[symbol]) {
          await fetch(`/api/v1/iv/${symbol}/call?iv=${ivData[symbol].call}`, {
            method: "PUT",
          });
          await fetch(`/api/v1/iv/${symbol}/put?iv=${ivData[symbol].put}`, {
            method: "PUT",
          });
        }
      }
      onSave();
    } catch (err) {
      console.error("Failed to save IV:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (symbol: string, type: "call" | "put", value: string) => {
    const num = parseFloat(value) || 0;
    setIvData((prev) => ({
      ...prev,
      [symbol]: {
        ...prev[symbol],
        [type]: Math.max(0, Math.min(5, num)),
      },
    }));
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg">
          <div className="glass rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Implied Volatility Settings</h3>
              <button
                onClick={onClose}
                className="p-1 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-400 mb-2">
                    <div>Symbol</div>
                    <div className="text-center">Call IV</div>
                    <div className="text-center">Put IV</div>
                  </div>

                  {SYMBOLS.map((symbol) => (
                    <div
                      key={symbol}
                      className="grid grid-cols-3 gap-4 items-center"
                    >
                      <div className="font-mono font-medium">{symbol}</div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          value={ivData[symbol]?.call || 0.2}
                          onChange={(e) =>
                            handleChange(symbol, "call", e.target.value)
                          }
                          className="input w-full text-center"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          value={ivData[symbol]?.put || 0.2}
                          onChange={(e) =>
                            handleChange(symbol, "put", e.target.value)
                          }
                          className="input w-full text-center"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-border/50">
                  <p className="text-xs text-gray-500 mb-4">
                    IV values are used for Greeks calculation. Enter IV as decimal
                    (e.g., 0.20 for 20%). Changes take effect immediately.
                  </p>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary w-full"
                  >
                    {saving ? "Saving..." : "Save IV Settings"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

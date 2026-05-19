"use client";

import { useState, useEffect } from "react";
import { createPosition, updatePosition, fetchPortfolios } from "@/lib/api";
import { Position, Portfolio } from "@/lib/types";

type AssetType = "option" | "etf" | "stock";

interface PositionFormProps {
  position?: Position;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PositionForm({ position, onClose, onSuccess }: PositionFormProps) {
  const isEdit = !!position;
  const [assetType, setAssetType] = useState<AssetType>(
    position?.asset_type || "option"
  );
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    position?.portfolio_id || "main"
  );
  const entryPrice = position?.entry_price;
  const [form, setForm] = useState({
    symbol: position?.symbol || "VOO",
    option_type: (position?.option_type as "call" | "put") || "call",
    strike: position?.strike ?? 450,
    expiration: position?.expiration || "",
    quantity: position?.quantity ?? 1,
    side: (position?.side as "long" | "short") || "long",
    entry_price: typeof entryPrice === "number" && !isNaN(entryPrice) ? String(entryPrice) : "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPortfolios().then(setPortfolios).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const entryPriceVal = form.entry_price === "" ? 0 : Number(form.entry_price);
      const payload: any = {
        portfolio_id: selectedPortfolioId,
        asset_type: assetType,
        symbol: form.symbol,
        quantity: form.quantity,
        side: form.side,
        entry_price: entryPriceVal,
        option_symbol: null,
        option_type: null,
        strike: null,
        expiration: null,
      };

      if (assetType === "option") {
        payload.option_symbol = `${form.symbol}${form.expiration.replace(/-/g, "").slice(2)}${form.option_type === "call" ? "C" : "P"}${form.strike}`;
        payload.option_type = form.option_type;
        payload.strike = form.strike;
        payload.expiration = form.expiration;
      }

      if (isEdit && position) {
        await updatePosition(position.id, payload);
      } else {
        await createPosition(payload);
      }
      onSuccess();
    } catch (err) {
      alert(`Failed to ${isEdit ? "update" : "create"} position`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md">
          <div className="glass rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{isEdit ? "Edit Position" : "Add Position"}</h3>
              <button
                onClick={onClose}
                className="p-1 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Portfolio</label>
                <select
                  value={selectedPortfolioId}
                  onChange={(e) => setSelectedPortfolioId(e.target.value)}
                  className="input w-full"
                  required
                >
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Asset Type</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as AssetType)}
                  className="input w-full"
                  disabled={isEdit}
                >
                  <option value="option">Option</option>
                  <option value="etf">ETF</option>
                  <option value="stock">Stock</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Symbol</label>
                <input
                  type="text"
                  value={form.symbol}
                  onChange={(e) =>
                    setForm({ ...form, symbol: e.target.value.toUpperCase() })
                  }
                  className="input w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Side</label>
                  <select
                    value={form.side}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        side: e.target.value as "long" | "short",
                      })
                    }
                    className="input w-full"
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: parseInt(e.target.value) })
                    }
                    className="input w-full"
                    required
                  />
                </div>
              </div>

              {assetType === "option" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Type</label>
                      <select
                        value={form.option_type}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            option_type: e.target.value as "call" | "put",
                          })
                        }
                        className="input w-full"
                      >
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Strike</label>
                      <input
                        type="number"
                        step="1"
                        value={form.strike}
                        onChange={(e) =>
                          setForm({ ...form, strike: parseFloat(e.target.value) })
                        }
                        className="input w-full"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Expiration (YYYY-MM-DD)
                    </label>
                    <input
                      type="date"
                      value={form.expiration}
                      onChange={(e) =>
                        setForm({ ...form, expiration: e.target.value })
                      }
                      className="input w-full"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {assetType === "option" ? "Entry Premium" : "Entry Price"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.entry_price}
                  onChange={(e) =>
                    setForm({ ...form, entry_price: e.target.value })
                  }
                  className="input w-full"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn flex-1 bg-surface-light"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary flex-1"
                >
                  {submitting ? (isEdit ? "Saving..." : "Adding...") : (isEdit ? "Save Changes" : "Add Position")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

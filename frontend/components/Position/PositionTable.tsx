"use client";

import { useState, useEffect, useCallback } from "react";
import { Position, Portfolio } from "@/lib/types";
import { fetchPositions, deletePosition, closePosition, fetchPortfolios } from "@/lib/api";
import { Plus, Trash2, X, TrendingUp, Pencil } from "lucide-react";

const SYMBOL_ORDER = ["VOO", "QQQ", "GLD", "USO", "TLT"];

interface PositionTableProps {
  onRefresh: () => void;
  onShowAddForm: () => void;
  onEdit: (position: Position) => void;
  refreshKey?: number;
}

export default function PositionTable({ onRefresh, onShowAddForm, onEdit, refreshKey }: PositionTableProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    try {
      const data = await fetchPositions(selectedPortfolioId || undefined);
      setPositions(data.filter((p: Position) => p.status === "open"));
    } catch (err) {
      console.error("Failed to load positions:", err);
    }
  }, [selectedPortfolioId]);

  useEffect(() => {
    fetchPortfolios().then(setPortfolios).catch(console.error);
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions, refreshKey]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this position?")) return;
    await deletePosition(id);
    loadPositions();
    onRefresh();
  };

  const handleClose = async (id: string, exitPrice: number) => {
    await closePosition(id, exitPrice);
    loadPositions();
    onRefresh();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  const calculatePnL = (pos: Position) => {
    if (pos.asset_type === "option") {
      const current = pos.current_price || 0;
      const entry = pos.entry_price;
      const diff = current - entry;
      const multiplier = pos.side === "long" ? 1 : -1;
      return diff * multiplier * 100 * pos.quantity;
    } else {
      const current = pos.current_price || 0;
      const entry = pos.entry_price;
      const diff = current - entry;
      const multiplier = pos.side === "long" ? 1 : -1;
      return diff * multiplier * pos.quantity;
    }
  };

  const optionPositions = positions
    .filter(p => p.asset_type === "option")
    .sort((a, b) => {
      const aIdx = SYMBOL_ORDER.indexOf(a.symbol);
      const bIdx = SYMBOL_ORDER.indexOf(b.symbol);
      const aOrder = aIdx === -1 ? 999 : aIdx;
      const bOrder = bIdx === -1 ? 999 : bIdx;
      return aOrder - bOrder;
    });
  const etfStockPositions = positions
    .filter(p => p.asset_type === "etf" || p.asset_type === "stock")
    .sort((a, b) => {
      const aIdx = SYMBOL_ORDER.indexOf(a.symbol);
      const bIdx = SYMBOL_ORDER.indexOf(b.symbol);
      const aOrder = aIdx === -1 ? 999 : aIdx;
      const bOrder = bIdx === -1 ? 999 : bIdx;
      return aOrder - bOrder;
    });

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            Positions
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={selectedPortfolioId || ""}
              onChange={(e) => setSelectedPortfolioId(e.target.value || null)}
              className="input w-40"
            >
              <option value="">All Portfolios</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={onShowAddForm}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        {optionPositions.length === 0 && etfStockPositions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No open positions. Click "Add" to create one.
          </div>
        ) : (
          <>
            {optionPositions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm mb-6">
                  <thead>
                    <tr className="text-gray-400 border-b border-border">
                      <th className="text-left py-3 px-2">Symbol</th>
                      <th className="text-left py-3 px-2">Type</th>
                      <th className="text-right py-3 px-2">Strike</th>
                      <th className="text-right py-3 px-2">Exp</th>
                      <th className="text-right py-3 px-2">Qty</th>
                      <th className="text-right py-3 px-2">Side</th>
                      <th className="text-right py-3 px-2">Entry</th>
                      <th className="text-right py-3 px-2">Current</th>
                      <th className="text-right py-3 px-2">P&L</th>
                      <th className="text-right py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optionPositions.map((pos) => {
                      const pnl = calculatePnL(pos);
                      return (
                        <tr
                          key={pos.id}
                          className="border-b border-border/50 hover:bg-surface-light/50"
                        >
                          <td className="py-3 px-2 font-mono font-medium">
                            {pos.symbol}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                pos.option_type === "call"
                                  ? "bg-accent/20 text-accent"
                                  : "bg-accent-red/20 text-accent-red"
                              }`}
                            >
                              {pos.option_type?.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right mono">
                            ${pos.strike?.toFixed(2)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {pos.expiration ? formatDate(pos.expiration) : "-"}
                          </td>
                          <td className="py-3 px-2 text-right mono">{pos.quantity}</td>
                          <td className="py-3 px-2 text-right">
                            <span
                              className={pos.side === "long" ? "text-accent" : "text-accent-red"}
                            >
                              {pos.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right mono">
                            ${pos.entry_price.toFixed(2)}
                          </td>
                          <td className="py-3 px-2 text-right mono">
                            {pos.current_price
                              ? `$${pos.current_price.toFixed(2)}`
                              : "-"}
                          </td>
                          <td
                            className={`py-3 px-2 text-right mono font-medium ${
                              pnl >= 0 ? "text-accent" : "text-accent-red"
                            }`}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {pnl.toFixed(0)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => onEdit(pos)}
                                className="p-1 hover:text-accent transition-colors"
                                title="Edit position"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const price = prompt(
                                    "Enter exit price:",
                                    pos.current_price?.toString() || "0"
                                  );
                                  if (price) handleClose(pos.id, parseFloat(price));
                                }}
                                className="p-1 hover:text-accent transition-colors"
                                title="Close position"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(pos.id)}
                                className="p-1 hover:text-accent-red transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {etfStockPositions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">ETF / Stock Holdings</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-border">
                        <th className="text-left py-3 px-2">Symbol</th>
                        <th className="text-left py-3 px-2">Asset</th>
                        <th className="text-right py-3 px-2">Qty</th>
                        <th className="text-right py-3 px-2">Side</th>
                        <th className="text-right py-3 px-2">Entry</th>
                        <th className="text-right py-3 px-2">Current</th>
                        <th className="text-right py-3 px-2">Value</th>
                        <th className="text-right py-3 px-2">P&L</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etfStockPositions.map((pos) => {
                        const pnl = calculatePnL(pos);
                        const currentPrice = pos.current_price || 0;
                        const value = currentPrice * pos.quantity;
                        return (
                          <tr
                            key={pos.id}
                            className="border-b border-border/50 hover:bg-surface-light/50"
                          >
                            <td className="py-3 px-2 font-mono font-medium text-cyan-400">
                              {pos.symbol}
                            </td>
                            <td className="py-3 px-2">
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400 uppercase">
                                {pos.asset_type}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right mono">{pos.quantity}</td>
                            <td className="py-3 px-2 text-right">
                              <span
                                className={pos.side === "long" ? "text-accent" : "text-accent-red"}
                              >
                                {pos.side.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right mono">
                              ${pos.entry_price.toFixed(2)}
                            </td>
                            <td className="py-3 px-2 text-right mono">
                              {pos.current_price
                                ? `$${pos.current_price.toFixed(2)}`
                                : "-"}
                            </td>
                            <td className="py-3 px-2 text-right mono text-yellow-400">
                              ${value.toFixed(0)}
                            </td>
                            <td
                              className={`py-3 px-2 text-right mono font-medium ${
                                pnl >= 0 ? "text-accent" : "text-accent-red"
                              }`}
                            >
                              {pnl >= 0 ? "+" : ""}
                              {pnl.toFixed(0)}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => onEdit(pos)}
                                  className="p-1 hover:text-accent transition-colors"
                                  title="Edit position"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    const price = prompt(
                                      "Enter exit price:",
                                      pos.current_price?.toString() || "0"
                                    );
                                    if (price) handleClose(pos.id, parseFloat(price));
                                  }}
                                  className="p-1 hover:text-accent transition-colors"
                                  title="Close position"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(pos.id)}
                                  className="p-1 hover:text-accent-red transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

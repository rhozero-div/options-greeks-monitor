"use client";

import { useState, useEffect } from "react";
import { Portfolio } from "@/lib/types";
import { fetchPortfolios, deletePortfolio } from "@/lib/api";
import { Plus, Edit2, Trash2 } from "lucide-react";
import PortfolioForm from "./PortfolioForm";

export default function PortfolioSelector({
  selectedId,
  onSelect,
  onRefresh,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
}) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | undefined>();
  const [loading, setLoading] = useState(true);

  const loadPortfolios = async () => {
    try {
      const data = await fetchPortfolios();
      setPortfolios(data);
    } catch (err) {
      console.error("Failed to load portfolios", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolios();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this portfolio?")) return;
    try {
      await deletePortfolio(id);
      if (selectedId === id) {
        onSelect("main");
      }
      loadPortfolios();
      onRefresh();
    } catch (err) {
      alert("Failed to delete portfolio. Make sure it has no positions.");
    }
  };

  const handleEdit = (e: React.MouseEvent, portfolio: Portfolio) => {
    e.stopPropagation();
    setEditingPortfolio(portfolio);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPortfolio(undefined);
    loadPortfolios();
    onRefresh();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-48 bg-surface-light rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          selectedId === null
            ? "bg-accent text-black"
            : "bg-surface-light text-gray-300 hover:bg-surface-lighter"
        }`}
      >
        All Portfolios
      </button>

      {portfolios.map((p) => (
        <div key={p.id} className="relative group">
          <button
            onClick={() => onSelect(p.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              selectedId === p.id
                ? "text-black"
                : "text-gray-300 hover:bg-surface-lighter"
            }`}
            style={{
              backgroundColor:
                selectedId === p.id ? p.color : undefined,
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            {p.name}
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover:flex gap-1 bg-surface rounded-lg p-1 shadow-lg z-10">
            <button
              onClick={(e) => handleEdit(e, p)}
              className="p-1 hover:bg-surface-light rounded"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            {p.id !== "main" && (
              <button
                onClick={(e) => handleDelete(e, p.id)}
                className="p-1 hover:bg-surface-light rounded text-accent-red"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={() => {
          setEditingPortfolio(undefined);
          setShowForm(true);
        }}
        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-light text-gray-300 hover:bg-surface-lighter transition-all flex items-center gap-1"
      >
        <Plus className="w-4 h-4" />
        New
      </button>

      {showForm && (
        <PortfolioForm
          portfolio={editingPortfolio}
          onClose={() => {
            setShowForm(false);
            setEditingPortfolio(undefined);
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import { createPortfolio, updatePortfolio } from "@/lib/api";
import { Portfolio } from "@/lib/types";

export default function PortfolioForm({
  portfolio,
  onClose,
  onSuccess,
}: {
  portfolio?: Portfolio;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: portfolio?.name || "",
    color: portfolio?.color || "#808080",
    description: portfolio?.description || "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (portfolio) {
        await updatePortfolio(portfolio.id, form);
      } else {
        await createPortfolio(form);
      }
      onSuccess();
    } catch (err) {
      alert("Failed to save portfolio");
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
              <h3 className="text-lg font-semibold">
                {portfolio ? "Edit Portfolio" : "New Portfolio"}
              </h3>
              <button
                onClick={onClose}
                className="p-1 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Color</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="input flex-1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    placeholder="#808080"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="input w-full"
                  placeholder="Optional notes"
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
                  {submitting ? "Saving..." : portfolio ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
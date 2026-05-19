"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PositionTable from "@/components/Position/PositionTable";
import PositionForm from "@/components/Position/PositionForm";
import GreeksDashboard from "@/components/Greeks/GreeksDashboard";
import ScenarioPage from "@/components/Scenario/ScenarioPage";
import ParametersPage from "@/components/Parameters/ParametersPage";
import SensitivityChart from "@/components/Sensitivity/SensitivityChart";
import Sensitivity3DChart from "@/components/Sensitivity/Sensitivity3DChart";
import SensitivityIVChart from "@/components/Sensitivity/SensitivityIVChart";
import PortfolioSelector from "@/components/Portfolio/PortfolioSelector";
import { fetchGreeks, fetchPrices, fetchGreeksDetail } from "@/lib/api";
import { GreeksPortfolio, PriceData, IVData, GreeksDetailResponse, Position } from "@/lib/types";
import { Activity, PieChart, GitBranch, Sliders, TrendingUp } from "lucide-react";
import clsx from "clsx";

type Tab = "greeks" | "positions" | "scenario" | "parameters" | "sensitivity";

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="card">
        <div className="h-6 bg-surface-light rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4">
              <div className="h-4 bg-surface-light rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-surface-light rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="h-4 bg-surface-light rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-border/30">
              <div className="h-4 bg-surface-light rounded w-1/4"></div>
              <div className="h-4 bg-surface-light rounded w-1/6"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("greeks");
  const [greeks, setGreeks] = useState<GreeksPortfolio | null>(null);
  const [greeksDetail, setGreeksDetail] = useState<GreeksDetailResponse | null>(null);
  const [greeksLoading, setGreeksLoading] = useState(true);
  const [prices, setPrices] = useState<PriceData>({});
  const [sensitivitySymbol, setSensitivitySymbol] = useState<string>("QQQ");
  const [sensitivityIVSymbol, setSensitivityIVSymbol] = useState<string>("QQQ");
  const [sensitivity3DSymbol, setSensitivity3DSymbol] = useState<string>("QQQ");
  const [sensitivityView, setSensitivityView] = useState<"spot" | "iv" | "3d">("spot");
  const [ivData, setIvData] = useState<IVData>({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionRefreshKey, setPositionRefreshKey] = useState(0);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [sensitivityPortfolioId, setSensitivityPortfolioId] = useState<string | null>(null);
  const [scenarioPortfolioId, setScenarioPortfolioId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = useCallback(() => {
    if (typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `ws://localhost:8742/ws/greeks`;

    try {
      setWsStatus("connecting");
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsStatus("connected");
        ws.send(JSON.stringify({ type: "subscribe" }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "greeks_update") {
          if (selectedPortfolioId === null) {
            setGreeks(data.data);
            fetchGreeksDetail(undefined).then(setGreeksDetail).catch(console.error);
          } else {
            fetchGreeks(selectedPortfolioId).then(setGreeks).catch(console.error);
            fetchGreeksDetail(selectedPortfolioId).then(setGreeksDetail).catch(console.error);
          }
          setPrices(data.prices || {});
          setIvData(data.iv || {});
          setGreeksLoading(false);
          setInitialLoad(false);
        }
      };

      ws.onclose = () => {
        setWsStatus("disconnected");
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("WebSocket connection error:", err);
      setWsStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (!initialLoad) {
      if (selectedPortfolioId === null) {
        fetchGreeks(undefined).then(setGreeks).catch(console.error);
        fetchGreeksDetail(undefined).then(setGreeksDetail).catch(console.error);
      } else {
        fetchGreeks(selectedPortfolioId).then(setGreeks).catch(console.error);
        fetchGreeksDetail(selectedPortfolioId).then(setGreeksDetail).catch(console.error);
      }
    }
  }, [selectedPortfolioId, initialLoad]);

  const handleRefresh = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "refresh" }));
    } else {
      fetchGreeks(selectedPortfolioId || undefined).then(setGreeks).catch(console.error);
      fetchGreeksDetail(selectedPortfolioId || undefined).then(setGreeksDetail).catch(console.error);
    }
  }, [selectedPortfolioId]);

  const tabs = [
    { id: "greeks" as const, label: "Greeks", icon: Activity },
    { id: "positions" as const, label: "Positions", icon: PieChart },
    { id: "sensitivity" as const, label: "Sensitivity", icon: TrendingUp },
    { id: "scenario" as const, label: "Scenario", icon: GitBranch },
    { id: "parameters" as const, label: "Parameters", icon: Sliders },
  ];

  const formatPrice = (symbol: string) => {
    const price = prices[symbol];
    return price !== undefined ? `$${price.toFixed(2)}` : "...";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">Options Greeks Monitor</h1>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  {Object.entries(prices).length > 0 ? (
                    Object.entries(prices).map(([sym, price]) => (
                      <span key={sym} className="mono">
                        {sym}: ${price.toFixed(2)}
                      </span>
                    ))
                  ) : (
                    <span>Loading prices...</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  "w-2 h-2 rounded-full",
                  wsStatus === "connected"
                    ? "bg-accent"
                    : wsStatus === "connecting"
                    ? "bg-accent-yellow animate-pulse"
                    : "bg-gray-500"
                )}
                title={wsStatus}
              />

              {greeksLoading && initialLoad && (
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          <nav className="flex gap-1 mt-4 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                  activeTab === tab.id
                    ? "bg-surface border border-border border-b-background text-white"
                    : "text-gray-400 hover:text-white hover:bg-surface-light"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "greeks" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <PortfolioSelector
                selectedId={selectedPortfolioId}
                onSelect={setSelectedPortfolioId}
                onRefresh={() => {
                  fetchGreeks(selectedPortfolioId || undefined).then(setGreeks).catch(console.error);
                  fetchGreeksDetail(selectedPortfolioId || undefined).then(setGreeksDetail).catch(console.error);
                }}
              />
            </div>
            {initialLoad && greeksLoading ? (
              <LoadingSkeleton />
            ) : (
              <GreeksDashboard greeks={greeks} loading={greeksLoading} prices={prices} greeksDetail={greeksDetail} />
            )}
          </div>
        )}
        {activeTab === "positions" && (
          <PositionTable onRefresh={handleRefresh} onShowAddForm={() => setShowAddForm(true)} onEdit={(pos) => setEditingPosition(pos)} refreshKey={positionRefreshKey} />
        )}
        {activeTab === "scenario" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <PortfolioSelector
                selectedId={scenarioPortfolioId}
                onSelect={setScenarioPortfolioId}
                onRefresh={() => {}}
              />
            </div>
            <ScenarioPage prices={prices} portfolioId={scenarioPortfolioId} />
          </div>
        )}
        {activeTab === "parameters" && <ParametersPage />}
        {activeTab === "sensitivity" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSensitivityView("spot")}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    sensitivityView === "spot" ? "bg-accent text-white" : "bg-surface-light text-gray-400 hover:text-white"
                  }`}
                >
                  2D-Spot
                </button>
                <button
                  onClick={() => setSensitivityView("iv")}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    sensitivityView === "iv" ? "bg-accent text-white" : "bg-surface-light text-gray-400 hover:text-white"
                  }`}
                >
                  2D-IV
                </button>
                <button
                  onClick={() => setSensitivityView("3d")}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    sensitivityView === "3d" ? "bg-accent text-white" : "bg-surface-light text-gray-400 hover:text-white"
                  }`}
                >
                  3D
                </button>
              </div>
              <PortfolioSelector
                selectedId={sensitivityPortfolioId}
                onSelect={setSensitivityPortfolioId}
                onRefresh={() => {}}
              />
            </div>

            {sensitivityView === "spot" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-400">Symbol:</label>
                  <select
                    value={sensitivitySymbol}
                    onChange={(e) => setSensitivitySymbol(e.target.value)}
                    className="input w-32"
                  >
                    {Object.keys(prices).map((sym) => (
                      <option key={sym} value={sym}>{sym}</option>
                    ))}
                  </select>
                </div>
                <SensitivityChart symbol={sensitivitySymbol} prices={prices} portfolioId={sensitivityPortfolioId || undefined} />
              </div>
            )}

            {sensitivityView === "iv" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-400">Symbol:</label>
                  <select
                    value={sensitivityIVSymbol}
                    onChange={(e) => setSensitivityIVSymbol(e.target.value)}
                    className="input w-32"
                  >
                    {Object.keys(prices).map((sym) => (
                      <option key={sym} value={sym}>{sym}</option>
                    ))}
                  </select>
                </div>
                <SensitivityIVChart symbol={sensitivityIVSymbol} portfolioId={sensitivityPortfolioId || undefined} />
              </div>
            )}

            {sensitivityView === "3d" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-400">Symbol:</label>
                  <select
                    value={sensitivity3DSymbol}
                    onChange={(e) => setSensitivity3DSymbol(e.target.value)}
                    className="input w-32"
                  >
                    {Object.keys(prices).map((sym) => (
                      <option key={sym} value={sym}>{sym}</option>
                    ))}
                  </select>
                </div>
                <Sensitivity3DChart symbol={sensitivity3DSymbol} portfolioId={sensitivityPortfolioId || undefined} />
              </div>
            )}
          </div>
        )}
      </main>

      {(showAddForm || editingPosition) && (
        <PositionForm
          position={editingPosition || undefined}
          onClose={() => {
            setShowAddForm(false);
            setEditingPosition(null);
          }}
          onSuccess={() => {
            setShowAddForm(false);
            setEditingPosition(null);
            setPositionRefreshKey(k => k + 1);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}

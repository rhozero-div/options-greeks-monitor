const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:8742/api/v1"
  : "/api/v1";

export async function fetchPrices(): Promise<any> {
  const res = await fetch(`${API_BASE}/prices`);
  if (!res.ok) throw new Error("Failed to fetch prices");
  return res.json();
}

export async function fetchIV(): Promise<any> {
  const res = await fetch(`${API_BASE}/iv`);
  if (!res.ok) throw new Error("Failed to fetch IV");
  return res.json();
}

export async function setIV(symbol: string, optionType: string, iv: number): Promise<any> {
  const res = await fetch(`${API_BASE}/iv/${symbol}/${optionType}?iv=${iv}`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error("Failed to set IV");
  return res.json();
}

export async function fetchPositions(portfolioId?: string): Promise<any[]> {
  const url = portfolioId 
    ? `${API_BASE}/positions?portfolio_id=${portfolioId}`
    : `${API_BASE}/positions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch positions");
  return res.json();
}

export async function createPosition(position: any): Promise<any> {
  const res = await fetch(`${API_BASE}/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(position),
  });
  if (!res.ok) throw new Error("Failed to create position");
  return res.json();
}

export async function updatePosition(id: string, update: any): Promise<any> {
  const res = await fetch(`${API_BASE}/positions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error("Failed to update position");
  return res.json();
}

export async function deletePosition(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/positions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete position");
}

export async function closePosition(id: string, exitPrice: number): Promise<any> {
  const res = await fetch(`${API_BASE}/positions/close/${id}?exit_price=${exitPrice}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to close position");
  return res.json();
}

export async function fetchGreeks(portfolioId?: string): Promise<any> {
  const url = portfolioId 
    ? `${API_BASE}/greeks?portfolio_id=${portfolioId}`
    : `${API_BASE}/greeks`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error("Failed to fetch Greeks");
  return res.json();
}

export async function fetchGreeksDetail(portfolioId?: string): Promise<any> {
  const url = portfolioId 
    ? `${API_BASE}/greeks/detail?portfolio_id=${portfolioId}`
    : `${API_BASE}/greeks/detail`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch Greeks detail");
  return res.json();
}

export async function runScenario(params: {
  symbol: string;
  price_shifts: number[];
  spot_price: number;
  volatility?: number;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to run scenario");
  return res.json();
}

export async function fetchSensitivity(symbol: string, minPct = -50, maxPct = 50, stepPct = 5, portfolioId?: string): Promise<any> {
  const url = portfolioId 
    ? `${API_BASE}/sensitivity?portfolio_id=${portfolioId}`
    : `${API_BASE}/sensitivity`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, min_pct: minPct, max_pct: maxPct, step_pct: stepPct }),
  });
  if (!res.ok) throw new Error("Failed to fetch sensitivity");
  return res.json();
}

export async function fetchSettings(): Promise<any> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function setRiskFreeRate(rate: number): Promise<any> {
  const res = await fetch(`${API_BASE}/settings/risk_free_rate?rate=${rate}`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error("Failed to set risk free rate");
  return res.json();
}

export async function fetchIVOverrides(): Promise<any> {
  const res = await fetch(`${API_BASE}/iv/overrides`);
  if (!res.ok) throw new Error("Failed to fetch IV overrides");
  return res.json();
}

export async function setIVOverrides(overrides: any): Promise<any> {
  const res = await fetch(`${API_BASE}/iv/overrides`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides }),
  });
  if (!res.ok) throw new Error("Failed to set IV overrides");
  return res.json();
}

export async function fetchSensitivity3D(symbol: string, portfolioId?: string): Promise<any> {
  const url = portfolioId 
    ? `${API_BASE}/sensitivity-3d?portfolio_id=${portfolioId}`
    : `${API_BASE}/sensitivity-3d`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) throw new Error("Failed to fetch 3D sensitivity");
  return res.json();
}

export async function fetchSensitivityIV(symbol: string, portfolioId?: string): Promise<any> {
  const url = portfolioId 
    ? `${API_BASE}/sensitivity-iv?portfolio_id=${portfolioId}`
    : `${API_BASE}/sensitivity-iv`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) throw new Error("Failed to fetch IV sensitivity");
  return res.json();
}

export async function fetchScenarios(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/scenarios`);
  if (!res.ok) throw new Error("Failed to fetch scenarios");
  return res.json();
}

export async function createScenario(data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create scenario");
  return res.json();
}

export async function updateScenario(id: string, data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/scenarios/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update scenario");
  return res.json();
}

export async function deleteScenario(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/scenarios/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete scenario");
}

export async function calculateScenario(data: any, portfolioId?: string | null): Promise<any> {
  const url = portfolioId 
    ? `${API_BASE}/scenario/calculate?portfolio_id=${portfolioId}`
    : `${API_BASE}/scenario/calculate`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to calculate scenario");
  return res.json();
}

export async function fetchPortfolios(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/portfolios`);
  if (!res.ok) throw new Error("Failed to fetch portfolios");
  return res.json();
}

export async function createPortfolio(data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/portfolios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create portfolio");
  return res.json();
}

export async function updatePortfolio(id: string, data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/portfolios/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update portfolio");
  return res.json();
}

export async function deletePortfolio(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/portfolios/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete portfolio");
}

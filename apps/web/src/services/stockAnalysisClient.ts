import type { StockAnalysisResponse } from "@share-stock-god/shared";

export async function fetchStockAnalysis(symbol: string): Promise<StockAnalysisResponse> {
  const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/analysis?limit=20`);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "查询失败");
  }

  return (await response.json()) as StockAnalysisResponse;
}

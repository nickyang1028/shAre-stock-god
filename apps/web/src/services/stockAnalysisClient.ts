import type { StockAnalysisResponse } from "@share-stock-god/shared";

/**
 * 请求后端股票分析接口。
 * @param {string} symbol 股票代码
 * @returns {Promise<StockAnalysisResponse>} 股票分析结果
 */
export async function fetchStockAnalysis(symbol: string): Promise<StockAnalysisResponse> {
  // 副作用说明：发起网络请求并在失败时抛出可展示错误。
  const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/analysis?limit=30`);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "查询失败");
  }

  return (await response.json()) as StockAnalysisResponse;
}

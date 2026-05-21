import type { StockAnalysisResponse } from "@share-stock-god/shared";
import { fetchDailyKLines } from "../market-data/eastmoney.js";
import { detectSignals } from "../signals/detectSignals.js";

type GetStockAnalysisParams = {
  /** 股票代码 */
  symbol: string;
  /** 返回的最近交易日数量 */
  limit: number;
};

/**
 * 获取股票分析结果（K 线 + 信号）。
 * @param {GetStockAnalysisParams} params 查询参数
 * @returns {Promise<StockAnalysisResponse>} 面向前端的分析结果
 */
export async function getStockAnalysis(params: GetStockAnalysisParams): Promise<StockAnalysisResponse> {
  // 边界处理：将 limit 限制在 1~120，避免异常参数导致接口压力过大。
  const safeLimit = Number.isFinite(params.limit) ? Math.min(Math.max(params.limit, 1), 120) : 20;
  // 关键逻辑：额外拉取更长历史，保证均线与 MACD 计算有足够预热数据。
  const historyLimit = Math.max(safeLimit + 80, 120);
  const marketData = await fetchDailyKLines({
    symbol: params.symbol,
    limit: historyLimit,
  });

  const recentKlines = marketData.klines.slice(-safeLimit);
  const signals = detectSignals(marketData.klines).filter((signal) =>
    recentKlines.some((kline) => kline.timestamp === signal.timestamp),
  );

  return {
    symbol: marketData.symbol,
    name: marketData.name,
    period: "1d",
    limit: safeLimit,
    klines: recentKlines,
    signals,
    source: "eastmoney",
    adjustment: "qfq",
  };
}

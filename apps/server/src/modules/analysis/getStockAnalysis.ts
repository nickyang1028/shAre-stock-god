import type { StockAnalysisResponse } from "@share-stock-god/shared";
import { fetchDailyKLines } from "../market-data/eastmoney.js";
import { detectSignals } from "../signals/detectSignals.js";

type GetStockAnalysisParams = {
  symbol: string;
  limit: number;
};

export async function getStockAnalysis(params: GetStockAnalysisParams): Promise<StockAnalysisResponse> {
  const safeLimit = Number.isFinite(params.limit) ? Math.min(Math.max(params.limit, 1), 120) : 20;
  const historyLimit = Math.max(safeLimit + 80, 120);
  const marketData = await fetchDailyKLines({
    symbol: params.symbol,
    limit: historyLimit,
  });
  const signals = detectSignals(marketData.klines).filter((signal) =>
    marketData.klines.slice(-safeLimit).some((kline) => kline.timestamp === signal.timestamp),
  );

  return {
    symbol: marketData.symbol,
    name: marketData.name,
    period: "1d",
    limit: safeLimit,
    klines: marketData.klines.slice(-safeLimit),
    signals,
    source: "eastmoney",
    adjustment: "qfq",
  };
}

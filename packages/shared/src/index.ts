export type ASharePeriod = "1d";

export type SignalDirection = "bullish" | "bearish" | "neutral";

export type SignalType =
  | "bullish_engulfing"
  | "bearish_engulfing"
  | "ma_golden_cross"
  | "ma_dead_cross"
  | "macd_golden_cross"
  | "macd_dead_cross";

export type KLine = {
  symbol: string;
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
};

export type Signal = {
  id: string;
  symbol: string;
  timestamp: number;
  date: string;
  type: SignalType;
  name: string;
  direction: SignalDirection;
  strength: 1 | 2 | 3 | 4 | 5;
  description: string;
  price: number;
};

export type StockAnalysisResponse = {
  symbol: string;
  name: string;
  period: ASharePeriod;
  limit: number;
  klines: KLine[];
  signals: Signal[];
  source: string;
  adjustment: "qfq";
};

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
  /** 股票代码，例如 600519.SH */
  symbol: string;
  /** 交易日收盘时间戳（毫秒） */
  timestamp: number;
  /** 交易日期，格式 YYYY-MM-DD */
  date: string;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 收盘价 */
  close: number;
  /** 成交量 */
  volume: number;
  /** 成交额 */
  amount: number;
};

export type Signal = {
  /** 信号唯一标识 */
  id: string;
  /** 股票代码 */
  symbol: string;
  /** 信号对应交易日时间戳（毫秒） */
  timestamp: number;
  /** 信号日期，格式 YYYY-MM-DD */
  date: string;
  /** 信号类型 */
  type: SignalType;
  /** 信号名称（中文展示） */
  name: string;
  /** 信号方向 */
  direction: SignalDirection;
  /** 信号强度，1~5 */
  strength: 1 | 2 | 3 | 4 | 5;
  /** 信号说明文本 */
  description: string;
  /** 信号触发时价格 */
  price: number;
};

export type StockAnalysisResponse = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** K 线周期 */
  period: ASharePeriod;
  /** 返回的最近交易日数量 */
  limit: number;
  /** 最近 K 线序列 */
  klines: KLine[];
  /** 对应区间内识别出的信号 */
  signals: Signal[];
  /** 数据来源 */
  source: string;
  /** 复权方式 */
  adjustment: "qfq";
};

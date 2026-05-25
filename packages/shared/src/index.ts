export type ASharePeriod = "1d";

export type SignalDirection = "bullish" | "bearish" | "neutral";

export type SignalType =
  // K线形态
  | "bullish_engulfing"           // 阳包阴
  | "bearish_engulfing"           // 阴包阳
  | "hammer"                       // 锤子线
  | "inverted_hammer"            // 倒锤子线
  | "doji"                         // 十字星
  | "morning_star"                // 早晨之星
  | "evening_star"                // 黄昏之星
  | "shooting_star"               // 流星线
  | "hanging_man"                 // 吊颈线
  // 均线信号
  | "ma_golden_cross"             // 均线金叉
  | "ma_dead_cross"               // 均线死叉
  // MACD信号
  | "macd_golden_cross"           // MACD金叉
  | "macd_dead_cross"             // MACD死叉
  // 背离信号
  | "macd_bullish_divergence"     // MACD底背离
  | "macd_bearish_divergence"     // MACD顶背离
  | "rsi_bullish_divergence"      // RSI底背离
  | "rsi_bearish_divergence"      // RSI顶背离
  // 支撑阻力信号
  | "support_bounce"              // 支撑反弹
  | "resistance_rejection"        // 阻力回落
  | "support_break"               // 跌破支撑
  | "resistance_break";           // 突破阻力

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

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
  /** 信号可信度评分，0~100 */
  confidence: number;
  /** 信号触发原因，用于前端解释展示 */
  reasons: string[];
  /** 信号计算时的关键数据快照 */
  metrics: SignalMetric[];
  /** 信号辅助标签 */
  tags: string[];
};

export type SignalMetric = {
  /** 指标名称 */
  label: string;
  /** 指标展示值 */
  value: string;
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

export type BacktestStrategyType = "ma_cross";

export type BacktestExecutionPrice = "next_open";

export type BacktestSide = "buy" | "sell";

export type BacktestStrategyConfig = {
  /** 策略类型 */
  type: BacktestStrategyType;
  /** 短周期均线参数 */
  shortPeriod: number;
  /** 长周期均线参数 */
  longPeriod: number;
};

export type BacktestConfig = {
  /** 初始资金 */
  initialCapital: number;
  /** 买卖双边手续费率，小数形式 */
  feeRate: number;
  /** 卖出印花税率，小数形式 */
  stampTaxRate: number;
  /** 滑点率，小数形式 */
  slippageRate: number;
  /** A 股整手股数 */
  lotSize: number;
  /** 成交价口径 */
  executionPrice: BacktestExecutionPrice;
  /** 策略配置 */
  strategy: BacktestStrategyConfig;
};

export type BacktestTrade = {
  /** 交易编号 */
  id: string;
  /** 股票代码 */
  symbol: string;
  /** 买卖方向 */
  side: BacktestSide;
  /** 信号日期 */
  signalDate: string;
  /** 成交日期 */
  tradeDate: string;
  /** 成交价格 */
  price: number;
  /** 成交股数 */
  shares: number;
  /** 成交金额 */
  amount: number;
  /** 手续费 */
  fee: number;
  /** 印花税 */
  tax: number;
  /** 交易后现金 */
  cashAfterTrade: number;
  /** 交易后持仓股数 */
  positionAfterTrade: number;
};

export type BacktestEquityPoint = {
  /** 交易日期 */
  date: string;
  /** 账户权益 */
  equity: number;
  /** 可用现金 */
  cash: number;
  /** 持仓股数 */
  position: number;
  /** 当日收盘价 */
  close: number;
};

export type BacktestMetrics = {
  /** 初始资金 */
  initialCapital: number;
  /** 期末权益 */
  finalEquity: number;
  /** 总收益率，小数形式 */
  totalReturn: number;
  /** 年化收益率，小数形式 */
  annualizedReturn: number;
  /** 最大回撤，小数形式 */
  maxDrawdown: number;
  /** 交易次数 */
  tradeCount: number;
  /** 完整卖出交易中的盈利次数 */
  winCount: number;
  /** 完整卖出交易中的亏损次数 */
  lossCount: number;
  /** 胜率，小数形式 */
  winRate: number;
};

export type BacktestResult = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 数据来源 */
  source: string;
  /** 回测配置 */
  config: BacktestConfig;
  /** 绩效指标 */
  metrics: BacktestMetrics;
  /** 交易流水 */
  trades: BacktestTrade[];
  /** 权益曲线 */
  equityCurve: BacktestEquityPoint[];
};

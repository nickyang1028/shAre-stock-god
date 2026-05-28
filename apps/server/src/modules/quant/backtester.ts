import type {
  BacktestConfig,
  BacktestEquityPoint,
  BacktestMetrics,
  BacktestResult,
  BacktestTrade,
  KLine,
} from '@share-stock-god/shared';

type BacktestInput = {
  /** 股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 数据来源 */
  source: string;
  /** K 线数据 */
  klines: KLine[];
  /** 回测配置 */
  config: BacktestConfig;
};

type BacktestState = {
  /** 当前现金 */
  cash: number;
  /** 当前持仓股数 */
  position: number;
  /** 当前持仓总成本 */
  positionCost: number;
  /** 累计盈利卖出次数 */
  winCount: number;
  /** 累计亏损卖出次数 */
  lossCount: number;
};

type StrategySignal = {
  /** 信号方向 */
  side: 'buy' | 'sell';
  /** 信号所在 K 线索引 */
  signalIndex: number;
  /** 成交所在 K 线索引 */
  tradeIndex: number;
};

/**
 * 执行单股票回测。
 * @param {BacktestInput} input 回测输入
 * @returns {BacktestResult} 回测结果
 */
export function runBacktest(input: BacktestInput): BacktestResult {
  if (input.klines.length < input.config.strategy.longPeriod + 2) {
    throw new Error('K线数据不足，无法执行回测');
  }

  const signals = generateSignals(input.klines, input.config);
  const state: BacktestState = {
    cash: input.config.initialCapital,
    position: 0,
    positionCost: 0,
    winCount: 0,
    lossCount: 0,
  };
  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestEquityPoint[] = [];
  let signalCursor = 0;

  input.klines.forEach((kline, index) => {
    // 副作用说明：按时间顺序消费已生成信号并更新账户状态。
    while (signals[signalCursor]?.tradeIndex === index) {
      const signal = signals[signalCursor];
      if (signal !== undefined) {
        const trade = executeSignal({
          signal,
          klines: input.klines,
          symbol: input.symbol,
          config: input.config,
          state,
          tradeOrder: trades.length + 1,
        });
        if (trade !== null) {
          trades.push(trade);
        }
      }
      signalCursor += 1;
    }

    equityCurve.push({
      date: kline.date,
      equity: roundMoney(state.cash + state.position * kline.close),
      cash: roundMoney(state.cash),
      position: state.position,
      close: kline.close,
    });
  });

  const metrics = calculateMetrics({
    equityCurve,
    initialCapital: input.config.initialCapital,
    tradeCount: trades.length,
    winCount: state.winCount,
    lossCount: state.lossCount,
  });

  return {
    symbol: input.symbol,
    name: input.name,
    source: input.source,
    config: input.config,
    metrics,
    trades,
    equityCurve,
  };
}

/**
 * 生成策略信号。
 * @param {KLine[]} klines K 线数据
 * @param {BacktestConfig} config 回测配置
 * @returns {StrategySignal[]} 策略信号数组
 */
function generateSignals(
  klines: KLine[],
  config: BacktestConfig
): StrategySignal[] {
  switch (config.strategy.type) {
    case 'ma_cross':
      return generateMaCrossSignals(klines, config);
    default:
      return [];
  }
}

/**
 * 生成 MA 金叉买入、死叉卖出信号。
 * @param {KLine[]} klines K 线数据
 * @param {BacktestConfig} config 回测配置
 * @returns {StrategySignal[]} 策略信号数组
 */
function generateMaCrossSignals(
  klines: KLine[],
  config: BacktestConfig
): StrategySignal[] {
  const closes = klines.map((kline) => kline.close);
  const signals: StrategySignal[] = [];
  const startIndex = config.strategy.longPeriod;

  for (let index = startIndex; index < klines.length - 1; index += 1) {
    const previousShortMA = calculateMA(closes, config.strategy.shortPeriod, index - 1);
    const previousLongMA = calculateMA(closes, config.strategy.longPeriod, index - 1);
    const currentShortMA = calculateMA(closes, config.strategy.shortPeriod, index);
    const currentLongMA = calculateMA(closes, config.strategy.longPeriod, index);

    if (
      previousShortMA === null ||
      previousLongMA === null ||
      currentShortMA === null ||
      currentLongMA === null
    ) {
      continue;
    }

    if (previousShortMA <= previousLongMA && currentShortMA > currentLongMA) {
      signals.push({ side: 'buy', signalIndex: index, tradeIndex: index + 1 });
    } else if (previousShortMA >= previousLongMA && currentShortMA < currentLongMA) {
      signals.push({ side: 'sell', signalIndex: index, tradeIndex: index + 1 });
    }
  }

  return signals;
}

/**
 * 计算指定索引处的移动平均线。
 * @param {number[]} values 输入数值序列
 * @param {number} period 均线周期
 * @param {number} endIndex 结束索引
 * @returns {number | null} 均线数值
 */
function calculateMA(
  values: number[],
  period: number,
  endIndex: number
): number | null {
  const startIndex = endIndex - period + 1;
  if (period <= 0 || startIndex < 0) {
    return null;
  }

  let sum = 0;
  for (let index = startIndex; index <= endIndex; index += 1) {
    const value = values[index];
    if (value === undefined) {
      return null;
    }
    sum += value;
  }

  return sum / period;
}

/**
 * 执行单个策略信号。
 * @param {object} params 执行参数
 * @param {StrategySignal} params.signal 策略信号
 * @param {KLine[]} params.klines K 线数据
 * @param {string} params.symbol 股票代码
 * @param {BacktestConfig} params.config 回测配置
 * @param {BacktestState} params.state 回测账户状态
 * @param {number} params.tradeOrder 交易序号
 * @returns {BacktestTrade | null} 成交记录
 */
function executeSignal(params: {
  signal: StrategySignal;
  klines: KLine[];
  symbol: string;
  config: BacktestConfig;
  state: BacktestState;
  tradeOrder: number;
}): BacktestTrade | null {
  const signalKline = params.klines[params.signal.signalIndex];
  const tradeKline = params.klines[params.signal.tradeIndex];
  if (signalKline === undefined || tradeKline === undefined) {
    return null;
  }

  if (params.signal.side === 'buy') {
    return executeBuy(params, signalKline, tradeKline);
  }

  return executeSell(params, signalKline, tradeKline);
}

/**
 * 执行买入信号。
 * @param {object} params 执行参数
 * @param {KLine} signalKline 信号 K 线
 * @param {KLine} tradeKline 成交 K 线
 * @returns {BacktestTrade | null} 成交记录
 */
function executeBuy(
  params: {
    signal: StrategySignal;
    symbol: string;
    config: BacktestConfig;
    state: BacktestState;
    tradeOrder: number;
  },
  signalKline: KLine,
  tradeKline: KLine
): BacktestTrade | null {
  if (params.state.position > 0) {
    return null;
  }

  const price = tradeKline.open * (1 + params.config.slippageRate);
  const affordableShares =
    params.state.cash / (price * (1 + params.config.feeRate));
  const shares =
    Math.floor(affordableShares / params.config.lotSize) * params.config.lotSize;
  if (shares <= 0) {
    return null;
  }

  const amount = price * shares;
  const fee = amount * params.config.feeRate;
  params.state.cash = roundMoney(params.state.cash - amount - fee);
  params.state.position = shares;
  params.state.positionCost = amount + fee;

  return createTrade({
    id: `${params.symbol}-${params.tradeOrder}`,
    symbol: params.symbol,
    side: 'buy',
    signalDate: signalKline.date,
    tradeDate: tradeKline.date,
    price,
    shares,
    amount,
    fee,
    tax: 0,
    state: params.state,
  });
}

/**
 * 执行卖出信号。
 * @param {object} params 执行参数
 * @param {KLine} signalKline 信号 K 线
 * @param {KLine} tradeKline 成交 K 线
 * @returns {BacktestTrade | null} 成交记录
 */
function executeSell(
  params: {
    signal: StrategySignal;
    symbol: string;
    config: BacktestConfig;
    state: BacktestState;
    tradeOrder: number;
  },
  signalKline: KLine,
  tradeKline: KLine
): BacktestTrade | null {
  if (params.state.position <= 0) {
    return null;
  }

  const shares = params.state.position;
  const price = tradeKline.open * (1 - params.config.slippageRate);
  const amount = price * shares;
  const fee = amount * params.config.feeRate;
  const tax = amount * params.config.stampTaxRate;
  const profit = amount - fee - tax - params.state.positionCost;

  if (profit >= 0) {
    params.state.winCount += 1;
  } else {
    params.state.lossCount += 1;
  }

  params.state.cash = roundMoney(params.state.cash + amount - fee - tax);
  params.state.position = 0;
  params.state.positionCost = 0;

  return createTrade({
    id: `${params.symbol}-${params.tradeOrder}`,
    symbol: params.symbol,
    side: 'sell',
    signalDate: signalKline.date,
    tradeDate: tradeKline.date,
    price,
    shares,
    amount,
    fee,
    tax,
    state: params.state,
  });
}

/**
 * 创建标准化交易记录。
 * @param {object} params 交易参数
 * @returns {BacktestTrade} 标准化交易记录
 */
function createTrade(params: {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalDate: string;
  tradeDate: string;
  price: number;
  shares: number;
  amount: number;
  fee: number;
  tax: number;
  state: BacktestState;
}): BacktestTrade {
  return {
    id: params.id,
    symbol: params.symbol,
    side: params.side,
    signalDate: params.signalDate,
    tradeDate: params.tradeDate,
    price: roundMoney(params.price),
    shares: params.shares,
    amount: roundMoney(params.amount),
    fee: roundMoney(params.fee),
    tax: roundMoney(params.tax),
    cashAfterTrade: roundMoney(params.state.cash),
    positionAfterTrade: params.state.position,
  };
}

/**
 * 计算回测绩效指标。
 * @param {object} params 指标输入
 * @returns {BacktestMetrics} 绩效指标
 */
function calculateMetrics(params: {
  equityCurve: BacktestEquityPoint[];
  initialCapital: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
}): BacktestMetrics {
  const finalPoint = params.equityCurve[params.equityCurve.length - 1];
  const finalEquity = finalPoint?.equity ?? params.initialCapital;
  const totalReturn =
    params.initialCapital > 0
      ? (finalEquity - params.initialCapital) / params.initialCapital
      : 0;
  const years = Math.max(params.equityCurve.length / 242, 1 / 242);
  const annualizedReturn =
    params.initialCapital > 0
      ? Math.pow(finalEquity / params.initialCapital, 1 / years) - 1
      : 0;
  const closedTradeCount = params.winCount + params.lossCount;

  return {
    initialCapital: roundMoney(params.initialCapital),
    finalEquity: roundMoney(finalEquity),
    totalReturn: roundRatio(totalReturn),
    annualizedReturn: roundRatio(annualizedReturn),
    maxDrawdown: roundRatio(calculateMaxDrawdown(params.equityCurve)),
    tradeCount: params.tradeCount,
    winCount: params.winCount,
    lossCount: params.lossCount,
    winRate:
      closedTradeCount > 0
        ? roundRatio(params.winCount / closedTradeCount)
        : 0,
  };
}

/**
 * 计算最大回撤。
 * @param {BacktestEquityPoint[]} equityCurve 权益曲线
 * @returns {number} 最大回撤
 */
function calculateMaxDrawdown(equityCurve: BacktestEquityPoint[]): number {
  let peak = 0;
  let maxDrawdown = 0;

  equityCurve.forEach((point) => {
    peak = Math.max(peak, point.equity);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
    }
  });

  return maxDrawdown;
}

/**
 * 金额保留两位小数。
 * @param {number} value 原始金额
 * @returns {number} 标准化金额
 */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 比率保留六位小数。
 * @param {number} value 原始比率
 * @returns {number} 标准化比率
 */
function roundRatio(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

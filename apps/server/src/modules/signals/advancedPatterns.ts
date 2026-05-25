import type { KLine, Signal, SignalDirection, SignalType } from "@share-stock-god/shared";

type SignalMeta = {
  type: SignalType;
  name: string;
  direction: SignalDirection;
  strength: 1 | 2 | 3 | 4 | 5;
  description: string;
};

/**
 * 创建信号对象
 */
function createSignal(kline: KLine, meta: SignalMeta): Signal {
  return {
    id: `${kline.symbol}-${kline.timestamp}-${meta.type}`,
    symbol: kline.symbol,
    timestamp: kline.timestamp,
    date: kline.date,
    type: meta.type,
    name: meta.name,
    direction: meta.direction,
    strength: meta.strength,
    description: meta.description,
    price: kline.close,
  };
}

/**
 * 计算K线实体大小
 */
function getBodySize(kline: KLine): number {
  return Math.abs(kline.close - kline.open);
}

/**
 * 计算K线影线大小
 */
function getUpperShadow(kline: KLine): number {
  return kline.high - Math.max(kline.open, kline.close);
}

function getLowerShadow(kline: KLine): number {
  return Math.min(kline.open, kline.close) - kline.low;
}

/**
 * 判断是否为阳线
 */
function isBullish(kline: KLine): boolean {
  return kline.close > kline.open;
}

/**
 * 判断是否为阴线
 */
function isBearish(kline: KLine): boolean {
  return kline.close < kline.open;
}

/**
 * 判断是否为十字星
 */
function isDoji(kline: KLine, threshold: number = 0.01): boolean {
  const bodySize = getBodySize(kline);
  const range = kline.high - kline.low;
  return range > 0 && bodySize / range < threshold;
}

/**
 * 识别锤子线形态
 */
export function detectHammerSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  for (let i = 2; i < klines.length; i++) {
    const current = klines[i];
    const prev1 = klines[i - 1];
    const prev2 = klines[i - 2];


    // 锤子线条件：
    // 1. 出现在下跌趋势后（前两根K线整体下跌）
    // 2. 下影线长度是实体的2倍以上
    // 3. 上影线很短或几乎没有
    // 4. 实体较小（阳线或阴线都可以）

    const isDowntrend = prev2.close > prev1.close || prev2.high > prev1.high;
    const bodySize = getBodySize(current);
    const lowerShadow = getLowerShadow(current);
    const upperShadow = getUpperShadow(current);
    const totalRange = current.high - current.low;

    const isHammer =
      isDowntrend &&
      bodySize > 0 &&
      lowerShadow >= bodySize * 2 &&
      upperShadow <= bodySize * 0.3 &&
      bodySize / totalRange < 0.3;

    if (isHammer) {
      signals.push(createSignal(current, {
        type: "hammer",
        name: "锤子线",
        direction: "bullish",
        strength: 4,
        description: "出现在下跌趋势底部，下影线长实体小，提示可能的底部反转。",
      }));
    }

    // 倒锤子线（Inverted Hammer）
    // 出现在下跌趋势底部，上影线长，实体在底部
    const isInvertedHammer =
      isDowntrend &&
      bodySize > 0 &&
      upperShadow >= bodySize * 2 &&
      lowerShadow <= bodySize * 0.3 &&
      bodySize / totalRange < 0.3;

    if (isInvertedHammer) {
      signals.push(createSignal(current, {
        type: "inverted_hammer",
        name: "倒锤子线",
        direction: "bullish",
        strength: 3,
        description: "出现在下跌趋势底部，上影线长，提示可能的反转信号（需次日确认）。",
      }));
    }
  }

  return signals;
}

/**
 * 识别十字星信号
 */
export function detectDojiSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];


  for (let i = 1; i < klines.length; i++) {
    const current = klines[i];
    const prev = klines[i - 1];


    const bodySize = getBodySize(current);
    const totalRange = current.high - current.low;


    // 严格十字星：实体非常小（小于范围的1%）
    const isStrictDoji = totalRange > 0 && bodySize / totalRange < 0.01;

    // 长腿十字星：上下影线都很长
    const upperShadow = getUpperShadow(current);
    const lowerShadow = getLowerShadow(current);
    const isLongLeggedDoji =
      isStrictDoji &&
      upperShadow > bodySize * 3 &&
      lowerShadow > bodySize * 3;

    // 墓碑十字星（T形）：上影线很长，下影线很短或无，出现在上涨趋势顶部
    const isGravestoneDoji =
      isStrictDoji &&
      upperShadow > bodySize * 4 &&
      lowerShadow < bodySize * 0.5 &&
      prev.close < current.close; // 处于上涨趋势

    // 蜻蜓十字星（倒T形）：下影线很长，上影线很短或无，出现在下跌趋势底部
    const isDragonflyDoji =
      isStrictDoji &&
      lowerShadow > bodySize * 4 &&
      upperShadow < bodySize * 0.5 &&
      prev.close > current.close; // 处于下跌趋势

    // 根据十字星类型生成不同的信号
    if (isDragonflyDoji) {
      signals.push(createSignal(current, {
        type: "doji",
        name: "蜻蜓十字星",
        direction: "bullish",
        strength: 4,
        description: "出现在下跌趋势底部，下影线很长，提示可能的底部反转。",
      }));
    } else if (isGravestoneDoji) {
      signals.push(createSignal(current, {
        type: "doji",
        name: "墓碑十字星",
        direction: "bearish",
        strength: 4,
        description: "出现在上涨趋势顶部，上影线很长，提示可能的顶部反转。",
      }));
    } else if (isLongLeggedDoji) {
      signals.push(createSignal(current, {
        type: "doji",
        name: "长腿十字星",
        direction: "neutral",
        strength: 2,
        description: "多空双方激烈博弈后势均力敌，市场处于犹豫状态，需等待方向确认。",
      }));
    } else if (isStrictDoji) {
      // 普通十字星
      signals.push(createSignal(current, {
        type: "doji",
        name: "十字星",
        direction: "neutral",
        strength: 1,
        description: "开盘价与收盘价几乎相同，表示市场暂时失去方向，需结合前后K线判断。",
      }));
    }
  }

  return signals;
}

/**
 * 识别早晨之星和黄昏之星形态
 */
export function detectMorningStarEveningStarSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  for (let i = 2; i < klines.length; i++) {
    const first = klines[i - 2];
    const second = klines[i - 1];
    const third = klines[i];

    // 早晨之星：下跌趋势后出现，第一根大阴线，第二根小实体（十字星或陀螺），第三根大阳线
    const isMorningStar =
      first.close < first.open && // 第一根阴线
      (third.close - third.open) > (first.open - first.close) * 0.6 && // 第三根阳线实体较大
      third.close > third.open && // 第三根阳线
      third.close > (first.open + first.close) / 2 && // 第三根收盘价深入第一根实体
      getBodySize(second) < Math.abs(first.close - first.open) * 0.3 && // 第二根实体很小
      second.low < first.low && second.low < third.low; // 第二根是最低点

    if (isMorningStar) {
      signals.push(createSignal(third, {
        type: "morning_star",
        name: "早晨之星",
        direction: "bullish",
        strength: 5,
        description: "三根K线组成的底部反转形态，第一根大阴线，第二根小实体，第三根大阳线确认反转。",
      }));
    }

    // 黄昏之星：上涨趋势后出现，第一根大阳线，第二根小实体，第三根大阴线
    const isEveningStar =
      first.close > first.open && // 第一根阳线
      (first.close - first.open) > (third.open - third.close) * 0.6 &&
      third.close < third.open && // 第三根阴线
      third.close < (first.open + first.close) / 2 && // 第三根收盘价深入第一根实体
      getBodySize(second) < Math.abs(first.close - first.open) * 0.3 && // 第二根实体很小
      second.high > first.high && second.high > third.high; // 第二根是最高点

    if (isEveningStar) {
      signals.push(createSignal(third, {
        type: "evening_star",
        name: "黄昏之星",
        direction: "bearish",
        strength: 5,
        description: "三根K线组成的顶部反转形态，第一根大阳线，第二根小实体，第三根大阴线确认反转。",
      }));
    }
  }

  return signals;
}

/**
 * 识别流星线和吊颈线
 */
export function detectShootingStarHangingManSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  for (let i = 2; i < klines.length; i++) {
    const current = klines[i];
    const prev1 = klines[i - 1];
    const prev2 = klines[i - 2];

    const bodySize = getBodySize(current);
    const upperShadow = getUpperShadow(current);
    const lowerShadow = getLowerShadow(current);
    const totalRange = current.high - current.low;

    // 流星线：出现在上涨趋势顶部，上影线很长（实体2倍以上），实体小，下影线很短
    const isUptrend = prev2.close < prev1.close || prev2.high < prev1.high;
    const isShootingStar =
      isUptrend &&
      bodySize > 0 &&
      upperShadow >= bodySize * 2 &&
      lowerShadow <= bodySize * 0.2 &&
      bodySize / totalRange < 0.3;

    if (isShootingStar) {
      signals.push(createSignal(current, {
        type: "shooting_star",
        name: "流星线",
        direction: "bearish",
        strength: 4,
        description: "出现在上涨趋势顶部，上影线长下影线短，提示可能的顶部反转。",
      }));
    }

    // 吊颈线：出现在下跌趋势底部，下影线很长（实体2倍以上），实体小，上影线很短
    const isDowntrend = prev2.close > prev1.close || prev2.high > prev1.high;
    const isHangingMan =
      isDowntrend &&
      bodySize > 0 &&
      lowerShadow >= bodySize * 2 &&
      upperShadow <= bodySize * 0.2 &&
      bodySize / totalRange < 0.3;

    if (isHangingMan) {
      signals.push(createSignal(current, {
        type: "hanging_man",
        name: "吊颈线",
        direction: "bearish",
        strength: 3,
        description: "出现在下跌趋势中，下影线长上影线短，可能是下跌中继或弱反弹信号。",
      }));
    }
  }

  return signals;
}

/**
 * 计算RSI指标
 */
function calculateRSI(klines: KLine[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // 计算价格变化
  for (let i = 1; i < klines.length; i++) {
    const change = klines[i].close - klines[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // 计算RSI
  for (let i = 0; i < klines.length; i++) {
    if (i < period) {
      rsi.push(50); // 默认中性值
      continue;
    }

    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }

  return rsi;
}

/**
 * 检测背离信号
 */
export function detectDivergenceSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];
  const macd = calculateMACD(klines);
  const rsi = calculateRSI(klines, 14);

  // 需要至少30根K线才能计算可靠的背离
  if (klines.length < 30) return signals;

  // 寻找价格极值点
  for (let i = 5; i < klines.length - 5; i++) {
    const current = klines[i];
    const prevMacd = macd[i - 1];
    const currentMacd = macd[i];

    // 检测MACD底背离（看涨）
    // 价格创新低，但MACD未创新低
    const isPriceLowerLow =
      current.low < klines[i - 5].low &&
      current.low < klines[i + 5].low;

    const isMacdNotLowerLow =
      prevMacd &&
      currentMacd.bar > prevMacd.bar;

    if (isPriceLowerLow && isMacdNotLowerLow && currentMacd.bar < 0) {
      signals.push(createSignal(current, {
        type: "macd_bullish_divergence",
        name: "MACD底背离",
        direction: "bullish",
        strength: 4,
        description: "价格创新低但MACD未创新低，可能预示下跌趋势即将反转。",
      }));
    }

    // 检测MACD顶背离（看跌）
    // 价格创新高，但MACD未创新高
    const isPriceHigherHigh =
      current.high > klines[i - 5].high &&
      current.high > klines[i + 5].high;

    const isMacdNotHigherHigh =
      prevMacd &&
      currentMacd.bar < prevMacd.bar;

    if (isPriceHigherHigh && isMacdNotHigherHigh && currentMacd.bar > 0) {
      signals.push(createSignal(current, {
        type: "macd_bearish_divergence",
        name: "MACD顶背离",
        direction: "bearish",
        strength: 4,
        description: "价格创新高但MACD未创新高，可能预示上涨趋势即将反转。",
      }));
    }

    // 检测RSI背离（类似逻辑，使用RSI值）
    const currentRSI = rsi[i];
    const prevRSI = rsi[i - 5];

    // RSI底背离
    if (
      isPriceLowerLow &&
      currentRSI > prevRSI &&
      currentRSI < 40
    ) {
      signals.push(createSignal(current, {
        type: "rsi_bullish_divergence",
        name: "RSI底背离",
        direction: "bullish",
        strength: 3,
        description: "价格创新低但RSI未创新低，显示下跌动能减弱。",
      }));
    }

    // RSI顶背离
    if (
      isPriceHigherHigh &&
      currentRSI < prevRSI &&
      currentRSI > 60
    ) {
      signals.push(createSignal(current, {
        type: "rsi_bearish_divergence",
        name: "RSI顶背离",
        direction: "bearish",
        strength: 3,
        description: "价格创新高但RSI未创新高，显示上涨动能减弱。",
      }));
    }
  }

  return signals;
}

/**
 * 计算简单移动平均
 */
function calculateSMA(values: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sma.push(values[i]);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - j];
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

/**
 * 寻找局部极值点
 */
function findExtremes(
  klines: KLine[],
  window: number = 5
): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = window; i < klines.length - window; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= window; j++) {
      if (klines[i].high <= klines[i - j].high || klines[i].high <= klines[i + j].high) {
        isHigh = false;
      }
      if (klines[i].low >= klines[i - j].low || klines[i].low >= klines[i + j].low) {
        isLow = false;
      }
    }

    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }

  return { highs, lows };
}

/**
 * 检测支撑阻力位突破信号
 */
export function detectSupportResistanceSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  if (klines.length < 20) return signals;

  // 寻找近期的高点和低点作为支撑阻力位
  const { highs, lows } = findExtremes(klines, 3);

  // 计算支撑阻力位（使用近期极值点的均值）
  const recentHighs = highs.slice(-3).map(i => klines[i].high);
  const recentLows = lows.slice(-3).map(i => klines[i].low);

  const resistanceLevel = recentHighs.length > 0
    ? recentHighs.reduce((a, b) => a + b, 0) / recentHighs.length
    : klines[klines.length - 1].high * 1.02;

  const supportLevel = recentLows.length > 0
    ? recentLows.reduce((a, b) => a + b, 0) / recentLows.length
    : klines[klines.length - 1].low * 0.98;

  // 检测突破信号
  for (let i = 5; i < klines.length; i++) {
    const current = klines[i];
    const prev = klines[i - 1];

    const prev2 = klines[i - 2];

    // 突破阻力位：前一根K线收盘价低于阻力位，当前K线收盘价高于阻力位
    if (
      prev.close < resistanceLevel &&
      current.close > resistanceLevel &&
      current.close > current.open // 阳线突破更可靠
    ) {
      signals.push(createSignal(current, {
        type: "resistance_break",
        name: "突破阻力",
        direction: "bullish",
        strength: 4,
        description: `价格突破近期阻力位（${resistanceLevel.toFixed(2)}），可能开启上涨趋势。`,
      }));
    }
    // 跌破支撑位：前一根K线收盘价高于支撑位，当前K线收盘价低于支撑位
    if (
      prev.close > supportLevel &&
      current.close < supportLevel &&
      current.close < current.open // 阴线跌破更可靠
    ) {
      signals.push(createSignal(current, {
        type: "support_break",
        name: "跌破支撑",
        direction: "bearish",
        strength: 4,
        description: `价格跌破近期支撑位（${supportLevel.toFixed(2)}），可能开启下跌趋势。`,
      }));
    }
    // 支撑反弹：价格触及支撑位后反弹
    if (
      prev.low <= supportLevel * 1.01 && // 前一根触及或接近支撑位
      current.close > current.open && // 当前收阳线
      current.close > prev.close // 收盘价上涨
    ) {
      signals.push(createSignal(current, {
        type: "support_bounce",
        name: "支撑反弹",
        direction: "bullish",
        strength: 3,
        description: `价格在支撑位（${supportLevel.toFixed(2)}）附近获得支撑并反弹。`,
      }));
    }
    // 阻力回落：价格触及阻力位后回落
    if (
      prev.high >= resistanceLevel * 0.99 && // 前一根触及或接近阻力位
      current.close < current.open && // 当前收阴线
      current.close < prev.close // 收盘价下跌
    ) {
      signals.push(createSignal(current, {
        type: "resistance_rejection",
        name: "阻力回落",
        direction: "bearish",
        strength: 3,
        description: `价格在阻力位（${resistanceLevel.toFixed(2)}）附近遇阻回落。`,
      }));
    }
  }

  return signals;
}

// TODO: 实现更多信号检测函数
// - detectDivergenceSignals (背离检测)
// - detectVolumeSignals (成交量异常)

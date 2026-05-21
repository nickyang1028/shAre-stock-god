import type { KLine, Signal, SignalDirection, SignalType } from "@share-stock-god/shared";
import { calculateMA, calculateMACD } from "../indicators/indicators.js";

type SignalMeta = {
  type: SignalType;
  name: string;
  direction: SignalDirection;
  strength: 1 | 2 | 3 | 4 | 5;
  description: string;
};

export function detectSignals(klines: KLine[]): Signal[] {
  return [
    ...detectEngulfingSignals(klines),
    ...detectMaCrossSignals(klines),
    ...detectMacdCrossSignals(klines),
  ].sort((first, second) => first.timestamp - second.timestamp);
}

function detectEngulfingSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];

  for (let index = 1; index < klines.length; index += 1) {
    const previous = klines[index - 1];
    const current = klines[index];
    if (!previous || !current) {
      continue;
    }

    if (
      previous.close < previous.open &&
      current.close > current.open &&
      current.open <= previous.close &&
      current.close >= previous.open
    ) {
      signals.push(createSignal(current, {
        type: "bullish_engulfing",
        name: "阳包阴",
        direction: "bullish",
        strength: 3,
        description: "当前阳线实体向上包住前一根阴线实体，属于偏多形态提示。",
      }));
    }

    if (
      previous.close > previous.open &&
      current.close < current.open &&
      current.open >= previous.close &&
      current.close <= previous.open
    ) {
      signals.push(createSignal(current, {
        type: "bearish_engulfing",
        name: "阴包阳",
        direction: "bearish",
        strength: 3,
        description: "当前阴线实体向下包住前一根阳线实体，属于偏空形态提示。",
      }));
    }
  }

  return signals;
}

function detectMaCrossSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];
  const ma5 = calculateMA(klines, 5);
  const ma10 = calculateMA(klines, 10);

  for (let index = 1; index < klines.length; index += 1) {
    const previousShort = ma5[index - 1];
    const previousLong = ma10[index - 1];
    const currentShort = ma5[index];
    const currentLong = ma10[index];
    const current = klines[index];

    if (
      current &&
      previousShort != null &&
      previousLong != null &&
      currentShort != null &&
      currentLong != null &&
      previousShort <= previousLong &&
      currentShort > currentLong
    ) {
      signals.push(createSignal(current, {
        type: "ma_golden_cross",
        name: "均线金叉",
        direction: "bullish",
        strength: 3,
        description: "MA5 从下方向上穿越 MA10，属于短期均线偏多提示。",
      }));
    }

    if (
      current &&
      previousShort != null &&
      previousLong != null &&
      currentShort != null &&
      currentLong != null &&
      previousShort >= previousLong &&
      currentShort < currentLong
    ) {
      signals.push(createSignal(current, {
        type: "ma_dead_cross",
        name: "均线死叉",
        direction: "bearish",
        strength: 3,
        description: "MA5 从上方向下穿越 MA10，属于短期均线偏空提示。",
      }));
    }
  }

  return signals;
}

function detectMacdCrossSignals(klines: KLine[]): Signal[] {
  const signals: Signal[] = [];
  const macd = calculateMACD(klines);

  for (let index = 1; index < klines.length; index += 1) {
    const previous = macd[index - 1];
    const current = macd[index];
    const kline = klines[index];

    if (previous && current && kline && previous.dif <= previous.dea && current.dif > current.dea) {
      signals.push(createSignal(kline, {
        type: "macd_golden_cross",
        name: "MACD 金叉",
        direction: "bullish",
        strength: current.dif > 0 && current.dea > 0 ? 4 : 3,
        description: "DIF 从下方向上穿越 DEA，属于 MACD 偏多提示。",
      }));
    }

    if (previous && current && kline && previous.dif >= previous.dea && current.dif < current.dea) {
      signals.push(createSignal(kline, {
        type: "macd_dead_cross",
        name: "MACD 死叉",
        direction: "bearish",
        strength: current.dif < 0 && current.dea < 0 ? 4 : 3,
        description: "DIF 从上方向下穿越 DEA，属于 MACD 偏空提示。",
      }));
    }
  }

  return signals;
}

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

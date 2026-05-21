import type { KLine } from "@share-stock-god/shared";

export type MacdPoint = {
  dif: number;
  dea: number;
  macd: number;
};

export function calculateMA(klines: KLine[], period: number): Array<number | null> {
  const result: Array<number | null> = [];
  let sum = 0;

  klines.forEach((kline, index) => {
    sum += kline.close;
    if (index >= period) {
      sum -= klines[index - period]?.close ?? 0;
    }
    result.push(index >= period - 1 ? round(sum / period) : null);
  });

  return result;
}

export function calculateMACD(klines: KLine[]): MacdPoint[] {
  const closes = klines.map((kline) => kline.close);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const difValues = closes.map((_close, index) => {
    const shortValue = ema12[index] ?? closes[index] ?? 0;
    const longValue = ema26[index] ?? closes[index] ?? 0;
    return shortValue - longValue;
  });
  const deaValues = calculateEMA(difValues, 9);

  return difValues.map((dif, index) => {
    const dea = deaValues[index] ?? 0;
    return {
      dif: round(dif),
      dea: round(dea),
      macd: round((dif - dea) * 2),
    };
  });
}

function calculateEMA(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  values.forEach((value, index) => {
    if (index === 0) {
      result.push(value);
      return;
    }
    const previous = result[index - 1] ?? value;
    result.push(round((value - previous) * multiplier + previous));
  });

  return result;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

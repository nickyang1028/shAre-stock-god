import type { KLine } from "@share-stock-god/shared";

type FetchDailyKLinesParams = {
  symbol: string;
  limit: number;
};

type EastmoneyResponse = {
  data?: {
    name?: string;
    code?: string;
    klines?: string[];
  } | null;
};

type EastmoneyMarketData = {
  symbol: string;
  name: string;
  klines: KLine[];
};

const EASTMONEY_KLINE_URL = "https://push2his.eastmoney.com/api/qt/stock/kline/get";

export async function fetchDailyKLines(params: FetchDailyKLinesParams): Promise<EastmoneyMarketData> {
  const normalizedSymbol = normalizeAShareSymbol(params.symbol);
  const secid = toEastmoneySecid(normalizedSymbol);
  const url = new URL(EASTMONEY_KLINE_URL);
  url.searchParams.set("secid", secid);
  url.searchParams.set("fields1", "f1,f2,f3,f4,f5,f6");
  url.searchParams.set("fields2", "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61");
  url.searchParams.set("klt", "101");
  url.searchParams.set("fqt", "1");
  url.searchParams.set("end", "20500101");
  url.searchParams.set("lmt", String(params.limit));

  const response = await fetch(url, {
    headers: {
      "user-agent": "share-stock-god/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`东方财富行情接口请求失败：${response.status}`);
  }

  const payload = (await response.json()) as EastmoneyResponse;
  if (!payload.data?.klines?.length) {
    throw new Error(`未查询到 ${normalizedSymbol} 的 A 股日 K 数据`);
  }

  return {
    symbol: normalizedSymbol,
    name: payload.data.name ?? normalizedSymbol,
    klines: payload.data.klines.map((line) => parseKLine(line, normalizedSymbol)),
  };
}

function normalizeAShareSymbol(input: string): string {
  const trimmed = input.trim().toUpperCase();
  const codeMatch = trimmed.match(/\d{6}/);
  if (!codeMatch) {
    throw new Error("请输入 6 位 A 股股票代码，例如 600519 或 000001");
  }
  const code = codeMatch[0];
  if (trimmed.endsWith(".SH") || trimmed.startsWith("SH")) {
    return `${code}.SH`;
  }
  if (trimmed.endsWith(".SZ") || trimmed.startsWith("SZ")) {
    return `${code}.SZ`;
  }
  if (code.startsWith("6")) {
    return `${code}.SH`;
  }
  if (code.startsWith("0") || code.startsWith("3")) {
    return `${code}.SZ`;
  }
  throw new Error("MVP 暂支持沪深 A 股代码：上证 6 开头，深证 0/3 开头");
}

function toEastmoneySecid(symbol: string): string {
  const code = symbol.slice(0, 6);
  if (symbol.endsWith(".SH")) {
    return `1.${code}`;
  }
  return `0.${code}`;
}

function parseKLine(line: string, symbol: string): KLine {
  const parts = line.split(",");
  const date = requireField(parts, 0);
  const timestamp = new Date(`${date}T15:00:00+08:00`).getTime();

  return {
    symbol,
    timestamp,
    date,
    open: parseNumber(requireField(parts, 1), "开盘价"),
    close: parseNumber(requireField(parts, 2), "收盘价"),
    high: parseNumber(requireField(parts, 3), "最高价"),
    low: parseNumber(requireField(parts, 4), "最低价"),
    volume: parseNumber(requireField(parts, 5), "成交量"),
    amount: parseNumber(requireField(parts, 6), "成交额"),
  };
}

function requireField(parts: string[], index: number): string {
  const value = parts[index];
  if (value === undefined || value === "") {
    throw new Error("东方财富 K 线字段缺失");
  }
  return value;
}

function parseNumber(value: string, label: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${label} 不是有效数字`);
  }
  return numberValue;
}

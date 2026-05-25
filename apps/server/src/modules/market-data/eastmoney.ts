import type { KLine } from '@share-stock-god/shared';

type FetchDailyKLinesParams = {
  /** 股票代码，支持 600519 / 600519.SH / SH600519 等格式 */
  symbol: string;
  /** 拉取的历史 K 线数量上限 */
  limit: number;
};

type EastmoneyResponse = {
  /** 东方财富响应主体 */
  data?: {
    /** 股票名称 */
    name?: string;
    /** 股票代码 */
    code?: string;
    /** K 线原始字符串数组 */
    klines?: string[];
  } | null;
};

type EastmoneyMarketData = {
  /** 归一化后的股票代码 */
  symbol: string;
  /** 股票名称 */
  name: string;
  /** 结构化后的 K 线数据 */
  klines: KLine[];
};

const EASTMONEY_KLINE_URL =
  'https://push2his.eastmoney.com/api/qt/stock/kline/get';

/**
 * 从东方财富接口拉取指定股票的日 K 线数据。
 * @param {FetchDailyKLinesParams} params 查询参数
 * @returns {Promise<EastmoneyMarketData>} 标准化后的行情数据
 */
export async function fetchDailyKLines(
  params: FetchDailyKLinesParams
): Promise<EastmoneyMarketData> {
  const normalizedSymbol = normalizeAShareSymbol(params.symbol);
  const secid = toEastmoneySecid(normalizedSymbol);
  const url = new URL(EASTMONEY_KLINE_URL);
  url.searchParams.set('secid', secid);
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6');
  url.searchParams.set(
    'fields2',
    'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61'
  );
  url.searchParams.set('klt', '101');
  url.searchParams.set('fqt', '1');
  url.searchParams.set('end', '20500101');
  url.searchParams.set('lmt', String(params.limit));

  // 副作用说明：向外部行情源发起 HTTP 请求，失败时直接抛错交由上层处理。
  const response = await fetch(url, {
    headers: {
      'user-agent': 'share-stock-god/0.1',
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
    klines: payload.data.klines.map((line) =>
      parseKLine(line, normalizedSymbol)
    ),
  };
}

/**
 * 归一化用户输入为项目统一的 A 股代码格式。
 * @param {string} input 用户输入的股票代码
 * @returns {string} 归一化后的代码（如 600519.SH）
 */
function normalizeAShareSymbol(input: string): string {
  const trimmed = input.trim().toUpperCase();
  const codeMatch = trimmed.match(/\d{6}/);
  if (!codeMatch) {
    throw new Error('请输入 6 位 A 股股票代码，例如 600519 或 000001');
  }

  const code = codeMatch[0];
  if (trimmed.endsWith('.SH') || trimmed.startsWith('SH')) {
    return `${code}.SH`;
  }
  if (trimmed.endsWith('.SZ') || trimmed.startsWith('SZ')) {
    return `${code}.SZ`;
  }

  // 边界处理：未显式带市场前缀时按代码首位推断交易所。
  if (code.startsWith('6')) {
    return `${code}.SH`;
  }
  if (code.startsWith('0') || code.startsWith('3')) {
    return `${code}.SZ`;
  }
  throw new Error('MVP 暂支持沪深 A 股代码：上证 6 开头，深证 0/3 开头');
}

/**
 * 将标准股票代码转换为东方财富接口所需的 secid。
 * @param {string} symbol 标准股票代码
 * @returns {string} 东方财富 secid
 */
function toEastmoneySecid(symbol: string): string {
  const code = symbol.slice(0, 6);
  if (symbol.endsWith('.SH')) {
    return `1.${code}`;
  }
  return `0.${code}`;
}

/**
 * 解析东方财富单行 K 线文本为结构化对象。
 * @param {string} line 单行 K 线文本
 * @param {string} symbol 股票代码
 * @returns {KLine} 结构化 K 线数据
 */
function parseKLine(line: string, symbol: string): KLine {
  const parts = line.split(',');
  const date = requireField(parts, 0);
  // 使用东八区收盘时刻生成时间戳，保证前后端展示一致。
  const timestamp = new Date(`${date}T15:00:00+08:00`).getTime();

  return {
    symbol,
    timestamp,
    date,
    open: parseNumber(requireField(parts, 1), '开盘价'),
    close: parseNumber(requireField(parts, 2), '收盘价'),
    high: parseNumber(requireField(parts, 3), '最高价'),
    low: parseNumber(requireField(parts, 4), '最低价'),
    volume: parseNumber(requireField(parts, 5), '成交量'),
    amount: parseNumber(requireField(parts, 6), '成交额'),
  };
}

/**
 * 读取并校验指定索引字段是否存在。
 * @param {string[]} parts K 线字段数组
 * @param {number} index 字段索引
 * @returns {string} 非空字段值
 */
function requireField(parts: string[], index: number): string {
  const value = parts[index];
  if (value === undefined || value === '') {
    throw new Error('东方财富 K 线字段缺失');
  }
  return value;
}

/**
 * 将字符串解析为数字并校验合法性。
 * @param {string} value 原始值
 * @param {string} label 字段名称
 * @returns {number} 解析后的数字
 */
function parseNumber(value: string, label: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${label} 不是有效数字`);
  }
  return numberValue;
}

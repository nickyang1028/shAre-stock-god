import {
  clearWatchlistRecords,
  deleteWatchlistRecord,
  getWatchlistRecords,
  saveWatchlistRecord,
} from '../../services/localDatabase.js';

const LEGACY_WATCHLIST_STORAGE_KEY = 'share-stock-god-watchlist';

export type WatchlistStock = {
  /** 股票代码 */
  symbol: string;
};

/**
 * 规范化股票代码。
 * @param {string} symbol 原始股票代码
 * @returns {string} 规范化后的股票代码
 */
export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.(SH|SZ)$/u, '');
}

/**
 * 读取自选股。
 * @returns {Promise<WatchlistStock[]>} 自选股列表
 */
export async function readWatchlist(): Promise<WatchlistStock[]> {
  const records = await getWatchlistRecords();
  if (records.length > 0) {
    return records.map((record) => ({ symbol: record.symbol }));
  }

  const legacyStocks = readLegacyWatchlist();
  if (legacyStocks.length === 0) {
    return [];
  }

  await Promise.all(
    legacyStocks.map((stock, index) =>
      saveWatchlistRecord({
        symbol: stock.symbol,
        createdAt: Date.now() + index,
      })
    )
  );
  window.localStorage.removeItem(LEGACY_WATCHLIST_STORAGE_KEY);
  return legacyStocks;
}

/**
 * 写入自选股。
 * @param {WatchlistStock[]} stocks 自选股列表
 * @returns {Promise<void>} 无返回值
 */
export async function writeWatchlist(stocks: WatchlistStock[]): Promise<void> {
  await clearWatchlistRecords();
  await Promise.all(
    stocks.map((stock, index) =>
      saveWatchlistRecord({
        symbol: stock.symbol,
        createdAt: Date.now() + index,
      })
    )
  );
}

/**
 * 新增一只自选股。
 * @param {string} symbol 股票代码
 * @returns {Promise<void>} 无返回值
 */
export function addWatchlistStock(symbol: string): Promise<void> {
  return saveWatchlistRecord({
    symbol,
    createdAt: Date.now(),
  });
}

/**
 * 删除一只自选股。
 * @param {string} symbol 股票代码
 * @returns {Promise<void>} 无返回值
 */
export function removeWatchlistStock(symbol: string): Promise<void> {
  return deleteWatchlistRecord(symbol);
}

/**
 * 清空自选股。
 * @returns {Promise<void>} 无返回值
 */
export function clearWatchlist(): Promise<void> {
  return clearWatchlistRecords();
}

/**
 * 解析批量输入的股票代码。
 * @param {string} input 用户输入文本
 * @returns {string[]} 股票代码列表
 */
export function parseSymbolInput(input: string): string[] {
  return input
    .split(/[\s,，;；]+/u)
    .map(normalizeSymbol)
    .filter((symbol, index, symbols) => symbol.length > 0 && symbols.indexOf(symbol) === index);
}

/**
 * 读取旧版 localStorage 自选股。
 * @returns {WatchlistStock[]} 自选股列表
 */
function readLegacyWatchlist(): WatchlistStock[] {
  const rawValue = window.localStorage.getItem(LEGACY_WATCHLIST_STORAGE_KEY);
  if (rawValue === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map((item) => {
        if (typeof item === 'string') {
          return normalizeSymbol(item);
        }

        if (
          typeof item === 'object' &&
          item !== null &&
          'symbol' in item &&
          typeof item.symbol === 'string'
        ) {
          return normalizeSymbol(item.symbol);
        }

        return '';
      })
      .filter((symbol, index, symbols) => symbol.length > 0 && symbols.indexOf(symbol) === index)
      .map((symbol) => ({ symbol }));
  } catch {
    return [];
  }
}

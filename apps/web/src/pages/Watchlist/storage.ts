const WATCHLIST_STORAGE_KEY = 'share-stock-god-watchlist';

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
 * 从本地存储读取自选股。
 * @returns {WatchlistStock[]} 自选股列表
 */
export function readWatchlist(): WatchlistStock[] {
  const rawValue = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
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

/**
 * 写入自选股到本地存储。
 * @param {WatchlistStock[]} stocks 自选股列表
 * @returns {void} 无返回值
 */
export function writeWatchlist(stocks: WatchlistStock[]): void {
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(stocks));
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

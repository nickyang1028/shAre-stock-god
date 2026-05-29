import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BacktestPage } from '../Backtest/index.js';
import { StrategyStabilityPage } from '../StrategyStability/index.js';
import './styles.scss';

type StrategyTab = 'backtest' | 'stability';

type StrategyTabItem = {
  /** 页签值 */
  value: StrategyTab;
  /** 页签名称 */
  label: string;
  /** 页签说明 */
  description: string;
};

const STRATEGY_TABS: StrategyTabItem[] = [
  {
    value: 'backtest',
    label: '策略回测',
    description: '验证单段历史中的策略交易表现。',
  },
  {
    value: 'stability',
    label: '策略稳定性',
    description: '用滚动窗口观察策略是否持续有效。',
  },
];

/**
 * 策略组合页面。
 * @returns {JSX.Element} 回测与稳定性组合页
 */
export function StrategyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseStrategyTab(searchParams.get('tab'));
  const symbol = searchParams.get('symbol') ?? '600519';

  const activeDescription = useMemo(
    () => STRATEGY_TABS.find((tab) => tab.value === activeTab)?.description ?? '',
    [activeTab]
  );

  /**
   * 切换策略页签。
   * @param {StrategyTab} tab 目标页签
   * @returns {void} 无返回值
   */
  function handleChangeTab(tab: StrategyTab): void {
    const nextParams: Record<string, string> = { tab };
    if (symbol.length > 0) {
      nextParams.symbol = symbol;
    }

    setSearchParams(nextParams);
  }

  /**
   * 更新共享股票代码。
   * @param {string} nextSymbol 股票代码
   * @returns {void} 无返回值
   */
  function handleSymbolChange(nextSymbol: string): void {
    setSearchParams({
      tab: activeTab,
      symbol: nextSymbol,
    });
  }

  return (
    <main className="strategy-page">
      <header className="strategy-header">
        <div>
          <h1>策略分析</h1>
          <p>{activeDescription}</p>
        </div>
        <input
          type="text"
          value={symbol}
          onChange={(event) => handleSymbolChange(event.target.value)}
          placeholder="输入股票代码，如 600519"
          className="strategy-symbol-input"
        />
        <div className="strategy-tabs" role="tablist" aria-label="策略分析切换">
          {STRATEGY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              className={activeTab === tab.value ? 'active' : ''}
              onClick={() => handleChangeTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <section className="strategy-content">
        {activeTab === 'backtest' ? (
          <BacktestPage symbol={symbol} onSymbolChange={handleSymbolChange} hideHeader />
        ) : (
          <StrategyStabilityPage symbol={symbol} onSymbolChange={handleSymbolChange} hideHeader />
        )}
      </section>
    </main>
  );
}

/**
 * 解析策略页签。
 * @param {string | null} value 原始页签值
 * @returns {StrategyTab} 页签值
 */
function parseStrategyTab(value: string | null): StrategyTab {
  return value === 'stability' ? 'stability' : 'backtest';
}

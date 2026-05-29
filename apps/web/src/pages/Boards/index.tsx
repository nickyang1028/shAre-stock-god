import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HoldingsPage } from '../Holdings/index.js';
import { WatchlistPage } from '../Watchlist/index.js';
import './styles.scss';

type BoardTab = 'watchlist' | 'holdings';

type BoardTabItem = {
  /** 页签值 */
  value: BoardTab;
  /** 页签名称 */
  label: string;
  /** 页签说明 */
  description: string;
};

const BOARD_TABS: BoardTabItem[] = [
  {
    value: 'watchlist',
    label: '自选看板',
    description: '跟踪关注股票、信号和资金流。',
  },
  {
    value: 'holdings',
    label: '持仓看板',
    description: '维护持仓成本、数量和浮动盈亏。',
  },
];

/**
 * 看板组合页面。
 * @returns {JSX.Element} 自选与持仓组合看板
 */
export function BoardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseBoardTab(searchParams.get('tab'));

  const activeDescription = useMemo(
    () => BOARD_TABS.find((tab) => tab.value === activeTab)?.description ?? '',
    [activeTab]
  );

  /**
   * 切换看板页签。
   * @param {BoardTab} tab 目标页签
   * @returns {void} 无返回值
   */
  function handleChangeTab(tab: BoardTab): void {
    setSearchParams({ tab });
  }

  return (
    <main className="boards-page">
      <header className="boards-header">
        <div>
          <h1>股票看板</h1>
          <p>{activeDescription}</p>
        </div>
        <div className="boards-tabs" role="tablist" aria-label="股票看板切换">
          {BOARD_TABS.map((tab) => (
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

      <section className="boards-content">
        {activeTab === 'watchlist' ? <WatchlistPage hideHeader /> : <HoldingsPage hideHeader />}
      </section>
    </main>
  );
}

/**
 * 解析看板页签。
 * @param {string | null} value 原始页签值
 * @returns {BoardTab} 页签值
 */
function parseBoardTab(value: string | null): BoardTab {
  return value === 'holdings' ? 'holdings' : 'watchlist';
}

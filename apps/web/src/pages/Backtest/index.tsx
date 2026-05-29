import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BacktestPanel } from './components/BacktestPanel/index.js';
import './styles.scss';

type BacktestPageProps = {
  /** 外部传入的股票代码 */
  symbol?: string;
  /** 股票代码变更回调 */
  onSymbolChange?: (symbol: string) => void;
  /** 是否隐藏页面标题 */
  hideHeader?: boolean;
};

/**
 * 策略回测页面组件。
 * @returns {JSX.Element} 策略回测页面
 */
export function BacktestPage(props: BacktestPageProps) {
  const { symbol: controlledSymbol, onSymbolChange, hideHeader = false } = props;
  const [searchParams] = useSearchParams();
  const [uncontrolledSymbol, setUncontrolledSymbol] = useState(searchParams.get('symbol') ?? '600519');
  const symbol = controlledSymbol ?? uncontrolledSymbol;

  /**
   * 更新股票代码。
   * @param {string} nextSymbol 股票代码
   * @returns {void} 无返回值
   */
  function handleSymbolChange(nextSymbol: string): void {
    if (controlledSymbol === undefined) {
      setUncontrolledSymbol(nextSymbol);
    }
    onSymbolChange?.(nextSymbol);
  }

  return (
    <main className="backtest-page">
      {!hideHeader && (
        <header className="backtest-page-header">
          <div>
            <h1>策略回测</h1>
            <p>独立验证策略信号、交易执行与收益表现。</p>
          </div>
          <input
            type="text"
            value={symbol}
            onChange={(event) => handleSymbolChange(event.target.value)}
            placeholder="输入股票代码，如 600519"
            className="backtest-symbol-input"
          />
        </header>
      )}

      <BacktestPanel symbol={symbol} />
    </main>
  );
}

export default BacktestPage;

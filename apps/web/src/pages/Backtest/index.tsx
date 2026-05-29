import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BacktestPanel } from './components/BacktestPanel/index.js';
import './styles.scss';

/**
 * 策略回测页面组件。
 * @returns {JSX.Element} 策略回测页面
 */
export function BacktestPage() {
  const [searchParams] = useSearchParams();
  const [symbol, setSymbol] = useState(searchParams.get('symbol') ?? '600519');

  return (
    <main className="backtest-page">
      <header className="backtest-page-header">
        <div>
          <h1>策略回测</h1>
          <p>独立验证策略信号、交易执行与收益表现。</p>
        </div>
        <input
          type="text"
          value={symbol}
          onChange={(event) => setSymbol(event.target.value)}
          placeholder="输入股票代码，如 600519"
          className="backtest-symbol-input"
        />
      </header>

      <BacktestPanel symbol={symbol} />
    </main>
  );
}

export default BacktestPage;

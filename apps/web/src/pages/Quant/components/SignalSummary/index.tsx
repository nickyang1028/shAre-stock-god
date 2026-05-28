import type { FactorData } from '../../types.js';
import './styles.scss';

interface SignalSummaryProps {
  data: FactorData['signals'];
}

/**
 * 技术信号汇总组件
 */
export function SignalSummary({ data }: SignalSummaryProps) {
  const signals = [
    {
      key: 'maGoldenCross',
      icon: '🌟',
      text: 'MA金叉',
      active: data.maGoldenCross,
    },
    {
      key: 'maDeadCross',
      icon: '⚠️',
      text: 'MA死叉',
      active: data.maDeadCross,
      danger: true,
    },
    {
      key: 'volumeBreakout',
      icon: '🔥',
      text: '量能突破',
      active: data.volumeBreakout,
    },
    {
      key: 'capitalInflowSignal',
      icon: '💰',
      text: '资金流入',
      active: data.capitalInflowSignal,
    },
  ];

  return (
    <div className="factor-card signals-card">
      <h3>技术信号汇总</h3>
      <div className="signals-grid">
        {signals.map((signal) => (
          <div
            key={signal.key}
            className={`signal-item ${signal.active ? 'active' : ''} ${signal.danger ? 'danger' : ''}`}
          >
            <span className="signal-icon">{signal.icon}</span>
            <span className="signal-text">{signal.text}</span>
            <span className="signal-status">{signal.active ? '触发' : '未触发'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

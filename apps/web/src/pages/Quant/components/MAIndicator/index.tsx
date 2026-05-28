import type { FactorData } from '../../types.js';
import { formatNumber, getTrendClass } from '../../utils.js';
import './styles.scss';

interface MAIndicatorProps {
  data: FactorData['ma'];
}

/**
 * MA移动平均线指标组件
 */
export function MAIndicator({ data }: MAIndicatorProps) {
  return (
    <div className="factor-card ma-indicator">
      <h3>移动平均线 (MA)</h3>
      <div className="ma-grid">
        <div className="ma-item">
          <span className="ma-label">MA5</span>
          <span className="ma-value">{formatNumber(data.ma5)}</span>
        </div>
        <div className="ma-item">
          <span className="ma-label">MA10</span>
          <span className="ma-value">{formatNumber(data.ma10)}</span>
        </div>
        <div className="ma-item">
          <span className="ma-label">MA20</span>
          <span className="ma-value">{formatNumber(data.ma20)}</span>
        </div>
        <div className="ma-item">
          <span className="ma-label">MA60</span>
          <span className="ma-value">{formatNumber(data.ma60)}</span>
        </div>
      </div>
      <div className={`trend-badge ${getTrendClass(data.trend)}`}>
        MA趋势:{' '}
        {data.trend === 'up' ? '上涨' : data.trend === 'down' ? '下跌' : '盘整'}
      </div>
    </div>
  );
}

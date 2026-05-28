import type { FactorData } from '../../types.js';
import { formatNumber } from '../../utils.js';
import './styles.scss';

interface CapitalFlowProps {
  data: FactorData['capitalFlow'];
}

/**
 * 资金流向组件
 */
export function CapitalFlow({ data }: CapitalFlowProps) {
  return (
    <div className="factor-card capital-flow">
      <h3>资金流向估算</h3>
      <div className="capital-flow-stats">
        <div className="flow-row inflow">
          <span className="flow-label">主力流入</span>
          <span className="flow-value">¥{formatNumber(data.mainForceInflow)}万</span>
        </div>
        <div className="flow-row outflow">
          <span className="flow-label">主力流出</span>
          <span className="flow-value">¥{formatNumber(data.mainForceOutflow)}万</span>
        </div>
        <div className={`flow-row net ${data.netInflow >= 0 ? 'positive' : 'negative'}`}>
          <span className="flow-label">净流入</span>
          <span className="flow-value">
            {data.netInflow >= 0 ? '+' : ''}¥{formatNumber(data.netInflow)}万
          </span>
        </div>
      </div>
      <div className="inflow-ratio">
        <div className="ratio-bar">
          <div
            className="ratio-fill"
            style={{ width: `${Math.min(data.inflowRatio, 100)}%` }}
          />
        </div>
        <span className="ratio-text">流入占比: {formatNumber(data.inflowRatio)}%</span>
      </div>
      <div className={`signal-badge ${data.signal}`}>
        {data.signal === 'inflow'
          ? '💰 资金流入'
          : data.signal === 'outflow'
            ? '📉 资金流出'
            : '⚖️ 资金平衡'}
      </div>
    </div>
  );
}

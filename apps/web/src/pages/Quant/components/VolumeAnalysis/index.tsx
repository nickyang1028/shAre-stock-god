import type { FactorData } from '../../types.js';
import { formatNumber, formatVolume, getTrendClass } from '../../utils.js';
import './styles.scss';

interface VolumeAnalysisProps {
  data: FactorData['volume'];
}

/**
 * 成交量分析组件
 */
export function VolumeAnalysis({ data }: VolumeAnalysisProps) {
  return (
    <div className="factor-card volume-analysis">
      <h3>成交量分析</h3>
      <div className="volume-stats">
        <div className="stat-row">
          <span className="stat-label">最新成交量</span>
          <span className="stat-value">{formatVolume(data.latestVolume)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">5日均量</span>
          <span className="stat-value">{formatVolume(data.avgVolume5)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">量比</span>
          <span className={`stat-value ${data.volumeRatio > 2 ? 'highlight' : ''}`}>
            {formatNumber(data.volumeRatio)}x
            {data.volumeRatio > 2 && ' 🔥'}
          </span>
        </div>
      </div>
      <div className={`trend-badge ${getTrendClass(data.trend)}`}>
        量能趋势:{' '}
        {data.trend === 'up' ? '放大' : data.trend === 'down' ? '萎缩' : '平稳'}
      </div>
    </div>
  );
}

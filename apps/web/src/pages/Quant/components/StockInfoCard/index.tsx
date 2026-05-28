import type { FactorData } from '../../types.js';
import { formatNumber } from '../../utils.js';
import './styles.scss';

interface StockInfoCardProps {
  data: FactorData;
}

/**
 * 股票基础信息卡片组件
 */
export function StockInfoCard({ data }: StockInfoCardProps) {
  return (
    <div className="info-card">
      <div className="stock-header">
        <h2>{data.name}</h2>
        <span className="stock-code">{data.symbol}</span>
      </div>
      <div className="price-info">
        <span className="current-price">¥{formatNumber(data.latestPrice)}</span>
        <span className={`change ${data.change >= 0 ? 'positive' : 'negative'}`}>
          {data.change >= 0 ? '+' : ''}
          {formatNumber(data.change)} (
          {data.changePercent >= 0 ? '+' : ''}
          {formatNumber(data.changePercent * 100)}%)
        </span>
      </div>
      <div className="data-source-inline">
        <span>
          数据来源: {data.source === 'tushare' ? 'Tushare' : '东方财富'}
        </span>
        <span>计算时间: {new Date(data.timestamp).toLocaleString()}</span>
      </div>
    </div>
  );
}

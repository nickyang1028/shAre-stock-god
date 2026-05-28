import type { BacktestTrade } from '@share-stock-god/shared';
import { formatMoney, formatNumber } from '../../../../utils/format.js';

type TradeTableProps = {
  /** 交易流水 */
  trades: BacktestTrade[];
};

/**
 * 交易流水表格组件。
 * @param {TradeTableProps} props 组件属性
 * @returns {JSX.Element} 交易流水表格
 */
export function TradeTable({ trades }: TradeTableProps) {
  return (
    <div className="trade-table-wrap">
      <table className="trade-table">
        <thead>
          <tr>
            <th>成交日</th>
            <th>方向</th>
            <th>价格</th>
            <th>股数</th>
            <th>金额</th>
            <th>现金</th>
          </tr>
        </thead>
        <tbody>
          {trades.length > 0 ? (
            trades.map((trade) => (
              <tr key={trade.id}>
                <td>{trade.tradeDate}</td>
                <td className={trade.side === 'buy' ? 'buy-side' : 'sell-side'}>
                  {trade.side === 'buy' ? '买入' : '卖出'}
                </td>
                <td>{formatNumber(trade.price)}</td>
                <td>{trade.shares}</td>
                <td>{formatMoney(trade.amount)}</td>
                <td>{formatMoney(trade.cashAfterTrade)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="empty-trades">
                当前参数下未产生交易
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

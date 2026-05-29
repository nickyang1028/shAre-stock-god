import type { BacktestTrade } from '@share-stock-god/shared';
import { Tooltip } from '../../../../components/basic/Tooltip.js';
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
            <th>
              <Tooltip label="价格" content="实际成交价格。买入价按开盘价上浮滑点，卖出价按开盘价下调滑点。" />
            </th>
            <th>股数</th>
            <th>
              <Tooltip label="金额" content="成交金额。公式：成交价格 × 成交股数。" />
            </th>
            <th>
              <Tooltip label="收益" content="卖出平仓收益。公式：卖出金额 - 手续费 - 印花税 - 持仓成本。" />
            </th>
            <th>
              <Tooltip label="收益率" content="单笔平仓收益率。公式：平仓收益 / 持仓成本。" />
            </th>
            <th>
              <Tooltip label="持仓" content="从买入成交日到卖出成交日之间经过的交易日数量。" />
            </th>
            <th>
              <Tooltip label="现金" content="该笔交易完成后的账户可用现金。" />
            </th>
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
                <td>{trade.side === 'sell' ? formatMoney(trade.profit) : '-'}</td>
                <td>{trade.side === 'sell' ? `${(trade.profitRate * 100).toFixed(2)}%` : '-'}</td>
                <td>{trade.side === 'sell' ? `${trade.holdingDays} 天` : '-'}</td>
                <td>{formatMoney(trade.cashAfterTrade)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} className="empty-trades">
                当前参数下未产生交易
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import type { Signal } from "@share-stock-god/shared";

type SignalListProps = {
  /** 待展示的信号列表 */
  signals: Signal[];
};

/**
 * 展示技术信号列表与信号摘要信息。
 * @param {SignalListProps} props 组件属性
 * @returns {JSX.Element} 信号列表视图
 */
export function SignalList(props: SignalListProps) {
  // 边界处理：没有信号时展示空状态，避免渲染空列表。
  if (props.signals.length === 0) {
    return <div className="emptyState">近 20 个交易日暂未识别到 MVP 信号</div>;
  }

  return (
    <div className="signalList">
      {props.signals.map((signal) => (
        <article className="signalItem" key={signal.id}>
          <div className="signalHeader">
            <span className={`signalBadge ${signal.direction}`}>{signal.name}</span>
            <span className="signalDate">{signal.date}</span>
          </div>
          <p>{signal.description}</p>
          <div className="signalMeta">
            <span>收盘价 {signal.price.toFixed(2)}</span>
            <span>强度 {signal.strength}/5</span>
          </div>
        </article>
      ))}
    </div>
  );
}

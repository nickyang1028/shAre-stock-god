import { useState } from 'react';
import type { Signal } from '@share-stock-god/shared';

type SignalListProps = {
  /** 待展示的信号列表 */
  signals: Signal[];
};

type SignalDetailData = {
  /** 信号可信度评分 */
  confidence: number;
  /** 信号触发原因 */
  reasons: string[];
  /** 信号关键指标 */
  metrics: Signal['metrics'];
  /** 信号标签 */
  tags: string[];
};

/**
 * 格式化信号可信度展示。
 * @param {number} confidence 0~100 的可信度评分
 * @returns {string} 百分比展示文本
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence)}%`;
}

/**
 * 获取兼容旧接口数据的信号详情。
 * @param {Signal} signal 信号数据
 * @returns {SignalDetailData} 可展示的详情数据
 */
function getSignalDetailData(signal: Signal): SignalDetailData {
  // 边界处理：兼容正在运行的旧后端或缓存数据尚未包含解释字段的情况。
  return {
    confidence: signal.confidence ?? signal.strength * 15,
    reasons: signal.reasons ?? [signal.description],
    metrics: signal.metrics ?? [
      { label: '收盘价', value: signal.price.toFixed(2) },
      { label: '强度', value: `${signal.strength}/5` },
    ],
    tags: signal.tags ?? ['技术信号'],
  };
}

/**
 * 展示技术信号列表与信号摘要信息。
 * @param {SignalListProps} props 组件属性
 * @returns {JSX.Element} 信号列表视图
 */
export function SignalList(props: SignalListProps) {
  const [activeSignalId, setActiveSignalId] = useState<string | null>(null);

  // 边界处理：没有信号时展示空状态，避免渲染空列表。
  if (props.signals.length === 0) {
    return <div className="emptyState">近 60 个交易日暂未识别到信号</div>;
  }

  /**
   * 切换当前信号详情展示状态。
   * @param {string} signalId 信号唯一标识
   * @returns {void} 无返回值
   */
  function handleSignalClick(signalId: string): void {
    // 关键交互：点击同一信号时收起，点击其他信号时切换详情。
    setActiveSignalId((currentSignalId) =>
      currentSignalId === signalId ? null : signalId
    );
  }

  return (
    <div className="signalList">
      {props.signals.map((signal) => {
        const isActive = activeSignalId === signal.id;
        const detailData = getSignalDetailData(signal);

        return (
          <article
            aria-expanded={isActive}
            role="button"
            tabIndex={0}
            className={`signalItem${isActive ? ' active' : ''}`}
            key={signal.id}
            onClick={() => handleSignalClick(signal.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleSignalClick(signal.id);
              }
            }}
          >
            <div className="signalHeader">
              <span className={`signalBadge ${signal.direction}`}>
                {signal.name}
              </span>
              <span className="signalDate">{signal.date}</span>
            </div>
            <p className="signalDesc">{signal.description}</p>
            <div className="signalMeta">
              <span>收盘价 {signal.price.toFixed(2)}</span>
              <span>强度 {signal.strength}/5</span>
            </div>
            {isActive && (
              <div className="signalDetailPanel">
                <div className="signalDetailHeader">
                  <span>触发解释</span>
                  <strong>可信度 {formatConfidence(detailData.confidence)}</strong>
                </div>
                <div className="signalTags">
                  {detailData.tags.map((tag) => (
                    <span className="signalTag" key={`${signal.id}-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                <ul className="signalReasons">
                  {detailData.reasons.map((reason) => (
                    <li key={`${signal.id}-${reason}`}>{reason}</li>
                  ))}
                </ul>
                <dl className="signalMetrics">
                  {detailData.metrics.map((metric) => (
                    <div className="signalMetric" key={`${signal.id}-${metric.label}`}>
                      <dt>{metric.label}</dt>
                      <dd>{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

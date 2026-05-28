type MetricCardProps = {
  /** 指标名称 */
  label: string;
  /** 指标值 */
  value: string;
};

/**
 * 指标卡片组件。
 * @param {MetricCardProps} props 组件属性
 * @returns {JSX.Element} 指标卡片
 */
export function MetricCard(props: MetricCardProps) {
  return (
    <div className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

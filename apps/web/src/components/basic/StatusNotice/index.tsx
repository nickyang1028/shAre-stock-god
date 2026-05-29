import './styles.scss';

type StatusNoticeTone = 'info' | 'success' | 'warning' | 'error';

type StatusNoticeProps = {
  /** 状态提示内容 */
  children: string;
  /** 状态提示类型 */
  tone?: StatusNoticeTone;
};

/**
 * 通用状态提示组件。
 * @param {StatusNoticeProps} props 组件属性
 * @returns {JSX.Element} 状态提示视图
 */
export function StatusNotice(props: StatusNoticeProps) {
  const { children, tone = 'info' } = props;

  return (
    <div className={`status-notice ${tone}`} role="status">
      {children}
    </div>
  );
}

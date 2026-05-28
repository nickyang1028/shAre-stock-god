import { NavLink, Outlet } from 'react-router-dom';
import './AppLayout.scss';

type NavigationItem = {
  /** 路由路径 */
  path: string;
  /** 导航短标识 */
  mark: string;
  /** 导航名称 */
  label: string;
};

const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    path: '/kline',
    mark: 'K',
    label: 'K线信号',
  },
  {
    path: '/quant',
    mark: 'F',
    label: '因子分析',
  },
  {
    path: '/backtest',
    mark: 'B',
    label: '策略回测',
  },
];

/**
 * 应用公共布局组件。
 * @returns {JSX.Element} 带侧边栏的页面布局
 */
export function AppLayout() {
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand-mark">SG</span>
          <span className="app-brand-text">Stock God</span>
        </div>

        <nav className="app-nav" aria-label="功能导航">
          {NAVIGATION_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                isActive ? 'app-nav-link active' : 'app-nav-link'
              }
            >
              <span className="app-nav-mark">{item.mark}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}

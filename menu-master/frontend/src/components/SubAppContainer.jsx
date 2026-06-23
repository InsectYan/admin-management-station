import { Navigate } from 'react-router-dom';
import { buildMenuPath } from '../qiankun/config.js';

export default function SubAppContainer() {
  return (
    <div className="subapp-wrapper">
      <div id="subapp-container" className="subapp-container" />
    </div>
  );
}

export function HomeRedirect({ rootMenus }) {
  const first = rootMenus.find(m => m.status === 'enabled');
  if (first) {
    return <Navigate to={buildMenuPath(first.route_prefix)} replace />;
  }
  return (
    <div className="welcome-panel">
      <h2>欢迎使用私人管理平台</h2>
      <p>暂无可用菜单，请先在数据库中配置 menu_items。</p>
    </div>
  );
}

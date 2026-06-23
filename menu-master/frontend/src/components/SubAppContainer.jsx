import { Navigate } from 'react-router-dom';
import { Empty, Typography } from 'antd';
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
      <Empty
        description={
          <>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              欢迎使用私人管理平台
            </Typography.Title>
            <Typography.Text type="secondary">
              暂无可用菜单，请先在数据库中配置 menu_items。
            </Typography.Text>
          </>
        }
      />
    </div>
  );
}

import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Layout, Menu, Spin, Typography } from 'antd';
import { AppstoreOutlined, BookOutlined } from '@ant-design/icons';
import { buildMenuPath } from '../qiankun/config.js';

const { Sider: AntSider } = Layout;

const ICON_MAP = {
  'icon-novel': BookOutlined,
};

function resolveIcon(iconName) {
  const Icon = ICON_MAP[iconName] || AppstoreOutlined;
  return <Icon />;
}

function toMenuItems(menus) {
  return menus.map(menu => ({
    key: buildMenuPath(menu.route_prefix),
    icon: resolveIcon(menu.icon),
    label: menu.name,
    children: menu.children?.length ? toMenuItems(menu.children) : undefined,
  }));
}

function findSelectedKey(pathname, menus) {
  let best = '';

  function walk(items) {
    for (const menu of items) {
      const path = buildMenuPath(menu.route_prefix);
      if (pathname === path || pathname.startsWith(`${path}/`)) {
        if (path.length >= best.length) {
          best = path;
        }
      }
      if (menu.children?.length) {
        walk(menu.children);
      }
    }
  }

  walk(menus);
  return best ? [best] : [];
}

function findOpenKeys(pathname, menus, keys = []) {
  for (const menu of menus) {
    const path = buildMenuPath(menu.route_prefix);
    if (!menu.children?.length) {
      continue;
    }
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      keys.push(path);
      findOpenKeys(pathname, menu.children, keys);
    }
  }
  return keys;
}

export default function Sider({ menus, loading, error }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items = useMemo(() => toMenuItems(menus), [menus]);
  const selectedKeys = useMemo(() => findSelectedKey(pathname, menus), [pathname, menus]);
  const openKeys = useMemo(() => findOpenKeys(pathname, menus), [pathname, menus]);

  return (
    <AntSider width={240} theme="dark">
      <div className="app-brand">
        <Typography.Text strong style={{ color: '#fff', fontSize: 16 }}>
          私人管理平台
        </Typography.Text>
      </div>
      {loading && (
        <div className="menu-status">
          <Spin size="small" />
          <span>菜单加载中…</span>
        </div>
      )}
      {error && (
        <Alert
          className="menu-alert"
          type="error"
          message={error}
          showIcon
        />
      )}
      {!loading && !error && (
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      )}
    </AntSider>
  );
}

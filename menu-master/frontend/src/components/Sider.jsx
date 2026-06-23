import { NavLink } from 'react-router-dom';
import { buildMenuPath } from '../qiankun/config.js';

function MenuNode({ menu, level = 0 }) {
  const path = buildMenuPath(menu.route_prefix);
  const isRoot = !menu.parent_id;

  return (
    <div className="menu-node" style={{ paddingLeft: `${level * 16}px` }}>
      <NavLink
        to={path}
        className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}
        end={isRoot}
      >
        {menu.icon && <span className="menu-icon">{menu.icon}</span>}
        <span className="menu-name">{menu.name}</span>
      </NavLink>
      {menu.children?.length > 0 && (
        <div className="menu-children">
          {menu.children.map(child => (
            <MenuNode key={child.id} menu={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sider({ menus, loading, error }) {
  return (
    <aside className="app-sider">
      <div className="app-brand">私人管理平台</div>
      {loading && <div className="menu-status">菜单加载中…</div>}
      {error && <div className="menu-status error">{error}</div>}
      {!loading && !error && (
        <nav className="menu-list">
          {menus.map(menu => (
            <MenuNode key={menu.id} menu={menu} />
          ))}
        </nav>
      )}
    </aside>
  );
}

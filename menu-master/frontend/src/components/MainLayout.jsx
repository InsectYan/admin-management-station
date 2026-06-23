import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Sider from './Sider.jsx';
import SubAppContainer, { HomeRedirect } from './SubAppContainer.jsx';
import { useMenus } from '../hooks/useMenus.js';
import { registerSubApps } from '../qiankun/registerApps.js';

export default function MainLayout() {
  const { menus, rootMenus, loading, error } = useMenus();

  useEffect(() => {
    if (rootMenus.length > 0) {
      registerSubApps(rootMenus);
    }
  }, [rootMenus]);

  return (
    <div className="app-layout">
      <Sider menus={menus} loading={loading} error={error} />
      <main className="app-main">
        <Routes>
          <Route index element={<HomeRedirect rootMenus={rootMenus} />} />
          <Route path="/media/*" element={<SubAppContainer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

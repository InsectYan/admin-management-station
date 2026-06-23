import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from 'antd';
import Sider from './Sider.jsx';
import SubAppContainer, { HomeRedirect } from './SubAppContainer.jsx';
import { useMenus } from '../hooks/useMenus.js';
import { registerSubApps } from '../qiankun/registerApps.js';

const { Content } = Layout;

export default function MainLayout() {
  const { menus, rootMenus, loading, error } = useMenus();

  useEffect(() => {
    if (rootMenus.length > 0) {
      registerSubApps(rootMenus);
    }
  }, [rootMenus]);

  return (
    <Layout className="app-layout">
      <Sider menus={menus} loading={loading} error={error} />
      <Layout>
        <Content className="app-content">
          <Routes>
            <Route index element={<HomeRedirect rootMenus={rootMenus} />} />
            <Route path="/media/*" element={<SubAppContainer />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

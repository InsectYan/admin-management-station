import { Layout, Menu } from 'antd';
import { BookOutlined, RobotOutlined } from '@ant-design/icons';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { isQiankunEmbedded } from '../services/apiConfig.js';
import './MainLayout.css';

const { Header, Content } = Layout;

export default function MainLayout() {
  const location = useLocation();
  const embedded = isQiankunEmbedded();
  const selected = location.pathname.includes('/agent') ? ['agent'] : ['novels'];

  const nav = (
    <Menu
      theme={embedded ? 'light' : 'dark'}
      mode="horizontal"
      selectedKeys={selected}
      className={embedded ? 'novel-sub-nav embedded' : 'novel-sub-nav'}
      items={[
        { key: 'novels', icon: <BookOutlined />, label: <Link to="novels">小说管理</Link> },
        { key: 'agent', icon: <RobotOutlined />, label: <Link to="agent">AI 助手</Link> },
      ]}
    />
  );

  if (embedded) {
    return (
      <Layout className="novel-sub-layout embedded">
        <div className="novel-sub-embedded-bar">{nav}</div>
        <Content className="novel-sub-content embedded">
          <Outlet />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="novel-sub-layout">
      <Header className="novel-sub-header">
        <div className="novel-sub-title">小说创作平台</div>
        {nav}
      </Header>
      <Content className="novel-sub-content">
        <Outlet />
      </Content>
    </Layout>
  );
}

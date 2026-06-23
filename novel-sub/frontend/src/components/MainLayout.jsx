import { Layout, Menu } from 'antd';
import { BookOutlined, RobotOutlined } from '@ant-design/icons';
import { Link, Outlet, useLocation } from 'react-router-dom';
import './MainLayout.css';

const { Header, Content } = Layout;

export default function MainLayout() {
  const location = useLocation();
  const selected = location.pathname.includes('/agent') ? ['agent'] : ['novels'];

  return (
    <Layout className="novel-sub-layout">
      <Header className="novel-sub-header">
        <div className="novel-sub-title">小说创作平台</div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={selected}
          items={[
            { key: 'novels', icon: <BookOutlined />, label: <Link to="novels">小说管理</Link> },
            { key: 'agent', icon: <RobotOutlined />, label: <Link to="agent">AI 助手</Link> },
          ]}
        />
      </Header>
      <Content className="novel-sub-content">
        <Outlet />
      </Content>
    </Layout>
  );
}

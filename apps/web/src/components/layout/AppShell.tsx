import { Layout, Menu, Avatar, Dropdown, Badge, Typography, Drawer, Button } from 'antd';
import { AppstoreOutlined, AlertOutlined, BarChartOutlined, CheckSquareOutlined, DashboardOutlined, DollarOutlined, LogoutOutlined, SettingOutlined, TeamOutlined, PieChartOutlined, WalletOutlined, MoreOutlined, MenuOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
const { Sider, Header, Content } = Layout;
const items = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '驾驶舱' },
  { key: '/usage', icon: <DollarOutlined />, label: '我的费用' },
  { key: '/quota', icon: <WalletOutlined />, label: '额度中心' },
  { key: '/applications', icon: <CheckSquareOutlined />, label: '申请与审批' },
  { key: '/department', icon: <TeamOutlined />, label: '部门管理', roles: ['manager', 'budget_admin'] },
  { key: '/budget', icon: <BarChartOutlined />, label: '年度预算', roles: ['manager', 'budget_admin'] },
  { key: '/analytics', icon: <PieChartOutlined />, label: '费用分析' },
  { key: '/alerts', icon: <AlertOutlined />, label: '预警中心' },
  { key: '/tools', icon: <AppstoreOutlined />, label: '工具与模型', roles: ['budget_admin'] },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置', roles: ['budget_admin'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const menuItems = items.filter(item => !item.roles || (user && item.roles.includes(user.role))).map(({ roles: _roles, ...item }) => item);
  const mobileItems = menuItems.filter(item => ['/dashboard', '/usage', '/applications', '/alerts'].includes(item.key));
  const roleName = user?.role === 'budget_admin' ? '预算管理员' : user?.role === 'manager' ? '部门主管' : '员工';
  const go = (path: string) => { navigate(path); setMoreOpen(false); };
  return <Layout className="app-layout">
    <Sider className="desktop-sider" breakpoint="lg" collapsedWidth="64" theme="dark">
      <div className="brand"><div className="brand-mark">AI</div><div className="brand-copy"><b>AI 费用管理</b><small>EXPENSE MANAGEMENT</small></div></div>
      <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => go(key)} />
    </Sider>
    <Layout>
      <Header className="app-header">
        <Typography.Text type="secondary" className="header-breadcrumb">工作台 <span className="breadcrumb-slash">/</span> <b>{location.pathname === '/dashboard' ? '费用驾驶舱' : '业务管理'}</b></Typography.Text>
        <div className="header-actions"><Badge dot><AlertOutlined className="header-icon" onClick={() => go('/alerts')} /></Badge><Dropdown menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: signOut }] }}><div className="user-menu"><Avatar size="small" style={{ backgroundColor: '#d8f0f0', color: '#167882' }}>{user?.name?.slice(0, 1)}</Avatar><span>{user?.name}</span><span className="user-role">{roleName}</span></div></Dropdown></div>
      </Header>
      <Content className="app-content">{children}</Content>
    </Layout>
    <nav className="mobile-bottom-nav">{mobileItems.map(item => <button className={location.pathname === item.key ? 'active' : ''} key={item.key} onClick={() => go(item.key)}>{item.icon}<span>{item.label}</span></button>)}<button className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen(true)}><MoreOutlined /><span>更多</span></button></nav>
    <Drawer title="全部功能" placement="bottom" height="78vh" open={moreOpen} onClose={() => setMoreOpen(false)} closeIcon={<MenuOutlined />} className="mobile-menu-drawer"><Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => go(key)} /><Button danger block className="mobile-logout" onClick={signOut}>退出登录</Button></Drawer>
  </Layout>;
}

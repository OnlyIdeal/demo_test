import { Layout, Menu, Avatar, Dropdown, Badge, Typography } from 'antd';
import { AppstoreOutlined, AlertOutlined, BarChartOutlined, CheckSquareOutlined, DashboardOutlined, DollarOutlined, LogoutOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../lib/auth';

const { Sider, Header, Content } = Layout;
const items = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '驾驶舱' },
  { key: '/usage', icon: <DollarOutlined />, label: '我的费用' },
  { key: '/applications', icon: <CheckSquareOutlined />, label: '申请与审批' },
  { key: '/department', icon: <TeamOutlined />, label: '部门管理', roles: ['manager', 'budget_admin'] },
  { key: '/budget', icon: <BarChartOutlined />, label: '年度预算', roles: ['manager', 'budget_admin'] },
  { key: '/alerts', icon: <AlertOutlined />, label: '预警中心' },
  { key: '/tools', icon: <AppstoreOutlined />, label: '工具与模型', roles: ['budget_admin'] },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置', roles: ['budget_admin'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const menuItems = items.filter(item => !item.roles || (user && item.roles.includes(user.role))).map(({ roles: _roles, ...item }) => item);
  const roleName = user?.role === 'budget_admin' ? '预算管理员' : user?.role === 'manager' ? '部门主管' : '员工';
  return <Layout className="app-layout"><Sider breakpoint="lg" collapsedWidth="64" theme="dark"><div className="brand"><div className="brand-mark">AI</div><div className="brand-copy"><b>AI 费用管理</b><small>EXPENSE MANAGEMENT</small></div></div><Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} /></Sider><Layout><Header className="app-header"><Typography.Text type="secondary">工作台 <span className="breadcrumb-slash">/</span> <b>{location.pathname === '/dashboard' ? '费用驾驶舱' : '业务管理'}</b></Typography.Text><div className="header-actions"><Badge dot><AlertOutlined className="header-icon" /></Badge><Dropdown menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: signOut }] }}><div className="user-menu"><Avatar size="small" style={{ backgroundColor: '#d8f0f0', color: '#167882' }}>{user?.name?.slice(0, 1)}</Avatar><span>{user?.name}</span><span className="user-role">{roleName}</span></div></Dropdown></div></Header><Content className="app-content">{children}</Content></Layout></Layout>;
}

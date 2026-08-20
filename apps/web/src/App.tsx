import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spin, App as AntdApp, Result, Button } from 'antd';
import { AuthProvider, useAuth } from './lib/auth';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsagePage } from './pages/UsagePage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { NewApplicationPage } from './pages/NewApplicationPage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { DepartmentPage } from './pages/DepartmentPage';
import { BudgetPage } from './pages/BudgetPage';
import { QuotaPage } from './pages/QuotaPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AlertsPage } from './pages/AlertsPage';
import { ToolsPage } from './pages/ToolsPage';
import { SettingsPage } from './pages/SettingsPage';
import './styles/global.css';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className='page-loading'><Spin size='large' /></div>;
  if (!user) return <Navigate to='/login' replace />;
  return <AppShell>{children}</AppShell>;
}

function PermissionGuard({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.permissions.includes(permission)) return <Result status='403' title='无权限访问' extra={<Button href='/dashboard'>返回驾驶舱</Button>} />;
  return <>{children}</>;
}

const guarded = (permission: string, page: React.ReactNode) => <Protected><PermissionGuard permission={permission}>{page}</PermissionGuard></Protected>;

function AppRoutes() {
  return <Routes>
    <Route path='/login' element={<LoginPage />} />
    <Route path='/' element={<Navigate to='/dashboard' replace />} />
    <Route path='/dashboard' element={guarded('dashboard.view', <DashboardPage />)} />
    <Route path='/usage' element={guarded('usage.view', <UsagePage />)} />
    <Route path='/quota' element={guarded('quota.view', <QuotaPage />)} />
    <Route path='/applications' element={guarded('application.view', <ApplicationsPage />)} />
    <Route path='/applications/new' element={guarded('application.create', <NewApplicationPage />)} />
    <Route path='/applications/:id' element={guarded('application.view', <ApplicationDetailPage />)} />
    <Route path='/department' element={guarded('department.view', <DepartmentPage />)} />
    <Route path='/budget' element={guarded('budget.view', <BudgetPage />)} />
    <Route path='/analytics' element={guarded('analytics.view', <AnalyticsPage />)} />
    <Route path='/alerts' element={guarded('alerts.view', <AlertsPage />)} />
    <Route path='/tools' element={guarded('catalog.view', <ToolsPage />)} />
    <Route path='/settings' element={guarded('role.manage', <SettingsPage />)} />
    <Route path='*' element={<Navigate to='/dashboard' replace />} />
  </Routes>;
}

export default function App() {
  return <AuthProvider><BrowserRouter><AntdApp><AppRoutes /></AntdApp></BrowserRouter></AuthProvider>;
}

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

function Protected({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <div className="page-loading"><Spin size="large" /></div>; if (!user) return <Navigate to="/login" replace />; return <AppShell>{children}</AppShell>; }
function RoleGuard({ roles, children }: { roles: string[]; children: React.ReactNode }) { const { user } = useAuth(); if (!user || !roles.includes(user.role)) return <Result status="403" title="无权限访问" extra={<Button href="/dashboard">返回驾驶舱</Button>} />; return <>{children}</>; }
function AppRoutes() { return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/" element={<Navigate to="/dashboard" replace />} /><Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} /><Route path="/usage" element={<Protected><UsagePage /></Protected>} /><Route path="/quota" element={<Protected><QuotaPage /></Protected>} /><Route path="/applications" element={<Protected><ApplicationsPage /></Protected>} /><Route path="/applications/new" element={<Protected><NewApplicationPage /></Protected>} /><Route path="/applications/:id" element={<Protected><ApplicationDetailPage /></Protected>} /><Route path="/department" element={<Protected><RoleGuard roles={['manager','budget_admin']}><DepartmentPage /></RoleGuard></Protected>} /><Route path="/budget" element={<Protected><RoleGuard roles={['manager','budget_admin']}><BudgetPage /></RoleGuard></Protected>} /><Route path="/analytics" element={<Protected><AnalyticsPage /></Protected>} /><Route path="/alerts" element={<Protected><AlertsPage /></Protected>} /><Route path="/tools" element={<Protected><RoleGuard roles={['budget_admin']}><ToolsPage /></RoleGuard></Protected>} /><Route path="/settings" element={<Protected><RoleGuard roles={['budget_admin']}><SettingsPage /></RoleGuard></Protected>} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes>; }
export default function App() { return <AuthProvider><BrowserRouter><AntdApp><AppRoutes /></AntdApp></BrowserRouter></AuthProvider>; }

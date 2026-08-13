import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spin, App as AntdApp } from 'antd';
import { AuthProvider, useAuth } from './lib/auth';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsagePage } from './pages/UsagePage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { NewApplicationPage } from './pages/NewApplicationPage';
import './styles/global.css';

function Protected({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <div className="page-loading"><Spin size="large" /></div>; if (!user) return <Navigate to="/login" replace />; return <AppShell>{children}</AppShell>; }
function AppRoutes() { return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/" element={<Navigate to="/dashboard" replace />} /><Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} /><Route path="/usage" element={<Protected><UsagePage /></Protected>} /><Route path="/applications" element={<Protected><ApplicationsPage /></Protected>} /><Route path="/applications/new" element={<Protected><NewApplicationPage /></Protected>} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes>; }
export default function App() { return <AuthProvider><BrowserRouter><AntdApp><AppRoutes /></AntdApp></BrowserRouter></AuthProvider>; }

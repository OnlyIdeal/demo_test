import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { z } from 'zod';

const schema = z.object({ username: z.string().trim().min(1, '请输入用户名'), password: z.string().min(1, '请输入密码') });
type LoginValues = z.infer<typeof schema>;
const accounts = [
  { role: '系统管理员', username: 'system.admin', password: 'SystemAdmin@2026!' },
  { role: '员工', username: 'employee.demo', password: 'Employee@2026!' },
  { role: '部门主管', username: 'manager.demo', password: 'Manager@2026!' },
  { role: '部门预算员', username: 'budget.admin', password: 'BudgetAdmin@2026!' },
];

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<LoginValues>({ username: 'system.admin', password: 'SystemAdmin@2026!' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginValues, string>>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to='/dashboard' replace />;

  const update = (field: keyof LoginValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof LoginValues, string>> = {};
      parsed.error.issues.forEach((issue) => { next[issue.path[0] as keyof LoginValues] = issue.message; });
      setErrors(next);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await signIn(parsed.data.username, parsed.data.password);
      message.success('登录成功');
      navigate('/dashboard', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };
  const quickLogin = (username: string, password: string) => { setValues({ username, password }); setErrors({}); setError(''); };

  return <div className='login-page'><div className='login-decoration'><div className='login-brand'><div className='brand-mark'>AI</div><div><b>AI 费用管理</b><small>EXPENSE MANAGEMENT</small></div></div><div className='login-copy'><span>AI COST CONTROL CENTER</span><h1>让每一笔 AI 费用<br /><em>都清晰可控。</em></h1><p>统一管理预算、额度、使用记录和审批流程，帮助团队把 AI 用在真正重要的地方。</p></div><div className='login-foot'>MVP Prototype · 2026</div></div><Card className='login-card' bordered={false}><Typography.Title level={2}>欢迎回来</Typography.Title><Typography.Paragraph type='secondary'>默认使用系统管理员登录，可切换其他角色体验完整流程。</Typography.Paragraph>{error && <Alert type='error' showIcon message={error} className='form-alert' />}<form onSubmit={submit}><Form.Item validateStatus={errors.username ? 'error' : ''} help={errors.username}><Input size='large' prefix={<UserOutlined />} placeholder='用户名' value={values.username} onChange={(event) => update('username', event.target.value)} /></Form.Item><Form.Item validateStatus={errors.password ? 'error' : ''} help={errors.password}><Input.Password size='large' prefix={<LockOutlined />} placeholder='密码' value={values.password} onChange={(event) => update('password', event.target.value)} /></Form.Item><Button type='primary' htmlType='submit' size='large' block loading={submitting}>登录</Button></form><div className='demo-login'><span>演示账号（点击即可自动填充）</span><div className='demo-account-list'>{accounts.map((account) => <div className='demo-account' key={account.username}><div><b>{account.role}</b><code>{account.username}</code><code>{account.password}</code></div><Button type='link' onClick={() => quickLogin(account.username, account.password)}>使用</Button></div>)}</div></div></Card></div>;
}

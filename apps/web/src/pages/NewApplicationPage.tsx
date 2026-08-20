import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, Select, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApplication, getProjects, getTools } from '../services/applications';
import { useAuth } from '../lib/auth';
import type { Project, Tool } from '../types/api';

export function NewApplicationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { Promise.all([getProjects(), getTools()]).then(([projectRows, toolRows]) => { setProjects(projectRows); setTools(toolRows.filter((tool) => tool.status === 'active')); }).catch(() => setLoadError('基础数据加载失败')); }, []);
  const submit = async (values: { type: string; requestedAmount: number; projectId?: string; toolId?: string; reason: string; expectedUsage?: string; dateRange?: { format: (pattern: string) => string }[] }) => {
    setSubmitting(true);
    try { const [start, end] = values.dateRange ?? []; const result = await createApplication({ ...values, startDate: start?.format('YYYY-MM-DD'), endDate: end?.format('YYYY-MM-DD') }); message.success(`申请 ${result.applicationNo} 已提交`); navigate('/applications'); } catch (caught) { message.error(caught instanceof Error ? caught.message : '提交失败'); } finally { setSubmitting(false); }
  };
  const typeOptions = [{ value: 'quota', label: '额度申请' }, { value: 'extra_usage', label: '额外使用申请' }, { value: 'tool_access', label: '工具权限申请' }, ...(user?.role === 'manager' ? [{ value: 'budget_increase', label: '预算追加申请' }] : [])];
  return <div className='page-wrap narrow-page'><Button type='link' icon={<ArrowLeftOutlined />} onClick={() => navigate('/applications')}>返回申请列表</Button><Card className='form-card'><Typography.Title level={2}>新建申请</Typography.Title><Typography.Paragraph type='secondary'>申请先由部门主管审批，再由本部门预算员终审并生效。</Typography.Paragraph>{loadError ? <Alert type='warning' showIcon message={loadError} /> : <Form form={form} layout='vertical' initialValues={{ type: 'quota' }} onFinish={submit}><Form.Item name='type' label='申请类型' rules={[{ required: true }]}><Select options={typeOptions} /></Form.Item><Form.Item name='requestedAmount' label='申请金额' rules={[{ required: true, type: 'number', min: 0.01 }]}><InputNumber min={0.01} precision={2} prefix='¥' style={{ width: '100%' }} /></Form.Item><Form.Item name='projectId' label='所属项目'><Select allowClear options={projects.map((project) => ({ value: project.id, label: project.name }))} /></Form.Item><Form.Item name='toolId' label='AI 工具'><Select allowClear options={tools.map((tool) => ({ value: tool.id, label: tool.name }))} /></Form.Item><Form.Item name='dateRange' label='预计使用周期'><DatePicker.RangePicker /></Form.Item><Form.Item name='expectedUsage' label='预计用量'><Input placeholder='例如：预计使用 Token 500 万，周期 30 天' /></Form.Item><Form.Item name='reason' label='申请原因' rules={[{ required: true, min: 10, message: '申请原因至少填写 10 个字' }]}><Input.TextArea rows={5} /></Form.Item><Button type='primary' htmlType='submit' loading={submitting}>提交申请</Button></Form>}</Card></div>;
}

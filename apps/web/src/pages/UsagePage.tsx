import { Alert, Button, Card, DatePicker, Form, InputNumber, Modal, Select, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getProjects, getTools } from '../services/applications';
import { getUserOptions } from '../services/management';
import { createUsage, getUsages } from '../services/usage';
import { ApiError } from '../lib/http';
import { useAuth } from '../lib/auth';
import type { Project, Tool, UsageRecord, UserOption } from '../types/api';

const money = (value: number) => `¥ ${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
export function UsagePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UsageRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const canCreate = user?.permissions.includes('usage.create');
  const load = () => { setLoading(true); getUsages({ page: 1, pageSize: 100 }).then((result) => { setRows(result.items); setError(''); }).catch((caught) => setError(caught instanceof ApiError ? caught.message : '费用数据加载失败')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const showCreate = async () => { try { const [userRows, projectRows, toolRows] = await Promise.all([getUserOptions(), getProjects(), getTools()]); setUsers(userRows); setProjects(projectRows); setTools(toolRows.filter((tool) => tool.status === 'active')); form.setFieldsValue({ originalCurrency: 'CNY', exchangeRate: 1, usageType: 'token' }); setOpen(true); } catch { message.error('录入基础数据加载失败'); } };
  const submit = async () => { const values = await form.validateFields(); try { await createUsage({ ...values, occurredAt: values.occurredAt.toISOString() }); message.success('费用记录已录入'); setOpen(false); form.resetFields(); load(); } catch (caught) { message.error(caught instanceof Error ? caught.message : '录入失败'); } };
  const columns = [{ title: '使用时间', dataIndex: 'occurredAt', render: (value: string) => new Date(value).toLocaleString('zh-CN') }, { title: '员工', dataIndex: 'employeeName' }, { title: '部门', dataIndex: 'departmentName' }, { title: '工具', dataIndex: 'toolName', render: (value: string) => <Tag color='blue'>{value}</Tag> }, { title: '项目', dataIndex: 'projectName', render: (value?: string) => value || '-' }, { title: '用量', dataIndex: 'quantity', render: (value: number, row: UsageRecord) => `${value.toLocaleString()} ${row.usageType}` }, { title: '金额', dataIndex: 'amount', render: money }];
  return <div className='page-wrap'><div className='page-title'><div><Typography.Title level={2}>费用明细</Typography.Title><Typography.Paragraph type='secondary'>{user?.role === 'system_admin' ? '查看全公司 AI 费用明细。' : user?.role === 'employee' ? '查看个人 AI 工具和项目费用。' : '查看本部门 AI 工具和项目费用。'}</Typography.Paragraph></div>{canCreate && <Button type='primary' icon={<PlusOutlined />} onClick={showCreate}>录入费用</Button>}</div>{error && <Alert type='error' showIcon message={error} action={<a onClick={load}>重新加载</a>} />}<Card><Table rowKey='id' loading={loading} dataSource={rows} columns={columns} scroll={{ x: 900 }} /></Card><Modal title='录入费用' open={open} onCancel={() => setOpen(false)} onOk={submit}><Form form={form} layout='vertical'><Form.Item name='employeeId' label='员工' rules={[{ required: true }]}><Select options={users.map((item) => ({ value: item.id, label: `${item.name} · ${item.departmentName}` }))} /></Form.Item><Form.Item name='projectId' label='项目'><Select allowClear options={projects.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item><Form.Item name='toolId' label='AI 工具' rules={[{ required: true }]}><Select options={tools.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item><Form.Item name='usageType' label='计费单位' rules={[{ required: true }]}><Select options={['seat', 'token', 'credit', 'call', 'fixed'].map((value) => ({ value, label: value }))} /></Form.Item><Form.Item name='quantity' label='用量' rules={[{ required: true, type: 'number', min: 0 }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item><Form.Item name='originalCurrency' label='原币种'><Select options={[{ value: 'CNY' }, { value: 'USD' }]} /></Form.Item><Form.Item name='originalAmount' label='原币金额' rules={[{ required: true, type: 'number', min: 0 }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item><Form.Item name='exchangeRate' label='汇率' rules={[{ required: true, type: 'number', min: 0.0001 }]}><InputNumber min={0.0001} precision={4} style={{ width: '100%' }} /></Form.Item><Form.Item name='amount' label='人民币金额' rules={[{ required: true, type: 'number', min: 0 }]}><InputNumber min={0} precision={2} prefix='¥' style={{ width: '100%' }} /></Form.Item><Form.Item name='occurredAt' label='发生时间' rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Form></Modal></div>;
}

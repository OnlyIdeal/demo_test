import { Button, Card, Col, Form, InputNumber, Modal, Progress, Row, Select, Statistic, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBudgets, getDepartments, saveBudget } from '../services/management';
import { useAuth } from '../lib/auth';
import type { Budget, Department } from '../types/api';

const money = (value: number) => `¥ ${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
export function BudgetPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Budget[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const canManage = user?.permissions.includes('budget.manage');
  const load = () => { setLoading(true); Promise.all([getBudgets(2026), getDepartments()]).then(([budgets, departmentRows]) => { setRows(budgets); setDepartments(departmentRows); }).catch(() => message.error('预算数据加载失败')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const submit = async () => { const values = await form.validateFields(); try { await saveBudget({ ...values, year: 2026 }); message.success('年度预算已保存'); setOpen(false); load(); } catch (caught) { message.error(caught instanceof Error ? caught.message : '保存失败'); } };
  const showEditor = () => { form.setFieldsValue({ departmentId: departments[0]?.id, initialAmount: rows.find((row) => row.departmentId === departments[0]?.id)?.initialAmount ?? 0, status: 'active' }); setOpen(true); };
  const total = rows.reduce((sum, row) => sum + row.totalAmount, 0);
  const used = rows.reduce((sum, row) => sum + row.usedAmount, 0);
  return <div className='page-wrap'><div className='page-title'><div><Typography.Title level={2}>年度预算</Typography.Title><Typography.Paragraph type='secondary'>{user?.role === 'system_admin' ? '查看并维护全公司各部门年度预算。' : '查看本部门年度预算；追加预算由主管发起、预算员复核。'}</Typography.Paragraph></div>{canManage ? <Button type='primary' onClick={showEditor}>维护预算</Button> : <Button type='primary' onClick={() => navigate('/applications/new')}>申请增加预算</Button>}</div><Row gutter={[16, 16]}><Col xs={24} md={8}><Card><Statistic title='年度预算' value={total} prefix='¥' precision={0} /></Card></Col><Col xs={24} md={8}><Card><Statistic title='年度已用' value={used} prefix='¥' precision={0} /></Card></Col><Col xs={24} md={8}><Card><Statistic title='总体执行率' value={total ? Number((used / total * 100).toFixed(2)) : 0} suffix='%' /></Card></Col></Row><Card title='部门年度预算明细' style={{ marginTop: 16 }}><Table loading={loading} rowKey='id' dataSource={rows} columns={[{ title: '部门', dataIndex: 'departmentName' }, { title: '初始预算', dataIndex: 'initialAmount', render: money }, { title: '追加预算', dataIndex: 'increaseAmount', render: money }, { title: '年度总额', dataIndex: 'totalAmount', render: money }, { title: '已用', dataIndex: 'usedAmount', render: money }, { title: '剩余', dataIndex: 'remainingAmount', render: money }, { title: '执行率', dataIndex: 'executionRate', render: (value: number) => <Progress percent={value} size='small' /> }, { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={value === 'active' ? 'green' : 'default'}>{value}</Tag> }]} /></Card><Modal title='维护年度预算' open={open} onCancel={() => setOpen(false)} onOk={submit}><Form form={form} layout='vertical'><Form.Item name='departmentId' label='部门' rules={[{ required: true }]}><Select options={departments.map((item) => ({ value: item.id, label: item.name }))} onChange={(departmentId) => { const budget = rows.find((row) => row.departmentId === departmentId); form.setFieldsValue({ initialAmount: budget?.initialAmount ?? 0, status: budget?.status ?? 'active' }); }} /></Form.Item><Form.Item name='initialAmount' label='初始预算' rules={[{ required: true, type: 'number', min: 0 }]}><InputNumber prefix='¥' precision={2} min={0} style={{ width: '100%' }} /></Form.Item><Form.Item name='status' label='状态'><Select options={[{ value: 'draft', label: '草稿' }, { value: 'active', label: '启用' }, { value: 'closed', label: '关闭' }]} /></Form.Item></Form></Modal></div>;
}

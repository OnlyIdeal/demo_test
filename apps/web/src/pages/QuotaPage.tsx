import { Button, Card, Col, Form, InputNumber, Modal, Progress, Row, Select, Statistic, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { getDepartments, getQuotas, saveQuota } from '../services/management';
import { useAuth } from '../lib/auth';
import type { Department, Quota } from '../types/api';

const money = (value: number) => `¥ ${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
export function QuotaPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Quota[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const canManage = user?.permissions.includes('quota.manage');
  const load = () => { setLoading(true); Promise.all([getQuotas(2026), getDepartments()]).then(([quotas, departmentRows]) => { setRows(quotas); setDepartments(departmentRows); }).catch(() => message.error('额度数据加载失败')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const showEditor = () => { form.setFieldsValue({ departmentId: departments[0]?.id, allocatedAmount: rows.find((row) => row.departmentId === departments[0]?.id)?.allocatedAmount ?? 0 }); setOpen(true); };
  const submit = async () => { const values = await form.validateFields(); try { await saveQuota({ ...values, year: 2026 }); message.success('部门额度已保存'); setOpen(false); load(); } catch (caught) { message.error(caught instanceof Error ? caught.message : '保存失败'); } };
  return <div className='page-wrap'><div className='page-title'><div><Typography.Title level={2}>额度中心</Typography.Title><Typography.Paragraph type='secondary'>{user?.role === 'system_admin' ? '查看全公司额度并按部门配置。' : '查看本部门共享额度及费用使用率预警。'}</Typography.Paragraph></div>{canManage ? <Button type='primary' onClick={showEditor}>调整额度</Button> : <Tag color='blue'>使用率预警：70% / 80% / 90% / 100%</Tag>}</div><Row gutter={[16, 16]}>{rows.map((row) => <Col xs={24} md={12} xl={8} key={row.id}><Card loading={loading} title={row.departmentName}><Statistic title='可用额度' value={row.remainingAmount} prefix='¥' precision={0} /><Progress percent={row.usageRate} status={row.usageRate >= 90 ? 'exception' : row.usageRate >= 80 ? 'active' : 'normal'} /><Typography.Text type='secondary'>已分配 {money(row.allocatedAmount)} · 已使用 {money(row.usedAmount)}</Typography.Text></Card></Col>)}</Row><Card title='部门共享额度明细' style={{ marginTop: 16 }}><Table loading={loading} rowKey='id' dataSource={rows} columns={[{ title: '部门', dataIndex: 'departmentName' }, { title: '已分配', dataIndex: 'allocatedAmount', render: money }, { title: '已使用', dataIndex: 'usedAmount', render: money }, { title: '剩余', dataIndex: 'remainingAmount', render: money }, { title: '使用率', dataIndex: 'usageRate', render: (value: number) => <Progress percent={value} size='small' /> }]} /></Card><Modal title='调整部门额度' open={open} onCancel={() => setOpen(false)} onOk={submit}><Form form={form} layout='vertical'><Form.Item name='departmentId' label='部门' rules={[{ required: true }]}><Select options={departments.map((item) => ({ value: item.id, label: item.name }))} onChange={(departmentId) => form.setFieldValue('allocatedAmount', rows.find((row) => row.departmentId === departmentId)?.allocatedAmount ?? 0)} /></Form.Item><Form.Item name='allocatedAmount' label='分配额度' rules={[{ required: true, type: 'number', min: 0 }]}><InputNumber prefix='¥' precision={2} min={0} style={{ width: '100%' }} /></Form.Item></Form></Modal></div>;
}

import { Card, Switch, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { getCatalogTools, updateToolStatus } from '../services/management';
import { useAuth } from '../lib/auth';
import type { Tool } from '../types/api';

export function ToolsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = user?.permissions.includes('catalog.manage');
  const load = () => { setLoading(true); getCatalogTools().then(setRows).catch(() => message.error('工具台账加载失败')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const changeStatus = async (tool: Tool, active: boolean) => { try { await updateToolStatus(tool.id, active ? 'active' : 'inactive'); message.success('工具状态已更新'); load(); } catch (caught) { message.error(caught instanceof Error ? caught.message : '更新失败'); } };
  return <div className='page-wrap'><div className='page-title'><div><Typography.Title level={2}>工具与模型</Typography.Title><Typography.Paragraph type='secondary'>{canManage ? '维护全平台 AI 工具启停状态和模型目录。' : '查看可申请使用的 AI 工具和模型信息。'}</Typography.Paragraph></div></div><Card><Table loading={loading} rowKey='id' dataSource={rows} columns={[{ title: '工具名称', dataIndex: 'name' }, { title: '供应商', dataIndex: 'vendor' }, { title: '计费方式', dataIndex: 'billingType', render: (value: string) => <Tag color='blue'>{value}</Tag> }, { title: '币种', dataIndex: 'currency' }, { title: '模型数量', dataIndex: 'modelCount' }, { title: '状态', render: (_: unknown, row: Tool) => canManage ? <Switch checked={row.status === 'active'} checkedChildren='启用' unCheckedChildren='停用' onChange={(checked) => changeStatus(row, checked)} /> : <Tag color={row.status === 'active' ? 'green' : 'default'}>{row.status === 'active' ? '启用' : '停用'}</Tag> }]} /></Card></div>;
}

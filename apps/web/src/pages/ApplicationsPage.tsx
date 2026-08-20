import { Alert, Button, Card, Form, Input, InputNumber, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { approveApplication, getApplications, rejectApplication } from '../services/applications';
import { ApiError } from '../lib/http';
import { useAuth } from '../lib/auth';
import type { Application } from '../types/api';

const statusMap: Record<string, { text: string; color: string }> = { pending: { text: '待审批', color: 'processing' }, approved: { text: '已通过', color: 'success' }, rejected: { text: '已驳回', color: 'error' }, cancelled: { text: '已取消', color: 'default' } };
const typeMap: Record<string, string> = { quota: '额度申请', extra_usage: '额外使用', budget_increase: '预算追加', tool_access: '工具权限' };
const stageMap: Record<string, { text: string; color: string }> = { manager: { text: '待主管审批', color: 'gold' }, budget_admin: { text: '待预算员审批', color: 'purple' }, completed: { text: '流程完成', color: 'green' } };

export function ApplicationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<Application | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [form] = Form.useForm();
  const load = () => { setLoading(true); getApplications({ page: 1, pageSize: 20 }).then((result) => setRows(result.items)).catch((caught) => setError(caught instanceof ApiError ? caught.message : '申请列表加载失败')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const submitReview = async () => { try { const values = await form.validateFields(); const result = reviewAction === 'approve' ? await approveApplication(reviewing!.id, values.comment, values.approvedAmount) : await rejectApplication(reviewing!.id, values.comment); message.success(result.message); setReviewing(null); form.resetFields(); load(); } catch (caught) { if (!(caught as { errorFields?: unknown }).errorFields) message.error(caught instanceof Error ? caught.message : '提交失败'); } };
  const canApprove = (row: Application) => row.status === 'pending' && ((user?.role === 'manager' && user.permissions.includes('application.approve_manager') && row.approvalStage === 'manager') || (user?.role === 'budget_admin' && user.permissions.includes('application.approve_budget') && row.approvalStage === 'budget_admin'));
  const openReview = (row: Application, action: 'approve' | 'reject') => { setReviewing(row); setReviewAction(action); form.setFieldsValue({ approvedAmount: row.requestedAmount, comment: '' }); };
  const columns = [
    { title: '申请编号', dataIndex: 'applicationNo' },
    { title: '申请类型', dataIndex: 'type', render: (value: string) => typeMap[value] ?? value },
    { title: '申请人', dataIndex: 'applicantName' }, { title: '部门', dataIndex: 'departmentName' },
    { title: '申请金额', dataIndex: 'requestedAmount', render: (value: number) => `¥ ${value.toLocaleString()}` },
    { title: '审批阶段', dataIndex: 'approvalStage', render: (value: string) => <Tag color={stageMap[value]?.color}>{stageMap[value]?.text ?? value}</Tag> },
    { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={statusMap[value]?.color}>{statusMap[value]?.text ?? value}</Tag> },
    { title: '操作', render: (_: unknown, row: Application) => <Space>{canApprove(row) && <><Button size='small' type='link' icon={<CheckOutlined />} onClick={() => openReview(row, 'approve')}>通过</Button><Button size='small' danger type='link' icon={<CloseOutlined />} onClick={() => openReview(row, 'reject')}>驳回</Button></>}<Button type='link' size='small' onClick={() => navigate(`/applications/${row.id}`)}>详情</Button></Space> },
  ];
  return <div className='page-wrap'><div className='page-title'><div><Typography.Title level={2}>申请与审批</Typography.Title><Typography.Paragraph type='secondary'>{user?.role === 'system_admin' ? '全局查看各部门申请进度；业务审批由对应部门角色完成。' : '管理额度、额外使用和年度预算追加申请。'}</Typography.Paragraph></div>{user?.permissions.includes('application.create') && <Button type='primary' icon={<PlusOutlined />} onClick={() => navigate('/applications/new')}>新建申请</Button>}</div>{error && <Alert type='error' showIcon message={error} action={<a onClick={load}>重新加载</a>} />}<Card><Table rowKey='id' loading={loading} dataSource={rows} columns={columns} scroll={{ x: 1000 }} /></Card><Modal title={reviewAction === 'approve' ? '审批通过' : '驳回申请'} open={Boolean(reviewing)} onCancel={() => setReviewing(null)} onOk={submitReview}><Form form={form} layout='vertical'><Form.Item name='approvedAmount' label='通过金额' rules={reviewAction === 'approve' ? [{ required: true, type: 'number', min: 0.01 }] : []}><InputNumber style={{ width: '100%' }} disabled={reviewAction === 'reject'} min={0.01} precision={2} /></Form.Item><Form.Item name='comment' label='审批意见' rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={4} /></Form.Item></Form></Modal></div>;
}

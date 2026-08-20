import { Button, Card, Descriptions, Result, Tag, Timeline, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApplication } from '../services/applications';
import type { Application } from '../types/api';

const stageName = { manager: '部门主管审批', budget_admin: '部门预算员审批' };
export function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Application>();
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (id) getApplication(id).then(setData).catch(() => message.error('申请详情加载失败')).finally(() => setLoading(false)); }, [id]);
  if (!loading && !data) return <Result status='404' title='申请不存在' extra={<Button onClick={() => navigate('/applications')}>返回列表</Button>} />;
  const timeline = [{ children: `申请已提交${data?.submittedAt ? ` · ${new Date(data.submittedAt).toLocaleString('zh-CN')}` : ''}`, color: 'blue' }, ...(data?.reviews ?? []).map((review) => ({ color: review.action === 'approved' ? 'green' : 'red', children: <div><b>{stageName[review.stage]}：{review.action === 'approved' ? '通过' : '驳回'}</b><div>{review.reviewerName} · {new Date(review.reviewedAt).toLocaleString('zh-CN')}</div><div>意见：{review.reviewerComment}{review.approvedAmount ? ` · 审批金额 ¥${review.approvedAmount.toLocaleString()}` : ''}</div></div> })), ...(data?.status === 'pending' ? [{ color: 'gray', children: data.approvalStage === 'manager' ? '等待部门主管审批' : '等待部门预算员审批' }] : [])];
  return <div className='page-wrap narrow-page'><Button type='link' onClick={() => navigate('/applications')}>返回申请列表</Button><Card loading={loading} title='申请详情'><Descriptions bordered column={1}><Descriptions.Item label='申请编号'>{data?.applicationNo}</Descriptions.Item><Descriptions.Item label='申请类型'>{data?.type}</Descriptions.Item><Descriptions.Item label='申请人'>{data?.applicantName}</Descriptions.Item><Descriptions.Item label='部门'>{data?.departmentName}</Descriptions.Item><Descriptions.Item label='申请金额'>¥ {data?.requestedAmount?.toLocaleString()}</Descriptions.Item><Descriptions.Item label='最终金额'>{data?.approvedAmount ? `¥ ${data.approvedAmount.toLocaleString()}` : '-'}</Descriptions.Item><Descriptions.Item label='状态'><Tag color={data?.status === 'approved' ? 'green' : data?.status === 'rejected' ? 'red' : 'blue'}>{data?.status}</Tag></Descriptions.Item><Descriptions.Item label='申请原因'>{data?.reason}</Descriptions.Item><Descriptions.Item label='预期用途'>{data?.expectedUsage ?? '-'}</Descriptions.Item></Descriptions><Typography.Title level={5} style={{ marginTop: 24 }}>流程记录</Typography.Title><Timeline items={timeline} /></Card></div>;
}

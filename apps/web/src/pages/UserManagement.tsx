import { Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { createUser, getDepartments, getUsers, updateUser } from '../services/management';
import type { AdminUser, Department, UserRole } from '../types/api';

const roleOptions = [
  { value: 'employee', label: '员工' },
  { value: 'manager', label: '部门主管' },
  { value: 'budget_admin', label: '部门预算员' },
  { value: 'system_admin', label: '系统管理员' },
];

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const load = () => {
    setLoading(true);
    Promise.all([getUsers(), getDepartments()]).then(([userRows, departmentRows]) => { setUsers(userRows); setDepartments(departmentRows); }).catch(() => message.error('用户数据加载失败')).finally(() => setLoading(false));
  };
  useEffect(load, []);
  const update = async (user: AdminUser, values: Partial<AdminUser>) => {
    try { await updateUser(user.id, values); message.success('用户信息已更新'); load(); } catch (caught) { message.error(caught instanceof Error ? caught.message : '更新失败'); }
  };
  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try { await createUser(values); message.success('用户创建成功'); setOpen(false); form.resetFields(); load(); } catch (caught) { message.error(caught instanceof Error ? caught.message : '创建失败'); } finally { setSaving(false); }
  };
  const columns = [
    { title: '用户', render: (_: unknown, row: AdminUser) => <Space direction='vertical' size={0}><b>{row.name}</b><span>{row.username}</span></Space> },
    { title: '邮箱', dataIndex: 'email' },
    { title: '部门', dataIndex: 'departmentName' },
    { title: '角色', render: (_: unknown, row: AdminUser) => <Select value={row.role} options={roleOptions} style={{ width: 130 }} onChange={(role: UserRole) => update(row, { role })} /> },
    { title: '状态', render: (_: unknown, row: AdminUser) => <Space><Switch checked={row.status === 'active'} onChange={(checked) => update(row, { status: checked ? 'active' : 'inactive' })} /><Tag color={row.status === 'active' ? 'green' : 'default'}>{row.status === 'active' ? '启用' : '停用'}</Tag></Space> },
  ];
  return <Card title='用户管理' extra={<Button type='primary' icon={<PlusOutlined />} onClick={() => setOpen(true)}>新增用户</Button>}><Table loading={loading} rowKey='id' dataSource={users} columns={columns} scroll={{ x: 900 }} /><Modal title='新增用户' open={open} onCancel={() => setOpen(false)} onOk={submit} confirmLoading={saving}><Form form={form} layout='vertical' initialValues={{ role: 'employee' }}><Form.Item name='name' label='姓名' rules={[{ required: true }]}><Input /></Form.Item><Form.Item name='username' label='用户名' rules={[{ required: true, min: 3 }]}><Input /></Form.Item><Form.Item name='email' label='邮箱' rules={[{ required: true, type: 'email' }]}><Input /></Form.Item><Form.Item name='password' label='初始密码' rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item><Form.Item name='departmentId' label='所属部门' rules={[{ required: true }]}><Select options={departments.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item><Form.Item name='role' label='角色' rules={[{ required: true }]}><Select options={roleOptions} /></Form.Item></Form></Modal></Card>;
}

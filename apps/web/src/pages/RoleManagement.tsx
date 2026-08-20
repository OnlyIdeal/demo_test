import { Button, Card, Checkbox, Col, Row, Space, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { getRoles, updateRolePermissions } from '../services/management';
import type { Permission, RoleConfig } from '../types/api';

export function RoleManagement() {
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState('');
  const load = () => getRoles().then((data) => { setRoles(data.roles); setPermissions(data.permissions); setDrafts(Object.fromEntries(data.roles.map((role) => [role.id, role.permissions]))); }).catch(() => message.error('角色权限加载失败'));
  useEffect(() => { void load(); }, []);
  const modules = [...new Set(permissions.map((permission) => permission.module))];
  const save = async (role: RoleConfig) => {
    setSaving(role.id);
    try { await updateRolePermissions(role.id, drafts[role.id] ?? []); message.success(`${role.name}权限已保存`); load(); } catch (caught) { message.error(caught instanceof Error ? caught.message : '保存失败'); } finally { setSaving(''); }
  };
  return <Space direction='vertical' size='middle' style={{ width: '100%' }}>{roles.map((role) => {
    const locked = role.id === 'system_admin';
    return <Card key={role.id} title={<Space><span>{role.name}</span><Tag color={role.dataScope === 'global' ? 'purple' : role.dataScope === 'department' ? 'blue' : 'default'}>{role.dataScope === 'global' ? '全局数据' : role.dataScope === 'department' ? '本部门数据' : '个人数据'}</Tag></Space>} extra={!locked && <Button type='primary' loading={saving === role.id} onClick={() => save(role)}>保存权限</Button>}><Typography.Paragraph type='secondary'>{role.description}{locked ? '；为防止系统失管，该角色固定保留全部权限。' : ''}</Typography.Paragraph><Checkbox.Group value={drafts[role.id] ?? []} disabled={locked} onChange={(values) => setDrafts((current) => ({ ...current, [role.id]: values as string[] }))} style={{ width: '100%' }}><Row gutter={[16, 12]}>{modules.map((module) => <Col xs={24} lg={12} key={module}><Card size='small' title={module}>{permissions.filter((permission) => permission.module === module).map((permission) => <div key={permission.id} style={{ marginBottom: 8 }}><Checkbox value={permission.id}><b>{permission.name}</b><Typography.Text type='secondary'> · {permission.description}</Typography.Text></Checkbox></div>)}</Card></Col>)}</Row></Checkbox.Group></Card>;
  })}</Space>;
}

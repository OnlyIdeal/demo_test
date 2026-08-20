import { Tabs, Typography } from 'antd';
import { UserManagement } from './UserManagement';
import { RoleManagement } from './RoleManagement';

export function SettingsPage() {
  return <div className='page-wrap'><div className='page-title'><div><Typography.Title level={2}>用户与权限</Typography.Title><Typography.Paragraph type='secondary'>统一维护账号、角色、部门归属和功能权限。系统管理员默认拥有全局数据视图。</Typography.Paragraph></div></div><Tabs items={[{ key: 'users', label: '用户管理', children: <UserManagement /> }, { key: 'roles', label: '角色权限', children: <RoleManagement /> }]} /></div>;
}

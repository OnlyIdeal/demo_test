import { Card, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { getCatalogTools } from '../services/management';
import type { Tool } from '../types/api';
export function ToolsPage(){const [rows,setRows]=useState<Tool[]>([]);const [loading,setLoading]=useState(true);useEffect(()=>{getCatalogTools().then(setRows).catch(()=>message.error('工具台账加载失败')).finally(()=>setLoading(false))},[]);return <div className="page-wrap"><div className="page-title"><div><Typography.Title level={2}>工具与模型</Typography.Title><Typography.Paragraph type="secondary">维护 AI 工具基础信息和模型数量。</Typography.Paragraph></div></div><Card><Table loading={loading} rowKey="id" dataSource={rows} columns={[{title:'工具名称',dataIndex:'name'},{title:'供应商',dataIndex:'vendor'},{title:'计费方式',dataIndex:'billingType',render:(v:string)=><Tag color="blue">{v}</Tag>},{title:'币种',dataIndex:'currency'},{title:'模型数量',dataIndex:'modelCount'}]}/></Card></div>}

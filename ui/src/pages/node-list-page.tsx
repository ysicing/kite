import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Node } from 'kubernetes-types/core/v1'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { formatCPU, formatDate, formatMemory } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'

export function NodeListPage() {
  const { t } = useTranslation()

  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<Node>()

  // Define columns for the node table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link to={`/nodes/${row.original.metadata!.name}`}>
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.status?.conditions?.find(c => c.type === 'Ready')?.status, {
        id: 'status',
        header: t('common.status'),
        enableColumnFilter: true,
        cell: ({ row }) => {
          const readyCondition = row.original.status?.conditions?.find(c => c.type === 'Ready')
          const isReady = readyCondition?.status === 'True'
          const isSchedulable = !row.original.spec?.unschedulable
          
          return (
            <div className="flex items-center gap-2">
              <Badge 
                variant={isReady ? 'default' : 'destructive'}
                className="text-xs"
              >
                {isReady ? 'Ready' : 'NotReady'}
              </Badge>
              {!isSchedulable && (
                <Badge variant="secondary" className="text-xs">
                  SchedulingDisabled
                </Badge>
              )}
            </div>
          )
        },
      }),
      columnHelper.accessor((row) => {
        const labels = row.metadata?.labels || {}
        const roles = Object.keys(labels)
          .filter(key => key.startsWith('node-role.kubernetes.io/'))
          .map(key => key.replace('node-role.kubernetes.io/', ''))
          .filter(role => role !== '') // 过滤掉空字符串
        
        if (roles.length === 0) {
          return 'worker'
        }
        
        return roles.join(', ')
      }, {
        id: 'role',
        header: t('nodes.role'),
        enableColumnFilter: true,
        cell: ({ getValue }) => {
          const roles = String(getValue() || 'worker')
          const roleList = roles.split(', ')
          
          // 检查是否包含控制节点角色
          const hasControlPlaneRole = roleList.some(role => role === 'control-plane' || role === 'master')
          
          // 过滤出非控制节点角色
          const otherRoles = roleList.filter(role => role !== 'control-plane' && role !== 'master')
          
          return (
            <div className="flex flex-wrap gap-1">
              {/* 如果有控制节点角色，显示控制节点标识 */}
              {hasControlPlaneRole && (
                <Badge 
                  variant="default" 
                  className="text-xs bg-blue-600 text-white font-semibold"
                >
                  👑 {t('nodes.controlPlane')}
                </Badge>
              )}
              
              {/* 显示其他角色 */}
              {otherRoles.map((role, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {role}
                </Badge>
              ))}
            </div>
          )
        },
      }),
      columnHelper.accessor((row) => row.status?.addresses?.find(addr => addr.type === 'InternalIP')?.address, {
        id: 'internalIP',
        header: 'Internal IP',
        cell: ({ getValue }) => getValue() || 'N/A',
      }),
      columnHelper.accessor((row) => row.status?.nodeInfo?.kubeletVersion, {
        id: 'version',
        header: t('nodes.version'),
        cell: ({ getValue }) => getValue() || 'N/A',
      }),
      columnHelper.accessor((row) => row.status?.capacity?.cpu, {
        id: 'cpu',
        header: 'CPU',
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? formatCPU(value) : 'N/A'
        },
      }),
      columnHelper.accessor((row) => row.status?.capacity?.memory, {
        id: 'memory',
        header: 'Memory',
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? formatMemory(value) : 'N/A'
        },
      }),
      columnHelper.accessor((row) => row.metadata?.creationTimestamp, {
        id: 'creationTimestamp',
        header: t('common.created'),
        cell: ({ getValue }) => {
          const dateStr = formatDate(getValue() || '')
          return (
            <span className="text-muted-foreground text-sm">{dateStr}</span>
          )
        },
      }),
    ],
    [columnHelper, t]
  )

  // Custom filter for node search
  const nodeSearchFilter = useCallback((node: Node, query: string) => {
    const name = node.metadata?.name?.toLowerCase() || ''
    const internalIP = node.status?.addresses?.find(addr => addr.type === 'InternalIP')?.address?.toLowerCase() || ''
    
    // 获取所有角色
    const labels = node.metadata?.labels || {}
    const roles = Object.keys(labels)
      .filter(key => key.startsWith('node-role.kubernetes.io/'))
      .map(key => key.replace('node-role.kubernetes.io/', ''))
      .filter(role => role !== '')
    
    // 构建搜索文本，包括英文原名和国际化显示名
    const searchTexts = roles.length > 0 ? roles.map(role => {
      let displayName = role
      if (role === 'control-plane' || role === 'master') {
        displayName = t('nodes.controlPlane')
      }
      return `${role} ${displayName}`
    }).join(' ').toLowerCase() : 'worker'
    
    return (
      name.includes(query) ||
      internalIP.includes(query) ||
      searchTexts.includes(query)
    )
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <ResourceTable<Node>
        resourceName={t('nodes.title')}
        resourceType="nodes"
        columns={columns}
        clusterScope={true}
        searchQueryFilter={nodeSearchFilter}
      />
    </div>
  )
} 

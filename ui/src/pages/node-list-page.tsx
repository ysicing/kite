import { useCallback, useMemo, useState, useEffect } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { formatBytes } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResourceTable } from '@/components/resource-table'
import { useNodesWithDetails } from '@/lib/api'
import { NodeDetailInfo } from '@/types/api'

export function NodeListPage() {
  const { t } = useTranslation()
  
  // 视图模式状态：true为详情模式，false为精简模式
  // 从localStorage读取用户的选择，默认为精简模式
  const [isDetailsMode, setIsDetailsMode] = useState(() => {
    const saved = localStorage.getItem('nodeListDetailsMode')
    return saved === 'true'
  })

  // 角色过滤状态
  const [selectedRole, setSelectedRole] = useState<string>('__all__')

  // 当模式改变时，保存到localStorage
  useEffect(() => {
    localStorage.setItem('nodeListDetailsMode', isDetailsMode.toString())
  }, [isDetailsMode])
  
  // 使用新的API获取节点详细信息
  const { data: nodeDetails, isLoading, error } = useNodesWithDetails({
    refreshInterval: 30000, // 30秒刷新一次
  })

  // 收集所有角色用于过滤器
  const allRoles = useMemo(() => {
    if (!nodeDetails?.items) return []
    
    const roleSet = new Set<string>()
    
    nodeDetails.items.forEach(node => {
      const labels = node.metadata?.labels || {}
      const roles = Object.keys(labels)
        .filter(key => key.startsWith('node-role.kubernetes.io/'))
        .map(key => key.replace('node-role.kubernetes.io/', ''))
        .filter(role => role !== '')
      
      if (roles.length === 0) {
        roleSet.add(t('nodes.worker'))
      } else {
        const hasControlPlaneRole = roles.some(role => role === 'control-plane' || role === 'master')
        if (hasControlPlaneRole) {
          roleSet.add(t('nodes.controlPlane'))
        }
        const otherRoles = roles.filter(role => role !== 'control-plane' && role !== 'master')
        otherRoles.forEach(role => roleSet.add(role))
      }
    })
    
    return Array.from(roleSet).sort()
  }, [nodeDetails, t])

  // 过滤节点数据
  const filteredNodeDetails = useMemo(() => {
    if (!nodeDetails?.items || !selectedRole || selectedRole === '__all__') {
      return nodeDetails
    }
    
    const filteredItems = nodeDetails.items.filter(node => {
      const labels = node.metadata?.labels || {}
      const roles = Object.keys(labels)
        .filter(key => key.startsWith('node-role.kubernetes.io/'))
        .map(key => key.replace('node-role.kubernetes.io/', ''))
        .filter(role => role !== '')
      
      if (roles.length === 0) {
        return selectedRole === t('nodes.worker')
      }
      
      const hasControlPlaneRole = roles.some(role => role === 'control-plane' || role === 'master')
      if (hasControlPlaneRole && selectedRole === t('nodes.controlPlane')) {
        return true
      }
      
      const otherRoles = roles.filter(role => role !== 'control-plane' && role !== 'master')
      return otherRoles.includes(selectedRole)
    })
    
    return { ...nodeDetails, items: filteredItems }
  }, [nodeDetails, selectedRole, t])

  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<NodeDetailInfo>()

  // 精简模式的列配置
  const simpleColumns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <div className="font-medium text-blue-500 hover:underline">
              <Link to={`/nodes/${row.original.metadata!.name}`}>
                {row.original.metadata!.name}
              </Link>
            </div>
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
            <div className="flex justify-center">
              <div className="flex items-center gap-2">
                <Badge
                  variant={isReady ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {isReady ? t('common.ready') : t('common.notReady')}
                </Badge>
                {!isSchedulable && (
                  <Badge variant="secondary" className="text-xs">
                    SchedulingDisabled
                  </Badge>
                )}
              </div>
            </div>
          )
        },
      }),
      columnHelper.accessor((row) => {
        const labels = row.metadata?.labels || {}
        const roles = Object.keys(labels)
          .filter(key => key.startsWith('node-role.kubernetes.io/'))
          .map(key => key.replace('node-role.kubernetes.io/', ''))
          .filter(role => role !== '')
        
        if (roles.length === 0) {
          return t('nodes.worker')
        }
        
        // 返回所有角色，用逗号分隔，用于显示和过滤
        const processedRoles = []
        const hasControlPlaneRole = roles.some(role => role === 'control-plane' || role === 'master')
        
        if (hasControlPlaneRole) {
          processedRoles.push(t('nodes.controlPlane'))
        }
        
        const otherRoles = roles.filter(role => role !== 'control-plane' && role !== 'master')
        processedRoles.push(...otherRoles)
        
        return processedRoles.join(', ')
      }, {
        id: 'role',
        header: t('nodes.role'),
        enableColumnFilter: false, // 禁用内置过滤器，我们将使用自定义过滤器
        cell: ({ row }) => {
          const labels = row.original.metadata?.labels || {}
          const roles = Object.keys(labels)
            .filter(key => key.startsWith('node-role.kubernetes.io/'))
            .map(key => key.replace('node-role.kubernetes.io/', ''))
            .filter(role => role !== '')
          
          if (roles.length === 0) {
            return (
              <div className="flex justify-center">
                <Badge variant="outline" className="text-xs">
                  {t('nodes.worker')}
                </Badge>
              </div>
            )
          }
          
          const hasControlPlaneRole = roles.some(role => role === 'control-plane' || role === 'master')
          const otherRoles = roles.filter(role => role !== 'control-plane' && role !== 'master')
          
          return (
            <div className="flex justify-center">
              <div className="flex flex-wrap gap-1">
                {hasControlPlaneRole && (
                  <Badge 
                    variant="default" 
                    className="text-xs bg-blue-600 text-white font-semibold"
                  >
                    👑 {t('nodes.controlPlane')}
                  </Badge>
                )}
                {otherRoles.map((role, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          )
        },
      }),
      columnHelper.accessor((row) => row.status?.addresses?.find(addr => addr.type === 'InternalIP')?.address, {
        id: 'internalIP',
        header: t('nodes.internalIP'),
        cell: ({ getValue }) => (
          <div className="flex justify-center">
            {getValue() || t('nodes.unavailable')}
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.status?.nodeInfo?.kubeletVersion, {
        id: 'version',
        header: t('common.version'),
        cell: ({ getValue }) => (
          <div className="flex justify-center">
            <span className="text-xs text-muted-foreground">{getValue() || t('nodes.unavailable')}</span>
          </div>
        ),
      }),
    ],
    [columnHelper, t]
  )

  // 详情模式的列配置
  const detailsColumns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <div className="font-medium text-blue-500 hover:underline">
              <Link to={`/nodes/${row.original.metadata!.name}`}>
                {row.original.metadata!.name}
              </Link>
            </div>
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
                {isReady ? t('common.ready') : t('common.notReady')}
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
          return t('nodes.worker')
        }
        
        // 返回所有角色，用逗号分隔，用于显示和过滤
        const processedRoles = []
        const hasControlPlaneRole = roles.some(role => role === 'control-plane' || role === 'master')
        
        if (hasControlPlaneRole) {
          processedRoles.push(t('nodes.controlPlane'))
        }
        
        const otherRoles = roles.filter(role => role !== 'control-plane' && role !== 'master')
        processedRoles.push(...otherRoles)
        
        return processedRoles.join(', ')
      }, {
        id: 'role',
        header: t('nodes.role'),
        enableColumnFilter: false, // 禁用内置过滤器，我们将使用自定义过滤器
        cell: ({ row }) => {
          const labels = row.original.metadata?.labels || {}
          const roles = Object.keys(labels)
            .filter(key => key.startsWith('node-role.kubernetes.io/'))
            .map(key => key.replace('node-role.kubernetes.io/', ''))
            .filter(role => role !== '')
          
          if (roles.length === 0) {
            return (
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">
                  {t('nodes.worker')}
                </Badge>
              </div>
            )
          }
          
          const hasControlPlaneRole = roles.some(role => role === 'control-plane' || role === 'master')
          const otherRoles = roles.filter(role => role !== 'control-plane' && role !== 'master')
          
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
        header: t('nodes.internalIP'),
        cell: ({ getValue }) => getValue() || t('nodes.unavailable'),
      }),
      // CPU使用率列
      columnHelper.accessor((row) => row.cpuUsagePercent, {
        id: 'cpuUsage',
        header: t('nodes.cpuUsage'),
        cell: ({ row }) => {
          const cpuUsageCores = row.original.cpuUsageCores
          const cpuCapacityCores = row.original.cpuCapacityCores
          const cpuUsagePercent = row.original.cpuUsagePercent
          
          return (
            <div className="space-y-1">
                          <div className="text-sm font-medium">
              {cpuUsageCores > 0 ? cpuUsageCores.toFixed(3) : t('nodes.unavailable')} / {cpuCapacityCores > 0 ? cpuCapacityCores.toString() : t('nodes.unavailable')} {t('nodes.cores')}
            </div>
              {cpuUsagePercent > 0 && (
                <div className="text-xs text-muted-foreground">
                  {cpuUsagePercent.toFixed(1)}%
                </div>
              )}
            </div>
          )
        },
      }),
      // CPU分配率列
      columnHelper.accessor((row) => row.cpuRequestedPercent, {
        id: 'cpuRequested',
        header: t('nodes.cpuRequested'),
        cell: ({ row }) => {
          const cpuRequestedCores = row.original.cpuRequestedCores
          const cpuAllocatableCores = row.original.cpuAllocatableCores
          const cpuRequestedPercent = row.original.cpuRequestedPercent
          
          return (
            <div className="space-y-1">
                          <div className="text-sm font-medium">
              {cpuRequestedCores > 0 ? cpuRequestedCores.toFixed(3) : '0'} / {cpuAllocatableCores > 0 ? cpuAllocatableCores.toString() : t('nodes.unavailable')} {t('nodes.cores')}
            </div>
              {cpuRequestedPercent > 0 && (
                <div className="text-xs text-muted-foreground">
                  {cpuRequestedPercent.toFixed(1)}%
                </div>
              )}
            </div>
          )
        },
      }),
      // 内存使用率列
      columnHelper.accessor((row) => row.memoryUsagePercent, {
        id: 'memoryUsage',
        header: t('nodes.memoryUsage'),
        cell: ({ row }) => {
          const memoryUsageBytes = row.original.memoryUsageBytes
          const memoryCapacityBytes = row.original.memoryCapacityBytes
          const memoryUsagePercent = row.original.memoryUsagePercent
          
          return (
            <div className="space-y-1">
                          <div className="text-sm font-medium">
              {memoryUsageBytes > 0 ? formatBytes(memoryUsageBytes) : t('nodes.unavailable')} / {memoryCapacityBytes > 0 ? formatBytes(memoryCapacityBytes) : t('nodes.unavailable')}
            </div>
              {memoryUsagePercent > 0 && (
                <div className="text-xs text-muted-foreground">
                  {memoryUsagePercent.toFixed(1)}%
                </div>
              )}
            </div>
          )
        },
      }),
      // 内存分配率列
      columnHelper.accessor((row) => row.memoryRequestedPercent, {
        id: 'memoryRequested',
        header: t('nodes.memoryRequested'),
        cell: ({ row }) => {
          const memoryRequestedBytes = row.original.memoryRequestedBytes
          const memoryAllocatableBytes = row.original.memoryAllocatableBytes
          const memoryRequestedPercent = row.original.memoryRequestedPercent
          
          return (
            <div className="space-y-1">
                          <div className="text-sm font-medium">
              {memoryRequestedBytes > 0 ? formatBytes(memoryRequestedBytes) : '0 B'} / {memoryAllocatableBytes > 0 ? formatBytes(memoryAllocatableBytes) : t('nodes.unavailable')}
            </div>
              {memoryRequestedPercent > 0 && (
                <div className="text-xs text-muted-foreground">
                  {memoryRequestedPercent.toFixed(1)}%
                </div>
              )}
            </div>
          )
        },
      }),
      // Pod数量列
      columnHelper.accessor((row) => row.podCount, {
        id: 'podCount',
        header: t('nodes.podCount'),
        cell: ({ row }) => {
          const podCount = row.original.podCount
          const podCapacity = row.original.podCapacity
          const podUsagePercent = row.original.podUsagePercent
          
          return (
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {podCount} / {podCapacity}
              </div>
              {podUsagePercent > 0 && (
                <div className="text-xs text-muted-foreground">
                  {podUsagePercent.toFixed(1)}%
                </div>
              )}
            </div>
          )
        },
      }),
      // 存活时间列
      columnHelper.accessor((row) => row.age, {
        id: 'age',
        header: t('common.age'),
        cell: ({ getValue }) => {
          const age = getValue()
          return (
            <span className="text-sm font-mono">{age}</span>
          )
        },
      }),
      columnHelper.accessor((row) => row.status?.nodeInfo?.kubeletVersion, {
        id: 'version',
        header: t('common.version'),
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue() || t('nodes.unavailable')}</span>
        ),
      }),
    ],
    [columnHelper, t]
  )



  // Custom filter for node search
  const nodeSearchFilter = useCallback((node: NodeDetailInfo, query: string) => {
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
    }).join(' ').toLowerCase() : t('nodes.worker').toLowerCase()
    
    return (
      name.includes(query) ||
      internalIP.includes(query) ||
      searchTexts.includes(query)
    )
  }, [t])

  // 如果有错误且在详情模式下，显示错误信息，回退到精简模式
  if (error && isDetailsMode) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('nodes.title')}</h1>
            <div className="text-red-500 text-sm">
              {t('nodes.failedToLoadDetails')}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('nodes.simpleMode')}</span>
            <Switch
              checked={isDetailsMode}
              onCheckedChange={setIsDetailsMode}
              disabled
            />
            <span className="text-sm text-muted-foreground">{t('nodes.detailsMode')}</span>
          </div>
        </div>
        
        <ResourceTable<NodeDetailInfo>
          resourceName={t('nodes.title')}
          resourceType="nodes"
          columns={simpleColumns}
          clusterScope={true}
          searchQueryFilter={nodeSearchFilter}
          hideHeader={true}
          customFilters={
            allRoles.length > 0 ? (
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="min-w-32">
                  <SelectValue placeholder={`Filter ${t('nodes.role')}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All {t('nodes.role')}</SelectItem>
                  {allRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : undefined
          }
        />
      </div>
    )
  }

  // 如果有错误且在精简模式下，使用基本的ResourceTable
  if (error && !isDetailsMode) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('nodes.title')}</h1>
            <p className="text-muted-foreground text-sm">
              {t('nodes.simpleDescription')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('nodes.simpleMode')}</span>
            <Switch
              checked={isDetailsMode}
              onCheckedChange={setIsDetailsMode}
            />
            <span className="text-sm text-muted-foreground">{t('nodes.detailsMode')}</span>
          </div>
        </div>
        
        <ResourceTable<NodeDetailInfo>
          resourceName={t('nodes.title')}
          resourceType="nodes"
          columns={simpleColumns}
          clusterScope={true}
          searchQueryFilter={nodeSearchFilter}
          hideHeader={true}
          customFilters={
            allRoles.length > 0 ? (
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="min-w-32">
                  <SelectValue placeholder={`Filter ${t('nodes.role')}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All {t('nodes.role')}</SelectItem>
                  {allRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : undefined
          }
        />
      </div>
    )
  }

  // 如果正在加载，显示加载状态
  if (isLoading && !nodeDetails) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('nodes.title')}</h1>
            <p className="text-muted-foreground text-sm">
              {isDetailsMode ? t('nodes.detailsDescription') : t('nodes.simpleDescription')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('nodes.simpleMode')}</span>
            <Switch
              checked={isDetailsMode}
              onCheckedChange={setIsDetailsMode}
            />
            <span className="text-sm text-muted-foreground">{t('nodes.detailsMode')}</span>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>{isDetailsMode ? t('nodes.loadingDetails') : t('common.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  // 如果没有数据，显示空状态
  if (!nodeDetails?.items || nodeDetails.items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('nodes.title')}</h1>
            <p className="text-muted-foreground text-sm">
              {isDetailsMode ? t('nodes.detailsDescription') : t('nodes.simpleDescription')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('nodes.simpleMode')}</span>
            <Switch
              checked={isDetailsMode}
              onCheckedChange={setIsDetailsMode}
            />
            <span className="text-sm text-muted-foreground">{t('nodes.detailsMode')}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p>{t('nodes.noNodesFound')}</p>
          </div>
        </div>
      </div>
    )
  }

  // 精简模式：使用基本的ResourceTable
  if (!isDetailsMode) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('nodes.title')}</h1>
            <p className="text-muted-foreground text-sm">
              {t('nodes.simpleDescription')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('nodes.simpleMode')}</span>
            <Switch
              checked={isDetailsMode}
              onCheckedChange={setIsDetailsMode}
            />
            <span className="text-sm text-muted-foreground">{t('nodes.detailsMode')}</span>
          </div>
        </div>
        
        <ResourceTable<NodeDetailInfo>
          resourceName={t('nodes.title')}
          resourceType="nodes"
          columns={simpleColumns}
          clusterScope={true}
          searchQueryFilter={nodeSearchFilter}
          data={filteredNodeDetails}
          hideHeader={true}
          customFilters={
            allRoles.length > 0 ? (
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="min-w-32">
                  <SelectValue placeholder={`Filter ${t('nodes.role')}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All {t('nodes.role')}</SelectItem>
                  {allRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : undefined
          }
        />
      </div>
    )
  }

  // 详情模式：使用ResourceTable渲染详情列
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('nodes.title')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('nodes.detailsDescription')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t('nodes.simpleMode')}</span>
          <Switch
            checked={isDetailsMode}
            onCheckedChange={setIsDetailsMode}
          />
          <span className="text-sm text-muted-foreground">{t('nodes.detailsMode')}</span>
        </div>
      </div>
      
      <ResourceTable<NodeDetailInfo>
        resourceName={t('nodes.title')}
        resourceType="nodes"
        columns={detailsColumns}
        clusterScope={true}
        searchQueryFilter={nodeSearchFilter}
        data={filteredNodeDetails}
        isLoading={isLoading}
        error={error}
        hideHeader={true}
        customFilters={
          allRoles.length > 0 ? (
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="min-w-32">
                <SelectValue placeholder={`Filter ${t('nodes.role')}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All {t('nodes.role')}</SelectItem>
                {allRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />
      <div className="text-xs text-muted-foreground text-center">
        {t('nodes.autoRefresh')}
      </div>
    </div>
  )
} 

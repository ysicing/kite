import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import {
  IconEdit,
  IconTrash,
  IconPlus,
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { CreateResourceDialog } from '@/components/create-resource-dialog'
import { useCluster } from '@/hooks/use-cluster'
import { fetchResources, deleteResource } from '@/lib/api'
import { handleResourceError } from '@/lib/utils'
import type { UpgradePlan } from '@/types/api'

export default function UpgradePlansListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectedCluster } = useCluster()
  
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    plan: UpgradePlan | null
    isDeleting: boolean
  }>({
    open: false,
    plan: null,
    isDeleting: false,
  })
  
  const [createDialog, setCreateDialog] = useState(false)

  // 定义列助手
  const columnHelper = createColumnHelper<UpgradePlan>()

  // 获取升级计划列表
  const {
    data: plansData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['resources', selectedCluster, 'plans', 'system-upgrade'],
    queryFn: () => fetchResources('plans', 'system-upgrade'),
    enabled: !!selectedCluster,
  })

  const plans = (plansData as UpgradePlan[]) || []

  const handleView = useCallback((plan: UpgradePlan) => {
    navigate(`/plans/${plan.metadata.name}`)
  }, [navigate])

  const handleEdit = useCallback((plan: UpgradePlan) => {
    navigate(`/plans/${plan.metadata.name}?tab=yaml`)
  }, [navigate])

  const handleDeleteClick = useCallback((plan: UpgradePlan) => {
    setDeleteDialog({
      open: true,
      plan,
      isDeleting: false,
    })
  }, [])

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.plan) return

    setDeleteDialog(prev => ({ ...prev, isDeleting: true }))
    
    try {
              await deleteResource('plans', deleteDialog.plan.metadata.name, 'system-upgrade')
      setDeleteDialog({ open: false, plan: null, isDeleting: false })
      refetch()
    } catch (error) {
      console.error('Failed to delete plan:', error)
      handleResourceError(error, t)
      setDeleteDialog(prev => ({ ...prev, isDeleting: false }))
    }
  }

  const renderPlanStatus = (plan: UpgradePlan) => {
    if (!plan.status?.conditions) {
      return <Badge variant="secondary">{t('systemUpgrade.status.unknown')}</Badge>
    }

    const conditions = plan.status.conditions
    const latestCondition = conditions[conditions.length - 1]

    if (latestCondition?.type === 'Complete' && latestCondition?.status === 'True') {
      return <Badge variant="default">{t('systemUpgrade.status.completed')}</Badge>
    }
    if (latestCondition?.type === 'InProgress' && latestCondition?.status === 'True') {
      return <Badge variant="secondary">{t('systemUpgrade.status.inProgress')}</Badge>
    }
    if (latestCondition?.type === 'Failed' && latestCondition?.status === 'True') {
      return <Badge variant="destructive">{t('systemUpgrade.status.failed')}</Badge>
    }

    return <Badge variant="outline">{t('systemUpgrade.status.pending')}</Badge>
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div 
            className="font-medium text-blue-500 hover:underline cursor-pointer"
            onClick={() => handleView(row.original)}
          >
            {row.original.metadata.name}
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.status, {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => renderPlanStatus(row.original),
      }),
      columnHelper.accessor('spec.upgrade.image', {
        header: t('systemUpgrade.image'),
        cell: ({ row }) => (
          <div className="font-mono text-sm">
            {row.original.spec?.upgrade?.image || '-'}
          </div>
        ),
      }),
      columnHelper.accessor('spec.version', {
         header: t('common.version'),
         cell: ({ row }) => row.original.spec?.version || '-',
       }),
      //  columnHelper.accessor((row) => row.spec?.nodeSelector, {
      //    id: 'nodeSelector',
      //    header: t('common.nodeSelector'),
      //    cell: ({ row }) => {
      //      const nodeSelector = row.original.spec?.nodeSelector
      //      if (!nodeSelector) return '-'
           
      //      let selectorText = ''
      //      if (nodeSelector.matchLabels) {
      //        selectorText = Object.entries(nodeSelector.matchLabels)
      //          .map(([key, value]) => `${key}=${value}`)
      //          .join(', ')
      //      }
      //      if (nodeSelector.matchExpressions && nodeSelector.matchExpressions.length > 0) {
      //        const expressions = nodeSelector.matchExpressions
      //          .map(exp => `${exp.key} ${exp.operator} ${exp.values?.join(',') || ''}`)
      //          .join(', ')
      //        selectorText = selectorText ? `${selectorText}, ${expressions}` : expressions
      //      }
           
      //      return (
      //        <div className="font-mono text-xs max-w-48 truncate" title={selectorText}>
      //          {selectorText || '-'}
      //        </div>
      //      )
      //    },
      //  }),
      //  columnHelper.accessor((row) => row.spec?.tolerations, {
      //    id: 'tolerations',
      //    header: t('systemUpgrade.tolerations'),
      //    cell: ({ row }) => {
      //      const tolerations = row.original.spec?.tolerations
      //      if (!tolerations || tolerations.length === 0) return '-'
           
      //      const tolerationText = tolerations
      //        .map(tol => {
      //          if (tol.operator === 'Exists') {
      //            return tol.key ? `${tol.key}:Exists` : 'Exists'
      //          }
      //          return tol.key && tol.value ? `${tol.key}=${tol.value}` : tol.key || 'NoKey'
      //        })
      //        .join(', ')
           
      //      return (
      //        <div className="font-mono text-xs max-w-48 truncate" title={tolerationText}>
      //          {tolerationText}
      //        </div>
      //      )
      //    },
      //  }),
       columnHelper.accessor('spec.concurrency', {
         header: t('systemUpgrade.concurrency'),
         cell: ({ row }) => row.original.spec?.concurrency || 1,
       }),
      columnHelper.accessor('metadata.creationTimestamp', {
        header: t('common.age'),
        cell: ({ row }) => {
          const plan = row.original
          if (!plan.metadata.creationTimestamp) return '-'
          const created = new Date(plan.metadata.creationTimestamp)
          const now = new Date()
          const diffMs = now.getTime() - created.getTime()
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
          
          if (diffDays > 0) {
            return `${diffDays}${t('common.timeUnits.days')}`
          } else if (diffHours > 0) {
            return `${diffHours}${t('common.timeUnits.hours')}`
          } else {
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
            return `${diffMinutes}${t('common.timeUnits.minutes')}`
          }
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => {
          const plan = row.original
          return (
            <div className="flex items-center gap-2">

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(plan)}
              >
                <IconEdit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(plan)}
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      }),
    ],
    [columnHelper, t, handleView, handleEdit, handleDeleteClick, renderPlanStatus]
  )

  const filter = (item: UpgradePlan, query: string): boolean => {
    if (!query) return true
    
    const searchText = query.toLowerCase()
    
    // 搜索名称
    if (item.metadata.name?.toLowerCase().includes(searchText)) {
      return true
    }
    
    // 搜索镜像
    if (item.spec?.upgrade?.image?.toLowerCase().includes(searchText)) {
      return true
    }
    
    // 搜索节点选择器
    if (item.spec?.nodeSelector) {
      let selectorText = ''
      if (item.spec.nodeSelector.matchLabels) {
        selectorText += Object.entries(item.spec.nodeSelector.matchLabels)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ')
      }
      if (item.spec.nodeSelector.matchExpressions) {
        const expressions = item.spec.nodeSelector.matchExpressions
          .map(exp => `${exp.key} ${exp.operator} ${exp.values?.join(',') || ''}`)
          .join(' ')
        selectorText += ' ' + expressions
      }
      if (selectorText.toLowerCase().includes(searchText)) {
        return true
      }
    }
    
    // 搜索容忍度
    if (item.spec?.tolerations) {
      const tolerationText = item.spec.tolerations
        .map(tol => `${tol.key || ''} ${tol.operator || ''} ${tol.value || ''} ${tol.effect || ''}`)
        .join(' ')
        .toLowerCase()
      if (tolerationText.includes(searchText)) {
        return true
      }
    }
    
    return false
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('systemUpgrade.upgradeDevices')}</h1>
          <p className="text-muted-foreground">{t('systemUpgrade.upgradeDevicesDescription')}</p>
        </div>
        <Button onClick={() => setCreateDialog(true)}>
          <IconPlus className="h-4 w-4 mr-2" />
          {t('systemUpgrade.createPlan')}
        </Button>
      </div>

      <ResourceTable<UpgradePlan>
        resourceName="plans"
        data={plans}
        columns={columns}
        isLoading={isLoading}
        error={error}
        searchQueryFilter={filter}
        clusterScope={true}
      />

      <DeleteConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDeleteDialog({ open: false, plan: null, isDeleting: false })
          }
        }}
        resourceName={deleteDialog.plan?.metadata.name || ''}
        resourceType="plans"
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteDialog.isDeleting}
      />

      <CreateResourceDialog
        open={createDialog}
        onOpenChange={(open) => {
          setCreateDialog(open)
          if (!open) {
            // 对话框关闭时刷新数据
            refetch()
          }
        }}
      />
    </div>
  )
} 

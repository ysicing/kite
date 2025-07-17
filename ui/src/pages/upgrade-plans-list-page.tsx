import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  IconEye,
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

  // 获取升级计划列表
  const {
    data: plansData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['resources', selectedCluster, 'plans', ''],
    queryFn: () => fetchResources('plans', ''),
    enabled: !!selectedCluster,
  })

  const plans = (plansData as UpgradePlan[]) || []

  const handleView = (plan: UpgradePlan) => {
    navigate(`/plans/${plan.metadata.name}`)
  }

  const handleEdit = (plan: UpgradePlan) => {
    navigate(`/plans/${plan.metadata.name}?tab=yaml`)
  }

  const handleDeleteClick = (plan: UpgradePlan) => {
    setDeleteDialog({
      open: true,
      plan,
      isDeleting: false,
    })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.plan) return

    setDeleteDialog(prev => ({ ...prev, isDeleting: true }))
    
    try {
      await deleteResource('plans', '', deleteDialog.plan.metadata.name)
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

  const columns = [
    {
      accessorKey: 'metadata.name',
      header: t('common.name'),
      cell: ({ row }: any) => (
        <div className="font-medium">{row.original.metadata.name}</div>
      ),
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      cell: ({ row }: any) => renderPlanStatus(row.original as UpgradePlan),
    },
    {
      accessorKey: 'spec.upgrade.image',
      header: t('systemUpgrade.image'),
      cell: ({ row }: any) => (
        <div className="font-mono text-sm">
          {(row.original as UpgradePlan).spec?.upgrade?.image || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'spec.nodeSelector',
      header: t('systemUpgrade.nodeSelector'),
      cell: ({ row }: any) => {
        const plan = row.original as UpgradePlan
        if (!plan.spec?.nodeSelector) return '-'
        
        const selectors = Object.entries(plan.spec.nodeSelector)
        if (selectors.length === 0) return '-'
        
        return (
          <div className="flex flex-wrap gap-1">
            {selectors.map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-xs">
                {key}={String(value)}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'spec.concurrency',
      header: t('systemUpgrade.concurrency'),
      cell: ({ row }: any) => (row.original as UpgradePlan).spec?.concurrency || 1,
    },
    {
      accessorKey: 'metadata.creationTimestamp',
      header: t('common.age'),
      cell: ({ row }: any) => {
        const plan = row.original as UpgradePlan
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
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }: any) => {
        const plan = row.original as UpgradePlan
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleView(plan)}
            >
              <IconEye className="h-4 w-4" />
            </Button>
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
    },
  ]

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
      const selectorText = Object.entries(item.spec.nodeSelector)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ')
        .toLowerCase()
      if (selectorText.includes(searchText)) {
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

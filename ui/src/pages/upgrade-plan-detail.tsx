import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  IconTrash,
  IconEdit,
  IconDownload,
  IconRefresh,
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { YamlEditor } from '@/components/yaml-editor'
import { EventTable } from '@/components/event-table'
import { LabelsAnno } from '@/components/lables-anno'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { useCluster } from '@/hooks/use-cluster'
import { fetchResource, deleteResource, updateResource } from '@/lib/api'
import { downloadResource, handleResourceError } from '@/lib/utils'
import type { UpgradePlan } from '@/types/api'

export default function UpgradePlanDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { selectedCluster } = useCluster()
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedYaml, setEditedYaml] = useState('')

  // 获取升级计划详情
  const {
    data: plan,
    isLoading: planLoading,
    error: planError,
    refetch,
  } = useQuery({
    queryKey: ['resource', selectedCluster, 'plans', '', name],
    queryFn: () => fetchResource('plans', '', name as string),
    enabled: !!selectedCluster && !!name,
  })

  const upgradePlan = plan as UpgradePlan

  useEffect(() => {
    if (upgradePlan && typeof upgradePlan === 'object') {
      // 如果有YAML内容就使用，否则使用JSON stringify
      const yamlContent = (upgradePlan as any).yaml || JSON.stringify(upgradePlan, null, 2)
      setEditedYaml(yamlContent)
    }
  }, [upgradePlan])

  const handleSave = async () => {
    if (!editedYaml.trim()) {
      toast.error(t('validation.yamlRequired'))
      return
    }

    try {
      // 解析YAML内容为对象
      const resourceData = editedYaml.startsWith('{') 
        ? JSON.parse(editedYaml) 
        : editedYaml
      await updateResource('plans', '', name as string, resourceData as any)
      setIsEditing(false)
      toast.success(t('actions.updateSuccess'))
      refetch()
    } catch (error) {
      console.error('Failed to update plan:', error)
      handleResourceError(error, t)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('plans', '', name as string)
      toast.success(t('actions.deleteSuccess'))
      navigate('/plans')
    } catch (error) {
      console.error('Failed to delete plan:', error)
      handleResourceError(error, t)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownload = () => {
    if (upgradePlan) {
      downloadResource(upgradePlan, `${name}.yaml`)
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

  if (planLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (planError || !upgradePlan) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              {planError ? t('errors.loadFailed') : t('errors.notFound')}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('systemUpgrade.planDetail')}: {name}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <IconRefresh className="h-4 w-4 mr-2" />
            {t('actions.refresh')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            <IconDownload className="h-4 w-4 mr-2" />
            {t('actions.download')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <IconEdit className="h-4 w-4 mr-2" />
            {isEditing ? t('actions.cancel') : t('actions.edit')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <IconTrash className="h-4 w-4 mr-2" />
            {t('actions.delete')}
          </Button>
        </div>
      </div>

      <ResponsiveTabs
        tabs={[
          {
            value: 'overview',
            label: t('systemUpgrade.overview'),
            content: (
              <div className="space-y-6">
                {/* 基本信息 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('systemUpgrade.basicInfo')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('common.name')}</p>
                        <p className="font-medium">{upgradePlan.metadata.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('common.status')}</p>
                        {renderPlanStatus(upgradePlan)}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('systemUpgrade.image')}</p>
                        <p className="font-medium font-mono text-sm">
                          {upgradePlan.spec?.upgrade?.image || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('systemUpgrade.concurrency')}</p>
                        <p className="font-medium">{upgradePlan.spec?.concurrency || 1}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('common.createdTime')}</p>
                        <p className="font-medium">
                          {upgradePlan.metadata.creationTimestamp
                            ? new Date(upgradePlan.metadata.creationTimestamp).toLocaleString()
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('systemUpgrade.channel')}</p>
                        <p className="font-medium">{upgradePlan.spec?.channel || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 节点选择器 */}
                {upgradePlan.spec?.nodeSelector && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('systemUpgrade.nodeSelector')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(upgradePlan.spec.nodeSelector).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <Badge variant="outline">{key}</Badge>
                            <span>=</span>
                            <Badge variant="secondary">{String(value)}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 标签和注解 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('systemUpgrade.labelsAnnotations')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LabelsAnno 
                      labels={upgradePlan.metadata.labels || {}}
                      annotations={upgradePlan.metadata.annotations || {}}
                    />
                  </CardContent>
                </Card>

                {/* 状态信息 */}
                {upgradePlan.status && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('systemUpgrade.statusInfo')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {upgradePlan.status.conditions && upgradePlan.status.conditions.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">{t('systemUpgrade.conditions')}</h4>
                            <div className="space-y-2">
                              {upgradePlan.status.conditions.map((condition: any, index: number) => (
                                <div key={index} className="p-3 border rounded-lg">
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Type:</span> {condition.type}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Status:</span> {condition.status}
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">Message:</span> {condition.message || '-'}
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">Last Transition:</span>{' '}
                                      {condition.lastTransitionTime 
                                        ? new Date(condition.lastTransitionTime).toLocaleString()
                                        : '-'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ),
          },
          {
            value: 'yaml',
            label: 'YAML',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    YAML {t('common.configuration')}
                    {isEditing && (
                      <Button onClick={handleSave}>
                        {t('actions.save')}
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <YamlEditor
                    value={editedYaml}
                    onChange={setEditedYaml}
                    readOnly={!isEditing}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            value: 'events',
            label: t('common.events'),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{t('common.events')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <EventTable 
                    resource="plans"
                    name={name as string}
                    namespace=""
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        resourceName={name as string}
        resourceType="plans"
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
} 

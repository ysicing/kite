import { useEffect, useState } from 'react'
import { IconRefresh, IconTrash, IconChartLine, IconTarget } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import * as yaml from 'js-yaml'
import { HorizontalPodAutoscaler } from 'kubernetes-types/autoscaling/v2'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import {
  deleteResource,
  updateResource,
  useResource,
} from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { EventTable } from '@/components/event-table'
import { LabelsAnno } from '@/components/lables-anno'
import { RelatedResourcesTable } from '@/components/related-resource-table'
import { YamlEditor } from '@/components/yaml-editor'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function HPADetail(props: { namespace: string; name: string }) {
  const { namespace, name } = props
  const [yamlContent, setYamlContent] = useState('')
  const [isSavingYaml, setIsSavingYaml] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Fetch HPA data
  const {
    data: hpa,
    isLoading: isLoadingHPA,
    isError: isHPAError,
    error: hpaError,
    refetch: refetchHPA,
  } = useResource<HorizontalPodAutoscaler>('horizontalpodautoscalers', name, namespace)

  useEffect(() => {
    if (hpa) {
      setYamlContent(yaml.dump(hpa, { indent: 2 }))
    }
  }, [hpa])

  const handleYamlChange = (value: string) => {
    setYamlContent(value)
  }

  const handleSaveYaml = async () => {
    try {
      setIsSavingYaml(true)
      const parsedYaml = yaml.load(yamlContent) as HorizontalPodAutoscaler
      await updateResource('horizontalpodautoscalers', namespace, name, parsedYaml)
      toast.success('HPA updated successfully')
      refetchHPA()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update HPA')
    } finally {
      setIsSavingYaml(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await deleteResource('horizontalpodautoscalers', namespace, name)
      toast.success('HPA deleted successfully')
      navigate(`/horizontalpodautoscalers`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete HPA')
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  if (isLoadingHPA) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isHPAError) {
    return (
      <div className="text-center py-10 text-red-500">
        {t('common.errorLoadingResource')}: {hpaError?.message}
      </div>
    )
  }

  if (!hpa) {
    return (
      <div className="text-center py-10">
        {t('common.resourceNotFound')}
      </div>
    )
  }

  // Extract metrics information
  const metrics = hpa.spec?.metrics || []
  const currentMetrics = hpa.status?.currentMetrics || []
  const conditions = hpa.status?.conditions || []
  const scaleTargetRef = hpa.spec?.scaleTargetRef

  const tabs = [
    {
      value: 'overview',
      label: t('common.overview'),
      content: (
        <div className="space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('common.basicInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t('common.name')}</Label>
                  <p className="font-medium">{hpa.metadata?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('common.namespace')}</Label>
                  <p className="font-medium">{hpa.metadata?.namespace}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('common.created')}</Label>
                  <p className="font-medium">{formatDate(hpa.metadata?.creationTimestamp || '')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">UID</Label>
                  <p className="font-mono text-xs">{hpa.metadata?.uid}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Target Resource Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconTarget className="h-5 w-5" />
                Target Resource
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Kind</Label>
                  <p className="font-medium">{scaleTargetRef?.kind}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{scaleTargetRef?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">API Version</Label>
                  <p className="font-medium">{scaleTargetRef?.apiVersion || 'apps/v1'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scaling Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>Scaling Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Min Replicas</Label>
                  <p className="font-medium text-xl">{hpa.spec?.minReplicas || 1}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Max Replicas</Label>
                  <p className="font-medium text-xl">{hpa.spec?.maxReplicas}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Current Replicas</Label>
                  <p className="font-medium text-xl">{hpa.status?.currentReplicas || '-'}</p>
                </div>
              </div>
              {hpa.status?.desiredReplicas !== undefined && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Desired Replicas: </span>
                    <span className="font-medium">{hpa.status.desiredReplicas}</span>
                  </p>
                  {hpa.status?.lastScaleTime && (
                    <p className="text-sm mt-1">
                      <span className="text-muted-foreground">Last Scale Time: </span>
                      <span className="font-medium">{formatDate(hpa.status.lastScaleTime)}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metrics Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconChartLine className="h-5 w-5" />
                Metrics Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Target Type</TableHead>
                      <TableHead>Target Value</TableHead>
                      <TableHead>Current Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((metric, index) => {
                      const currentMetric = currentMetrics[index]
                      let metricName = '-'
                      let targetType = '-'
                      let targetValue = '-'
                      let currentValue = '-'

                      if (metric.type === 'Resource') {
                        metricName = metric.resource?.name || '-'
                        const target = metric.resource?.target
                        targetType = target?.type || '-'
                        if (target?.type === 'Utilization') {
                          targetValue = `${target.averageUtilization}%`
                        } else if (target?.type === 'AverageValue') {
                          targetValue = target.averageValue || '-'
                        }

                        if (currentMetric?.resource) {
                          const current = currentMetric.resource.current
                          if (current?.averageUtilization !== undefined) {
                            currentValue = `${current.averageUtilization}%`
                          } else if (current?.averageValue) {
                            currentValue = current.averageValue
                          }
                        }
                      } else if (metric.type === 'Pods') {
                        metricName = metric.pods?.metric?.name || '-'
                        targetType = metric.pods?.target?.type || '-'
                        targetValue = metric.pods?.target?.averageValue || '-'
                        if (currentMetric?.pods?.current?.averageValue) {
                          currentValue = currentMetric.pods.current.averageValue
                        }
                      } else if (metric.type === 'Object') {
                        metricName = metric.object?.metric?.name || '-'
                        targetType = metric.object?.target?.type || '-'
                        targetValue = metric.object?.target?.value || metric.object?.target?.averageValue || '-'
                        if (currentMetric?.object?.current?.value) {
                          currentValue = currentMetric.object.current.value
                        } else if (currentMetric?.object?.current?.averageValue) {
                          currentValue = currentMetric.object.current.averageValue
                        }
                      }

                      return (
                        <TableRow key={index}>
                          <TableCell>{metric.type}</TableCell>
                          <TableCell>{metricName}</TableCell>
                          <TableCell>{targetType}</TableCell>
                          <TableCell>{targetValue}</TableCell>
                          <TableCell>
                            <Badge variant={currentValue !== '-' ? 'default' : 'secondary'}>
                              {currentValue}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No metrics configured</p>
              )}
            </CardContent>
          </Card>

          {/* Conditions Card */}
          {conditions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Last Transition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conditions.map((condition, index) => (
                      <TableRow key={index}>
                        <TableCell>{condition.type}</TableCell>
                        <TableCell>
                          <Badge variant={condition.status === 'True' ? 'success' : 'secondary'}>
                            {condition.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{condition.reason || '-'}</TableCell>
                        <TableCell className="max-w-md truncate">{condition.message || '-'}</TableCell>
                        <TableCell>{formatDate(condition.lastTransitionTime || '')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      value: 'labels',
      label: t('common.labelsAnnotations'),
      content: <LabelsAnno labels={hpa.metadata?.labels} annotations={hpa.metadata?.annotations} />,
    },
    {
      value: 'events',
      label: t('common.events'),
      content: (
        <EventTable
          namespace={namespace}
          uid={hpa.metadata?.uid}
          name={name}
          kind="HorizontalPodAutoscaler"
        />
      ),
    },
    {
      value: 'related',
      label: t('common.relatedResources'),
      content: (
        <RelatedResourcesTable
          resourceType="horizontalpodautoscalers"
          name={name}
          namespace={namespace}
        />
      ),
    },
    {
      value: 'yaml',
      label: t('common.yaml'),
      content: (
        <YamlEditor
          value={yamlContent}
          title={t('common.yamlConfiguration')}
          onSave={handleSaveYaml}
          onChange={handleYamlChange}
          isSaving={isSavingYaml}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{hpa.metadata?.name}</h1>
          <p className="text-muted-foreground mt-2">
            HorizontalPodAutoscaler in namespace {hpa.metadata?.namespace}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchHPA()}
          >
            <IconRefresh className="w-4 h-4" />
            {t('common.refresh')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isDeleting}
          >
            <IconTrash className="w-4 h-4" />
            {t('common.delete')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <ResponsiveTabs tabs={tabs} defaultValue="overview" />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        resourceType="HorizontalPodAutoscaler"
        resourceName={hpa.metadata?.name || ''}
        namespace={hpa.metadata?.namespace}
      />
    </div>
  )
}

// Add missing Label import
import { Label } from '@/components/ui/label'
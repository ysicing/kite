import { useEffect, useState } from 'react'
import { IconLoader, IconRefresh, IconTrash, IconRouter } from '@tabler/icons-react'
import * as yaml from 'js-yaml'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { deleteResource, updateResource, useResource, useResources } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { EventTable } from '@/components/event-table'
import { LabelsAnno } from '@/components/lables-anno'
import { ServiceTable } from '@/components/service-table'
import { YamlEditor } from '@/components/yaml-editor'
import { CustomResource } from '@/types/api'
import { Service } from 'kubernetes-types/core/v1'

interface ProxyClassSpec extends Record<string, unknown> {
  statefulSet?: {
    labels?: Record<string, string>
    annotations?: Record<string, string>
    pod?: {
      labels?: Record<string, string>
      annotations?: Record<string, string>
      nodeSelector?: Record<string, string>
      tolerations?: Array<{
        key?: string
        operator?: string
        value?: string
        effect?: string
      }>
      tailscaleContainer?: {
        image?: string
        imagePullPolicy?: string
        resources?: {
          requests?: Record<string, string>
          limits?: Record<string, string>
        }
        securityContext?: {
          runAsUser?: number
          runAsGroup?: number
          capabilities?: {
            add?: string[]
            drop?: string[]
          }
        }
      }
    }
  }
  metrics?: {
    enable?: boolean
    serviceMonitor?: {
      enable?: boolean
    }
  }
}

interface ProxyClassResource extends CustomResource {
  spec: ProxyClassSpec
}

export function ProxyClassDetail(props: { name: string }) {
  const { name } = props
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingYaml, setIsSavingYaml] = useState(false)
  const [yamlContent, setYamlContent] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const {
    data: proxyClass,
    isLoading,
    isError,
    error,
    refetch: handleRefresh,
  } = useResource('proxyclasses', name) as {
    data: ProxyClassResource | undefined
    isLoading: boolean
    isError: boolean
    error: any
    refetch: () => Promise<any>
  }

  // Fetch related services
  const {
    data: servicesData,
    isLoading: servicesLoading,
  } = useResources('services', undefined, {
    labelSelector: `tailscale.com/proxy-class=${name}`,
  })

  const services = servicesData as Service[] || []

  useEffect(() => {
    if (proxyClass) {
      setYamlContent(yaml.dump(proxyClass, { noRefs: true }))
    }
  }, [proxyClass])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('proxyclasses', name, undefined)
      toast.success(t('tailscale.proxyclasses.deleteSuccess'))
      navigate('/proxyclasses')
    } catch (error: any) {
      toast.error(`${t('tailscale.proxyclasses.deleteError')}: ${error.message}`)
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSaveYaml = async (parsedYaml: any) => {
    setIsSavingYaml(true)
    try {
      await updateResource('proxyclasses', name, undefined, parsedYaml as ProxyClassResource)
      toast.success(t('tailscale.proxyclasses.yamlSaveSuccess'))
      await handleRefresh()
    } catch (error: any) {
      toast.error(`${t('tailscale.proxyclasses.yamlSaveError')}: ${error.message}`)
    } finally {
      setIsSavingYaml(false)
    }
  }

  const handleYamlChange = (newContent: string) => {
    setYamlContent(newContent)
  }

  const handleManualRefresh = async () => {
    setRefreshKey((prev) => prev + 1)
    await handleRefresh()
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <IconLoader className="animate-spin" />
              <span>Loading ProxyClass details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError || !proxyClass) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Error loading ProxyClass: {error?.message || 'ProxyClass not found'}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasMetrics = proxyClass.spec.metrics?.enable === true
  const hasServiceMonitor = proxyClass.spec.metrics?.serviceMonitor?.enable === true
  const hasResourceLimits = !!(
    proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.resources?.limits ||
    proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.resources?.requests
  )
  const hasSecurityContext = !!proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.securityContext
  const hasNodeSelector = !!proxyClass.spec.statefulSet?.pod?.nodeSelector
  const customLabelsCount = 
    Object.keys(proxyClass.spec.statefulSet?.labels || {}).length +
    Object.keys(proxyClass.spec.statefulSet?.pod?.labels || {}).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconRouter className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">{name}</h1>
            <p className="text-muted-foreground">
              {t('tailscale.proxyclasses.title')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={isLoading}
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
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

      <ResponsiveTabs
        tabs={[
          {
            value: 'overview',
            label: t('common.overview'),
            content: (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>ProxyClass Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.created')}
                        </Label>
                        <p className="text-sm">
                          {formatDate(proxyClass.metadata?.creationTimestamp || '')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          UID
                        </Label>
                        <p className="text-sm">
                          {proxyClass.metadata?.uid || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('tailscale.proxyclasses.image')}
                        </Label>
                        <p className="text-sm font-mono">
                          {proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.image || 
                           t('tailscale.proxyclasses.defaultImage')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('tailscale.proxyclasses.customLabels')}
                        </Label>
                        <p className="text-sm">
                          {customLabelsCount || 0}
                        </p>
                      </div>
                    </div>
                    
                    <LabelsAnno
                      labels={proxyClass.metadata?.labels || {}}
                      annotations={proxyClass.metadata?.annotations || {}}
                    />
                  </CardContent>
                </Card>

                {/* Features Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('tailscale.proxyclasses.features')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {hasMetrics && (
                        <Badge variant="outline" className="text-xs">
                          {t('tailscale.proxyclasses.featuresTypes.metrics')}
                        </Badge>
                      )}
                      {hasServiceMonitor && (
                        <Badge variant="outline" className="text-xs">
                          ServiceMonitor
                        </Badge>
                      )}
                      {hasResourceLimits && (
                        <Badge variant="outline" className="text-xs">
                          {t('tailscale.proxyclasses.featuresTypes.resources')}
                        </Badge>
                      )}
                      {hasSecurityContext && (
                        <Badge variant="outline" className="text-xs">
                          {t('tailscale.proxyclasses.featuresTypes.security')}
                        </Badge>
                      )}
                      {hasNodeSelector && (
                        <Badge variant="outline" className="text-xs">
                          {t('tailscale.proxyclasses.featuresTypes.nodeSelector')}
                        </Badge>
                      )}
                      {!hasMetrics && !hasServiceMonitor && !hasResourceLimits && !hasSecurityContext && !hasNodeSelector && (
                        <span className="text-sm text-muted-foreground">
                          {t('common.none')}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Resource Configuration */}
                {hasResourceLimits && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('tailscale.proxyclasses.resources')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.resources?.requests && (
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              Requests
                            </Label>
                            <div className="text-sm space-y-1">
                              <p>CPU: {proxyClass.spec.statefulSet.pod.tailscaleContainer.resources.requests.cpu || '-'}</p>
                              <p>Memory: {proxyClass.spec.statefulSet.pod.tailscaleContainer.resources.requests.memory || '-'}</p>
                            </div>
                          </div>
                        )}
                        {proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.resources?.limits && (
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              Limits
                            </Label>
                            <div className="text-sm space-y-1">
                              <p>CPU: {proxyClass.spec.statefulSet.pod.tailscaleContainer.resources.limits.cpu || '-'}</p>
                              <p>Memory: {proxyClass.spec.statefulSet.pod.tailscaleContainer.resources.limits.memory || '-'}</p>
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
            value: 'services',
            label: t('common.services'),
            content: (
              <ServiceTable
                services={services}
                isLoading={servicesLoading}
              />
            ),
          },
          {
            value: 'yaml',
            label: 'YAML',
            content: (
              <div className="space-y-4">
                <YamlEditor
                  key={refreshKey}
                  value={yamlContent}
                  title="YAML Configuration"
                  onSave={handleSaveYaml}
                  onChange={handleYamlChange}
                  isSaving={isSavingYaml}
                />
              </div>
            ),
          },
          {
            value: 'events',
            label: t('common.events'),
            content: (
              <EventTable
                resource="proxyclasses"
                name={name}
              />
            ),
          },
        ]}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        resourceName={name}
        resourceType="proxyclasses"
        isDeleting={isDeleting}
      />
    </div>
  )
} 

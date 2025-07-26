import { useEffect, useState } from 'react'
import {
  IconLoader,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import * as yaml from 'js-yaml'
import { Service } from 'kubernetes-types/core/v1'
import { Endpoints } from 'kubernetes-types/core/v1'
import { EndpointSlice } from 'kubernetes-types/discovery/v1'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import {
  deleteResource,
  updateResource,
  useResource,
  useResources,
} from '@/lib/api'
import { getServiceExternalIP } from '@/lib/k8s'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { LabelsAnno } from '@/components/lables-anno'
import { PodTable } from '@/components/pod-table'
import { YamlEditor } from '@/components/yaml-editor'

export function ServiceDetail(props: { namespace: string; name: string }) {
  const { namespace, name } = props
  const [yamlContent, setYamlContent] = useState('')
  const [isSavingYaml, setIsSavingYaml] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<number>(0)
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Fetch service data
  const {
    data: service,
    isLoading: isLoadingService,
    isError: isServiceError,
    error: serviceError,
    refetch: refetchService,
  } = useResource('services', name, namespace, {
    refreshInterval,
  })

  // Fetch related pods using service selector
  const labelSelector = service?.spec?.selector
    ? Object.entries(service.spec.selector)
        .map(([key, value]) => `${key}=${value}`)
        .join(',')
    : undefined
  const { data: relatedPods, isLoading: isLoadingPods } = useResources(
    'pods',
    namespace,
    {
      labelSelector,
      refreshInterval,
      disable: !service?.spec?.selector,
    }
  )

  // Fetch endpoints
  const { data: endpoints, isLoading: isLoadingEndpoints } = useResource(
    'endpoints',
    name,
    namespace,
    {
      refreshInterval,
    }
  )

  // Fetch endpoint slices
  const { data: endpointSlices, isLoading: isLoadingEndpointSlices } = useResources(
    'endpointslices',
    namespace,
    {
      labelSelector: `kubernetes.io/service-name=${name}`,
      refreshInterval,
    }
  )

  useEffect(() => {
    if (service) {
      setYamlContent(yaml.dump(service, { indent: 2 }))
    }
  }, [service])

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
    refetchService()
  }

  const handleSaveYaml = async (content: Service) => {
    setIsSavingYaml(true)
    try {
      await updateResource('services', name, namespace, content)
      toast.success('YAML saved successfully')
      setRefreshInterval(1000)
    } catch (error) {
      console.error('Failed to save YAML:', error)
      toast.error(
        `Failed to save YAML: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    } finally {
      setIsSavingYaml(false)
    }
  }

  const handleYamlChange = (content: string) => {
    setYamlContent(content)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('services', name, namespace)
      toast.success('Service deleted successfully')
      navigate(`/services`)
    } catch (error) {
      toast.error(
        `Failed to delete service: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  if (isLoadingService) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <IconLoader className="animate-spin" />
              <span>Loading service details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isServiceError || !service) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Error loading service:{' '}
              {serviceError?.message || t('common.resourceNotFound', { resource: 'Service' })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const serviceType = service.spec?.type || 'ClusterIP'
  const clusterIP = service.spec?.clusterIP
  const externalIP = getServiceExternalIP(service)
  const ports = service.spec?.ports || []

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{name}</h1>
          <p className="text-muted-foreground">
            {t('services.namespace')}: <span className="font-medium">{namespace}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <IconRefresh className="w-4 h-4" />
            {t('services.refresh')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isDeleting}
          >
            <IconTrash className="w-4 h-4" />
            {t('services.delete')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <ResponsiveTabs
        tabs={[
          {
            value: 'overview',
            label: t('common.overview'),
            content: (
              <div className="space-y-4">
                {/* Service Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('services.overview')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('services.type')}</p>
                        <p className="text-sm font-medium">
                          <Badge variant="outline">{serviceType}</Badge>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('services.clusterIP')}</p>
                        <p className="text-sm font-medium">{clusterIP || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('services.externalIP')}</p>
                        <p className="text-sm font-medium">{externalIP || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('services.ports')}</p>
                        <p className="text-sm font-medium">
                          {ports.length === 0
                            ? '-'
                            : ports
                                .map((port) => {
                                  const protocol = port.protocol || 'TCP'
                                  if (port.nodePort) {
                                    return `${port.port}:${port.nodePort}/${protocol}`
                                  }
                                  return `${port.port}/${protocol}`
                                })
                                .join(', ')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Service Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('services.information')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('services.created')}
                        </Label>
                        <p className="text-sm">
                          {formatDate(
                            service.metadata?.creationTimestamp || '',
                            true
                          )}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('services.sessionAffinity')}
                        </Label>
                        <p className="text-sm">
                          {service.spec?.sessionAffinity || 'None'}
                        </p>
                      </div>
                      {service.spec?.selector && (
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground">
                            {t('services.selector')}
                          </Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(service.spec.selector).map(([key, value]) => (
                              <Badge
                                key={key}
                                variant="secondary"
                                className="text-xs"
                              >
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <LabelsAnno
                      labels={service.metadata?.labels || {}}
                      annotations={service.metadata?.annotations || {}}
                    />
                  </CardContent>
                </Card>

                {/* Port Details */}
                {ports.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('services.portConfiguration')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {ports.map((port, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-4 p-3 border rounded"
                          >
                            <div>
                              <p className="font-medium">{port.name || `Port ${index + 1}`}</p>
                              <p className="text-sm text-muted-foreground">
                                {port.protocol || 'TCP'}
                              </p>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                {t('services.port')}: <span className="font-medium">{port.port}</span>
                              </p>
                              {port.targetPort && (
                                <p className="text-sm">
                                  {t('services.targetPort')}: <span className="font-medium">{port.targetPort}</span>
                                </p>
                              )}
                              {port.nodePort && (
                                <p className="text-sm">
                                  {t('services.nodePort')}: <span className="font-medium">{port.nodePort}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
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
              <YamlEditor<'services'>
                key={refreshKey}
                value={yamlContent}
                title="YAML Configuration"
                onSave={handleSaveYaml}
                onChange={handleYamlChange}
                isSaving={isSavingYaml}
              />
            ),
          },
          ...(relatedPods
            ? [
                {
                  value: 'pods',
                  label: (
                    <>
                      {t('common.pods')}
                      {relatedPods && (
                        <Badge variant="secondary">{relatedPods.length}</Badge>
                      )}
                    </>
                  ),
                  content: (
                    <PodTable
                      pods={relatedPods}
                      isLoading={isLoadingPods}
                      labelSelector={labelSelector}
                    />
                  ),
                },
              ]
            : []),
          {
            value: 'endpoints',
            label: t('services.endpoints'),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{t('services.endpoints')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingEndpoints ? (
                    <div className="flex items-center justify-center gap-2 py-8">
                      <IconLoader className="animate-spin" />
                      <span>{t('services.loadingEndpoints')}</span>
                    </div>
                  ) : endpoints ? (
                    <div className="space-y-4">
                      {(endpoints as Endpoints).subsets?.length ? (
                        (endpoints as Endpoints).subsets!.map((subset: any, index: number) => (
                          <div key={index} className="border rounded p-4">
                            <h4 className="font-medium mb-2">{t('services.subset')} {index + 1}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium mb-2">{t('services.addresses')}</p>
                                {subset.addresses?.length ? (
                                  <div className="space-y-1">
                                    {subset.addresses.map((addr: any, i: number) => (
                                      <div key={i} className="text-sm">
                                        <span className="font-mono">{addr.ip}</span>
                                        {addr.hostname && (
                                          <span className="text-muted-foreground ml-2">
                                            ({addr.hostname})
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium mb-2">{t('services.ports')}</p>
                                {subset.ports?.length ? (
                                  <div className="space-y-1">
                                    {subset.ports.map((port: any, i: number) => (
                                      <div key={i} className="text-sm">
                                        <span className="font-mono">{port.port}</span>
                                        <span className="text-muted-foreground ml-2">
                                          {port.protocol || 'TCP'}
                                        </span>
                                        {port.name && (
                                          <span className="text-muted-foreground ml-2">
                                            ({port.name})
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                                )}
                              </div>
                            </div>
                            {subset.notReadyAddresses?.length && (
                              <div className="mt-4">
                                <p className="text-sm font-medium mb-2">{t('services.notReadyAddresses')}</p>
                                <div className="space-y-1">
                                  {subset.notReadyAddresses.map((addr: any, i: number) => (
                                    <div key={i} className="text-sm">
                                      <span className="font-mono text-muted-foreground">{addr.ip}</span>
                                      {addr.hostname && (
                                        <span className="text-muted-foreground ml-2">
                                          ({addr.hostname})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground">{t('services.noEndpoints')}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{t('services.noEndpoints')}</p>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            value: 'endpointslices',
            label: t('services.endpointSlices'),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{t('services.endpointSlices')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingEndpointSlices ? (
                    <div className="flex items-center justify-center gap-2 py-8">
                      <IconLoader className="animate-spin" />
                      <span>{t('services.loadingEndpointSlices')}</span>
                    </div>
                  ) : endpointSlices?.length ? (
                    <div className="space-y-4">
                      {endpointSlices.map((slice, index) => (
                        <div key={slice.metadata?.name || index} className="border rounded p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium">{slice.metadata?.name}</h4>
                            <Badge variant="outline">{(slice as EndpointSlice).addressType}</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium mb-2">{t('services.endpoints')}</p>
                              {(slice as EndpointSlice).endpoints?.length ? (
                                <div className="space-y-2">
                                  {(slice as EndpointSlice).endpoints!.map((endpoint: any, i: number) => (
                                    <div key={i} className="border rounded p-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        {endpoint.addresses?.map((addr: string, j: number) => (
                                          <span key={j} className="font-mono text-sm">
                                            {addr}
                                          </span>
                                        ))}
                                        <Badge
                                          variant={
                                            endpoint.conditions?.ready ? 'default' : 'secondary'
                                          }
                                          className="text-xs"
                                        >
                                          {endpoint.conditions?.ready ? t('services.ready') : t('services.notReady')}
                                        </Badge>
                                      </div>
                                      {endpoint.hostname && (
                                        <p className="text-xs text-muted-foreground">
                                          {t('services.hostname')}: {endpoint.hostname}
                                        </p>
                                      )}
                                      {endpoint.targetRef && (
                                        <p className="text-xs text-muted-foreground">
                                          {t('services.target')}: {endpoint.targetRef.kind}/{endpoint.targetRef.name}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium mb-2">{t('services.ports')}</p>
                              {(slice as EndpointSlice).ports?.length ? (
                                <div className="space-y-1">
                                  {(slice as EndpointSlice).ports!.map((port: any, i: number) => (
                                    <div key={i} className="text-sm">
                                      <span className="font-mono">{port.port}</span>
                                      <span className="text-muted-foreground ml-2">
                                        {port.protocol || 'TCP'}
                                      </span>
                                      {port.name && (
                                        <span className="text-muted-foreground ml-2">
                                          ({port.name})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">{t('common.noData', {resource: t('services.ports').toLowerCase()})}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{t('services.noEndpointSlices')}</p>
                  )}
                </CardContent>
              </Card>
            ),
          },
        ]}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        resourceName={name}
        resourceType="service"
        namespace={namespace}
        isDeleting={isDeleting}
      />
    </div>
  )
}
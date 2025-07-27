import { useEffect, useState } from 'react'
import { IconLoader, IconRefresh, IconTrash, IconRoute, IconCode, IconWorld, IconShield } from '@tabler/icons-react'
import * as yaml from 'js-yaml'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ResourceTypeMap } from '@/types/api'
import { deleteResource, updateResource, useResource } from '@/lib/api'
import { getOwnerInfo } from '@/lib/k8s'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { EventTable } from '@/components/event-table'
import { LabelsAnno } from '@/components/lables-anno'
import { RelatedResourcesTable } from '@/components/related-resource-table'
import { YamlEditor } from '@/components/yaml-editor'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type IngressRouteResource = ResourceTypeMap['ingressroutes']

interface IngressRouteSpec {
  entryPoints?: string[]
  routes: Array<{
    match: string
    kind?: string
    priority?: number
    services?: Array<{
      name: string
      namespace?: string
      port?: number | string
      scheme?: string
      strategy?: string
      weight?: number
      sticky?: {
        cookie?: {
          name?: string
          secure?: boolean
          httpOnly?: boolean
          sameSite?: string
        }
      }
      healthCheck?: {
        path?: string
        port?: number
        interval?: string
        timeout?: string
        followRedirects?: boolean
        scheme?: string
        method?: string
        headers?: Record<string, string>
      }
    }>
    middlewares?: Array<{
      name: string
      namespace?: string
    }>
  }>
  tls?: {
    secretName?: string
    domains?: Array<{
      main: string
      sans?: string[]
    }>
    options?: {
      name: string
      namespace?: string
    }
    certResolver?: string
    store?: {
      name: string
      namespace?: string
    }
  }
}

interface IngressRouteDetailProps {
  namespace: string
  name: string
}

export function IngressRouteDetail({ namespace, name }: IngressRouteDetailProps) {
  const { t } = useTranslation()
  const [yamlContent, setYamlContent] = useState('')
  const [isSavingYaml, setIsSavingYaml] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const navigate = useNavigate()

  const {
    data,
    isLoading,
    isError,
    error,
    refetch: handleRefresh,
  } = useResource('ingressroutes', name, namespace)

  useEffect(() => {
    if (data) {
      setYamlContent(yaml.dump(data, { indent: 2 }))
    }
  }, [data])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('ingressroutes', name, namespace)
      toast.success(t('common.resourceDeleted', { resource: 'ingressroute' }))
      navigate('/ingressroutes')
    } catch (error) {
      toast.error(
        `${t('common.deleteResourceError', { resource: 'ingressroute' })}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSaveYaml = async (content: ResourceTypeMap['ingressroutes']) => {
    setIsSavingYaml(true)
    try {
      await updateResource('ingressroutes', name, namespace, content)
      toast.success(t('common.yamlSaved'))
      await handleRefresh()
    } catch (error) {
      toast.error(
        `${t('common.saveYamlError')}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
    } finally {
      setIsSavingYaml(false)
    }
  }

  const handleYamlChange = (content: string) => {
    setYamlContent(content)
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
              <span>{t('common.loadingResourceDetails', { resource: 'ingressroute' })}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              {t('common.errorLoadingResource', { resource: 'ingressroute' })}:{' '}
              {error?.message || t('common.resourceNotFound', { resource: 'ingressroute' })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const ingressRoute = data as IngressRouteResource
  const spec = ingressRoute.spec as unknown as IngressRouteSpec

  // Count total middlewares
  const totalMiddlewares = spec.routes.reduce((count, route) => {
    return count + (route.middlewares?.length || 0)
  }, 0)

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconRoute className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-bold">{name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {namespace}
              </Badge>
              <Badge variant="secondary">
                {spec.routes.length} route{spec.routes.length > 1 ? 's' : ''}
              </Badge>
              {totalMiddlewares > 0 && (
                <Badge variant="secondary">
                  {totalMiddlewares} middleware{totalMiddlewares > 1 ? 's' : ''}
                </Badge>
              )}
              {spec.tls && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <IconShield className="w-3 h-3 mr-1" />
                  TLS
                </Badge>
              )}
            </div>
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
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('common.basicInfo')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.created')}
                        </Label>
                        <p className="text-sm">
                          {formatDate(ingressRoute.metadata?.creationTimestamp || '')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.uid')}
                        </Label>
                        <p className="text-sm font-mono">
                          {ingressRoute.metadata?.uid || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Entry Points
                        </Label>
                        <div className="flex flex-wrap gap-1">
                          {spec.entryPoints?.map((ep, index) => (
                            <Badge key={index} variant="outline" className="font-mono text-xs">
                              {ep}
                            </Badge>
                          )) || <span className="text-sm text-muted-foreground">None specified</span>}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          API Version
                        </Label>
                        <p className="text-sm">
                          {ingressRoute.apiVersion}
                        </p>
                      </div>
                      {getOwnerInfo(ingressRoute.metadata) && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t('common.owner')}
                          </Label>
                          <p className="text-sm">
                            {(() => {
                              const ownerInfo = getOwnerInfo(ingressRoute.metadata)
                              if (!ownerInfo) {
                                return t('common.noOwner')
                              }
                              return (
                                <Link
                                  to={ownerInfo.path}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {ownerInfo.kind}/{ownerInfo.name}
                                </Link>
                              )
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                    <Separator />
                    <LabelsAnno
                      labels={ingressRoute.metadata?.labels || {}}
                      annotations={ingressRoute.metadata?.annotations || {}}
                    />
                  </CardContent>
                </Card>

                {/* TLS Configuration */}
                {spec.tls && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconShield className="h-4 w-4" />
                        TLS Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {spec.tls.secretName && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Secret Name</Label>
                          <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{spec.tls.secretName}</p>
                        </div>
                      )}
                      {spec.tls.certResolver && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Certificate Resolver</Label>
                          <p className="text-sm">{spec.tls.certResolver}</p>
                        </div>
                      )}
                      {spec.tls.domains && spec.tls.domains.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Domains</Label>
                          <div className="space-y-2">
                            {spec.tls.domains.map((domain, index) => (
                              <div key={index} className="p-2 bg-muted rounded">
                                <p className="font-mono text-sm">{domain.main}</p>
                                {domain.sans && domain.sans.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {domain.sans.map((san, sanIndex) => (
                                      <Badge key={sanIndex} variant="outline" className="font-mono text-xs">
                                        {san}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Routes Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconWorld className="h-4 w-4" />
                      Routes Configuration ({spec.routes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {spec.routes.map((route, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">Match Rule</Label>
                            <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">{route.match}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {route.kind && (
                              <Badge variant="outline" className="text-xs">
                                {route.kind}
                              </Badge>
                            )}
                            {route.priority && (
                              <Badge variant="secondary" className="text-xs">
                                Priority: {route.priority}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Services */}
                        {route.services && route.services.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Services ({route.services.length})</Label>
                            <div className="grid gap-2 mt-1">
                              {route.services.map((service, serviceIndex) => (
                                <div key={serviceIndex} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm">{service.name}</span>
                                    {service.namespace && service.namespace !== namespace && (
                                      <Badge variant="outline" className="text-xs">
                                        {service.namespace}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {service.port && <span>Port: {service.port}</span>}
                                    {service.weight && <span>Weight: {service.weight}</span>}
                                    {service.scheme && <span>Scheme: {service.scheme}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Middlewares */}
                        {route.middlewares && route.middlewares.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              Applied Middlewares ({route.middlewares.length})
                            </Label>
                            <div className="grid gap-2 mt-1">
                              {route.middlewares.map((middleware, middlewareIndex) => (
                                <div key={middlewareIndex} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950 rounded">
                                  <div className="flex items-center gap-2">
                                    <IconCode className="w-4 h-4 text-blue-600" />
                                    <Link
                                      to={`/middlewares/${middleware.namespace || namespace}/${middleware.name}`}
                                      className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {middleware.name}
                                    </Link>
                                    {middleware.namespace && middleware.namespace !== namespace && (
                                      <Badge variant="outline" className="text-xs">
                                        {middleware.namespace}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Order: {middlewareIndex + 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            value: 'yaml',
            label: 'YAML',
            content: (
              <div className="space-y-4">
                <YamlEditor<'ingressroutes'>
                  key={refreshKey}
                  value={yamlContent}
                  title={t('common.yamlConfiguration')}
                  onSave={handleSaveYaml}
                  onChange={handleYamlChange}
                  isSaving={isSavingYaml}
                />
              </div>
            ),
          },
          {
            value: 'Related',
            label: t('common.related'),
            content: (
              <RelatedResourcesTable
                resource="ingressroutes"
                name={name}
                namespace={namespace}
              />
            ),
          },
          {
            value: 'events',
            label: t('common.events'),
            content: (
              <EventTable
                resource="ingressroutes"
                namespace={namespace}
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
        resourceType="ingressroutes"
        namespace={namespace}
        isDeleting={isDeleting}
      />
    </div>
  )
}

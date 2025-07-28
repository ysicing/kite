import { useEffect, useState } from 'react'
import { IconLoader, IconRefresh, IconTrash, IconNetwork, IconRoute, IconTag, IconCheck, IconX, IconAlertCircle, IconExternalLink } from '@tabler/icons-react'
import * as yaml from 'js-yaml'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { deleteResource, updateResource, useResource } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { EventTable } from '@/components/event-table'
import { LabelsAnno } from '@/components/lables-anno'
import { YamlEditor } from '@/components/yaml-editor'
import { CustomResource } from '@/types/api'

interface ConnectorSpec extends Record<string, unknown> {
  hostname?: string
  tags?: string[]
  proxyClass?: string
  subnetRouter?: {
    advertiseRoutes?: string[]
  }
  exitNode?: boolean
  appConnector?: {
    routes?: string[]
  }
}

interface ConnectorResource extends CustomResource {
  spec: ConnectorSpec
  status?: {
    conditions?: Array<{
      type: string
      status: string
      lastTransitionTime?: string
      reason?: string
      message?: string
    }>
    hostname?: string
    tailnetIPs?: string[]
    isExitNode?: boolean
  }
}

export function ConnectorDetail(props: { name: string }) {
  const { name } = props
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingYaml, setIsSavingYaml] = useState(false)
  const [yamlContent, setYamlContent] = useState('')
  const [refreshKey] = useState(0)

  const {
    data: connector,
    isLoading,
    isError,
    error,
    refetch: handleRefresh,
  } = useResource('connectors', name) as {
    data: ConnectorResource | undefined
    isLoading: boolean
    isError: boolean
    error: any
    refetch: () => Promise<any>
  }

  useEffect(() => {
    if (connector) {
      setYamlContent(yaml.dump(connector, { noRefs: true }))
    }
  }, [connector])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('connectors', name, undefined)
      toast.success(t('tailscale.connectors.deleteSuccess'))
      navigate('/connectors')
    } catch (error: any) {
      toast.error(`${t('tailscale.connectors.deleteError')}: ${error.message}`)
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSaveYaml = async (parsedYaml: any) => {
    setIsSavingYaml(true)
    try {
      await updateResource('connectors', name, undefined, parsedYaml as ConnectorResource)
      toast.success(t('common.yamlSaved'))
      await handleRefresh()
    } catch (error: any) {
      toast.error(`${t('common.yamlSaveErrorr')}: ${error.message}`)
    } finally {
      setIsSavingYaml(false)
    }
  }

  const handleYamlChange = (value: string) => {
    setYamlContent(value)
  }

  const getConnectorType = (connector: ConnectorResource): string => {
    const { spec } = connector
    const types = []
    
    if (spec.subnetRouter?.advertiseRoutes?.length) {
      types.push(t('tailscale.connectors.types.subnetRouter'))
    }
    if (spec.exitNode) {
      types.push(t('tailscale.connectors.types.exitNode'))
    }
    if (spec.appConnector) {
      types.push(t('tailscale.connectors.types.appConnector'))
    }
    
    return types.length > 0 ? types.join(', ') : t('tailscale.connectors.types.connector')
  }

  const getConnectorStatus = (connector: ConnectorResource): { status: string; variant: 'default' | 'destructive' | 'secondary'; icon: React.ReactNode } => {
    const condition = connector.status?.conditions?.find(c => c.type === 'ConnectorReady')
    
    if (!condition) {
      return { 
        status: t('common.unknown'), 
        variant: 'secondary', 
        icon: <IconAlertCircle className="h-3 w-3" /> 
      }
    }
    
    if (condition.status === 'True') {
      return { 
        status: t('common.ready'), 
        variant: 'default', 
        icon: <IconCheck className="h-3 w-3" /> 
      }
    }
    
    return { 
      status: t('common.notReady'), 
      variant: 'destructive', 
      icon: <IconX className="h-3 w-3" /> 
    }
  }



  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <IconLoader className="h-6 w-6 animate-spin mr-2" />
        <span>{t('common.loading')}</span>
      </div>
    )
  }

  if (isError || !connector) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">
          {t('common.failedToLoad')}: {error?.message || t('tailscale.connectors.notFound')}
        </p>
      </div>
    )
  }

  const statusInfo = getConnectorStatus(connector)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconNetwork className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{connector.metadata?.name}</h1>
          <Badge variant={statusInfo.variant} className="flex items-center gap-1">
            {statusInfo.icon}
            {statusInfo.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <IconRefresh className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <IconTrash className="h-4 w-4 mr-2" />
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
                {/* 基本信息 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconNetwork className="h-5 w-5" />
                      {t('common.basicInfo')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.name')}
                        </Label>
                        <p className="text-sm font-medium">{connector.metadata?.name}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.type')}
                        </Label>
                        <p className="text-sm">{getConnectorType(connector)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('tailscale.connectors.hostname')}
                        </Label>
                        <p className="text-sm font-mono">
                          {connector.spec.hostname || connector.status?.hostname || '-'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('tailscale.connectors.proxyClass')}
                        </Label>
                        <div className="text-sm">
                          {connector.spec.proxyClass ? (
                            <Link 
                              to={`/proxyclasses/${connector.spec.proxyClass}`}
                              className="text-blue-600 hover:underline"
                            >
                              {connector.spec.proxyClass}
                            </Link>
                          ) : '-'}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.created')}
                        </Label>
                        <p className="text-sm">
                          {formatDate(connector.metadata?.creationTimestamp || '')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.uid')}
                        </Label>
                        <p className="text-sm font-mono text-muted-foreground">
                          {connector.metadata?.uid || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 网络配置 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconRoute className="h-5 w-5" />
                      {t('tailscale.connectors.networkConfig')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 子网路由 */}
                    {connector.spec.subnetRouter?.advertiseRoutes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('tailscale.connectors.advertiseRoutes')}
                        </Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {connector.spec.subnetRouter.advertiseRoutes.map((route, index) => (
                            <Badge key={index} variant="outline" className="font-mono text-xs">
                              <IconRoute className="h-3 w-3 mr-1" />
                              {route}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 应用连接器路由 */}
                    {connector.spec.appConnector?.routes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('tailscale.connectors.appRoutes')}
                        </Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {connector.spec.appConnector.routes.map((route, index) => (
                            <Badge key={index} variant="outline" className="font-mono text-xs">
                              <IconExternalLink className="h-3 w-3 mr-1" />
                              {route}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 出口节点 */}
                    {connector.spec.exitNode && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('tailscale.connectors.exitNode')}
                        </Label>
                        <div className="mt-1">
                          <Badge variant="secondary">
                            <IconCheck className="h-3 w-3 mr-1" />
                            {t('common.enabled')}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Tailnet IPs */}
                    {connector.status?.tailnetIPs && connector.status.tailnetIPs.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Tailnet IPs
                        </Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {connector.status.tailnetIPs.map((ip, index) => (
                            <Badge key={index} variant="outline" className="font-mono text-xs">
                              {ip}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 标签 */}
                {connector.spec.tags && connector.spec.tags.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconTag className="h-5 w-5" />
                        {t('tailscale.connectors.tags')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {connector.spec.tags.map((tag, index) => (
                          <Badge key={index} variant="outline">
                            <IconTag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 状态详情 */}
                {connector.status?.conditions && connector.status.conditions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('common.conditions')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {connector.status.conditions.map((condition, index) => (
                          <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {condition.status === 'True' ? (
                                  <IconCheck className="h-4 w-4 text-green-600" />
                                ) : (
                                  <IconX className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{condition.type}</div>
                                {condition.message && (
                                  <div className="text-sm text-muted-foreground">{condition.message}</div>
                                )}
                                {condition.reason && (
                                  <div className="text-xs text-muted-foreground">
                                    Reason: {condition.reason}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {condition.lastTransitionTime && formatDate(condition.lastTransitionTime)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 标签和注解 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('common.labelsAndAnnotations')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LabelsAnno
                      labels={connector.metadata?.labels || {}}
                      annotations={connector.metadata?.annotations || {}}
                    />
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
                <YamlEditor
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
            value: 'events',
            label: t('common.events'),
            content: (
              <EventTable
                resource="connectors"
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
        resourceType="connectors"
        isDeleting={isDeleting}
      />
    </div>
  )
} 

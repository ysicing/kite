import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQuery } from '@tanstack/react-query'
import { fetchResources, useTailscaleStatus } from '@/lib/api'
import { CustomResource } from '@/types/api'
import { useLastActiveTab } from '@/hooks/use-last-active-tab'
import { 
  IconNetwork, 
  IconRouter,
  IconArrowRight,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconInfoCircle,
  IconDownload,
  IconExternalLink,
  IconTag
} from '@tabler/icons-react'

interface ConnectorResource extends CustomResource {
  spec: {
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
  status?: {
    conditions?: Array<{
      type: string
      status: string
      lastTransitionTime: string
      reason?: string
      message?: string
    }>
    subnetRoutes?: string
    isExitNode?: boolean
    tailnetIPs?: string[]
    hostname?: string
  }
}

interface ProxyClassResource extends CustomResource {
  spec: {
    statefulSet?: {
      labels?: Record<string, string>
      annotations?: Record<string, string>
      pod?: {
        labels?: Record<string, string>
        annotations?: Record<string, string>
        tailscaleContainer?: {
          image?: string
          imagePullPolicy?: string
          resources?: {
            requests?: Record<string, string>
            limits?: Record<string, string>
          }
        }
      }
    }
    metrics?: {
      enable?: boolean
    }
  }
}

const TailscaleOverview: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { updateActiveTab } = useLastActiveTab()

  const { data: status, isLoading: statusLoading, error: statusError } = useTailscaleStatus()

  const { data: connectorsData, isLoading: connectorsLoading, error: connectorsError } = useQuery({
    queryKey: ['resources', 'connectors'],
    queryFn: () => fetchResources('connectors'),
    enabled: status?.installed,
  })

  const { data: proxyClassesData, isLoading: proxyClassesLoading, error: proxyClassesError } = useQuery({
    queryKey: ['resources', 'proxyclasses'],
    queryFn: () => fetchResources('proxyclasses'),
    enabled: status?.installed,
  })

  const connectors = (connectorsData as any)?.items as ConnectorResource[] || []
  const proxyClasses = (proxyClassesData as any)?.items as ProxyClassResource[] || []

  const isLoading = statusLoading || connectorsLoading || proxyClassesLoading
  const hasError = statusError || connectorsError || proxyClassesError

  const getConnectorType = (connector: ConnectorResource): string => {
    const { spec } = connector
    const types = []
    
    if (spec.subnetRouter?.advertiseRoutes?.length) {
      types.push('Subnet Router')
    }
    if (spec.exitNode) {
      types.push('Exit Node')
    }
    if (spec.appConnector) {
      types.push('App Connector')
    }
    
    return types.length > 0 ? types.join(', ') : 'Connector'
  }

  const getConnectorStatus = (connector: ConnectorResource): 'ready' | 'notReady' | 'unknown' => {
    const condition = connector.status?.conditions?.find(c => c.type === 'ConnectorReady')
    
    if (!condition) return 'unknown'
    return condition.status === 'True' ? 'ready' : 'notReady'
  }

  const connectorStats = {
    total: connectors.length,
    ready: connectors.filter(c => getConnectorStatus(c) === 'ready').length,
    subnetRouters: connectors.filter(c => c.spec.subnetRouter?.advertiseRoutes?.length).length,
    exitNodes: connectors.filter(c => c.spec.exitNode).length,
    appConnectors: connectors.filter(c => c.spec.appConnector).length,
  }

  const proxyClassStats = {
    total: proxyClasses.length,
    withMetrics: proxyClasses.filter(pc => pc.spec.metrics?.enable).length,
    withResources: proxyClasses.filter(pc => {
      const resources = pc.spec.statefulSet?.pod?.tailscaleContainer?.resources
      return !!(resources?.limits || resources?.requests)
    }).length,
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <IconNetwork className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.tailscale')} {t('common.overview')}</h2>
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <IconNetwork className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.tailscale')} {t('common.overview')}</h2>
        </div>
        <Alert>
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('common.error')}: {statusError?.message || connectorsError?.message || proxyClassesError?.message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!status?.installed) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <IconNetwork className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.tailscale')} {t('common.overview')}</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconInfoCircle className="h-5 w-5 text-blue-500" />
              {t('tailscale.notInstalled')}
            </CardTitle>
            <CardDescription>
              {t('tailscale.notInstalledDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('tailscale.installInstructions')}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild>
                <a
                  href="https://tailscale.com/kb/1236/kubernetes-operator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <IconDownload className="h-4 w-4" />
                  {t('tailscale.installGuide')}
                  <IconExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="https://tailscale.com/learn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  {t('tailscale.learnMore')}
                  <IconExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Tailscale is installed, show comprehensive overview

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconNetwork className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.tailscale')} {t('common.overview')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            ✓ Installed
          </Badge>
          {status.version && (
            <Badge variant="outline" className="flex items-center gap-1">
              <IconTag className="h-3 w-3" />
              {t('tailscale.version')}: {status.version}
            </Badge>
          )}
        </div>
      </div>



      {/* Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connector Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconNetwork className="h-5 w-5" />
              {t('tailscale.connectors.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-2xl font-bold">{connectorStats.total}</div>
                <div className="text-sm text-muted-foreground">
                  总数
                </div>
              </div>
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-blue-600">{connectorStats.subnetRouters}</div>
                <div className="text-sm text-muted-foreground">
                  子网路由器
                </div>
              </div>
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-purple-600">{connectorStats.exitNodes}</div>
                <div className="text-sm text-muted-foreground">
                  出口节点
                </div>
              </div>
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-orange-600">{connectorStats.appConnectors}</div>
                <div className="text-sm text-muted-foreground">
                  应用连接器
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proxy Class Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconRouter className="h-5 w-5" />
              {t('tailscale.proxyclasses.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-2xl font-bold">{proxyClassStats.total}</div>
                <div className="text-sm text-muted-foreground">
                  总数
                </div>
              </div>
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-gray-600">0</div>
                <div className="text-sm text-muted-foreground">
                  启用指标
                </div>
              </div>
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-gray-600">0</div>
                <div className="text-sm text-muted-foreground">
                  配置资源
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <IconNetwork className="h-5 w-5" />
                {t('tailscale.connectors.title')}
              </span>
              <Button variant="ghost" size="sm" onClick={() => {
                updateActiveTab('tailscale')
                navigate('/connectors')
              }}>
                {t('common.viewAll')}
                <IconArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connectors.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {t('tailscale.connectors.empty')}
              </p>
            ) : (
              <div className="space-y-3">
                {connectors.slice(0, 5).map((connector) => {
                  const status = getConnectorStatus(connector)
                  const statusConfig = {
                    ready: { icon: <IconCheck className="h-3 w-3" />, variant: 'default' as const, text: 'Ready' },
                    notReady: { icon: <IconX className="h-3 w-3" />, variant: 'destructive' as const, text: 'Not Ready' },
                    unknown: { icon: <IconAlertCircle className="h-3 w-3" />, variant: 'outline' as const, text: 'Unknown' }
                  }
                  
                  return (
                    <div key={connector.metadata.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <IconNetwork className="h-4 w-4 text-blue-600" />
                        <div>
                          <Button
                            variant="link"
                            className="h-auto p-0 font-medium text-left justify-start"
                            onClick={() => {
                              updateActiveTab('tailscale')
                              navigate(`/connectors/${connector.metadata.name}`)
                            }}
                          >
                            {connector.metadata.name}
                          </Button>
                          <p className="text-sm text-muted-foreground">{getConnectorType(connector)}</p>
                        </div>
                      </div>
                      <Badge variant={statusConfig[status].variant} className="flex items-center gap-1">
                        {statusConfig[status].icon}
                        {statusConfig[status].text}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <IconRouter className="h-5 w-5" />
                {t('tailscale.proxyclasses.title')}
              </span>
              <Button variant="ghost" size="sm" onClick={() => {
                updateActiveTab('tailscale')
                navigate('/proxyclasses')
              }}>
                {t('common.viewAll')}
                <IconArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proxyClasses.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {t('tailscale.proxyclasses.empty')}
              </p>
            ) : (
              <div className="space-y-3">
                {proxyClasses.slice(0, 5).map((proxyClass) => {
                  const hasMetrics = proxyClass.spec.metrics?.enable
                  const hasResources = !!(proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.resources?.limits || 
                                         proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.resources?.requests)
                  
                  return (
                    <div key={proxyClass.metadata.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <IconRouter className="h-4 w-4 text-blue-600" />
                        <div>
                          <Button
                            variant="link"
                            className="h-auto p-0 font-medium text-left justify-start"
                            onClick={() => {
                              updateActiveTab('tailscale')
                              navigate(`/proxyclasses/${proxyClass.metadata.name}`)
                            }}
                          >
                            {proxyClass.metadata.name}
                          </Button>
                          <div className="flex gap-1 mt-1">
                            {hasMetrics && (
                              <Badge variant="outline" className="text-xs">
                                Metrics
                              </Badge>
                            )}
                            {hasResources && (
                              <Badge variant="outline" className="text-xs">
                                Resources
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.image || 'Default'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <a
            href="https://tailscale.com/learn/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            {t('tailscale.learnMore')}
            <IconExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}

export default TailscaleOverview

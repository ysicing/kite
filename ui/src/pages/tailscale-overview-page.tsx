import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQuery } from '@tanstack/react-query'
import { fetchResources } from '@/lib/api'
import { CustomResource } from '@/types/api'
import { 
  IconNetwork, 
  IconRouter,
  IconArrowRight,
  IconCheck,
  IconX,
  IconAlertCircle
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
        nodeSelector?: Record<string, string>
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
}

const TailscaleOverviewPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: connectorsData, isLoading: connectorsLoading, error: connectorsError } = useQuery({
    queryKey: ['resources', 'connectors'],
    queryFn: () => fetchResources('connectors'),
  })

  const { data: proxyClassesData, isLoading: proxyClassesLoading, error: proxyClassesError } = useQuery({
    queryKey: ['resources', 'proxyclasses'],
    queryFn: () => fetchResources('proxyclasses'),
  })

  const connectors = (connectorsData as any)?.items as ConnectorResource[] || []
  const proxyClasses = (proxyClassesData as any)?.items as ProxyClassResource[] || []

  const isLoading = connectorsLoading || proxyClassesLoading
  const hasError = connectorsError || proxyClassesError

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
    
    return types.length > 0 ? types.join(', ') : 'Unknown'
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
    withSecurity: proxyClasses.filter(pc => 
      !!pc.spec.statefulSet?.pod?.tailscaleContainer?.securityContext
    ).length,
  }

  const recentConnectors = connectors.slice(0, 5)
  const recentProxyClasses = proxyClasses.slice(0, 5)

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <IconNetwork className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('tailscale.title')}</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <IconNetwork className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('tailscale.title')}</h1>
        </div>
        
        <Alert>
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('common.error')}: {connectorsError?.message || proxyClassesError?.message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <IconNetwork className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('tailscale.title')}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/connectors')}>
            <IconNetwork className="h-4 w-4 mr-2" />
            {t('tailscale.connectors.title')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/proxyclasses')}>
            <IconRouter className="h-4 w-4 mr-2" />
            {t('tailscale.proxyclasses.title')}
          </Button>
        </div>
      </div>

      {/* Connector Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <IconNetwork className="h-5 w-5" />
          {t('tailscale.connectors.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('tailscale.connectors.stats.total')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{connectorStats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('tailscale.connectors.stats.ready')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{connectorStats.ready}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('tailscale.connectors.stats.subnetRouters')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{connectorStats.subnetRouters}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('tailscale.connectors.stats.exitNodes')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{connectorStats.exitNodes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('tailscale.connectors.stats.appConnectors')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{connectorStats.appConnectors}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Proxy Class Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <IconRouter className="h-5 w-5" />
          {t('tailscale.proxyclasses.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('tailscale.proxyclasses.stats.total')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{proxyClassStats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('tailscale.proxyclasses.stats.withMetrics')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{proxyClassStats.withMetrics}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('tailscale.proxyclasses.stats.withResources')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{proxyClassStats.withResources}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t('tailscale.proxyclasses.stats.withSecurity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{proxyClassStats.withSecurity}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Connectors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <IconNetwork className="h-5 w-5" />
                {t('tailscale.connectors.title')}
              </span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/connectors')}>
                {t('common.viewAll')}
                <IconArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentConnectors.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {t('tailscale.connectors.empty')}
              </p>
            ) : (
              <div className="space-y-3">
                {recentConnectors.map((connector) => {
                  const status = getConnectorStatus(connector)
                  const statusConfig = {
                    ready: { icon: <IconCheck className="h-3 w-3" />, variant: 'default' as const, text: 'Ready' },
                    notReady: { icon: <IconX className="h-3 w-3" />, variant: 'destructive' as const, text: 'Not Ready' },
                    unknown: { icon: <IconAlertCircle className="h-3 w-3" />, variant: 'outline' as const, text: 'Unknown' }
                  }
                  
                  return (
                    <div key={connector.metadata.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <IconNetwork className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="font-medium">{connector.metadata.name}</p>
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

        {/* Recent Proxy Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <IconRouter className="h-5 w-5" />
                {t('tailscale.proxyclasses.title')}
              </span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/proxyclasses')}>
                {t('common.viewAll')}
                <IconArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentProxyClasses.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {t('tailscale.proxyclasses.empty')}
              </p>
            ) : (
              <div className="space-y-3">
                {recentProxyClasses.map((proxyClass) => {
                  const hasMetrics = proxyClass.spec.metrics?.enable
                  const hasResources = !!(proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.resources?.limits || 
                                         proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.resources?.requests)
                  
                  return (
                    <div key={proxyClass.metadata.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <IconRouter className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="font-medium">{proxyClass.metadata.name}</p>
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
    </div>
  )
}

export default TailscaleOverviewPage 

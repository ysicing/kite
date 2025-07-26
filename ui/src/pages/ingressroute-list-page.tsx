import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IconRoute, IconCode, IconShield, IconClock } from '@tabler/icons-react'

import { ResourceTypeMap } from '@/types/api'
import { formatDate } from '@/lib/utils'
import { ResourceTable } from '@/components/resource-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
    certResolver?: string
  }
}

function getIngressRouteInfo(spec: IngressRouteSpec) {
  const routesCount = spec.routes.length
  const middlewaresCount = spec.routes.reduce((count, route) => {
    return count + (route.middlewares?.length || 0)
  }, 0)
  const servicesCount = spec.routes.reduce((count, route) => {
    return count + (route.services?.length || 0)
  }, 0)
  const hasTLS = Boolean(spec.tls)
  const entryPoints = spec.entryPoints || []
  
  // Extract domains from TLS config
  const domains = spec.tls?.domains?.map(d => d.main) || []
  
  return {
    routesCount,
    middlewaresCount,
    servicesCount,
    hasTLS,
    entryPoints,
    domains
  }
}

export function IngressRouteListPage() {
  const { t } = useTranslation()
  
  const columnHelper = createColumnHelper<IngressRouteResource>()

  const columns = useMemo(
    () => [
      columnHelper.accessor((row: IngressRouteResource) => row.metadata?.name, {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium">
            <Link
              to={`/ingressroutes/${row.original.metadata!.namespace}/${row.original.metadata!.name}`}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
            >
              <IconRoute className="w-4 h-4" />
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor((row: IngressRouteResource) => row.metadata?.namespace, {
        header: t('common.namespace'),
        cell: ({ getValue }) => (
          <Badge variant="outline" className="font-mono text-xs">
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor((row: IngressRouteResource) => getIngressRouteInfo(row.spec as unknown as IngressRouteSpec), {
        header: 'Configuration',
        cell: ({ getValue }) => {
          const info = getValue()
          return (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs">
                      {info.routesCount} route{info.routesCount > 1 ? 's' : ''}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{info.routesCount} routing rule{info.routesCount > 1 ? 's' : ''}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {info.middlewaresCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs">
                        <IconCode className="w-3 h-3 mr-1" />
                        {info.middlewaresCount}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{info.middlewaresCount} middleware{info.middlewaresCount > 1 ? 's' : ''} applied</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {info.servicesCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs">
                        {info.servicesCount} svc
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{info.servicesCount} backend service{info.servicesCount > 1 ? 's' : ''}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {info.hasTLS && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                        <IconShield className="w-3 h-3 mr-1" />
                        TLS
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>TLS encryption enabled</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )
        },
      }),
      columnHelper.accessor((row: IngressRouteResource) => getIngressRouteInfo(row.spec as unknown as IngressRouteSpec).entryPoints, {
        header: t('traefik.ingressroutes.entryPoints'),
        cell: ({ getValue }) => {
          const entryPoints = getValue()
          if (entryPoints.length === 0) {
            return <span className="text-xs text-muted-foreground">Default</span>
          }
          return (
            <div className="flex flex-wrap gap-1">
              {entryPoints.slice(0, 2).map((ep, index) => (
                <Badge key={index} variant="outline" className="font-mono text-xs">
                  {ep}
                </Badge>
              ))}
              {entryPoints.length > 2 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs cursor-help">
                        +{entryPoints.length - 2}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        {entryPoints.slice(2).map((ep, index) => (
                          <p key={index} className="font-mono text-xs">{ep}</p>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )
        },
      }),
      columnHelper.accessor((row: IngressRouteResource) => row.metadata?.creationTimestamp, {
        header: t('common.created'),
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1">
            <IconClock className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {formatDate(getValue() || '')}
            </span>
          </div>
        ),
      }),
    ],
    [columnHelper, t]
  )

  const filter = useCallback((resource: IngressRouteResource, query: string) => {
    const name = resource.metadata!.name!.toLowerCase()
    const namespace = resource.metadata!.namespace?.toLowerCase() || ''
    const spec = resource.spec as unknown as IngressRouteSpec
    const info = getIngressRouteInfo(spec)
    
    // Search in domains, entry points, and match rules
    const domains = info.domains.join(' ').toLowerCase()
    const entryPoints = info.entryPoints.join(' ').toLowerCase()
    const matchRules = spec.routes.map(r => r.match).join(' ').toLowerCase()
    
    const searchQuery = query.toLowerCase()
    
    return (
      name.includes(searchQuery) ||
      namespace.includes(searchQuery) ||
      domains.includes(searchQuery) ||
      entryPoints.includes(searchQuery) ||
      matchRules.includes(searchQuery)
    )
  }, [])

  return (
    <div className="space-y-6">

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconRoute className="h-5 w-5" />
            {t('traefik.ingressroutes.title')}
          </CardTitle>
          <CardDescription>
            {t('traefik.ingressroutes.detailedDescription')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Resource Table */}
      <ResourceTable
        resourceName="ingressroutes"
        columns={columns}
        clusterScope={false}
        searchQueryFilter={filter}
      />
    </div>
  )
}

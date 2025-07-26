import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IconCode, IconClock } from '@tabler/icons-react'

import { ResourceTypeMap } from '@/types/api'
import { formatDate } from '@/lib/utils'
import { ResourceTable } from '@/components/resource-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type MiddlewareResource = ResourceTypeMap['middlewares']

interface MiddlewareSpec {
  addPrefix?: { prefix: string }
  stripPrefix?: { prefixes: string[]; forceSlash?: boolean }
  replacePath?: { path: string }
  replacePathRegex?: { regex: string; replacement: string }
  chain?: { middlewares: Array<{ name: string; namespace?: string }> }
  ipWhiteList?: { sourceRange: string[]; ipStrategy?: object }
  ipAllowList?: { sourceRange: string[]; ipStrategy?: object }
  headers?: {
    customRequestHeaders?: Record<string, string>
    customResponseHeaders?: Record<string, string>
    accessControlAllowCredentials?: boolean
    accessControlAllowHeaders?: string[]
    accessControlAllowMethods?: string[]
    accessControlAllowOriginList?: string[]
    accessControlExposeHeaders?: string[]
    accessControlMaxAge?: number
    addVaryHeader?: boolean
    allowedHosts?: string[]
    hostsProxyHeaders?: string[]
    referrerPolicy?: string
    featurePolicy?: string
    customFrameOptionsValue?: string
    contentTypeNosniff?: boolean
    browserXSSFilter?: boolean
    forceSTSHeader?: boolean
    stsIncludeSubdomains?: boolean
    stsPreload?: boolean
    stsSeconds?: number
    isDevelopment?: boolean
  }
  basicAuth?: { users?: string[]; usersFile?: string; realm?: string; removeHeader?: boolean; headerField?: string }
  digestAuth?: { users?: string[]; usersFile?: string; realm?: string; removeHeader?: boolean; headerField?: string }
  forwardAuth?: {
    address: string
    trustForwardHeader?: boolean
    authResponseHeaders?: string[]
    authRequestHeaders?: string[]
    authResponseHeadersRegex?: string
    tls?: object
  }
  inFlightReq?: { amount: number; sourceCriterion?: object }
  rateLimit?: { average?: number; period?: string; burst?: number; sourceCriterion?: object }
  redirectRegex?: { regex: string; replacement: string; permanent?: boolean }
  redirectScheme?: { scheme: string; port?: string; permanent?: boolean }
  retry?: { attempts: number; initialInterval?: string }
  buffering?: {
    maxRequestBodyBytes?: number
    memRequestBodyBytes?: number
    maxResponseBodyBytes?: number
    memResponseBodyBytes?: number
    retryExpression?: string
  }
  circuitBreaker?: { expression: string }
  compress?: { excludedContentTypes?: string[]; minResponseBodyBytes?: number }
  contentType?: { autoDetect?: boolean }
  errorPages?: { status: string[]; service: string; query?: string }
  grpcWeb?: object
  passTLSClientCert?: {
    pem?: boolean
    info?: {
      notAfter?: boolean
      notBefore?: boolean
      sans?: boolean
      subject?: object
      issuer?: object
      serialNumber?: boolean
    }
  }
  plugin?: Record<string, unknown>
}

function getMiddlewareType(spec: MiddlewareSpec): string {
  if (spec.addPrefix) return 'Add Prefix'
  if (spec.stripPrefix) return 'Strip Prefix'
  if (spec.replacePath) return 'Replace Path'
  if (spec.replacePathRegex) return 'Replace Path Regex'
  if (spec.chain) return 'Chain'
  if (spec.ipAllowList) return 'IP Allow List'
  if (spec.ipWhiteList) return 'IP Whitelist (Deprecated)'
  if (spec.headers) return 'Headers'
  if (spec.basicAuth) return 'Basic Auth'
  if (spec.digestAuth) return 'Digest Auth'
  if (spec.forwardAuth) return 'Forward Auth'
  if (spec.inFlightReq) return 'In Flight Requests'
  if (spec.rateLimit) return 'Rate Limit'
  if (spec.redirectRegex) return 'Redirect Regex'
  if (spec.redirectScheme) return 'Redirect Scheme'
  if (spec.retry) return 'Retry'
  if (spec.buffering) return 'Buffering'
  if (spec.circuitBreaker) return 'Circuit Breaker'
  if (spec.compress) return 'Compress'
  if (spec.contentType) return 'Content Type'
  if (spec.errorPages) return 'Error Pages'
  if (spec.grpcWeb) return 'gRPC Web'
  if (spec.passTLSClientCert) return 'Pass TLS Client Cert'
  if (spec.plugin) return 'Plugin'
  return 'Unknown'
}

function getMiddlewareTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'Add Prefix': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'Strip Prefix': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'Replace Path': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'Replace Path Regex': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'Chain': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    'IP Allow List': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'IP Whitelist (Deprecated)': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 line-through opacity-75',
    'Headers': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    'Basic Auth': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'Digest Auth': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'Forward Auth': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'In Flight Requests': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'Rate Limit': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'Redirect Regex': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    'Redirect Scheme': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    'Retry': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    'Buffering': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    'Circuit Breaker': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'Compress': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    'Content Type': 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
    'Error Pages': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'gRPC Web': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'Pass TLS Client Cert': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'Plugin': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    'Unknown': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
  return colors[type] || colors['Unknown']
}

function getMiddlewareDescription(spec: MiddlewareSpec): string {
  if (spec.addPrefix) return `Adds prefix: ${spec.addPrefix.prefix}`
  if (spec.stripPrefix) return `Strips prefixes: ${spec.stripPrefix.prefixes.join(', ')}`
  if (spec.replacePath) return `Replaces with: ${spec.replacePath.path}`
  if (spec.replacePathRegex) return `Regex: ${spec.replacePathRegex.regex} -> ${spec.replacePathRegex.replacement}`
  if (spec.chain) return `Chains ${spec.chain.middlewares.length} middleware(s)`
  if (spec.ipWhiteList) return `Allows ${spec.ipWhiteList.sourceRange.length} IP range(s)`
  if (spec.headers) return 'Modifies HTTP headers'
  if (spec.basicAuth) return 'Basic authentication'
  if (spec.digestAuth) return 'Digest authentication'
  if (spec.forwardAuth) return `Forward auth to: ${spec.forwardAuth.address}`
  if (spec.inFlightReq) return `Max concurrent requests: ${spec.inFlightReq.amount}`
  if (spec.rateLimit) return `Rate limit: ${spec.rateLimit.average || 'N/A'} req/sec`
  if (spec.redirectRegex) return `Redirect regex: ${spec.redirectRegex.regex}`
  if (spec.redirectScheme) return `Redirect to scheme: ${spec.redirectScheme.scheme}`
  if (spec.retry) return `Retry attempts: ${spec.retry.attempts}`
  if (spec.buffering) return 'Request/response buffering'
  if (spec.circuitBreaker) return `Circuit breaker: ${spec.circuitBreaker.expression}`
  if (spec.compress) return 'Response compression'
  if (spec.contentType) return 'Content-Type auto-detection'
  if (spec.errorPages) return `Custom error pages for: ${spec.errorPages.status.join(', ')}`
  if (spec.grpcWeb) return 'gRPC-Web support'
  if (spec.passTLSClientCert) return 'Pass TLS client certificate'
  if (spec.plugin) return `Plugin: ${Object.keys(spec.plugin)[0] || 'Unknown'}`
  return 'No description available'
}

export function MiddlewareListPage() {
  const { t } = useTranslation()
  
  const columnHelper = createColumnHelper<MiddlewareResource>()

  const columns = useMemo(
    () => [
      columnHelper.accessor((row: MiddlewareResource) => row.metadata?.name, {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium">
            <Link
              to={`/middlewares/${row.original.metadata!.namespace}/${row.original.metadata!.name}`}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
            >
              <IconCode className="w-4 h-4" />
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor((row: MiddlewareResource) => row.metadata?.namespace, {
        header: t('common.namespace'),
        cell: ({ getValue }) => (
          <Badge variant="outline" className="font-mono text-xs">
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor((row: MiddlewareResource) => getMiddlewareType(row.spec as MiddlewareSpec), {
        header: 'Type',
        cell: ({ getValue }) => {
          const type = getValue()
          return (
            <Badge className={getMiddlewareTypeColor(type)}>
              {type}
            </Badge>
          )
        },
      }),
      columnHelper.accessor((row: MiddlewareResource) => getMiddlewareDescription(row.spec as MiddlewareSpec), {
        header: 'Configuration',
        cell: ({ getValue }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="max-w-xs truncate text-sm text-muted-foreground cursor-help">
                  {getValue()}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-sm">{getValue()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      }),
      columnHelper.accessor((row: MiddlewareResource) => row.metadata?.creationTimestamp, {
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

  const filter = useCallback((resource: MiddlewareResource, query: string) => {
    const name = resource.metadata!.name!.toLowerCase()
    const namespace = resource.metadata!.namespace?.toLowerCase() || ''
    const type = getMiddlewareType(resource.spec as MiddlewareSpec).toLowerCase()
    const description = getMiddlewareDescription(resource.spec as MiddlewareSpec).toLowerCase()
    
    const searchQuery = query.toLowerCase()
    
    return (
      name.includes(searchQuery) || 
      namespace.includes(searchQuery) || 
      type.includes(searchQuery) || 
      description.includes(searchQuery)
    )
  }, [])

  return (
    <div className="space-y-6">

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCode className="h-5 w-5" />
            {t('traefik.middlewares.title')}
          </CardTitle>
          <CardDescription>
            {t('traefik.middlewares.detailedDescription')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Resource Table */}
      <ResourceTable
        resourceName="middlewares" 
        columns={columns}
        clusterScope={false}
        searchQueryFilter={filter}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { IconLoader, IconRefresh, IconTrash, IconCode, IconShield, IconClock, IconRoute, IconSettings } from '@tabler/icons-react'
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

// Type guard to check if a CustomResource has Middleware spec

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

function getMiddlewareIcon(type: string) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    'Add Prefix': IconRoute,
    'Strip Prefix': IconRoute,
    'Replace Path': IconRoute,
    'Replace Path Regex': IconRoute,
    'Chain': IconSettings,
    'IP Allow List': IconShield,
    'IP Whitelist (Deprecated)': IconShield,
    'Headers': IconCode,
    'Basic Auth': IconShield,
    'Digest Auth': IconShield,
    'Forward Auth': IconShield,
    'In Flight Requests': IconClock,
    'Rate Limit': IconClock,
    'Redirect Regex': IconRoute,
    'Redirect Scheme': IconRoute,
    'Retry': IconClock,
    'Buffering': IconSettings,
    'Circuit Breaker': IconShield,
    'Compress': IconSettings,
    'Content Type': IconCode,
    'Error Pages': IconCode,
    'gRPC Web': IconCode,
    'Pass TLS Client Cert': IconShield,
    'Plugin': IconSettings,
    'Unknown': IconCode
  }
  return icons[type] || IconCode
}

interface MiddlewareDetailProps {
  namespace: string
  name: string
}

export function MiddlewareDetail({ namespace, name }: MiddlewareDetailProps) {
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
  } = useResource('middlewares', name, namespace)

  useEffect(() => {
    if (data) {
      setYamlContent(yaml.dump(data, { indent: 2 }))
    }
  }, [data])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('middlewares', name, namespace)
      toast.success(t('common.resourceDeleted', { resource: 'middleware' }))
      navigate('/middlewares')
    } catch (error) {
      toast.error(
        `${t('common.deleteResourceError', { resource: 'middleware' })}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSaveYaml = async (content: ResourceTypeMap['middlewares']) => {
    setIsSavingYaml(true)
    try {
      await updateResource('middlewares', name, namespace, content)
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
              <span>{t('common.loadingResourceDetails', { resource: 'middleware' })}</span>
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
              {t('common.errorLoadingResource', { resource: 'middleware' })}:{' '}
              {error?.message || t('common.resourceNotFound', { resource: 'middleware' })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const middleware = data as MiddlewareResource
  const spec = middleware.spec as MiddlewareSpec | undefined
  const middlewareType = spec ? getMiddlewareType(spec) : 'Unknown'
  const MiddlewareIcon = getMiddlewareIcon(middlewareType)

  // Render middleware configuration details
  const renderMiddlewareConfig = () => {
    // If spec is not defined, show a message
    if (!spec) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconCode className="h-4 w-4" />
              Middleware Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No configuration details available for this middleware.
            </p>
          </CardContent>
        </Card>
      )
    }

    if (spec.addPrefix) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconRoute className="h-4 w-4" />
              Add Prefix Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Prefix</Label>
                <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{spec.addPrefix.prefix}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (spec.stripPrefix) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconRoute className="h-4 w-4" />
              Strip Prefix Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Prefixes</Label>
                <div className="flex flex-wrap gap-1">
                  {spec.stripPrefix.prefixes.map((prefix, index) => (
                    <Badge key={index} variant="secondary" className="font-mono">
                      {prefix}
                    </Badge>
                  ))}
                </div>
              </div>
              {spec.stripPrefix.forceSlash !== undefined && (
                <div>
                  <Label className="text-xs text-muted-foreground">Force Slash</Label>
                  <p className="text-sm">{spec.stripPrefix.forceSlash ? 'Yes' : 'No'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )
    }

    if (spec.replacePath) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconRoute className="h-4 w-4" />
              Replace Path Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs text-muted-foreground">New Path</Label>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{spec.replacePath.path}</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (spec.replacePathRegex) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconRoute className="h-4 w-4" />
              Replace Path Regex Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Regex Pattern</Label>
                <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{spec.replacePathRegex.regex}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Replacement</Label>
                <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{spec.replacePathRegex.replacement}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (spec.chain) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSettings className="h-4 w-4" />
              Middleware Chain Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs text-muted-foreground">Chained Middlewares ({spec.chain.middlewares.length})</Label>
              <div className="space-y-2 mt-2">
                {spec.chain.middlewares.map((mw, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="text-sm font-medium">{index + 1}.</span>
                    <div>
                      <p className="font-mono text-sm">{mw.name}</p>
                      {mw.namespace && (
                        <p className="text-xs text-muted-foreground">Namespace: {mw.namespace}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (spec.ipAllowList) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconShield className="h-4 w-4" />
              IP Allow List Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs text-muted-foreground">Allowed IP Ranges ({spec.ipAllowList.sourceRange.length})</Label>
              <div className="flex flex-wrap gap-1 mt-2">
                {spec.ipAllowList.sourceRange.map((ip, index) => (
                  <Badge key={index} variant="outline" className="font-mono">
                    {ip}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (spec.ipWhiteList) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconShield className="h-4 w-4" />
              IP Whitelist Configuration
              <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                DEPRECATED
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  ⚠️ The <code className="font-mono">ipWhiteList</code> field is deprecated. Please use <code className="font-mono">ipAllowList</code> instead.
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Allowed IP Ranges ({spec.ipWhiteList.sourceRange.length})</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {spec.ipWhiteList.sourceRange.map((ip, index) => (
                    <Badge key={index} variant="outline" className="font-mono">
                      {ip}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (spec.headers) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconCode className="h-4 w-4" />
              Headers Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {spec.headers.customRequestHeaders && Object.keys(spec.headers.customRequestHeaders).length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Custom Request Headers</Label>
                <div className="space-y-1 mt-1">
                  {Object.entries(spec.headers.customRequestHeaders).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <code className="bg-muted px-1 rounded">{key}</code>
                      <span>:</span>
                      <code className="bg-muted px-1 rounded">{value}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {spec.headers.customResponseHeaders && Object.keys(spec.headers.customResponseHeaders).length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Custom Response Headers</Label>
                <div className="space-y-1 mt-1">
                  {Object.entries(spec.headers.customResponseHeaders).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <code className="bg-muted px-1 rounded">{key}</code>
                      <span>:</span>
                      <code className="bg-muted px-1 rounded">{value}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {spec.headers.accessControlAllowOriginList && spec.headers.accessControlAllowOriginList.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">CORS Allowed Origins</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {spec.headers.accessControlAllowOriginList.map((origin, index) => (
                    <Badge key={index} variant="outline" className="font-mono text-xs">
                      {origin}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    if (spec.basicAuth) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconShield className="h-4 w-4" />
              Basic Auth Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {spec.basicAuth.realm && (
              <div>
                <Label className="text-xs text-muted-foreground">Realm</Label>
                <p className="text-sm">{spec.basicAuth.realm}</p>
              </div>
            )}
            {spec.basicAuth.users && (
              <div>
                <Label className="text-xs text-muted-foreground">Users Count</Label>
                <p className="text-sm">{spec.basicAuth.users.length} user(s) configured</p>
              </div>
            )}
            {spec.basicAuth.usersFile && (
              <div>
                <Label className="text-xs text-muted-foreground">Users File</Label>
                <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{spec.basicAuth.usersFile}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    if (spec.forwardAuth) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconShield className="h-4 w-4" />
              Forward Auth Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Auth Service Address</Label>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{spec.forwardAuth.address}</p>
            </div>
            {spec.forwardAuth.trustForwardHeader !== undefined && (
              <div>
                <Label className="text-xs text-muted-foreground">Trust Forward Header</Label>
                <p className="text-sm">{spec.forwardAuth.trustForwardHeader ? 'Yes' : 'No'}</p>
              </div>
            )}
            {spec.forwardAuth.authResponseHeaders && spec.forwardAuth.authResponseHeaders.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Auth Response Headers</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {spec.forwardAuth.authResponseHeaders.map((header, index) => (
                    <Badge key={index} variant="outline" className="font-mono text-xs">
                      {header}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    if (spec.rateLimit) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconClock className="h-4 w-4" />
              Rate Limit Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {spec.rateLimit.average && (
              <div>
                <Label className="text-xs text-muted-foreground">Average Rate</Label>
                <p className="text-sm">{spec.rateLimit.average} requests per second</p>
              </div>
            )}
            {spec.rateLimit.burst && (
              <div>
                <Label className="text-xs text-muted-foreground">Burst Size</Label>
                <p className="text-sm">{spec.rateLimit.burst} requests</p>
              </div>
            )}
            {spec.rateLimit.period && (
              <div>
                <Label className="text-xs text-muted-foreground">Period</Label>
                <p className="text-sm">{spec.rateLimit.period}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    if (spec.retry) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconClock className="h-4 w-4" />
              Retry Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Attempts</Label>
              <p className="text-sm">{spec.retry.attempts} attempts</p>
            </div>
            {spec.retry.initialInterval && (
              <div>
                <Label className="text-xs text-muted-foreground">Initial Interval</Label>
                <p className="text-sm">{spec.retry.initialInterval}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    // Generic fallback for other middleware types
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MiddlewareIcon className="h-4 w-4" />
            {middlewareType} Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This middleware type is configured. View the YAML tab for detailed configuration.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MiddlewareIcon className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-bold">{name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {namespace}
              </Badge>
              <Badge className={getMiddlewareTypeColor(middlewareType)}>
                {middlewareType}
              </Badge>
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
                    <CardTitle>Middleware Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.created')}
                        </Label>
                        <p className="text-sm">
                          {formatDate(middleware.metadata?.creationTimestamp || '')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.uid')}
                        </Label>
                        <p className="text-sm font-mono">
                          {middleware.metadata?.uid || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          API Version
                        </Label>
                        <p className="text-sm">
                          {middleware.apiVersion}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Kind
                        </Label>
                        <p className="text-sm">
                          {middleware.kind}
                        </p>
                      </div>
                      {getOwnerInfo(middleware.metadata) && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t('common.owner')}
                          </Label>
                          <p className="text-sm">
                            {(() => {
                              const ownerInfo = getOwnerInfo(middleware.metadata)
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
                      labels={middleware.metadata?.labels || {}}
                      annotations={middleware.metadata?.annotations || {}}
                    />
                  </CardContent>
                </Card>

                {/* Middleware Configuration */}
                {renderMiddlewareConfig()}
              </div>
            ),
          },
          {
            value: 'yaml',
            label: 'YAML',
            content: (
              <div className="space-y-4">
                <YamlEditor<'middlewares'>
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
            value: 'related',
            label: t('common.related'),
            content: (
              <RelatedResourcesTable
                resource="middlewares"
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
                resource="middlewares"
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
        resourceType="middlewares"
        namespace={namespace}
        isDeleting={isDeleting}
      />
    </div>
  )
}

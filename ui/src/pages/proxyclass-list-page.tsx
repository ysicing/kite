import React, { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'
import { CustomResource } from '@/types/api'
import { 
  IconRouter, 
  IconSettings, 

  IconChartBar,
  IconShield,
  IconCpu,
  IconServer
} from '@tabler/icons-react'

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

const ProxyClassListPage: React.FC = () => {
  const { t } = useTranslation()
  const columnHelper = createColumnHelper<ProxyClassResource>()

  const hasMetrics = (proxyClass: ProxyClassResource): boolean => {
    return proxyClass.spec.metrics?.enable === true
  }

  const hasServiceMonitor = (proxyClass: ProxyClassResource): boolean => {
    return proxyClass.spec.metrics?.serviceMonitor?.enable === true
  }

  const hasResourceLimits = (proxyClass: ProxyClassResource): boolean => {
    const resources = proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.resources
    return !!(resources?.limits || resources?.requests)
  }

  const hasSecurityContext = (proxyClass: ProxyClassResource): boolean => {
    return !!proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.securityContext
  }

  const getCustomLabelsCount = (proxyClass: ProxyClassResource): number => {
    const statefulSetLabels = Object.keys(proxyClass.spec.statefulSet?.labels || {}).length
    const podLabels = Object.keys(proxyClass.spec.statefulSet?.pod?.labels || {}).length
    return statefulSetLabels + podLabels
  }

  const hasNodeSelector = (proxyClass: ProxyClassResource): boolean => {
    return !!proxyClass.spec.statefulSet?.pod?.nodeSelector
  }

  const columns = useMemo(() => [
    columnHelper.accessor('metadata.name', {
      header: t('common.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <IconRouter className="h-4 w-4 text-blue-600" />
          <Link 
            to={`/proxyclasses/${row.original.metadata.name}`}
            className="font-medium hover:underline"
          >
            {row.original.metadata.name}
          </Link>
        </div>
      ),
    }),
    columnHelper.accessor((row) => row, {
      header: t('tailscale.proxyclasses.features'),
      cell: ({ getValue }) => {
        const proxyClass = getValue()
        return (
          <div className="flex flex-wrap gap-1">
            {hasMetrics(proxyClass) && (
              <Badge variant="outline" className="text-xs">
                <IconChartBar className="h-3 w-3 mr-1" />
                {t('tailscale.proxyclasses.featuresTypes.metrics')}
              </Badge>
            )}
            {hasServiceMonitor(proxyClass) && (
              <Badge variant="outline" className="text-xs">
                <IconChartBar className="h-3 w-3 mr-1" />
                ServiceMonitor
              </Badge>
            )}
            {hasResourceLimits(proxyClass) && (
              <Badge variant="outline" className="text-xs">
                <IconCpu className="h-3 w-3 mr-1" />
                {t('tailscale.proxyclasses.featuresTypes.resources')}
              </Badge>
            )}
            {hasSecurityContext(proxyClass) && (
              <Badge variant="outline" className="text-xs">
                <IconShield className="h-3 w-3 mr-1" />
                {t('tailscale.proxyclasses.featuresTypes.security')}
              </Badge>
            )}
            {hasNodeSelector(proxyClass) && (
              <Badge variant="outline" className="text-xs">
                <IconSettings className="h-3 w-3 mr-1" />
                {t('common.nodeSelector')}
              </Badge>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor((row) => getCustomLabelsCount(row), {
      header: t('tailscale.proxyclasses.customLabels'),
      cell: ({ getValue }) => (
        <span className="text-sm">
          {getValue() || '-'}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.spec.statefulSet?.pod?.tailscaleContainer?.image, {
      header: t('tailscale.proxyclasses.image'),
      cell: ({ getValue }) => (
        <span className="text-sm font-mono">
          {getValue() || t('tailscale.proxyclasses.defaultImage')}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.spec.statefulSet?.pod?.tailscaleContainer?.resources, {
      header: t('tailscale.proxyclasses.resources'),
      cell: ({ getValue }) => {
        const resources = getValue()
        if (!resources?.requests && !resources?.limits) {
          return <span className="text-sm text-gray-500">-</span>
        }
        
        return (
          <div className="text-xs space-y-1">
            {resources.requests && (
              <div className="flex items-center gap-1">
                <IconCpu className="h-3 w-3" />
                <span>
                  CPU: {resources.requests.cpu || '-'}, 
                  Mem: {resources.requests.memory || '-'}
                </span>
              </div>
            )}
            {resources.limits && (
              <div className="flex items-center gap-1">
                <IconServer className="h-3 w-3" />
                <span>
                  Max CPU: {resources.limits.cpu || '-'}, 
                  Max Mem: {resources.limits.memory || '-'}
                </span>
              </div>
            )}
          </div>
        )
      },
    }),
  ], [columnHelper, t])

  const searchFilter = useCallback((proxyClass: ProxyClassResource, query: string) => {
    const searchFields = [
      proxyClass.metadata?.name || '',
      proxyClass.spec.statefulSet?.pod?.tailscaleContainer?.image || '',
      ...(proxyClass.spec.statefulSet?.labels ? Object.keys(proxyClass.spec.statefulSet.labels) : []),
      ...(proxyClass.spec.statefulSet?.labels ? Object.values(proxyClass.spec.statefulSet.labels) : []),
      ...(proxyClass.spec.statefulSet?.pod?.labels ? Object.keys(proxyClass.spec.statefulSet.pod.labels) : []),
      ...(proxyClass.spec.statefulSet?.pod?.labels ? Object.values(proxyClass.spec.statefulSet.pod.labels) : []),
    ]

    return searchFields.some((field) =>
      field.toLowerCase().includes(query.toLowerCase())
    )
  }, [])

  return (
    <ResourceTable
      resourceName={t('tailscale.proxyclasses.title')}
      resourceType="proxyclasses"
      columns={columns}
      clusterScope={true}
      searchQueryFilter={searchFilter}
    />
  )
}

export default ProxyClassListPage 

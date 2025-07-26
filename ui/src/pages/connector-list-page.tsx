import React, { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'
import { CustomResource } from '@/types/api'
import { 
  IconNetwork, 
  IconRoute, 
  IconTag,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconExternalLink
} from '@tabler/icons-react'

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

interface ConnectorStatus extends Record<string, unknown> {
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

interface ConnectorResource extends CustomResource {
  spec: ConnectorSpec
  status?: ConnectorStatus
}

const ConnectorListPage: React.FC = () => {
  const { t } = useTranslation()
  const columnHelper = createColumnHelper<ConnectorResource>()

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
    
    return types.length > 0 ? types.join(', ') : t('tailscale.connectors.types.unknown')
  }

  const getConnectorStatus = (connector: ConnectorResource): { 
    status: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ReactNode
  } => {
    const condition = connector.status?.conditions?.find(c => c.type === 'ConnectorReady')
    
    if (!condition) {
      return {
        status: t('tailscale.connectors.status.unknown'),
        variant: 'outline',
        icon: <IconAlertCircle className="h-3 w-3" />
      }
    }
    
    if (condition.status === 'True') {
      return {
        status: t('tailscale.connectors.status.ready'),
        variant: 'default',
        icon: <IconCheck className="h-3 w-3" />
      }
    }
    
    return {
      status: t('tailscale.connectors.status.notReady'),
      variant: 'destructive',
      icon: <IconX className="h-3 w-3" />
    }
  }

  const formatRoutes = (routes?: string[]): string => {
    if (!routes || routes.length === 0) return '-'
    if (routes.length === 1) return routes[0]
    return `${routes[0]} +${routes.length - 1}`
  }

  const columns = useMemo(() => [
    columnHelper.accessor('metadata.name', {
      header: t('common.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <IconNetwork className="h-4 w-4 text-blue-600" />
          <Link 
            to={`/connectors/${row.original.metadata.name}`}
            className="font-medium hover:underline"
          >
            {row.original.metadata.name}
          </Link>
        </div>
      ),
    }),
    columnHelper.accessor((row) => getConnectorType(row), {
      header: t('tailscale.connectors.type'),
      cell: ({ getValue }) => (
        <div className="text-center">
          <span className="text-sm">{getValue()}</span>
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.spec.hostname || row.status?.hostname || '-', {
      header: t('tailscale.connectors.hostname'),
      cell: ({ getValue }) => (
        <div className="text-center">
          <span className="text-sm font-mono">{getValue()}</span>
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.spec.subnetRouter?.advertiseRoutes || row.spec.appConnector?.routes, {
      header: t('tailscale.connectors.routes'),
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.spec.subnetRouter?.advertiseRoutes && (
            <div className="flex items-center gap-1 text-sm justify-center">
              <IconRoute className="h-3 w-3" />
              <span className="font-mono">
                {formatRoutes(row.original.spec.subnetRouter.advertiseRoutes)}
              </span>
            </div>
          )}
          {row.original.spec.appConnector?.routes && (
            <div className="flex items-center gap-1 text-sm justify-center">
              <IconExternalLink className="h-3 w-3" />
              <span className="font-mono">
                {formatRoutes(row.original.spec.appConnector.routes)}
              </span>
            </div>
          )}
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.spec.proxyClass, {
      header: t('tailscale.connectors.proxyClass'),
      cell: ({ getValue }) => {
        const proxyClass = getValue()
        return (
          <div className="text-center">
            <span className="text-sm">
              {proxyClass ? (
                <Link 
                  to={`/proxyclasses/${proxyClass}`}
                  className="text-blue-600 hover:underline"
                >
                  {proxyClass}
                </Link>
              ) : '-'}
            </span>
          </div>
        )
      },
    }),
    columnHelper.accessor((row) => row.spec.tags, {
      header: t('tailscale.connectors.tags'),
      cell: ({ getValue }) => {
        const tags = getValue()
        return (
          <div className="flex flex-wrap gap-1 justify-center">
            {tags?.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                <IconTag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            )) || '-'}
          </div>
        )
      },
    }),
    columnHelper.accessor((row) => getConnectorStatus(row), {
      header: t('common.status'),
      cell: ({ getValue }) => {
        const { status, variant, icon } = getValue()
        return (
          <div className="flex justify-center">
            <Badge variant={variant} className="flex items-center gap-1">
              {icon}
              {status}
            </Badge>
          </div>
        )
      },
    }),
  ], [columnHelper, t])

  const searchFilter = useCallback((connector: ConnectorResource, query: string) => {
    const searchFields = [
      connector.metadata?.name || '',
      connector.spec.hostname || '',
      getConnectorType(connector),
      ...(connector.spec.tags || []),
      ...(connector.spec.subnetRouter?.advertiseRoutes || []),
      ...(connector.spec.appConnector?.routes || []),
    ]

    return searchFields.some((field) =>
      field.toLowerCase().includes(query.toLowerCase())
    )
  }, [])

  return (
    <ResourceTable
      resourceName={t('tailscale.connectors.title')}
      resourceType="connectors"
      columns={columns}
      clusterScope={true}
      searchQueryFilter={searchFilter}
    />
  )
}

export default ConnectorListPage 

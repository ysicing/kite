import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { HorizontalPodAutoscaler } from 'kubernetes-types/autoscaling/v2'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/utils'
import { ResourceTable } from '@/components/resource-table'
import { Badge } from '@/components/ui/badge'
import { IconChartLine } from '@tabler/icons-react'

export function HPAListPage() {
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<HorizontalPodAutoscaler>()
  const { t } = useTranslation()

  // Helper function to get metrics summary
  const getMetricsSummary = (hpa: HorizontalPodAutoscaler) => {
    const metrics = hpa.spec?.metrics || []
    const currentMetrics = hpa.status?.currentMetrics || []

    if (metrics.length === 0) return { type: '-', current: '-', target: '-' }

    const firstMetric = metrics[0]
    const firstCurrentMetric = currentMetrics[0]

    let type = firstMetric.type
    let target = '-'
    let current = '-'

    if (firstMetric.type === 'Resource' && firstMetric.resource) {
      type = firstMetric.resource.name || 'Resource'
      if (firstMetric.resource.target?.averageUtilization) {
        target = `${firstMetric.resource.target.averageUtilization}%`
      }

      if (firstCurrentMetric?.resource?.current?.averageUtilization !== undefined) {
        current = `${firstCurrentMetric.resource.current.averageUtilization}%`
      }
    }

    return { type, current, target }
  }

  // Helper function to get scaling status
  const getScalingStatus = (hpa: HorizontalPodAutoscaler) => {
    const current = hpa.status?.currentReplicas || 0
    const desired = hpa.status?.desiredReplicas

    if (desired === undefined) return 'unknown'
    if (current === desired) return 'stable'
    if (current < desired) return 'scaling-up'
    return 'scaling-down'
  }

  // Define columns for the HPA table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/horizontalpodautoscalers/${row.original.metadata!.namespace}/${
                row.original.metadata!.name
              }`}
            >
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor('spec.scaleTargetRef', {
        header: t('hpa.target'),
        cell: ({ getValue }) => {
          const ref = getValue()
          if (!ref) return '-'
          return (
            <span className="text-sm">
              {ref.kind}/{ref.name}
            </span>
          )
        },
      }),
      columnHelper.accessor((row) => getMetricsSummary(row), {
        id: 'metrics',
        header: () => (
          <div className="flex items-center gap-1">
            <IconChartLine className="h-4 w-4" />
            <span>{t('hpa.metrics')}</span>
          </div>
        ),
        cell: ({ getValue }) => {
          const metrics = getValue()
          return (
            <div className="space-y-1">
              <div className="text-sm font-medium">{metrics.type}</div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">
                  {t('hpa.current')}: {metrics.current}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {t('hpa.targetValue')}: {metrics.target}
                </Badge>
              </div>
            </div>
          )
        },
      }),
      columnHelper.accessor('spec', {
        id: 'replicas',
        header: t('hpa.replicasRange'),
        cell: ({ row }) => {
          const minReplicas = row.original.spec?.minReplicas || 1
          const maxReplicas = row.original.spec?.maxReplicas || '-'
          return (
            <span className="text-sm font-mono">
              {minReplicas} / {maxReplicas}
            </span>
          )
        },
      }),
      columnHelper.accessor('status', {
        id: 'currentStatus',
        header: t('hpa.currentDesired'),
        cell: ({ row }) => {
          const current = row.original.status?.currentReplicas || 0
          const desired = row.original.status?.desiredReplicas
          const status = getScalingStatus(row.original)

          let variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' = 'secondary'
          let statusText = ''

          switch (status) {
            case 'stable':
              variant = 'success'
              statusText = t('hpa.stable')
              break
            case 'scaling-up':
              variant = 'warning'
              statusText = t('hpa.scalingUp')
              break
            case 'scaling-down':
              variant = 'warning'
              statusText = t('hpa.scalingDown')
              break
            default:
              statusText = t('hpa.unknown')
          }

          return (
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">
                {current} / {desired !== undefined ? desired : '-'}
              </span>
              <Badge variant={variant} className="text-xs">
                {statusText}
              </Badge>
            </div>
          )
        },
      }),
      columnHelper.accessor('status.conditions', {
        id: 'conditions',
        header: t('hpa.status'),
        cell: ({ getValue }) => {
          const conditions = getValue() || []
          const ableToScale = conditions.find(c => c.type === 'AbleToScale')
          const scalingActive = conditions.find(c => c.type === 'ScalingActive')

          if (ableToScale?.status === 'False') {
            return (
              <Badge variant="destructive" className="text-xs">
                {t('hpa.unableToScale')}
              </Badge>
            )
          }

          if (scalingActive?.status === 'True') {
            return (
              <Badge variant="success" className="text-xs">
                {t('hpa.active')}
              </Badge>
            )
          }

          return (
            <Badge variant="secondary" className="text-xs">
              {t('hpa.unknown')}
            </Badge>
          )
        },
      }),
      columnHelper.accessor('metadata.creationTimestamp', {
        header: t('common.created'),
        cell: ({ getValue }) => {
          const dateStr = formatDate(getValue() || '')

          return (
            <span className="text-muted-foreground text-sm">{dateStr}</span>
          )
        },
      }),
    ],
    [columnHelper, t]
  )

  // Custom filter for HPA search
  const hpaSearchFilter = useCallback(
    (hpa: HorizontalPodAutoscaler, query: string) => {
      return (
        hpa.metadata!.name!.toLowerCase().includes(query) ||
        (hpa.metadata!.namespace?.toLowerCase() || '').includes(query) ||
        (hpa.spec?.scaleTargetRef?.name?.toLowerCase() || '').includes(query)
      )
    },
    []
  )

  return (
    <ResourceTable
      resourceName={t('hpa.title')}
      columns={columns}
      clusterScope={false} // HPAs are namespace-scoped
      searchQueryFilter={hpaSearchFilter}
    />
  )
}
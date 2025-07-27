import { useCallback, useMemo } from 'react'
import { IconCircleCheckFilled, IconLoader } from '@tabler/icons-react'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'
import { AdvancedDaemonSet } from '@/types/k8s'

export function AdvancedDaemonSetListPage() {
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<AdvancedDaemonSet>()
  const { t } = useTranslation()
  // Define columns for the advanced daemonset table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/advanceddaemonsets/${row.original.metadata!.namespace}/${
                row.original.metadata!.name
              }`}
            >
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor('status.desiredNumberScheduled', {
        header: t('common.desired'),
        cell: ({ getValue }) => getValue() || 0,
      }),
      columnHelper.accessor('status.currentNumberScheduled', {
        header: t('common.current'),
        cell: ({ getValue }) => getValue() || 0,
      }),
      columnHelper.accessor('status.numberReady', {
        header: t('common.ready'),
        cell: ({ getValue }) => getValue() || 0,
      }),
      columnHelper.accessor('status.numberAvailable', {
        header: t('common.available'),
        cell: ({ getValue }) => getValue() || 0,
      }),
      columnHelper.accessor('status.conditions', {
        header: t('common.status'),
        cell: ({ row }) => {
          const readyReplicas = row.original.status?.numberReady || 0
          const replicas = row.original.status?.desiredNumberScheduled || 0
          const isAvailable = readyReplicas === replicas
          const status = isAvailable ? 'Available' : 'In Progress'
          if (replicas === 0) {
            return (
              <Badge
                variant="secondary"
                className="text-muted-foreground px-1.5"
              >
                Pending
              </Badge>
            )
          }

          return (
            <Badge variant="outline" className="text-muted-foreground px-1.5">
              {isAvailable ? (
                <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
              ) : (
                <IconLoader className="animate-spin" />
              )}
              {status}
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

  // Custom filter for advanced daemonset search
  const advancedDaemonSetSearchFilter = useCallback(
    (advancedDaemonSet: AdvancedDaemonSet, query: string) => {
      return (
        advancedDaemonSet.metadata!.name!.toLowerCase().includes(query) ||
        (advancedDaemonSet.metadata!.namespace?.toLowerCase() || '').includes(query)
      )
    },
    []
  )

  return (
    <ResourceTable
      resourceName="AdvancedDaemonSets"
      columns={columns}
      searchQueryFilter={advancedDaemonSetSearchFilter}
    />
  )
}

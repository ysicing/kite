import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { getCloneSetStatus } from '@/lib/k8s'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { DeploymentStatusIcon } from '@/components/deployment-status-icon'
import { ResourceTable } from '@/components/resource-table'
import { CloneSet } from '@/types/k8s'

export function CloneSetListPage() {
  const { t } = useTranslation()

  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<CloneSet>()

  // Define columns for the cloneset table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/clonesets/${row.original.metadata.namespace}/${
                row.original.metadata.name
              }`}
            >
              {row.original.metadata.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.status, {
        id: 'ready',
        header: t('openkruise.clonesets.ready'),
        cell: ({ row }) => {
          const status = row.original.status
          const ready = status?.readyReplicas || 0
          const desired = status?.replicas || 0
          return (
            <div>
              {ready} / {desired}
            </div>
          )
        },
      }),
      columnHelper.accessor('status.conditions', {
        header: t('common.status'),
        cell: ({ row }) => {
          const status = getCloneSetStatus(row.original)
          return (
            <Badge variant="outline" className="text-muted-foreground px-1.5">
              <DeploymentStatusIcon status={status} />
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

  // Custom filter for cloneset search
  const cloneSetSearchFilter = useCallback(
    (cloneSet: CloneSet, query: string) => {
      return (
        cloneSet.metadata.name.toLowerCase().includes(query) ||
        (cloneSet.metadata.namespace?.toLowerCase() || '').includes(query)
      )
    },
    []
  )

  return (
    <ResourceTable
      resourceName={t('openkruise.clonesets.title')}
      resourceType="clonesets"
      columns={columns}
      searchQueryFilter={cloneSetSearchFilter}
    />
  )
}

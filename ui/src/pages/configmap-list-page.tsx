import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { ConfigMap } from 'kubernetes-types/core/v1'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/utils'
import { ResourceTable } from '@/components/resource-table'

export function ConfigMapListPage() {
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<ConfigMap>()
  const { t } = useTranslation()
  // Define columns for the configmap table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/configmaps/${row.original.metadata!.namespace}/${
                row.original.metadata!.name
              }`}
            >
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
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

  // Custom filter for configmap search
  const configMapSearchFilter = useCallback(
    (configMap: ConfigMap, query: string) => {
      return (
        configMap.metadata!.name!.toLowerCase().includes(query) ||
        (configMap.metadata!.namespace?.toLowerCase() || '').includes(query)
      )
    },
    []
  )

  return (
    <ResourceTable
      resourceName="ConfigMaps"
      columns={columns}
      clusterScope={false} // ConfigMaps are namespace-scoped
      searchQueryFilter={configMapSearchFilter}
    />
  )
}

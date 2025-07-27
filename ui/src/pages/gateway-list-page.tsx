import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Gateway } from '@/types/gateway'
import { formatDate } from '@/lib/utils'
import { ResourceTable } from '@/components/resource-table'

export function GatewayListPage() {
  const { t } = useTranslation()
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<Gateway>()

  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/gateways/${row.original.metadata!.namespace}/${row.original.metadata!.name}`}
            >
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor('spec.gatewayClassName', {
        header: t('common.gatewayClass'),
        cell: ({ row }) => row.original.spec?.gatewayClassName || 'N/A',
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

  const filter = useCallback((ns: Gateway, query: string) => {
    return ns.metadata!.name!.toLowerCase().includes(query)
  }, [])

  return (
    <ResourceTable
      resourceName="Gateways"
      columns={columns}
      searchQueryFilter={filter}
    />
  )
}

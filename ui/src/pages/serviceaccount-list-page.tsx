import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { ServiceAccount } from 'kubernetes-types/core/v1'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/utils'
import { ResourceTable } from '@/components/resource-table'

export function ServiceAccountListPage() {
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<ServiceAccount>()
  const { t } = useTranslation()
  
  // Define columns for the serviceaccount table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/serviceaccounts/${row.original.metadata!.namespace}/${
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

  // Custom filter for serviceaccount search
  const serviceAccountSearchFilter = useCallback(
    (serviceAccount: ServiceAccount, query: string) => {
      return (
        serviceAccount.metadata!.name!.toLowerCase().includes(query) ||
        (serviceAccount.metadata!.namespace?.toLowerCase() || '').includes(query)
      )
    },
    []
  )

  return (
    <ResourceTable
      resourceName="ServiceAccounts"
      columns={columns}
      clusterScope={false} // ServiceAccounts are namespace-scoped
      searchQueryFilter={serviceAccountSearchFilter}
    />
  )
}

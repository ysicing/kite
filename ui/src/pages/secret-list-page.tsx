import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Secret } from 'kubernetes-types/core/v1'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'

export function SecretListPage() {
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<Secret>()

  const { t } = useTranslation()
  // Define columns for the secret table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/secrets/${row.original.metadata!.namespace}/${
                row.original.metadata!.name
              }`}
            >
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor('type', {
        header: t('common.type'),
        cell: ({ getValue }) => {
          const type = getValue() || 'Opaque'
          return <Badge variant="outline">{type}</Badge>
        },
        enableColumnFilter: true,
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

  // Custom filter for secret search
  const secretSearchFilter = useCallback((secret: Secret, query: string) => {
    const type = secret.type || ''

    return (
      secret.metadata!.name!.toLowerCase().includes(query) ||
      (secret.metadata!.namespace?.toLowerCase() || '').includes(query) ||
      type.toLowerCase().includes(query)
    )
  }, [])

  return (
    <ResourceTable
      resourceName="Secrets"
      columns={columns}
      clusterScope={false} // Secrets are namespace-scoped
      searchQueryFilter={secretSearchFilter}
    />
  )
}

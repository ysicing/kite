import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Ingress } from 'kubernetes-types/networking/v1'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'

export function IngressListPage() {
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<Ingress>()
  const { t } = useTranslation()
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/ingresses/${row.original.metadata!.namespace}/${row.original.metadata!.name}`}
            >
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor('spec.ingressClassName', {
        header: 'Ingress Class',
        cell: ({ row }) => row.original.spec?.ingressClassName || 'N/A',
      }),
      columnHelper.accessor('spec.rules', {
        header: t('common.hosts'),
        cell: ({ row }) => {
          const rules = row.original.spec?.rules || []
          return (
            <Badge variant="outline" className="ml-2 ">
              {rules.length > 0 ? rules.map((r) => r.host).join(', ') : 'N/A'}
            </Badge>
          )
        },
      }),
      columnHelper.accessor('status.loadBalancer.ingress', {
        header: t('common.loadBalancer'),
        cell: ({ row }) => {
          const ingress = row.original.status?.loadBalancer?.ingress || []
          return (
            <div>
              {ingress.length > 0
                ? ingress.map((i) => i.ip || i.hostname).join(', ')
                : 'N/A'}
            </div>
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

  const filter = useCallback((ns: Ingress, query: string) => {
    return ns.metadata!.name!.toLowerCase().includes(query)
  }, [])

  return (
    <ResourceTable
      resourceName="Ingresses"
      columns={columns}
      searchQueryFilter={filter}
    />
  )
}

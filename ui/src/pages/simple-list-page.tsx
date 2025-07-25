import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  clusterScopeResources,
  ResourceType,
  ResourceTypeMap,
} from '@/types/api'
import { formatDate } from '@/lib/utils'
import { ResourceTable } from '@/components/resource-table'

export interface ResourceTableProps {
  resourceType?: ResourceType
}

export function SimpleListPage<T extends keyof ResourceTypeMap>({
  resourceType,
}: ResourceTableProps) {
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<ResourceTypeMap[T]>()
  const isClusterScope =
    resourceType && clusterScopeResources.includes(resourceType)
  const { t } = useTranslation()
  // Define columns for the service table
  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.metadata?.name, {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/${resourceType}${isClusterScope ? '' : `/${row.original.metadata!.namespace}`}/${row.original.metadata!.name}`}
            >
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.metadata?.creationTimestamp, {
        header: t('common.created'),
        cell: ({ getValue }) => {
          const dateStr = formatDate(getValue() || '')

          return (
            <span className="text-muted-foreground text-sm">{dateStr}</span>
          )
        },
      }),
    ],
    [columnHelper, isClusterScope, resourceType]
  )

  const filter = useCallback((resource: ResourceTypeMap[T], query: string) => {
    return resource.metadata!.name!.toLowerCase().includes(query)
  }, [])

  if (!resourceType) {
    return <div>Resource type "{resourceType}" not found</div>
  }

  return (
    <ResourceTable
      resourceName={resourceType}
      columns={columns}
      clusterScope={clusterScopeResources.includes(resourceType)}
      searchQueryFilter={filter}
    />
  )
}

import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'

import { StorageClassWithInfo } from '@/types/api'
import { formatDate } from '@/lib/utils'
import { ResourceTable } from '@/components/resource-table'

export function StorageClassListPage() {
  const { t } = useTranslation()
  const columnHelper = createColumnHelper<StorageClassWithInfo>()

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.metadata?.name, {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-2">
            <Link
              to={`/storageclasses/${row.original.metadata!.name}`}
              className="font-medium text-blue-500 hover:underline"
            >
              {row.original.metadata!.name}
            </Link>
            {row.original.isDefault && (
              <Badge variant="secondary" className="text-xs">
                {t('common.default')}
              </Badge>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('provisioner', {
        header: t('common.provisioner'),
        cell: ({ getValue }) => (
          <div className="text-center">
            <span className="text-sm text-muted-foreground">{getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('reclaimPolicy', {
        header: t('common.reclaimPolicy'),
        cell: ({ getValue }) => (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-xs">
              {getValue() || 'Delete'}
            </Badge>
          </div>
        ),
      }),
      columnHelper.accessor('volumeBindingMode', {
        header: t('common.volumeBindingMode'),
        cell: ({ getValue }) => (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-xs">
              {getValue() || 'Immediate'}
            </Badge>
          </div>
        ),
      }),
      columnHelper.accessor('associatedPVC', {
        header: t('common.associatedPVC'),
        cell: ({ row, getValue }) => {
          const count = getValue()
          if (count === 0) {
            return <div className="text-center"><span className="text-sm text-muted-foreground">0</span></div>
          }
          return (
            <div className="flex items-center justify-center gap-2">
              <Link to={`/storageclasses/${row.original.metadata!.name}`}>
                <Badge variant="default" className="text-xs">
                  {count}
                </Badge>
              </Link>
            </div>
          )
        },
      }),
      columnHelper.accessor((row) => row.metadata?.creationTimestamp, {
        header: t('common.created'),
        cell: ({ getValue }) => {
          const dateStr = formatDate(getValue() || '')
          return (
            <div className="text-center">
              <span className="text-muted-foreground text-sm">{dateStr}</span>
            </div>
          )
        },
      }),
    ],
    [columnHelper, t]
  )

  const filter = useCallback((resource: StorageClassWithInfo, query: string) => {
    const name = resource.metadata?.name?.toLowerCase() || ''
    const provisioner = resource.provisioner?.toLowerCase() || ''
    const q = query.toLowerCase()
    return name.includes(q) || provisioner.includes(q)
  }, [])

  return (
    <ResourceTable
      resourceName="storageclasses"
      columns={columns}
      clusterScope={true}
      searchQueryFilter={filter}
    />
  )
}

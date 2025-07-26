import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { AdmissionController } from '@/types/api'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'

export function AdmissionControllerListPage() {
  const { t } = useTranslation()
  
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<AdmissionController>()

  // Define columns for the admission controller table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/admission-controllers/${row.original.metadata.name}?type=${row.original.type}`}
            >
              {row.original.metadata.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor('type', {
        header: t('resources.type'),
        cell: ({ getValue }) => {
          const type = getValue()
          return (
            <Badge 
              variant={type === 'validating' ? 'default' : 'secondary'}
              className={type === 'validating' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
            >
              {type === 'validating' ? t('nav.validatingWebhooks') : t('nav.mutatingWebhooks')}
            </Badge>
          )
        },
        enableColumnFilter: true,
      }),
      columnHelper.accessor('spec', {
        header: t('resources.webhooks'),
        cell: ({ getValue }) => {
          const spec = getValue()
          const webhooks = spec?.webhooks as any[] || []
          return (
            <span className="text-muted-foreground">
              {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''}
            </span>
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

  // Custom filter for admission controller search
  const admissionControllerSearchFilter = useCallback(
    (controller: AdmissionController, query: string) => {
      const lowerQuery = query.toLowerCase()
      return (
        controller.metadata.name.toLowerCase().includes(lowerQuery) ||
        controller.type.toLowerCase().includes(lowerQuery) ||
        (controller.spec?.webhooks as any[])?.some((webhook: any) => 
          webhook.name?.toLowerCase().includes(lowerQuery)
        ) || false
      )
    },
    []
  )

  return (
    <ResourceTable
      resourceName="Admission Controllers"
      resourceType="admission-controllers"
      columns={columns}
      clusterScope={true} // Admission controllers are cluster-scoped
      searchQueryFilter={admissionControllerSearchFilter}
    />
  )
}

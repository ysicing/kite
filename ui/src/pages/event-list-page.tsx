import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Event } from 'kubernetes-types/core/v1'
import { useTranslation } from 'react-i18next'

import { ResourceTable } from '@/components/resource-table'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export function EventListPage() {
  const { t } = useTranslation()
  const columnHelper = createColumnHelper<Event>()

  const columns = useMemo(
    () => [
      columnHelper.accessor((event: Event) => event.type || '', {
        id: 'type',
        header: t('events.table.type'),
        cell: ({ getValue }) => {
          const type = getValue() as string
          const variant = type === 'Normal' ? 'default' : 'destructive'
          return <Badge variant={variant}>{type}</Badge>
        },
        enableColumnFilter: true,
      }),
      columnHelper.accessor((event: Event) => event.reason || '', {
        id: 'reason',
        header: t('events.table.reason'),
        cell: ({ getValue }) => (
          <div className="font-medium">{getValue() as string}</div>
        ),
      }),
      columnHelper.accessor((event: Event) => event.message || '', {
        id: 'message',
        header: t('events.table.message'),
        cell: ({ getValue }) => (
          <div className="text-sm max-w-md truncate" title={getValue() as string}>
            {getValue() as string}
          </div>
        ),
      }),
      columnHelper.accessor((event: Event) => event.metadata?.name || '', {
        id: 'eventName',
        header: t('events.table.eventName'),
        cell: ({ getValue }) => (
          <span className="text-sm font-mono">{getValue() as string}</span>
        ),
      }),
      columnHelper.accessor((event: Event) => event.involvedObject, {
        id: 'involvedObject',
        header: t('events.table.involvedObject'),
        cell: ({ getValue }) => {
          const obj = getValue() as Event['involvedObject']
          if (!obj) return <span className="text-muted-foreground text-xs">-</span>
          
          return (
            <div className="text-sm">
              <div className="font-medium">{obj.kind}</div>
              <div className="text-muted-foreground text-xs">
                {obj.namespace ? `${obj.namespace}/` : ''}{obj.name}
              </div>
            </div>
          )
        },
      }),
      columnHelper.accessor((event: Event) => event.reportingComponent || event.source?.component || '', {
        id: 'source',
        header: t('events.table.source'),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">
            {getValue() as string}
          </span>
        ),
      }),
      columnHelper.accessor((event: Event) => event.firstTimestamp || event.eventTime || '', {
        id: 'firstSeen',
        header: t('events.table.firstSeen'),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {formatDate(getValue() as string)}
          </span>
        ),
      }),
      columnHelper.accessor((event: Event) => event.lastTimestamp || event.eventTime || '', {
        id: 'lastSeen',
        header: t('events.table.lastSeen'),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {formatDate(getValue() as string)}
          </span>
        ),
      }),
    ],
    [columnHelper, t]
  )

  const searchQueryFilter = (event: Event, query: string) => {
    const searchFields = [
      event.type,
      event.reason,
      event.message,
      event.metadata?.name,
      event.metadata?.namespace,
      event.involvedObject?.kind,
      event.involvedObject?.name,
      event.involvedObject?.namespace,
      event.reportingComponent,
      event.source?.component,
    ]
    
    return searchFields.some(field => 
      field?.toLowerCase().includes(query)
    )
  }

  return (
    <ResourceTable
      resourceName="events"
      columns={columns}
      clusterScope={true}
      searchQueryFilter={searchQueryFilter}
    />
  )
}
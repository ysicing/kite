import { useMemo } from 'react'
import { IconLoader } from '@tabler/icons-react'
import { Event } from 'kubernetes-types/core/v1'
import { useTranslation } from 'react-i18next'

import { ResourceType } from '@/types/api'
import { useResourcesEvents } from '@/lib/api'
import { formatDate } from '@/lib/utils'

import { Column, SimpleTable } from './simple-table'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

export function EventTable(props: {
  resource: ResourceType
  name: string
  namespace?: string
}) {
  const { t } = useTranslation()
  const { data: events, isLoading } = useResourcesEvents(
    props.resource,
    props.name,
    props.namespace
  )

  // Event table columns
  const eventColumns = useMemo(
    (): Column<Event>[] => [
      {
        header: t('events.table.type'),
        accessor: (event: Event) => event.type || '',
        cell: (value: unknown) => {
          const type = value as string
          const variant = type === 'Normal' ? 'default' : 'destructive'
          return <Badge variant={variant}>{type}</Badge>
        },
      },
      {
        header: t('events.table.reason'),
        accessor: (event: Event) => event.reason || '',
        cell: (value: unknown) => (
          <div className="font-medium">{value as string}</div>
        ),
      },
      {
        header: t('events.table.message'),
        accessor: (event: Event) => event.message || '',
        cell: (value: unknown) => (
          <div className="text-sm max-w-sm truncate" title={value as string}>
            {value as string}
          </div>
        ),
      },
      {
        header: t('events.table.firstSeen'),
        accessor: (event: Event) =>
          event.firstTimestamp || event.eventTime || '',
        cell: (value: unknown) => {
          return (
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              {formatDate(value as string)}
            </span>
          )
        },
      },
    ],
    [t]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <IconLoader className="animate-spin mr-2" />
        Loading events...
      </div>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('events.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleTable
          data={events || []}
          columns={eventColumns}
          emptyMessage={t('common.emptyState.noResourcesFound', { resource: 'events' })}
        />
      </CardContent>
    </Card>
  )
}

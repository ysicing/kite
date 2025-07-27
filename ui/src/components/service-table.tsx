import { useMemo } from 'react'
import { IconLoader } from '@tabler/icons-react'
import { Service } from 'kubernetes-types/core/v1'
import { useTranslation } from 'react-i18next'

import { Column, SimpleTable } from './simple-table'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

export function ServiceTable(props: {
  services?: Service[]
  isLoading?: boolean
}) {
  const { t } = useTranslation()
  const { services, isLoading } = props

  // Service table columns
  const serviceColumns = useMemo(
    (): Column<Service>[] => [
      {
        header: t('common.name'),
        accessor: (service: Service) => service.metadata?.name || '',
        cell: (value: unknown) => (
          <div className="font-medium">{value as string}</div>
        ),
      },
      {
        header: t('common.type'),
        accessor: (service: Service) => service.spec?.type || 'ClusterIP',
        cell: (value: unknown) => value as string,
      },
      {
        header: 'Cluster IP',
        accessor: (service: Service) => service.spec?.clusterIP || '-',
        cell: (value: unknown) => value as string,
      },
      {
        header: t('common.port'),
        accessor: (service: Service) => service.spec?.ports || [],
        cell: (value: unknown) => {
          const ports = value as Array<{
            port?: number
            targetPort?: string | number
          }>
          return (
            ports.map((port) => `${port.port}:${port.targetPort}`).join(', ') ||
            '-'
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
        Loading services...
      </div>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('common.services')}</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleTable
          data={services || []}
          columns={serviceColumns}
          emptyMessage={t('common.emptyState.noResourcesFound', { resource: 'services' })}
        />
      </CardContent>
    </Card>
  )
}

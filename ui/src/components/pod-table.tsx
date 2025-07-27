import { useMemo, useState } from 'react'
import { IconLoader } from '@tabler/icons-react'
import { useQueries } from '@tanstack/react-query'
import { Pod } from 'kubernetes-types/core/v1'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { PodMetrics } from '@/types/api'
import { fetchResource } from '@/lib/api'
import { getPodStatus } from '@/lib/k8s'
import { formatDate, formatMemory, formatPodMetrics } from '@/lib/utils'

import { PodStatusIcon } from './pod-status-icon'
import { Column, SimpleTable } from './simple-table'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

export function PodTable(props: {
  pods?: Pod[]
  labelSelector?: string
  isLoading?: boolean
  hiddenNode?: boolean
}) {
  const { t } = useTranslation()
  const { pods, isLoading } = props

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  const paginatedPods = useMemo(() => {
    if (!pods) return []
    const start = (currentPage - 1) * pageSize
    return pods.slice(start, start + pageSize)
  }, [pods, currentPage])

  const metricsQueries = useQueries({
    queries: paginatedPods.map((pod) => ({
      queryKey: [
        'podmetrics',
        pod.metadata?.namespace || '',
        pod.metadata?.name || '',
      ],
      queryFn: async () => {
        return fetchResource<PodMetrics>(
          'podmetrics',
          pod.metadata?.name || '',
          pod.metadata?.namespace || ''
        )
      },
      enabled: !!pod.metadata?.name && !!pod.metadata?.namespace,
      staleTime: 5000,
      refetchInterval: 10000,
    })),
  })

  const metricsMap = useMemo(() => {
    const map = new Map<string, { cpu: number; memory: number }>()
    metricsQueries.forEach((query, idx) => {
      const pod = paginatedPods[idx]
      if (!pod) return
      const metric = query.data as PodMetrics
      if (!metric || !Array.isArray(metric.containers)) return
      map.set(pod.metadata?.name || '', formatPodMetrics(metric))
    })
    return map
  }, [metricsQueries, paginatedPods])

  // Pod table columns
  const podColumns = useMemo(
    (): Column<Pod>[] => [
      {
        header:  t('common.name'),
        accessor: (pod: Pod) => pod.metadata,
        cell: (value: unknown) => {
          const meta = value as Pod['metadata']
          return (
            <div className="font-medium text-blue-500 hover:underline">
              <Link to={`/pods/${meta!.namespace}/${meta!.name}`}>
                {meta!.name}
              </Link>
            </div>
          )
        },
      },
      {
        header:  t('common.ready'),
        accessor: (pod: Pod) => {
          const status = getPodStatus(pod)
          return `${status.readyContainers} / ${status.totalContainers}`
        },
        cell: (value: unknown) => value as string,
      },
      {
        header: t('common.restart'),
        accessor: (pod: Pod) => {
          const status = getPodStatus(pod)
          return status.restartString || '0'
        },
        cell: (value: unknown) => {
          return (
            <span className="text-muted-foreground text-sm">
              {value as number}
            </span>
          )
        },
      },
      {
        header: t('common.status'),
        accessor: (pod: Pod) => pod,
        cell: (value: unknown) => {
          const status = getPodStatus(value as Pod)
          return (
            <Badge variant="outline" className="text-muted-foreground px-1.5">
              <PodStatusIcon status={status.reason} />
              {status.reason}
            </Badge>
          )
        },
      },
      {
        header: 'CPU',
        accessor: (pod: Pod) => {
          const metrics = metricsMap.get(pod.metadata?.name || '')
          return metrics?.cpu || 0
        },
        cell: (value: unknown) => {
          const cpuValue = value as number
          if (cpuValue === 0)
            return <span className="text-muted-foreground">-</span>
          return (
            <span className="text-sm text-muted-foreground">
              {(cpuValue * 1000).toFixed(0)}m
            </span>
          )
        },
      },
      {
        header: 'Memory',
        accessor: (pod: Pod) => {
          const metrics = metricsMap.get(pod.metadata?.name || '')
          return metrics?.memory || 0
        },
        cell: (value: unknown) => {
          const memoryValue = value as number
          return (
            <span className="text-muted-foreground text-sm">
              {formatMemory(memoryValue)}
            </span>
          )
        },
      },
      {
        header: 'IP',
        accessor: (pod: Pod) => pod.status?.podIP || '-',
        cell: (value: unknown) => value as string,
      },
      ...(props.hiddenNode
        ? []
        : [
            {
              header: t('nav.nodes'),
              accessor: (pod: Pod) => pod.spec?.nodeName || '-',
              cell: (value: unknown) => (
                <Link
                  to={`/nodes/${value}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {value as string}
                </Link>
              ),
            },
          ]),
      {
        header: t('common.created'),
        accessor: (pod: Pod) => pod.metadata?.creationTimestamp || '',
        cell: (value: unknown) => {
          return (
            <span className="text-muted-foreground text-sm">
              {formatDate(value as string, true)}
            </span>
          )
        },
      },
    ],
    [metricsMap, props.hiddenNode, t]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <IconLoader className="animate-spin mr-2" />
        {t('common.loading')}...
      </div>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pods</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleTable
          data={pods || []}
          columns={podColumns}
          emptyMessage={t('common.emptyState.noResourcesFound', { resource: 'pods' })}
          pagination={{
            enabled: true,
            pageSize,
            showPageInfo: true,
            currentPage,
            onPageChange: setCurrentPage,
          }}
        />
      </CardContent>
    </Card>
  )
}

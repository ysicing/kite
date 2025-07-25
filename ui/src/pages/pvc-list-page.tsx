import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { PersistentVolumeClaim } from 'kubernetes-types/core/v1'
import { Link } from 'react-router-dom'

import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'
import { useTranslation } from 'react-i18next'
import { useResources } from '@/lib/api'

// Component to display pods that mount a specific PVC
const MountedPods = ({
  pvcName,
  namespace
}: {
  pvcName: string;
  namespace: string
}) => {
  const { data: pods = [] } = useResources('pods', namespace, {
    staleTime: 10000,
  })

  // Find pods that mount this PVC
  const mountedPods = useMemo(() => {
    return pods.filter(pod => {
      if (!pod.spec?.volumes) return false
      return pod.spec.volumes.some(volume =>
        volume.persistentVolumeClaim?.claimName === pvcName
      )
    })
  }, [pods, pvcName])

  if (mountedPods.length === 0) {
    return <span className="text-muted-foreground">-</span>
  }

  if (mountedPods.length === 1) {
    const pod = mountedPods[0]
    return (
      <Link
        to={`/pods/${namespace}/${pod.metadata!.name}`}
        className="text-blue-500 hover:underline text-sm"
      >
        {pod.metadata!.name}
      </Link>
    )
  }

  // Multiple pods - show count with link to all pods
  return (
    <div className="flex items-center space-x-1">
      <Link
        to={`/pods/${namespace}?labelSelector=volume-name=${pvcName}`}
        className="text-blue-500 hover:underline text-sm"
      >
        {mountedPods.length} pods
      </Link>
    </div>
  )
}

export function PVCListPage() {
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<PersistentVolumeClaim>()
  const { t } = useTranslation()
  // Define columns for the pvc table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/persistentvolumeclaims/${row.original.metadata!.namespace}/${
                row.original.metadata!.name
              }`}
            >
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor('status.phase', {
        header: t('common.status'),
        cell: ({ getValue }) => {
          const phase = getValue() || 'Unknown'
          let variant: 'default' | 'destructive' | 'secondary' = 'secondary'

          switch (phase) {
            case 'Bound':
              variant = 'default'
              break
            case 'Lost':
              variant = 'destructive'
              break
            case 'Pending':
              variant = 'secondary'
              break
          }

          return <Badge variant={variant}>{phase}</Badge>
        },
      }),
      columnHelper.accessor('spec.volumeName', {
        header: t('common.volumes'),
        cell: ({ getValue }) => getValue() || '-',
      }),
      columnHelper.accessor('spec.storageClassName', {
        header: t('nav.storageClasses'),
        cell: ({ getValue }) => {
          const storageClassName = getValue()
          if (!storageClassName) return '-'
          
          return (
            <Link
              to={`/storageclasses/_all/${storageClassName}`}
              className="text-blue-500 hover:underline"
            >
              {storageClassName}
            </Link>
          )
        },
      }),
      columnHelper.accessor('spec.resources.requests.storage', {
        header: t('common.capacity'),
        cell: ({ getValue }) => getValue() || '-',
      }),
      columnHelper.display({
        id: 'mountedPods',
        header: t('common.pods'),
        cell: ({ row }) => {
          const pvc = row.original
          if (pvc.status?.phase !== 'Bound') {
            return <span className="text-muted-foreground">-</span>
          }
          
          return (
            <MountedPods
              pvcName={pvc.metadata!.name!}
              namespace={pvc.metadata!.namespace!}
            />
          )
        },
      }),
      columnHelper.accessor('spec.accessModes', {
        header: t('common.accessModes'),
        cell: ({ getValue }) => {
          const modes = getValue() || []
          return modes.join(', ') || '-'
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
    [columnHelper]
  )

  // Custom filter for pvc search
  const pvcSearchFilter = useCallback(
    (pvc: PersistentVolumeClaim, query: string) => {
      return (
        pvc.metadata!.name!.toLowerCase().includes(query) ||
        (pvc.metadata!.namespace?.toLowerCase() || '').includes(query) ||
        (pvc.spec!.volumeName?.toLowerCase() || '').includes(query) ||
        (pvc.spec!.storageClassName?.toLowerCase() || '').includes(query) ||
        (pvc.status!.phase?.toLowerCase() || '').includes(query)
      )
    },
    []
  )

  return (
    <ResourceTable
      resourceName="PersistentVolumeClaims"
      columns={columns}
      searchQueryFilter={pvcSearchFilter}
    />
  )
}

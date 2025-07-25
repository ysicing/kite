import { useCallback, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { PersistentVolume } from 'kubernetes-types/core/v1'
import { Link } from 'react-router-dom'

import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResourceTable } from '@/components/resource-table'
import { useTranslation } from 'react-i18next'
import { useResources } from '@/lib/api'

// Component to display PVC that is bound to a specific PV
const BoundPVC = ({
  pvName
}: {
  pvName: string
}) => {
  const { data: pvcs = [] } = useResources('persistentvolumeclaims', '_all', {
    staleTime: 10000,
  })

  // Find PVC that is bound to this PV
  const boundPVC = useMemo(() => {
    return pvcs.find(pvc =>
      pvc.spec?.volumeName === pvName && pvc.status?.phase === 'Bound'
    )
  }, [pvcs, pvName])

  if (!boundPVC) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <Link
      to={`/persistentvolumeclaims/${boundPVC.metadata!.namespace}/${boundPVC.metadata!.name}`}
      className="text-blue-500 hover:underline text-sm"
    >
      {boundPVC.metadata!.namespace}/{boundPVC.metadata!.name}
    </Link>
  )
}

export function PVListPage() {
  // Define column helper outside of any hooks
  const columnHelper = createColumnHelper<PersistentVolume>()
  const { t } = useTranslation()
  
  // Define columns for the pv table
  const columns = useMemo(
    () => [
      columnHelper.accessor('metadata.name', {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="font-medium text-blue-500 hover:underline">
            <Link
              to={`/persistentvolumes/_all/${row.original.metadata!.name}`}
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
            case 'Available':
              variant = 'secondary'
              break
            case 'Released':
              variant = 'destructive'
              break
            case 'Failed':
              variant = 'destructive'
              break
            default:
              variant = 'secondary'
          }

          return <Badge variant={variant}>{phase}</Badge>
        },
      }),
      columnHelper.accessor('spec.claimRef', {
        header: t('common.associatedPVC'),
        cell: ({ row }) => {
          const pv = row.original
          if (pv.status?.phase !== 'Bound' || !pv.spec?.claimRef) {
            return <span className="text-muted-foreground">-</span>
          }
          
          return (
            <BoundPVC
              pvName={pv.metadata!.name!}
            />
          )
        },
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
      columnHelper.accessor('spec.capacity.storage', {
        header: t('common.capacity'),
        cell: ({ getValue }) => getValue() || '-',
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

  // Custom filter for pv search
  const pvSearchFilter = useCallback(
    (pv: PersistentVolume, query: string) => {
      return (
        pv.metadata!.name!.toLowerCase().includes(query) ||
        (pv.spec!.storageClassName?.toLowerCase() || '').includes(query) ||
        (pv.status!.phase?.toLowerCase() || '').includes(query) ||
        (pv.spec!.claimRef?.name?.toLowerCase() || '').includes(query) ||
        (pv.spec!.claimRef?.namespace?.toLowerCase() || '').includes(query)
      )
    },
    []
  )

  return (
    <ResourceTable
      resourceName="PersistentVolumes"
      columns={columns}
      clusterScope={true}
      searchQueryFilter={pvSearchFilter}
    />
  )
}

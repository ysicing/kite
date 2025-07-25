import { useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Loader2, Database, HardDrive } from 'lucide-react'

import { StorageClassWithInfo } from '@/types/api'
import { formatDate } from '@/lib/utils'
import { ResourceTable } from '@/components/resource-table'
import { apiClient } from '@/lib/api-client'
import { PersistentVolumeClaim } from 'kubernetes-types/core/v1'

interface StorageClassDetailProps {
  storageClass: StorageClassWithInfo
}

function StorageClassInfo({ storageClass }: StorageClassDetailProps) {
  const { t } = useTranslation()

  const parameters = storageClass.parameters || {}

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('common.basicInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('common.name')}
              </label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm">{storageClass.metadata?.name}</span>
                {storageClass.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    {t('common.default')}
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('common.provisioner')}
              </label>
              <p className="text-sm mt-1">{storageClass.provisioner}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('common.reclaimPolicy')}
              </label>
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">
                  {storageClass.reclaimPolicy || 'Delete'}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('common.volumeBindingMode')}
              </label>
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">
                  {storageClass.volumeBindingMode || 'Immediate'}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('common.allowVolumeExpansion')}
              </label>
              <div className="mt-1">
                <Badge variant={storageClass.allowVolumeExpansion ? 'default' : 'secondary'} className="text-xs">
                  {storageClass.allowVolumeExpansion ? t('common.yes') : t('common.no')}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('common.associatedPVC')}
              </label>
              <div className="mt-1">
                <Badge variant="default" className="text-xs">
                  {storageClass.associatedPVC}
                </Badge>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {t('common.created')}
            </label>
            <p className="text-sm mt-1">
              {formatDate(storageClass.metadata?.creationTimestamp || '')}
            </p>
          </div>

          {Object.keys(parameters).length > 0 && (
            <>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('common.parameters')}
                </label>
                <div className="mt-2 space-y-2">
                  {Object.entries(parameters).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="text-sm font-mono">{key}</span>
                      <span className="text-sm text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RelatedPVCs({ storageClassName }: { storageClassName: string }) {
  const { t } = useTranslation()
  const columnHelper = createColumnHelper<PersistentVolumeClaim>()

  const { data: pvcList, isLoading, error } = useQuery({
    queryKey: ['storageclasses', storageClassName, 'pvcs'],
    queryFn: async (): Promise<{ items: PersistentVolumeClaim[] }> => {
      return await apiClient.get<{ items: PersistentVolumeClaim[] }>(`/storageclasses/_all/${storageClassName}/pvcs`)
    },
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.metadata?.name, {
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="text-center">
            <Link
              to={`/persistentvolumeclaims/${row.original.metadata!.namespace}/${row.original.metadata!.name}`}
              className="font-medium text-blue-500 hover:underline"
            >
              {row.original.metadata!.name}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.metadata?.namespace, {
        header: t('common.namespace'),
        cell: ({ getValue }) => (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-xs">
              {getValue()}
            </Badge>
          </div>
        ),
      }),
      columnHelper.accessor('status.phase', {
        header: t('common.status'),
        cell: ({ getValue }) => {
          const phase = getValue()
          let variant: "default" | "secondary" | "destructive" | "outline" = "outline"
          
          switch (phase) {
            case 'Bound':
              variant = "default"
              break
            case 'Pending':
              variant = "secondary"
              break
            case 'Lost':
              variant = "destructive"
              break
            default:
              variant = "outline"
          }
          
          return (
            <div className="flex justify-center">
              <Badge variant={variant} className="text-xs">
                {phase || 'Unknown'}
              </Badge>
            </div>
          )
        },
      }),
      columnHelper.accessor((row) => row.spec?.resources?.requests?.storage, {
        header: t('common.capacity'),
        cell: ({ getValue }) => (
          <div className="flex items-center justify-center gap-1">
            <HardDrive className="h-3 w-3" />
            <span className="text-sm">{getValue() || '-'}</span>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.spec?.accessModes, {
        header: t('common.accessModes'),
        cell: ({ getValue }) => {
          const modes = getValue() || []
          return (
            <div className="flex flex-wrap justify-center gap-1">
              {modes.map((mode, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {mode.replace('ReadWrite', 'RW').replace('ReadOnly', 'RO')}
                </Badge>
              ))}
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

  const filter = useCallback((resource: PersistentVolumeClaim, query: string) => {
    const name = resource.metadata?.name?.toLowerCase() || ''
    const namespace = resource.metadata?.namespace?.toLowerCase() || ''
    const q = query.toLowerCase()
    return name.includes(q) || namespace.includes(q)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">{t('common.loading')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">{t('common.failedToLoad')}</p>
      </div>
    )
  }

  if (!pvcList?.items?.length) {
    return (
      <div className="text-center p-8">
        <HardDrive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t('common.noPVCsFound')}</p>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          {t('common.associatedPVC')} ({pvcList.items.length})
        </CardTitle>
        <CardDescription>
          {t('common.pvcUsingThisStorageClass')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResourceTable
          resourceName="persistentvolumeclaims"
          data={pvcList.items}
          columns={columns}
          clusterScope={true}
          searchQueryFilter={filter}
          hideHeader={true}
        />
      </CardContent>
    </Card>
  )
}

export function StorageClassDetailPage() {
  const { name } = useParams<{ name: string }>()
  const { t } = useTranslation()

  const { data: storageClass, isLoading, error } = useQuery({
    queryKey: ['storageclasses', name],
    queryFn: async (): Promise<StorageClassWithInfo> => {
      return await apiClient.get<StorageClassWithInfo>(`/storageclasses/_all/${name}`)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">{t('common.loading')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">{t('common.failedToLoad')}</p>
      </div>
    )
  }

  if (!storageClass) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">{t('common.storageClassNotFound')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{storageClass.metadata?.name}</h1>
        {storageClass.isDefault && (
          <Badge variant="secondary">
            {t('common.default')}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('common.overview')}</TabsTrigger>
          <TabsTrigger value="pvcs">
            {t('common.associatedPVC')} ({storageClass.associatedPVC})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <StorageClassInfo storageClass={storageClass} />
        </TabsContent>

        <TabsContent value="pvcs">
          <RelatedPVCs storageClassName={storageClass.metadata?.name || ''} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

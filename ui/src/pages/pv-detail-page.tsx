import { useEffect, useState } from 'react'
import { IconLoader, IconRefresh, IconTrash } from '@tabler/icons-react'
import * as yaml from 'js-yaml'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { deleteResource, updateResource, useResource, useResources } from '@/lib/api'
import { getOwnerInfo } from '@/lib/k8s'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { EventTable } from '@/components/event-table'
import { LabelsAnno } from '@/components/lables-anno'
import { RelatedResourcesTable } from '@/components/related-resource-table'
import { YamlEditor } from '@/components/yaml-editor'
import { PersistentVolume } from 'kubernetes-types/core/v1'
import { Badge } from '@/components/ui/badge'

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
  const boundPVC = pvcs.find(pvc =>
    pvc.spec?.volumeName === pvName && pvc.status?.phase === 'Bound'
  )

  if (!boundPVC) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <Link
      to={`/persistentvolumeclaims/${boundPVC.metadata!.namespace}/${boundPVC.metadata!.name}`}
      className="text-blue-500 hover:underline"
    >
      {boundPVC.metadata!.namespace}/{boundPVC.metadata!.name}
    </Link>
  )
}

export function PVDetailPage(props: {
  name: string
}) {
  const { t } = useTranslation()
  const { name } = props
  const [yamlContent, setYamlContent] = useState('')
  const [isSavingYaml, setIsSavingYaml] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const navigate = useNavigate()

  const {
    data,
    isLoading,
    isError,
    error,
    refetch: handleRefresh,
  } = useResource('persistentvolumes', name, undefined)

  useEffect(() => {
    if (data) {
      setYamlContent(yaml.dump(data, { indent: 2 }))
    }
  }, [data])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('persistentvolumes', name, undefined)
      toast.success(t('common.resourceDeleted', { resource: 'PersistentVolume' }))

      // Navigate back to the persistentvolumes list page
      navigate(`/persistentvolumes`)
    } catch (error) {
      toast.error(
        `${t('common.deleteResourceError', { resource: 'PersistentVolume' })}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSaveYaml = async (content: PersistentVolume) => {
    setIsSavingYaml(true)
    try {
      await updateResource('persistentvolumes', name, undefined, content)
      toast.success(t('common.yamlSaved'))
      // Refresh data after successful save
      await handleRefresh()
    } catch (error) {
      toast.error(
        `${t('common.saveYamlError')}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
    } finally {
      setIsSavingYaml(false)
    }
  }

  const handleYamlChange = (content: string) => {
    setYamlContent(content)
  }

  const handleManualRefresh = async () => {
    // Increment refresh key to force YamlEditor re-render
    setRefreshKey((prev) => prev + 1)
    await handleRefresh()
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <IconLoader className="animate-spin" />
              <span>{t('common.loadingResourceDetails', { resource: 'PersistentVolume' })}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              {t('common.errorLoadingResource', { resource: 'PersistentVolume' })}:{' '}
              {error?.message || t('common.resourceNotFound', { resource: 'PersistentVolume' })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pv = data as PersistentVolume

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{name}</h1>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={isLoading}
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
          >
            <IconRefresh className="w-4 h-4" />
            {t('common.refresh')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isDeleting}
          >
            <IconTrash className="w-4 h-4" />
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <ResponsiveTabs
        tabs={[
          {
            value: 'overview',
            label: t('common.overview'),
            content: (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t('common.resourceInformation', { resource: 'PersistentVolume' })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.name')}
                        </Label>
                        <p className="text-sm font-medium">{pv.metadata?.name}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.status')}
                        </Label>
                        <div className="text-sm">
                          {pv.status?.phase ? (
                            <Badge
                              variant={
                                pv.status.phase === 'Bound' ? 'default' :
                                pv.status.phase === 'Failed' || pv.status.phase === 'Released' ? 'destructive' :
                                'secondary'
                              }
                            >
                              {pv.status.phase}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.associatedPVC')}
                        </Label>
                        <div className="text-sm">
                          {pv.status?.phase === 'Bound' ? (
                            <BoundPVC pvName={name} />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('nav.storageClasses')}
                        </Label>
                        <div className="text-sm">
                          {pv.spec?.storageClassName ? (
                            <Link
                              to={`/storageclasses/_all/${pv.spec.storageClassName}`}
                              className="text-blue-500 hover:underline"
                            >
                              {pv.spec.storageClassName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.capacity')}
                        </Label>
                        <p className="text-sm">
                          {pv.spec?.capacity?.storage || '-'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.accessModes')}
                        </Label>
                        <p className="text-sm">
                          {pv.spec?.accessModes?.join(', ') || '-'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.created')}
                        </Label>
                        <p className="text-sm">
                          {formatDate(pv.metadata?.creationTimestamp || '')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.uid')}
                        </Label>
                        <p className="text-sm">
                          {pv.metadata?.uid || 'N/A'}
                        </p>
                      </div>
                      {getOwnerInfo(pv.metadata) && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t('common.owner')}
                          </Label>
                          <p className="text-sm">
                            {(() => {
                              const ownerInfo = getOwnerInfo(pv.metadata)
                              if (!ownerInfo) {
                                return t('common.noOwner')
                              }
                              return (
                                <Link
                                  to={ownerInfo.path}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {ownerInfo.kind}/{ownerInfo.name}
                                </Link>
                              )
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                    <LabelsAnno
                      labels={pv.metadata?.labels || {}}
                      annotations={pv.metadata?.annotations || {}}
                    />
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            value: 'yaml',
            label: 'YAML',
            content: (
              <div className="space-y-4">
                <YamlEditor<'persistentvolumes'>
                  key={refreshKey}
                  value={yamlContent}
                  title={t('common.yamlConfiguration')}
                  onSave={handleSaveYaml}
                  onChange={handleYamlChange}
                  isSaving={isSavingYaml}
                />
              </div>
            ),
          },
          {
            value: 'Related',
            label: t('common.related'),
            content: (
              <RelatedResourcesTable
                resource="persistentvolumes"
                name={name}
              />
            ),
          },
          {
            value: 'events',
            label: t('common.events'),
            content: (
              <EventTable
                resource="persistentvolumes"
                name={name}
              />
            ),
          },
        ]}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        resourceName={name}
        resourceType="persistentvolumes"
        isDeleting={isDeleting}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { IconLoader, IconRefresh, IconTrash } from '@tabler/icons-react'
import * as yaml from 'js-yaml'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ResourceType, ResourceTypeMap } from '@/types/api'
import { deleteResource, updateResource, useResource } from '@/lib/api'
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

export function SimpleResourceDetail<T extends ResourceType>(props: {
  resourceType: T
  name: string
  namespace?: string
}) {
  const { t } = useTranslation()
  const { namespace, name, resourceType } = props
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
  } = useResource(resourceType, name, namespace)

  useEffect(() => {
    if (data) {
      setYamlContent(yaml.dump(data, { indent: 2 }))
    }
  }, [data])

  const handleDelete = async () => {
    // Check if the resource is protected
    if (resourceType === 'secrets' && data) {
      // Type assert to Secret to check the type
      const secret = data as unknown as { type?: string };
      if (secret.type === 'helm.sh/release.v1') {
        toast.error(t('secrets.cannotDeleteHelmRelease'));
        setIsDeleteDialogOpen(false);
        return;
      }
    }
    
    if (resourceType === 'configmaps' && data) {
      if (data.metadata?.name === 'kube-root-ca.crt') {
        toast.error(t('configmaps.cannotDeleteKubeRootCA'));
        setIsDeleteDialogOpen(false);
        return;
      }
    }
    
    setIsDeleting(true)
    try {
      await deleteResource(resourceType, name, namespace)
      toast.success(t('common.resourceDeleted', { resource: resourceType.slice(0, -1) }))

      // Navigate back to the deployments list page
      navigate(`/${resourceType}`)
    } catch (error) {
      toast.error(
        `${t('common.deleteResourceError', { resource: resourceType.slice(0, -1) })}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSaveYaml = async (content: ResourceTypeMap[T]) => {
    setIsSavingYaml(true)
    try {
      await updateResource(resourceType, name, namespace, content)
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
              <span>{t('common.loadingResourceDetails', { resource: resourceType.slice(0, -1) })}</span>
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
              {t('common.errorLoadingResource', { resource: resourceType.slice(0, -1) })}:{' '}
              {error?.message || t('common.resourceNotFound', { resource: resourceType.slice(0, -1) })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{name}</h1>
          {namespace && (
            <p className="text-muted-foreground">
              Namespace: <span className="font-medium">{namespace}</span>
            </p>
          )}
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
          {!(resourceType === 'secrets' && data && (data as unknown as { type?: string }).type === 'helm.sh/release.v1') &&
           !(resourceType === 'configmaps' && data && data.metadata?.name === 'kube-root-ca.crt') && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              <IconTrash className="w-4 h-4" />
              {t('common.delete')}
            </Button>
          )}
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
                    <CardTitle className="capitalize">
                      {t('common.resourceInformation', { resource: resourceType.slice(0, -1) })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.created')}
                        </Label>
                        <p className="text-sm">
                          {formatDate(data.metadata?.creationTimestamp || '')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.uid')}
                        </Label>
                        <p className="text-sm ">
                          {data.metadata?.uid || 'N/A'}
                        </p>
                      </div>
                      {getOwnerInfo(data.metadata) && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t('common.owner')}
                          </Label>
                          <p className="text-sm">
                            {(() => {
                              const ownerInfo = getOwnerInfo(data.metadata)
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
                      labels={data.metadata?.labels || {}}
                      annotations={data.metadata?.annotations || {}}
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
                <YamlEditor
                  key={refreshKey}
                  value={yamlContent}
                  title={t('common.yamlConfiguration')}
                  onSave={handleSaveYaml}
                  onChange={handleYamlChange}
                  isSaving={isSavingYaml}
                  readOnly={(resourceType === 'secrets' && data && (data as unknown as { type?: string }).type === 'helm.sh/release.v1') ||
                            (resourceType === 'configmaps' && data && data.metadata?.name === 'kube-root-ca.crt')}
                />
              </div>
            ),
          },
          {
            value: 'Related',
            label: t('common.related'),
            content: (
              <RelatedResourcesTable
                resource={resourceType}
                name={name}
                namespace={namespace}
              />
            ),
          },
          {
            value: 'events',
            label: t('common.events'),
            content: (
              <EventTable
                resource={resourceType}
                namespace={namespace}
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
        resourceType={resourceType}
        namespace={namespace}
        isDeleting={isDeleting}
      />
    </div>
  )
}

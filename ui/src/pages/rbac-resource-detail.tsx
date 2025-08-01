import { useEffect, useState } from 'react'
import { IconLoader, IconRefresh, IconTrash } from '@tabler/icons-react'
import * as yaml from 'js-yaml'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ResourceTypeMap } from '@/types/api'
import { deleteResource, updateResource, useResource } from '@/lib/api'
import { getOwnerInfo } from '@/lib/k8s'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { LabelsAnno } from '@/components/lables-anno'
import { RBACRelatedResources } from '@/components/rbac-related-resources'
import { RBACRulesDisplay } from '@/components/rbac-rules-display'
import { YamlEditor } from '@/components/yaml-editor'

type RBACResourceType = 'clusterroles' | 'clusterrolebindings' | 'roles' | 'rolebindings'

export function RBACResourceDetail<T extends RBACResourceType>(props: {
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
    try {
      setIsDeleting(true)
      await deleteResource(resourceType, name, namespace)
      toast.success(t('common.deleteSuccess', { resource: resourceType.slice(0, -1) }))
      
      // Navigate back to resource list
      if (namespace) {
        navigate(`/${resourceType}/${namespace}`)
      } else {
        navigate(`/${resourceType}`)
      }
    } catch (error: unknown) {
      console.error('Failed to delete resource:', error)
      toast.error(
        t('common.deleteError', { 
          resource: resourceType.slice(0, -1),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      )
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSaveYaml = async (newResource: ResourceTypeMap[T]) => {
    try {
      setIsSavingYaml(true)
      await updateResource(resourceType, name, namespace, newResource)
      toast.success(t('common.saveSuccess'))
      setRefreshKey(prev => prev + 1)
      handleRefresh()
    } catch (error: unknown) {
      console.error('Failed to save YAML:', error)
      toast.error(
        t('common.saveError', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      )
    } finally {
      setIsSavingYaml(false)
    }
  }

  const handleYamlChange = (content: string) => {
    setYamlContent(content)
  }

  const handleManualRefresh = () => {
    handleRefresh()
    setRefreshKey(prev => prev + 1)
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
              {t('common.namespace')}: <span className="font-medium">{namespace}</span>
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
                          <p className="text-sm ">
                            <Link
                              to={`/${getOwnerInfo(data.metadata)?.kind.toLowerCase()}s/${
                                namespace ? `${namespace}/` : ''
                              }${getOwnerInfo(data.metadata)?.name}`}
                              className="text-blue-500 hover:underline"
                            >
                              {getOwnerInfo(data.metadata)?.name}
                            </Link>
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

                {/* Show permission rules for roles and cluster roles */}
                {(resourceType === 'roles' || resourceType === 'clusterroles') && (
                  <RBACRulesDisplay 
                    resource={data as ResourceTypeMap['roles'] | ResourceTypeMap['clusterroles']}
                  />
                )}
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
                />
              </div>
            ),
          },
          {
            value: 'Related',
            label: t('common.related'),
            content: (
              // Use specialized RBAC related resources for all RBAC resource types
              <RBACRelatedResources
                resourceType={resourceType}
                name={name}
                namespace={namespace}
              />
            ),
          },
          // Note: RBAC resources typically don't have meaningful events, so we omit the events tab
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
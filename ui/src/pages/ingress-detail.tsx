import { useEffect, useState } from 'react'
import { IconLoader, IconRefresh, IconTrash } from '@tabler/icons-react'
import * as yaml from 'js-yaml'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { deleteResource, updateResource, useResource } from '@/lib/api'
import { ResourceTypeMap } from '@/types/api'
import { getOwnerInfo } from '@/lib/k8s'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { YamlEditor } from '@/components/yaml-editor'
import { IngressRulesTable } from '@/components/ingress-rules-table'

export function IngressDetail(props: {
  name: string
  namespace: string
}) {
  const { t } = useTranslation()
  const { namespace, name } = props
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
  } = useResource('ingresses', name, namespace)

  useEffect(() => {
    if (data) {
      setYamlContent(yaml.dump(data, { indent: 2 }))
    }
  }, [data])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('ingresses', name, namespace)
      toast.success(t('common.resourceDeleted', { resource: 'ingress' }))

      // Navigate back to the ingresses list page
      navigate(`/ingresses`)
    } catch (error) {
      toast.error(
        `${t('common.deleteResourceError', { resource: 'ingress' })}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSaveYaml = async (content: unknown) => {
    setIsSavingYaml(true)
    try {
      await updateResource('ingresses', name, namespace, content as ResourceTypeMap['ingresses'])
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
              <span>{t('common.loadingResourceDetails', { resource: 'ingress' })}</span>
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
              {t('common.errorLoadingResource', { resource: 'ingress' })}:{' '}
              {error?.message || t('common.resourceNotFound', { resource: 'ingress' })}
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
                      {t('common.resourceInformation', { resource: 'ingress' })}
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
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Ingress Class
                        </Label>
                        <p className="text-sm">
                          {data.spec?.ingressClassName || 'N/A'}
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
                    
                    {/* Annotations section */}
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {t('common.annotations')}
                      </Label>
                      <div className="mt-1">
                        {data.metadata?.annotations && Object.keys(data.metadata.annotations).length > 0 ? (
                          <div className="space-y-1">
                            {Object.entries(data.metadata.annotations)
                              .filter(([key]) => !key.startsWith('meta.helm.sh'))
                              .map(([key, value]) => (
                                <div key={key} className="flex items-start">
                                  <span className="font-medium text-sm mr-2">{key}:</span>
                                  <span className="text-sm break-all">{value}</span>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">-</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            value: 'rules',
            label: t('ingress.rules'),
            content: (
              <div className="space-y-4">
                <IngressRulesTable ingress={data} />
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
        ]}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        resourceName={name}
        resourceType="ingresses"
        namespace={namespace}
        isDeleting={isDeleting}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import {
  IconCircleCheckFilled,
  IconExclamationCircle,
  IconLoader,
  IconRefresh,
  IconReload,
  IconTrash,
} from '@tabler/icons-react'
import * as yaml from 'js-yaml'
import { Container } from 'kubernetes-types/core/v1'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import {
  deleteResource,
  updateResource,
  useResource,
  useResources,
} from '@/lib/api'
import { toSimpleContainer } from '@/lib/k8s'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { ContainerTable } from '@/components/container-table'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { EventTable } from '@/components/event-table'
import { LabelsAnno } from '@/components/lables-anno'
import { LogViewer } from '@/components/log-viewer'
import { PodMonitoring } from '@/components/pod-monitoring'
import { PodTable } from '@/components/pod-table'
import { RelatedResourcesTable } from '@/components/related-resource-table'
import { Terminal } from '@/components/terminal'
import { VolumeTable } from '@/components/volume-table'
import { YamlEditor } from '@/components/yaml-editor'
import { AdvancedDaemonSet } from '@/types/k8s'

export function AdvancedDaemonSetDetail(props: { namespace: string; name: string }) {
  const { t } = useTranslation()
  const { namespace, name } = props
  const [yamlContent, setYamlContent] = useState('')
  const [isSavingYaml, setIsSavingYaml] = useState(false)
  const [isRestartPopoverOpen, setIsRestartPopoverOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<number>(0)
  const navigate = useNavigate()

  // Fetch advanced daemonset data
  const {
    data: advancedDaemonSet,
    isLoading: isLoadingAdvancedDaemonSet,
    isError: isAdvancedDaemonSetError,
    error: advancedDaemonSetError,
    refetch: refetchAdvancedDaemonSet,
  } = useResource('advanceddaemonsets', name, namespace, {
    refreshInterval,
  })

  useEffect(() => {
    if (advancedDaemonSet) {
      setYamlContent(yaml.dump(advancedDaemonSet, { indent: 2 }))
    }
  }, [advancedDaemonSet])

  // Auto-reset refresh interval when advanceddaemonset reaches stable state
  useEffect(() => {
    if (advancedDaemonSet && refreshInterval > 0) {
      const { status } = advancedDaemonSet
      const readyReplicas = status?.numberReady || 0
      const desiredReplicas = status?.desiredNumberScheduled || 0
      const currentReplicas = status?.currentNumberScheduled || 0

      // Check if advanceddaemonset is in a stable state
      const isStable =
        readyReplicas === desiredReplicas && currentReplicas === desiredReplicas

      if (isStable) {
        setRefreshInterval(0)
      }
    }
  }, [advancedDaemonSet, refreshInterval])

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
    refetchAdvancedDaemonSet()
  }

  const labelSelector = advancedDaemonSet?.spec?.selector.matchLabels
    ? Object.entries(advancedDaemonSet.spec.selector.matchLabels)
        .map(([key, value]) => `${key}=${value}`)
        .join(',')
    : undefined

  const { data: relatedPods, isLoading: isLoadingPods } = useResources(
    'pods',
    namespace,
    {
      labelSelector,
      refreshInterval,
      disable: !advancedDaemonSet?.spec?.selector.matchLabels,
    }
  )

  const handleSaveYaml = async () => {
    setIsSavingYaml(true)
    try {
      const parsedYaml = yaml.load(yamlContent) as AdvancedDaemonSet
      await updateResource('advanceddaemonsets', name, namespace, parsedYaml)
      toast.success(t('openkruise.advanceddaemonsets.yamlSaveSuccess'))
      setRefreshInterval(1000) // Set a short refresh interval to see changes
      await refetchAdvancedDaemonSet()
    } catch (error) {
      console.error(t('openkruise.advanceddaemonsets.yamlSaveError'), error)
      toast.error(
        `${t('openkruise.advanceddaemonsets.yamlSaveError')}: ${
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

  const handleRestart = async () => {
    if (!advancedDaemonSet) return

    try {
      // Create a deep copy of the advanceddaemonset to avoid modifying the original
      const updatedAdvancedDaemonSet = {
        ...advancedDaemonSet,
      }

      // Ensure template metadata and annotations exist
      if (!updatedAdvancedDaemonSet.spec?.template?.metadata) {
        updatedAdvancedDaemonSet.spec!.template!.metadata = {}
      }
      if (!updatedAdvancedDaemonSet.spec!.template!.metadata!.annotations) {
        updatedAdvancedDaemonSet.spec!.template!.metadata!.annotations = {}
      }

      // Add restart annotation to trigger pod restart
      updatedAdvancedDaemonSet.spec!.template!.metadata!.annotations[
        'kite.kubernetes.io/restartedAt'
      ] = new Date().toISOString()

      await updateResource('advanceddaemonsets', name, namespace, updatedAdvancedDaemonSet)
      toast.success(t('openkruise.advanceddaemonsets.restartSuccess'))
      setIsRestartPopoverOpen(false)
      setRefreshInterval(1000)
    } catch (error) {
      console.error(t('openkruise.advanceddaemonsets.restartError'), error)
      toast.error(
        `${t('openkruise.advanceddaemonsets.restartError')}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('advanceddaemonsets', name, namespace)
      toast.success(t('openkruise.advanceddaemonsets.deleteSuccess'))
      navigate(`/advanceddaemonsets`)
    } catch (error) {
      toast.error(
        `${t('openkruise.advanceddaemonsets.deleteError')}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleContainerUpdate = async (updatedContainer: Container) => {
    try {
      // Create a deep copy of the advanceddaemonset to avoid modifying the original
      const updatedAdvancedDaemonSet = JSON.parse(
        JSON.stringify(advancedDaemonSet)
      ) as AdvancedDaemonSet

      // Update the specific container in the advanceddaemonset spec
      if (updatedAdvancedDaemonSet.spec?.template?.spec?.containers) {
        const containerIndex =
          updatedAdvancedDaemonSet.spec.template.spec.containers.findIndex(
            (c) => c.name === updatedContainer.name
          )
        if (containerIndex !== -1) {
          // Ensure image is defined before assignment
          const containerToUpdate = {
            ...updatedContainer,
            image: updatedContainer.image || '', // Provide fallback empty string
          }
          updatedAdvancedDaemonSet.spec.template.spec.containers[containerIndex] =
            containerToUpdate as any // Use type assertion to bypass strict typing
          await updateResource('advanceddaemonsets', name, namespace, updatedAdvancedDaemonSet)
          toast.success(t('openkruise.advanceddaemonsets.containerUpdateSuccess'))
          setRefreshInterval(1000) // Set a short refresh interval to see changes
        }
      }
    } catch (error) {
      console.error(t('openkruise.advanceddaemonsets.containerUpdateError'), error)
      toast.error(
        `${t('openkruise.advanceddaemonsets.containerUpdateError')}: ${
          error instanceof Error ? error.message : t('common.unknownError')
        }`
      )
    }
  }

  if (isLoadingAdvancedDaemonSet) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <IconLoader className="animate-spin" />
              <span>{t('openkruise.advanceddaemonsets.loadingDetails')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isAdvancedDaemonSetError || !advancedDaemonSet) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <IconExclamationCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
              {t('openkruise.advanceddaemonsets.errorLoading')}{' '}
              {advancedDaemonSetError?.message || t('openkruise.advanceddaemonsets.notFound')}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { metadata, spec, status } = advancedDaemonSet
  const readyReplicas = status?.numberReady || 0
  const desiredReplicas = status?.desiredNumberScheduled || 0
  const currentReplicas = status?.currentNumberScheduled || 0
  const availableReplicas = status?.numberAvailable || 0

  const isAvailable = availableReplicas > 0
  const isPending = currentReplicas < desiredReplicas

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{metadata?.name}</h1>
          <p className="text-muted-foreground">
            {t('common.namespace')}: <span className="font-medium">{namespace}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={isLoadingAdvancedDaemonSet}
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <IconRefresh className="w-4 h-4" />
            {t('openkruise.advanceddaemonsets.refresh')}
          </Button>
          <Popover
            open={isRestartPopoverOpen}
            onOpenChange={setIsRestartPopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <IconReload className="w-4 h-4" />
                {t('openkruise.advanceddaemonsets.restart')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">{t('openkruise.advanceddaemonsets.restartDialogTitle')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('openkruise.advanceddaemonsets.restartDialogDescription')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsRestartPopoverOpen(false)}
                    className="flex-1"
                  >
                    {t('openkruise.advanceddaemonsets.restartDialogCancel')}
                  </Button>
                  <Button
                    onClick={() => {
                      handleRestart()
                      setIsRestartPopoverOpen(false)
                    }}
                    className="flex-1"
                  >
                    <IconReload className="w-4 h-4 mr-2" />
                    {t('openkruise.advanceddaemonsets.restart')}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <IconTrash className="w-4 h-4" />
            {t('openkruise.advanceddaemonsets.delete')}
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
                {/* Status Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('common.statusOverview')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {isPending ? (
                            <IconExclamationCircle className="w-4 h-4 fill-gray-500" />
                          ) : isAvailable ? (
                            <IconCircleCheckFilled className="w-4 h-4 fill-green-500" />
                          ) : (
                            <IconLoader className="w-4 h-4 animate-spin fill-amber-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t('openkruise.advanceddaemonsets.status')}
                          </p>
                          <p className="text-sm font-medium">
                            {isPending
                              ? t('openkruise.advanceddaemonsets.statusPending')
                              : isAvailable
                                ? t('openkruise.advanceddaemonsets.statusAvailable')
                                : t('openkruise.advanceddaemonsets.statusInProgress')}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('common.readyReplicas')}
                        </p>
                        <p className="text-sm font-medium">
                          {readyReplicas} / {desiredReplicas}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('openkruise.advanceddaemonsets.currentScheduled')}
                        </p>
                        <p className="text-sm font-medium">{currentReplicas}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('openkruise.advanceddaemonsets.desiredScheduled')}
                        </p>
                        <p className="text-sm font-medium">{desiredReplicas}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* {t('openkruise.advanceddaemonsets.information')} */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('openkruise.advanceddaemonsets.information')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('openkruise.advanceddaemonsets.created')}
                        </Label>
                        <p className="text-sm">
                          {formatDate(metadata?.creationTimestamp || '', true)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('openkruise.advanceddaemonsets.strategy')}
                        </Label>
                        <p className="text-sm">
                          {spec?.updateStrategy?.type || 'RollingUpdate'}
                        </p>
                      </div>
                    </div>
                    <LabelsAnno
                      labels={metadata?.labels || {}}
                      annotations={metadata?.annotations || {}}
                    />
                  </CardContent>
                </Card>

                {/* Containers */}
                {spec?.template?.spec?.containers && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('openkruise.advanceddaemonsets.containers')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {spec.template.spec.containers.map(
                          (container, index) => (
                            <ContainerTable
                              key={index}
                              container={container}
                              onContainerUpdate={handleContainerUpdate}
                            />
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ),
          },
          {
            value: 'yaml',
            label: t('common.yaml'),
            content: (
              <div className="space-y-4">
                <YamlEditor
                  key={refreshKey}
                  value={yamlContent}
                  title={t('openkruise.advanceddaemonsets.configuration')}
                  onSave={handleSaveYaml}
                  onChange={handleYamlChange}
                  isSaving={isSavingYaml}
                />
              </div>
            ),
          },
          ...(relatedPods
            ? [
                {
                  value: 'pods',
                  label: (
                    <>
                      {t('common.pods')}{' '}
                      {relatedPods && (
                        <Badge variant="secondary">{relatedPods.length}</Badge>
                      )}
                    </>
                  ),
                  content: (
                    <PodTable
                      pods={relatedPods}
                      isLoading={isLoadingPods}
                      labelSelector={labelSelector}
                    />
                  ),
                },
                {
                  value: 'logs',
                  label: t('common.logs'),
                  content: (
                    <div className="space-y-6">
                      <LogViewer
                        namespace={namespace}
                        pods={relatedPods}
                        containers={
                          relatedPods?.[0]?.spec?.containers?.map(
                            (container) => ({
                              name: container.name,
                              image: container.image || '',
                            })
                          ) || []
                        }
                      />
                    </div>
                  ),
                },
                {
                  value: 'terminal',
                  label: t('common.terminal'),
                  content: (
                    <div className="space-y-6">
                      {relatedPods && relatedPods.length > 0 && (
                        <Terminal
                          namespace={namespace}
                          pods={relatedPods}
                          containers={
                            relatedPods[0].spec?.containers?.map(
                              (container) => ({
                                name: container.name,
                                image: container.image || '',
                              })
                            ) || []
                          }
                        />
                      )}
                    </div>
                  ),
                },
              ]
            : []),
          ...(spec?.template?.spec?.volumes
            ? [
                {
                  value: 'volumes',
                  label: (
                    <>
                      {t('common.volumes')}
                      {spec.template.spec.volumes && (
                        <Badge variant="secondary">
                          {spec.template.spec.volumes.length}
                        </Badge>
                      )}
                    </>
                  ),
                  content: (
                    <div className="space-y-6">
                      <VolumeTable
                        namespace={namespace}
                        volumes={spec.template.spec?.volumes}
                        containers={spec.template.spec?.containers}
                        isLoading={isLoadingAdvancedDaemonSet}
                      />
                    </div>
                  ),
                },
              ]
            : []),
          {
            value: 'Related',
            label: t('common.related'),
            content: (
              <RelatedResourcesTable
                resource={'advanceddaemonsets'}
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
                resource="advanceddaemonsets"
                name={name}
                namespace={namespace}
              />
            ),
          },
          {
            value: 'monitor',
            label: t('common.monitor'),
            content: (
              <PodMonitoring
                namespace={namespace}
                pods={relatedPods}
                containers={toSimpleContainer(relatedPods?.[0]?.spec?.initContainers, relatedPods?.[0]?.spec?.containers)}
                defaultQueryName={relatedPods?.[0]?.metadata?.generateName}
                labelSelector={labelSelector}
              />
            ),
          },
        ]}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        resourceName={metadata?.name || ''}
        resourceType={t('openkruise.advanceddaemonsets.title')}
      />
    </div>
  )
}

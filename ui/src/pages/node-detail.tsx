import { useEffect, useState } from 'react'
import {
  IconBan,
  IconCircleCheckFilled,
  IconDroplet,
  IconExclamationCircle,
  IconLoader,
  IconLock,
  IconRefresh,
  IconReload,
} from '@tabler/icons-react'
import * as yaml from 'js-yaml'
import { Node } from 'kubernetes-types/core/v1'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import {
  cordonNode,
  drainNode,
  taintNode,
  uncordonNode,
  untaintNode,
  updateResource,
  useResource,
  useResources,
} from '@/lib/api'
import { formatCPU, formatDate, formatMemory } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EventTable } from '@/components/event-table'
import { LabelsAnno } from '@/components/lables-anno'
import { NodeMonitoring } from '@/components/node-monitoring'
import { PodTable } from '@/components/pod-table'
import { Terminal } from '@/components/terminal'
import { YamlEditor } from '@/components/yaml-editor'

export function NodeDetail(props: { name: string }) {
  const { name } = props
  const { t } = useTranslation()

  // Function to translate condition messages
  const translateConditionMessage = (message: string) => {
    // Common condition messages mapping
    const messageMap: { [key: string]: string } = {
      'kubelet has sufficient memory available': 'nodes.conditionMessages.kubeletHasSufficientMemoryAvailable',
      'kubelet has no disk pressure': 'nodes.conditionMessages.kubeletHasNoDiskPressure', 
      'kubelet has sufficient PID available': 'nodes.conditionMessages.kubeletHasSufficientPIDAvailable',
      'kubelet is posting ready status': 'nodes.conditionMessages.kubeletIsPostingReadyStatus'
    }
    
    const translationKey = messageMap[message]
    return translationKey ? t(translationKey) : message
  }
  const [yamlContent, setYamlContent] = useState('')
  const [isSavingYaml, setIsSavingYaml] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Node operation states
  const [isDrainPopoverOpen, setIsDrainPopoverOpen] = useState(false)
  const [isCordonPopoverOpen, setIsCordonPopoverOpen] = useState(false)
  const [isTaintPopoverOpen, setIsTaintPopoverOpen] = useState(false)

  // Drain operation options
  const [drainOptions, setDrainOptions] = useState({
    force: false,
    gracePeriod: 30,
    deleteLocalData: false,
    ignoreDaemonsets: true,
  })

  // Taint operation data
  const [taintData, setTaintData] = useState({
    key: '',
    value: '',
    effect: 'NoSchedule' as 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute',
  })

  // Untaint key
  const [untaintKey, setUntaintKey] = useState('')

  const {
    data,
    isLoading,
    isError,
    error,
    refetch: handleRefresh,
  } = useResource('nodes', name)

  useEffect(() => {
    if (data) {
      setYamlContent(yaml.dump(data, { indent: 2 }))
    }
  }, [data])

  const {
    data: relatedPods,
    isLoading: isLoadingRelated,
    refetch: refetchRelated,
  } = useResources('pods', undefined, {
    fieldSelector: `spec.nodeName=${name}`,
  })

  const handleSaveYaml = async (content: Node) => {
    setIsSavingYaml(true)
    try {
      await updateResource('nodes', name, undefined, content)
      toast.success('YAML saved successfully')
    } catch (error) {
      console.error('Failed to save YAML:', error)
      toast.error(
        `Failed to save YAML: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    } finally {
      setIsSavingYaml(false)
    }
  }

  // Node operation handlers
  const handleDrain = async () => {
    try {
      await drainNode(name, drainOptions)
      toast.success(t('nodes.drainSuccess', { name }))
      setIsDrainPopoverOpen(false)
      handleRefresh()
    } catch (error) {
      console.error('Failed to drain node:', error)
      toast.error(
        t('nodes.drainError', { 
          error: error instanceof Error ? error.message : t('nodes.unknownError')
        })
      )
    }
  }

  const handleCordon = async () => {
    try {
      await cordonNode(name)
      toast.success(t('nodes.cordonSuccess', { name }))
      setIsCordonPopoverOpen(false)
      handleRefresh()
    } catch (error) {
      console.error('Failed to cordon node:', error)
      toast.error(
        t('nodes.cordonError', { 
          error: error instanceof Error ? error.message : t('nodes.unknownError')
        })
      )
    }
  }

  const handleUncordon = async () => {
    try {
      await uncordonNode(name)
      toast.success(t('nodes.uncordonSuccess', { name }))
      setIsCordonPopoverOpen(false)
      handleRefresh()
    } catch (error) {
      console.error('Failed to uncordon node:', error)
      toast.error(
        t('nodes.uncordonError', { 
          error: error instanceof Error ? error.message : t('nodes.unknownError')
        })
      )
    }
  }

  const handleTaint = async () => {
    if (!taintData.key.trim()) {
      toast.error(t('nodes.taintKeyRequired'))
      return
    }

    try {
      await taintNode(name, taintData)
      toast.success(t('nodes.taintSuccess', { name }))
      setIsTaintPopoverOpen(false)
      setTaintData({ key: '', value: '', effect: 'NoSchedule' })
      handleRefresh()
    } catch (error) {
      console.error('Failed to taint node:', error)
      toast.error(
        t('nodes.taintError', { 
          error: error instanceof Error ? error.message : t('nodes.unknownError')
        })
      )
    }
  }

  const handleUntaint = async (key?: string) => {
    const taintKey = key || untaintKey
    if (!taintKey.trim()) {
      toast.error(t('nodes.taintKeyRequired'))
      return
    }

    try {
      await untaintNode(name, taintKey)
      toast.success(t('nodes.untaintSuccess', { name }))
      if (!key) setUntaintKey('')
      handleRefresh()
    } catch (error) {
      console.error('Failed to remove taint:', error)
      toast.error(
        t('nodes.untaintError', { 
          error: error instanceof Error ? error.message : t('nodes.unknownError')
        })
      )
    }
  }

  const handleYamlChange = (content: string) => {
    setYamlContent(content)
  }

  const handleManualRefresh = async () => {
    setRefreshKey((prev) => prev + 1)
    await handleRefresh()
    await refetchRelated()
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <IconLoader className="animate-spin" />
              <span>{t('nodes.loadingDetails')}</span>
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
              {t('common.error')}: {error?.message || t('nodes.noNodesFound')}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

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

          {/* Drain Node Popover */}
          <Popover
            open={isDrainPopoverOpen}
            onOpenChange={setIsDrainPopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <IconDroplet className="w-4 h-4" />
                {t('nodes.drain')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">{t('nodes.drainNode')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('nodes.drainDescription')}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="force"
                      checked={drainOptions.force}
                      onChange={(e) =>
                        setDrainOptions({
                          ...drainOptions,
                          force: e.target.checked,
                        })
                      }
                    />
                    <Label htmlFor="force" className="text-sm">
                      {t('nodes.forceDrain')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="deleteLocalData"
                      checked={drainOptions.deleteLocalData}
                      onChange={(e) =>
                        setDrainOptions({
                          ...drainOptions,
                          deleteLocalData: e.target.checked,
                        })
                      }
                    />
                    <Label htmlFor="deleteLocalData" className="text-sm">
                      {t('nodes.deleteLocalData')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="ignoreDaemonsets"
                      checked={drainOptions.ignoreDaemonsets}
                      onChange={(e) =>
                        setDrainOptions({
                          ...drainOptions,
                          ignoreDaemonsets: e.target.checked,
                        })
                      }
                    />
                    <Label htmlFor="ignoreDaemonsets" className="text-sm">
                      {t('nodes.ignoreDaemonsets')}
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gracePeriod" className="text-sm">
                      {t('nodes.gracePeriod')}
                    </Label>
                    <Input
                      id="gracePeriod"
                      type="number"
                      value={drainOptions.gracePeriod}
                      onChange={(e) =>
                        setDrainOptions({
                          ...drainOptions,
                          gracePeriod: parseInt(e.target.value) || 30,
                        })
                      }
                      min={0}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleDrain} size="sm" variant="destructive">
                    {t('nodes.drainNode')}
                  </Button>
                  <Button
                    onClick={() => setIsDrainPopoverOpen(false)}
                    size="sm"
                    variant="outline"
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Cordon/Uncordon Toggle */}
          {data.spec?.unschedulable ? (
            <Button onClick={handleUncordon} variant="outline" size="sm">
              <IconReload className="w-4 h-4" />
              {t('nodes.uncordon')}
            </Button>
          ) : (
            <Popover
              open={isCordonPopoverOpen}
              onOpenChange={setIsCordonPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <IconBan className="w-4 h-4" />
                  {t('nodes.cordon')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">{t('nodes.cordonNode')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('nodes.cordonDescription')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCordon}
                      size="sm"
                      variant="destructive"
                    >
                      {t('nodes.cordonNode')}
                    </Button>
                    <Button
                      onClick={() => setIsCordonPopoverOpen(false)}
                      size="sm"
                      variant="outline"
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Taint Node Popover */}
          <Popover
            open={isTaintPopoverOpen}
            onOpenChange={setIsTaintPopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLock className="w-4 h-4" />
                {t('nodes.taint')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">{t('nodes.taintNode')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('nodes.taintDescription')}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="taintKey" className="text-sm">
                      {t('nodes.taintKey')}
                    </Label>
                    <Input
                      id="taintKey"
                      value={taintData.key}
                      onChange={(e) =>
                        setTaintData({ ...taintData, key: e.target.value })
                      }
                      placeholder={t('nodes.taintKeyPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taintValue" className="text-sm">
                      {t('nodes.taintValue')}
                    </Label>
                    <Input
                      id="taintValue"
                      value={taintData.value}
                      onChange={(e) =>
                        setTaintData({ ...taintData, value: e.target.value })
                      }
                      placeholder={t('nodes.taintValuePlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taintEffect" className="text-sm">
                      {t('nodes.taintEffect')}
                    </Label>
                    <Select
                      value={taintData.effect}
                      onValueChange={(
                        value: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute'
                      ) => setTaintData({ ...taintData, effect: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NoSchedule">{t('nodes.noSchedule')}</SelectItem>
                        <SelectItem value="PreferNoSchedule">
                          {t('nodes.preferNoSchedule')}
                        </SelectItem>
                        <SelectItem value="NoExecute">{t('nodes.noExecute')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleTaint} size="sm" variant="destructive">
                    {t('nodes.addTaint')}
                  </Button>
                  <Button
                    onClick={() => setIsTaintPopoverOpen(false)}
                    size="sm"
                    variant="outline"
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <ResponsiveTabs
        tabs={[
          {
            value: 'overview',
            label: t('nav.overview'),
            content: (
              <div className="space-y-6">
                {/* Status Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('nodes.statusOverview')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {data.status?.conditions?.find(
                            (c) => c.type === 'Ready' && c.status === 'True'
                          ) ? (
                            <IconCircleCheckFilled className="w-4 h-4 fill-green-500" />
                          ) : (
                            <IconExclamationCircle className="w-4 h-4 fill-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t('common.status')}
                          </p>
                          <p className="text-sm font-medium">
                            {data.status?.conditions?.find(
                              (c) => c.type === 'Ready' && c.status === 'True'
                            )
                              ? t('common.ready')
                              : t('nodes.notReady')}
                            {data.spec?.unschedulable
                              ? ` (${t('nodes.schedulingDisabled')})`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">{t('nodes.role')}</p>
                        <p className="text-sm">
                          {Object.keys(data.metadata?.labels || {})
                            .find((key) =>
                              key.startsWith('node-role.kubernetes.io/')
                            )
                            ?.replace('node-role.kubernetes.io/', '') || t('nodes.unavailable')}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('nodes.internalIP')}
                        </p>
                        <p className="text-sm font-medium">
                          {data.status?.addresses?.find(
                            (addr) => addr.type === 'InternalIP'
                          )?.address || t('nodes.unavailable')}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('nodes.podCIDR')}
                        </p>
                        <p className="text-sm font-medium">
                          {data.spec?.podCIDR || t('nodes.unavailable')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Node Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('nodes.nodeInformation')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('common.created')}
                        </Label>
                        <p className="text-sm">
                          {formatDate(
                            data.metadata?.creationTimestamp || '',
                            true
                          )}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('nodes.kubeletVersion')}
                        </Label>
                        <p className="text-sm">
                          {data.status?.nodeInfo?.kubeletVersion || t('nodes.unavailable')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('nodes.hostname')}
                        </Label>
                        <p className="text-sm">
                          {data.status?.addresses?.find(
                            (addr) => addr.type === 'Hostname'
                          )?.address || t('nodes.unavailable')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('nodes.externalIP')}
                        </Label>
                        <p className="text-sm">
                          {data.status?.addresses?.find(
                            (addr) => addr.type === 'ExternalIP'
                          )?.address || t('nodes.unavailable')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('nodes.osImage')}
                        </Label>
                        <p className="text-sm">
                          {data.status?.nodeInfo?.osImage || t('nodes.unavailable')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('nodes.kernelVersion')}
                        </Label>
                        <p className="text-sm">
                          {data.status?.nodeInfo?.kernelVersion || t('nodes.unavailable')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('nodes.architecture')}
                        </Label>
                        <p className="text-sm">
                          {data.status?.nodeInfo?.architecture || t('nodes.unavailable')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('nodes.containerRuntime')}
                        </Label>
                        <p className="text-sm">
                          {data.status?.nodeInfo?.containerRuntimeVersion ||
                            t('nodes.unavailable')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('nodes.kubeProxyVersion')}
                        </Label>
                        <p className="text-sm">
                          {data.status?.nodeInfo?.kubeProxyVersion || t('nodes.unavailable')}
                        </p>
                      </div>
                    </div>
                    <LabelsAnno
                      labels={data.metadata?.labels || {}}
                      annotations={data.metadata?.annotations || {}}
                    />
                  </CardContent>
                </Card>

                {/* Resource Capacity & Allocation */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('nodes.resourceCapacity')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium mb-3">
                          {t('nodes.cpuMemory')}
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="text-sm font-medium">CPU</p>
                              <p className="text-xs text-muted-foreground">
                                {t('nodes.capacity')}:{' '}
                                {data.status?.capacity?.cpu
                                  ? formatCPU(data.status.capacity.cpu)
                                  : t('nodes.unavailable')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {data.status?.allocatable?.cpu
                                  ? formatCPU(data.status.allocatable.cpu)
                                  : t('nodes.unavailable')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t('nodes.allocatable')}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="text-sm font-medium">{t('nodes.memory')}</p>
                              <p className="text-xs text-muted-foreground">
                                {t('nodes.capacity')}:{' '}
                                {data.status?.capacity?.memory
                                  ? formatMemory(data.status.capacity.memory)
                                  : t('nodes.unavailable')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {data.status?.allocatable?.memory
                                  ? formatMemory(data.status.allocatable.memory)
                                  : t('nodes.unavailable')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t('nodes.allocatable')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-3">
                          {t('nodes.podsStorage')}
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="text-sm font-medium">{t('nav.pods')}</p>
                              <p className="text-xs text-muted-foreground">
                                {t('nodes.capacity')}: {data.status?.capacity?.pods || t('nodes.unavailable')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {data.status?.allocatable?.pods || t('nodes.unavailable')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t('nodes.allocatable')}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="text-sm font-medium">{t('nodes.storage')}</p>
                              <p className="text-xs text-muted-foreground">
                                {t('nodes.capacity')}:{' '}
                                {data.status?.capacity?.['ephemeral-storage']
                                  ? formatMemory(
                                      data.status.capacity['ephemeral-storage']
                                    )
                                  : t('nodes.unavailable')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {data.status?.allocatable?.['ephemeral-storage']
                                  ? formatMemory(
                                      data.status.allocatable[
                                        'ephemeral-storage'
                                      ]
                                    )
                                  : t('nodes.unavailable')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t('nodes.allocatable')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Node Taints */}
                {data.spec?.taints && data.spec.taints.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('nodes.nodeTaints')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-2">
                        {data.spec.taints.map((taint, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 border rounded-lg"
                          >
                            <Badge variant="secondary">{taint.effect}</Badge>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{taint.key}</p>
                              {taint.value && (
                                <p className="text-xs text-muted-foreground">
                                  = {taint.value}
                                </p>
                              )}
                            </div>
                            {taint.timeAdded && (
                              <p className="text-xs text-muted-foreground">
                                {formatDate(taint.timeAdded)}
                              </p>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUntaint(taint.key)}
                            >
                              {t('common.remove')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Node Conditions */}
                {data.status?.conditions &&
                  data.status.conditions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('nodes.nodeConditions')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {data.status.conditions.map((condition, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-3 border rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    condition.status === 'True'
                                      ? 'bg-green-500'
                                      : condition.status === 'False'
                                        ? 'bg-red-500'
                                        : 'bg-yellow-500'
                                  }`}
                                />
                                <Badge
                                  variant={
                                    condition.status === 'True'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {t(`nodes.conditions.${condition.type}`, { defaultValue: condition.type })}
                                </Badge>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground truncate">
                                  {condition.message 
                                    ? translateConditionMessage(condition.message)
                                    : condition.reason ||
                                      t('common.noMessage')}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {condition.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </div>
            ),
          },
          {
            value: 'yaml',
            label: t('nav.yaml'),
            content: (
              <div className="space-y-4">
                <YamlEditor<'nodes'>
                  key={refreshKey}
                  value={yamlContent}
                  title={t('nodes.yamlConfiguration')}
                  onSave={handleSaveYaml}
                  onChange={handleYamlChange}
                  isSaving={isSavingYaml}
                />
              </div>
            ),
          },
          ...(relatedPods && relatedPods.length > 0
            ? [
                {
                  value: 'pods',
                  label: (
                    <>
                      {t('nav.pods')}{' '}
                      {relatedPods && (
                        <Badge variant="secondary">{relatedPods.length}</Badge>
                      )}
                    </>
                  ),
                  content: (
                    <PodTable
                      pods={relatedPods}
                      isLoading={isLoadingRelated}
                      hiddenNode
                    />
                  ),
                },
              ]
            : []),
          {
            value: 'monitor',
            label: t('nav.monitor'),
            content: <NodeMonitoring name={name} />,
          },
          {
            value: 'Terminal',
            label: t('nav.terminal'),
            content: (
              <div className="space-y-6">
                <Terminal type="node" namespace={name} />
              </div>
            ),
          },
          {
            value: 'events',
            label: t('nav.events'),
            content: (
              <EventTable
                resource={'nodes'}
                namespace={undefined}
                name={name}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

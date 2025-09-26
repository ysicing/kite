import { useState, useEffect } from 'react'
import { IconPlus, IconChartLine } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiClient } from '@/lib/api-client'

interface CreateHPADialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetKind?: string
  targetName?: string
  targetNamespace?: string
  onSuccess?: () => void
}

interface HPARecommendation {
  minReplicas: number
  maxReplicas: number
  targetCPUPercent?: number
  targetMemoryPercent?: number
  hasCPURequests: boolean
  hasMemoryRequests: boolean
}

export function CreateHPADialog({
  open,
  onOpenChange,
  targetKind = 'Deployment',
  targetName = '',
  targetNamespace = 'default',
  onSuccess,
}: CreateHPADialogProps) {
  const { t } = useTranslation()
  const [isCreating, setIsCreating] = useState(false)
  const [loadingRecommendation, setLoadingRecommendation] = useState(false)
  const [recommendation, setRecommendation] = useState<HPARecommendation | null>(null)

  // Form state
  const [hpaName, setHpaName] = useState('')
  const [namespace, setNamespace] = useState(targetNamespace)
  const [kind, setKind] = useState(targetKind)
  const [name, setName] = useState(targetName)
  const [minReplicas, setMinReplicas] = useState(1)
  const [maxReplicas, setMaxReplicas] = useState(10)
  const [enableCPU, setEnableCPU] = useState(true)
  const [targetCPUPercent, setTargetCPUPercent] = useState(80)
  const [enableMemory, setEnableMemory] = useState(false)
  const [targetMemoryPercent, setTargetMemoryPercent] = useState(80)

  // Auto-generate HPA name
  useEffect(() => {
    if (targetName) {
      setHpaName(`${targetName}-hpa`)
      setName(targetName)
    }
  }, [targetName])

  useEffect(() => {
    if (targetNamespace) {
      setNamespace(targetNamespace)
    }
  }, [targetNamespace])

  // Fetch recommendation when dialog opens
  useEffect(() => {
    if (open && targetName && targetNamespace) {
      fetchRecommendation()
    }
  }, [open, targetName, targetNamespace])

  const fetchRecommendation = async () => {
    if (!targetName || !targetNamespace) return

    setLoadingRecommendation(true)
    try {
      const response = await apiClient.get<HPARecommendation>(
        `/horizontalpodautoscalers/${targetNamespace}/recommendation?type=${targetKind}&name=${targetName}`
      )
      const data = response
      setRecommendation(data)

      // Apply recommendations
      setMinReplicas(data.minReplicas)
      setMaxReplicas(data.maxReplicas)

      if (data.hasCPURequests && data.targetCPUPercent) {
        setEnableCPU(true)
        setTargetCPUPercent(data.targetCPUPercent)
      } else {
        setEnableCPU(false)
      }

      if (data.hasMemoryRequests && data.targetMemoryPercent) {
        setEnableMemory(true)
        setTargetMemoryPercent(data.targetMemoryPercent)
      }
    } catch (error) {
      console.error('Failed to fetch HPA recommendation:', error)
    } finally {
      setLoadingRecommendation(false)
    }
  }

  const handleCreate = async () => {
    if (!hpaName || !name || !namespace || !kind) {
      toast.error(t('hpa.fillRequiredFields'))
      return
    }

    if (!enableCPU && !enableMemory) {
      toast.error(t('hpa.enableAtLeastOneMetric'))
      return
    }

    setIsCreating(true)
    try {
      const payload: any = {
        name: hpaName,
        namespace,
        targetKind: kind,
        targetName: name,
        minReplicas,
        maxReplicas,
      }

      if (enableCPU) {
        payload.targetCPUPercent = targetCPUPercent
      }

      if (enableMemory) {
        payload.targetMemoryPercent = targetMemoryPercent
      }

      await apiClient.post('/horizontalpodautoscalers/create', payload)

      toast.success(t('hpa.createSuccess', { name: hpaName }))
      onOpenChange(false)
      onSuccess?.()

      // Reset form
      setHpaName('')
      setMinReplicas(1)
      setMaxReplicas(10)
      setEnableCPU(true)
      setTargetCPUPercent(80)
      setEnableMemory(false)
      setTargetMemoryPercent(80)
    } catch (error: any) {
      toast.error(error.message || t('hpa.createError'))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconChartLine className="h-5 w-5" />
            {t('hpa.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('hpa.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hpa-name">{t('hpa.hpaName')} *</Label>
                <Input
                  id="hpa-name"
                  value={hpaName}
                  onChange={(e) => setHpaName(e.target.value)}
                  placeholder="my-app-hpa"
                />
              </div>
              <div>
                <Label htmlFor="namespace">{t('common.namespace')} *</Label>
                <Input
                  id="namespace"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  placeholder="default"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="target-kind">{t('hpa.targetKind')} *</Label>
                <select
                  id="target-kind"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="Deployment">Deployment</option>
                  <option value="StatefulSet">StatefulSet</option>
                  <option value="ReplicaSet">ReplicaSet</option>
                </select>
              </div>
              <div>
                <Label htmlFor="target-name">{t('hpa.targetName')} *</Label>
                <Input
                  id="target-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-app"
                />
              </div>
            </div>
          </div>

          {/* Resource Requirements Alert */}
          {recommendation && (!recommendation.hasCPURequests && !recommendation.hasMemoryRequests) && (
            <Alert variant="destructive">
              <AlertDescription>
                ⚠️ {t('hpa.noResourceRequests')}
              </AlertDescription>
            </Alert>
          )}

          {recommendation && !recommendation.hasCPURequests && recommendation.hasMemoryRequests && (
            <Alert>
              <AlertDescription>
                ⚠️ {t('hpa.noCPURequests')}
              </AlertDescription>
            </Alert>
          )}

          {recommendation && recommendation.hasCPURequests && !recommendation.hasMemoryRequests && (
            <Alert>
              <AlertDescription>
                ⚠️ {t('hpa.noMemoryRequests')}
              </AlertDescription>
            </Alert>
          )}

          {/* Scaling Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('hpa.scalingConfiguration')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min-replicas">{t('hpa.minReplicas')} *</Label>
                <Input
                  id="min-replicas"
                  type="number"
                  min="1"
                  value={minReplicas}
                  onChange={(e) => setMinReplicas(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label htmlFor="max-replicas">{t('hpa.maxReplicas')} *</Label>
                <Input
                  id="max-replicas"
                  type="number"
                  min="1"
                  value={maxReplicas}
                  onChange={(e) => setMaxReplicas(parseInt(e.target.value) || 10)}
                />
              </div>
            </div>
          </div>

          {/* Metrics Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('hpa.metricsConfiguration')}</h3>

            {/* CPU Metric */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-cpu" className="font-medium">
                  {t('hpa.cpuUtilization')}
                </Label>
                <Switch
                  id="enable-cpu"
                  checked={enableCPU ?? false}
                  onCheckedChange={setEnableCPU}
                  disabled={recommendation ? !recommendation.hasCPURequests : false}
                />
              </div>
              {enableCPU && (
                <div>
                  <Label htmlFor="cpu-target">{t('hpa.targetCPUUtilization')}</Label>
                  <Input
                    id="cpu-target"
                    type="number"
                    min="1"
                    max="100"
                    value={targetCPUPercent}
                    onChange={(e) => setTargetCPUPercent(parseInt(e.target.value) || 80)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('hpa.cpuScaleDescription')}
                  </p>
                </div>
              )}
            </div>

            {/* Memory Metric */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-memory" className="font-medium">
                  {t('hpa.memoryUtilization')}
                </Label>
                <Switch
                  id="enable-memory"
                  checked={enableMemory ?? false}
                  onCheckedChange={setEnableMemory}
                  disabled={recommendation ? !recommendation.hasMemoryRequests : false}
                />
              </div>
              {enableMemory && (
                <div>
                  <Label htmlFor="memory-target">{t('hpa.targetMemoryUtilization')}</Label>
                  <Input
                    id="memory-target"
                    type="number"
                    min="1"
                    max="100"
                    value={targetMemoryPercent}
                    onChange={(e) => setTargetMemoryPercent(parseInt(e.target.value) || 80)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('hpa.memoryScaleDescription')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || loadingRecommendation}
          >
            {isCreating ? (
              <>{t('hpa.creating')}</>
            ) : (
              <>
                <IconPlus className="w-4 h-4 mr-2" />
                {t('hpa.createHPA')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
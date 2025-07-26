import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as yaml from 'js-yaml'
import {
  IconTrash,
  IconEdit,
  IconDownload,
  IconRefresh,
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { YamlEditor } from '@/components/yaml-editor'
import { EventTable } from '@/components/event-table'
import { LabelsAnno } from '@/components/lables-anno'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { useCluster } from '@/hooks/use-cluster'
import { fetchResource, deleteResource, updateResource } from '@/lib/api'
import { downloadResource, handleResourceError } from '@/lib/utils'
import type { UpgradePlan } from '@/types/api'

export default function UpgradePlanDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { selectedCluster } = useCluster()
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedYaml, setEditedYaml] = useState('')

  // 获取升级计划详情
  const {
    data: plan,
    isLoading: planLoading,
    error: planError,
    refetch,
  } = useQuery({
    queryKey: ['resource', selectedCluster, 'plans', 'system-upgrade', name],
    queryFn: () => fetchResource('plans', name as string, 'system-upgrade'),
    enabled: !!selectedCluster && !!name,
  })

  const upgradePlan = plan as UpgradePlan

  useEffect(() => {
    if (upgradePlan && typeof upgradePlan === 'object') {
      try {
        // 将对象转换为 YAML 格式
        const yamlContent = yaml.dump(upgradePlan, {
          indent: 2,
          lineWidth: -1, // 不限制行宽度
          noRefs: true,  // 不使用引用
        })
        setEditedYaml(yamlContent)
      } catch (error) {
        console.error('Failed to convert to YAML:', error)
        // 如果 YAML 转换失败，回退到 JSON
        setEditedYaml(JSON.stringify(upgradePlan, null, 2))
      }
    }
  }, [upgradePlan])

  const handleSave = async () => {
    if (!editedYaml.trim()) {
      toast.error(t('validation.yamlRequired'))
      return
    }

    try {
      // 解析YAML内容为对象
      let resourceData: unknown
      try {
        // 首先尝试解析为 YAML
        resourceData = yaml.load(editedYaml)
      } catch {
        // 如果 YAML 解析失败，尝试 JSON
        try {
          resourceData = JSON.parse(editedYaml)
        } catch {
          throw new Error('无效的 YAML 或 JSON 格式')
        }
      }
      await updateResource('plans', name as string, 'system-upgrade', resourceData as any)
      setIsEditing(false)
      toast.success(t('actions.updateSuccess'))
      refetch()
    } catch (error) {
      console.error('Failed to update plan:', error)
      handleResourceError(error, t)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteResource('plans', name as string, 'system-upgrade')
      toast.success(t('actions.deleteSuccess'))
      navigate('/plans')
    } catch (error) {
      console.error('Failed to delete plan:', error)
      handleResourceError(error, t)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownload = () => {
    if (upgradePlan) {
      downloadResource(upgradePlan, `${name}.yaml`)
    }
  }

  const renderPlanStatus = (plan: UpgradePlan) => {
    if (!plan.status?.conditions) {
      return <Badge variant="secondary">{t('systemUpgrade.status.unknown')}</Badge>
    }

    const conditions = plan.status.conditions
    const latestCondition = conditions[conditions.length - 1]

    if (latestCondition?.type === 'Complete' && latestCondition?.status === 'True') {
      return <Badge variant="default">{t('systemUpgrade.status.completed')}</Badge>
    }
    if (latestCondition?.type === 'InProgress' && latestCondition?.status === 'True') {
      return <Badge variant="secondary">{t('systemUpgrade.status.inProgress')}</Badge>
    }
    if (latestCondition?.type === 'Failed' && latestCondition?.status === 'True') {
      return <Badge variant="destructive">{t('systemUpgrade.status.failed')}</Badge>
    }

    return <Badge variant="outline">{t('systemUpgrade.status.pending')}</Badge>
  }

  if (planLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (planError || !upgradePlan) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              {planError ? t('errors.loadFailed') : t('errors.notFound')}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('systemUpgrade.planDetail')}: {name}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <IconRefresh className="h-4 w-4 mr-2" />
            {t('actions.refresh')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            <IconDownload className="h-4 w-4 mr-2" />
            {t('actions.download')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <IconEdit className="h-4 w-4 mr-2" />
            {isEditing ? t('actions.cancel') : t('actions.edit')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <IconTrash className="h-4 w-4 mr-2" />
            {t('actions.delete')}
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
                {/* 基本信息 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('common.basicInfo')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('common.name')}</p>
                        <p className="font-medium">{upgradePlan.metadata.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('common.status')}</p>
                        {renderPlanStatus(upgradePlan)}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('systemUpgrade.image')}</p>
                        <p className="font-medium font-mono text-sm">
                          {upgradePlan.spec?.upgrade?.image || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('systemUpgrade.version')}</p>
                        <p className="font-medium">{upgradePlan.spec?.version || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('systemUpgrade.concurrency')}</p>
                        <p className="font-medium">{upgradePlan.spec?.concurrency || 1}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('common.serviceAccount')}</p>
                        <p className="font-medium">{upgradePlan.spec?.serviceAccountName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('nodes.cordon')}</p>
                        <Badge variant={upgradePlan.spec?.cordon ? "default" : "secondary"}>
                          {upgradePlan.spec?.cordon ? t('common.true') : t('common.false')}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('common.createdTime')}</p>
                        <p className="font-medium">
                          {upgradePlan.metadata.creationTimestamp
                            ? new Date(upgradePlan.metadata.creationTimestamp).toLocaleString()
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('systemUpgrade.channel')}</p>
                        <p className="font-medium">{upgradePlan.spec?.channel || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 节点选择器和污点 */}
                {upgradePlan.spec?.nodeSelector && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('systemUpgrade.nodeSelector')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Match Labels */}
                          {upgradePlan.spec.nodeSelector.matchLabels && Object.keys(upgradePlan.spec.nodeSelector.matchLabels).length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">Match Labels</h4>
                              <div className="space-y-2">
                                {Object.entries(upgradePlan.spec.nodeSelector.matchLabels).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <Badge variant="outline">{key}</Badge>
                                    <span>=</span>
                                    <Badge variant="secondary">{String(value)}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Match Expressions */}
                          {upgradePlan.spec.nodeSelector.matchExpressions && upgradePlan.spec.nodeSelector.matchExpressions.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">Match Expressions</h4>
                              <div className="space-y-2">
                                {upgradePlan.spec.nodeSelector.matchExpressions.map((exp, index) => (
                                  <div key={index} className="p-2 border rounded-lg">
                                    <div className="flex items-center gap-2 text-sm">
                                      <Badge variant="outline">{exp.key}</Badge>
                                      <Badge variant="outline">{exp.operator}</Badge>
                                      {exp.values && exp.values.length > 0 && (
                                        <div className="flex gap-1">
                                          {exp.values.map((value, idx) => (
                                            <Badge key={idx} variant="secondary">{value}</Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('systemUpgrade.tolerations')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {upgradePlan.spec?.tolerations && upgradePlan.spec.tolerations.length > 0 ? (
                            upgradePlan.spec.tolerations.map((toleration, index) => (
                              <div key={index} className="p-2 border rounded-lg">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {toleration.key && (
                                    <div>
                                      <span className="text-muted-foreground">Key:</span>
                                      <Badge variant="outline" className="ml-1">{toleration.key}</Badge>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-muted-foreground">Operator:</span>
                                    <Badge variant="outline" className="ml-1">{toleration.operator || 'Equal'}</Badge>
                                  </div>
                                  {toleration.value && (
                                    <div>
                                      <span className="text-muted-foreground">Value:</span>
                                      <Badge variant="secondary" className="ml-1">{toleration.value}</Badge>
                                    </div>
                                  )}
                                  {toleration.effect && (
                                    <div>
                                      <span className="text-muted-foreground">Effect:</span>
                                      <Badge variant="secondary" className="ml-1">{toleration.effect}</Badge>
                                    </div>
                                  )}
                                  {toleration.tolerationSeconds !== undefined && (
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">Toleration Seconds:</span>
                                      <span className="ml-1">{toleration.tolerationSeconds}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-muted-foreground text-sm">-</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Prepare 配置 */}
                {upgradePlan.spec?.prepare && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('systemUpgrade.prepare')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">{t('systemUpgrade.image')}</p>
                          <p className="font-medium font-mono text-sm">
                            {upgradePlan.spec.prepare.image || '-'}
                          </p>
                        </div>
                        {upgradePlan.spec.prepare.args && upgradePlan.spec.prepare.args.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground">{t('systemUpgrade.args')}</p>
                            <div className="space-y-1">
                              {upgradePlan.spec.prepare.args.map((arg, index) => (
                                <Badge key={index} variant="outline" className="mr-1 font-mono text-xs">
                                  {arg}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Drain 配置 */}
                {upgradePlan.spec?.drain && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('systemUpgrade.drain')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{t('systemUpgrade.drainForce')}</p>
                          <Badge variant={upgradePlan.spec.drain.force ? "default" : "secondary"}>
                            {upgradePlan.spec.drain.force ? t('common.enabled') : t('common.disabled')}
                          </Badge>
                        </div>
                        {upgradePlan.spec.drain.skipWaitForDeleteTimeout && (
                          <div>
                            <p className="text-sm text-muted-foreground">{t('systemUpgrade.skipWaitForDeleteTimeout')}</p>
                            <p className="font-medium">{upgradePlan.spec.drain.skipWaitForDeleteTimeout}</p>
                          </div>
                        )}
                        {upgradePlan.spec.drain.timeout && (
                          <div>
                            <p className="text-sm text-muted-foreground">{t('systemUpgrade.timeout')}</p>
                            <p className="font-medium">{upgradePlan.spec.drain.timeout}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-muted-foreground">{t('systemUpgrade.ignoreDaemonSets')}</p>
                          <Badge variant={upgradePlan.spec.drain.ignoreDaemonSets ? "default" : "secondary"}>
                            {upgradePlan.spec.drain.ignoreDaemonSets ? t('common.enabled') : t('common.disabled')}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('systemUpgrade.deleteLocalData')}</p>
                          <Badge variant={upgradePlan.spec.drain.deleteLocalData ? "default" : "secondary"}>
                            {upgradePlan.spec.drain.deleteLocalData ? t('common.enabled') : t('common.disabled')}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Secrets 配置 */}
                {upgradePlan.spec?.secrets && upgradePlan.spec.secrets.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('nav.secrets')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {upgradePlan.spec.secrets.map((secret, index) => (
                          <div key={index} className="p-2 border rounded-lg">
                                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                               <div>
                                 <span className="text-muted-foreground">Name:</span>
                                 <Link 
                                   to={`/secrets/system-upgrade/${secret.name}`}
                                   className="ml-1"
                                 >
                                   <Badge variant="outline" className="hover:bg-blue-50 cursor-pointer">
                                     {secret.name}
                                   </Badge>
                                 </Link>
                               </div>
                               <div>
                                 <span className="text-muted-foreground">Path:</span>
                                 <span className="ml-1 font-mono text-xs">{secret.path}</span>
                               </div>
                             </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 标签和注解 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('systemUpgrade.labelsAnnotations')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LabelsAnno 
                      labels={upgradePlan.metadata.labels || {}}
                      annotations={upgradePlan.metadata.annotations || {}}
                    />
                  </CardContent>
                </Card>

                {/* 状态信息 */}
                {upgradePlan.status && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('systemUpgrade.statusInfo')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {upgradePlan.status.conditions && upgradePlan.status.conditions.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">{t('common.conditions')}</h4>
                            <div className="space-y-2">
                              {upgradePlan.status.conditions.map((condition, index: number) => (
                                <div key={index} className="p-3 border rounded-lg">
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Type:</span> {condition.type}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Status:</span> {condition.status}
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">Message:</span> {condition.message || '-'}
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">Last Transition:</span>{' '}
                                      {condition.lastTransitionTime 
                                        ? new Date(condition.lastTransitionTime).toLocaleString()
                                        : '-'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
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
            label: 'YAML',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    YAML {t('common.configuration')}
                    {isEditing && (
                      <Button onClick={handleSave}>
                        {t('actions.save')}
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <YamlEditor
                    value={editedYaml}
                    onChange={setEditedYaml}
                    readOnly={!isEditing}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            value: 'events',
            label: t('common.events'),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{t('common.events')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <EventTable 
                    resource="plans"
                    name={name as string}
                    namespace=""
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        resourceName={name as string}
        resourceType="plans"
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
} 

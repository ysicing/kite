import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQuery } from '@tanstack/react-query'
import { fetchResources, useSystemUpgradeStatus } from '@/lib/api'
import { UpgradePlan } from '@/types/api'
import { useLastActiveTab } from '@/hooks/use-last-active-tab'
import { 
  IconArrowUp, 
  IconCheck,
  IconX,
  IconAlertCircle,
  IconClock,
  IconArrowRight
} from '@tabler/icons-react'

const SystemUpgradeOverview: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { updateActiveTab } = useLastActiveTab()

  const { data: plansData, isLoading: plansLoading, error: plansError } = useQuery({
    queryKey: ['resources', 'plans'],
    queryFn: () => fetchResources('plans'),
  })

  const { data: systemUpgradeStatus, isLoading: statusLoading } = useSystemUpgradeStatus()

  const plans = (plansData as any)?.items as UpgradePlan[] || []

  const isLoading = plansLoading || statusLoading
  const hasError = plansError

  const getPlanStatus = (plan: UpgradePlan): 'ready' | 'notReady' | 'unknown' => {
    const condition = plan.status?.conditions?.find(c => c.type === 'Ready')
    
    if (!condition) return 'unknown'
    return condition.status === 'True' ? 'ready' : 'notReady'
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <IconArrowUp className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.systemUpgrade')} {t('common.overview')}</h2>
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <IconArrowUp className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.systemUpgrade')} {t('common.overview')}</h2>
        </div>
        <Alert>
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('common.error')}: {plansError?.message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconArrowUp className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.systemUpgrade')} {t('common.overview')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {systemUpgradeStatus?.installed ? (
            <>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                ✓ Installed
              </Badge>
              {systemUpgradeStatus.version && (
                <Badge variant="outline">
                  {t('systemUpgrade.version')}: {systemUpgradeStatus.version}
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              Not Installed
            </Badge>
          )}
        </div>
      </div>

      {/* 计划总数 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Total Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{plans.length}</div>
        </CardContent>
      </Card>

      {/* 最近计划 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <IconArrowUp className="h-5 w-5" />
              Recent Upgrade Plans
            </span>
            <Button variant="ghost" size="sm" onClick={() => {
              updateActiveTab('systemupgrade')
              navigate('/plans')
            }}>
              View All
              <IconArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {t('systemUpgrade.noPlans')}
            </p>
          ) : (
            <div className="space-y-3">
              {plans.slice(0, 5).map((plan) => {
                const status = getPlanStatus(plan)
                const statusConfig = {
                  ready: { icon: <IconCheck className="h-3 w-3" />, variant: 'default' as const, text: 'Ready' },
                  notReady: { icon: <IconX className="h-3 w-3" />, variant: 'destructive' as const, text: 'Not Ready' },
                  unknown: { icon: <IconAlertCircle className="h-3 w-3" />, variant: 'outline' as const, text: 'Unknown' }
                }
                
                return (
                  <div key={plan.metadata.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconArrowUp className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium">{plan.metadata.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-mono">{plan.spec?.upgrade?.image || 'No image specified'}</span>
                          {plan.spec?.version && (
                            <>
                              <span>•</span>
                              <span className="font-medium">v{plan.spec.version}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {plan.status?.applying && plan.status.applying.length > 0 && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <IconClock className="h-3 w-3" />
                          Applying ({plan.status.applying.length})
                        </Badge>
                      )}
                      <Badge variant={statusConfig[status].variant} className="flex items-center gap-1">
                        {statusConfig[status].icon}
                        {statusConfig[status].text}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SystemUpgradeOverview

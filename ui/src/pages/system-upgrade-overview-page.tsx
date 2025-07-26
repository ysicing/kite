import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQuery } from '@tanstack/react-query'
import { fetchResources } from '@/lib/api'
import { UpgradePlan } from '@/types/api'
import { 
  IconArrowUp, 
  IconCheck,
  IconX,
  IconAlertCircle,
  IconClock,
  IconArrowRight
} from '@tabler/icons-react'

const SystemUpgradeOverviewPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: plansData, isLoading: plansLoading, error: plansError } = useQuery({
    queryKey: ['resources', 'plans', 'system-upgrade'],
    queryFn: () => fetchResources('plans', 'system-upgrade'),
  })

  const plans = (plansData as any)?.items as UpgradePlan[] || []

  const isLoading = plansLoading
  const hasError = plansError

  const getPlanStatus = (plan: UpgradePlan): 'ready' | 'notReady' | 'unknown' => {
    const condition = plan.status?.conditions?.find(c => c.type === 'Ready')
    
    if (!condition) return 'unknown'
    return condition.status === 'True' ? 'ready' : 'notReady'
  }

  const planStats = {
    total: plans.length,
    ready: plans.filter(p => getPlanStatus(p) === 'ready').length,
    applying: plans.filter(p => p.status?.applying && p.status.applying.length > 0).length,
    withDrain: plans.filter(p => p.spec?.drain?.enabled).length,
  }

  const recentPlans = plans.slice(0, 5)

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <IconArrowUp className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('systemUpgrade.title')}</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <IconArrowUp className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('systemUpgrade.title')}</h1>
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <IconArrowUp className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('systemUpgrade.title')}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/plans')}>
            <IconArrowUp className="h-4 w-4 mr-2" />
            {t('systemUpgrade.plans.title')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/system-upgrade')}>
            <IconArrowRight className="h-4 w-4 mr-2" />
            {t('nav.systemUpgrade')}
          </Button>
        </div>
      </div>

      {/* Plan Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('systemUpgrade.plans.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {t('systemUpgrade.totalPlans')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('systemUpgrade.readyPlans')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{planStats.ready}</div>
            <p className="text-xs text-muted-foreground">
              {t('systemUpgrade.executablePlans')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('systemUpgrade.inProgress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{planStats.applying}</div>
            <p className="text-xs text-muted-foreground">
              {t('systemUpgrade.upgradeingNodes')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('systemUpgrade.drainEnabled')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{planStats.withDrain}</div>
            <p className="text-xs text-muted-foreground">
              {t('systemUpgrade.drainConfigured')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Plans */}
      {recentPlans.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t('systemUpgrade.recentPlans')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/plans')}>
              {t('systemUpgrade.viewAll')}
              <IconArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPlans.map((plan) => {
                const status = getPlanStatus(plan)
                const statusConfig = {
                  ready: { 
                    icon: <IconCheck className="h-4 w-4" />, 
                    variant: 'default' as const,
                    text: t('systemUpgrade.plans.status.ready')
                  },
                  notReady: { 
                    icon: <IconX className="h-4 w-4" />, 
                    variant: 'destructive' as const,
                    text: t('systemUpgrade.plans.status.notReady')
                  },
                  unknown: { 
                    icon: <IconAlertCircle className="h-4 w-4" />, 
                    variant: 'outline' as const,
                    text: t('systemUpgrade.plans.status.unknown')
                  }
                }[status]

                return (
                  <div
                    key={plan.metadata.name}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent"
                    onClick={() => navigate(`/plans/${plan.metadata.name}`)}
                  >
                    <div className="flex items-center space-x-3">
                      <IconArrowUp className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">{plan.metadata.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-mono">{plan.spec?.upgrade?.image || '-'}</span>
                          {plan.spec?.version && (
                            <>
                              <span>•</span>
                              <span>v{plan.spec.version}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {plan.status?.applying && plan.status.applying.length > 0 && (
                        <div className="flex items-center gap-1">
                          <IconClock className="h-3 w-3 text-yellow-600" />
                          <span className="text-xs text-muted-foreground">
                            {plan.status.applying.length} 节点执行中
                          </span>
                        </div>
                      )}
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                        {statusConfig.icon}
                        {statusConfig.text}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Plans */}
      {plans.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <IconArrowUp className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">{t('systemUpgrade.noPlans')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('systemUpgrade.noPlansDescription')}
              </p>
              <Button className="mt-4" onClick={() => navigate('/plans')}>
                {t('systemUpgrade.viewPlans')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SystemUpgradeOverviewPage 

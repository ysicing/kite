import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  IconLayoutDashboard, 
  IconInfoCircle, 
  IconExternalLink, 
  IconDownload,
  IconRoute,
  IconSettings,
  IconShield
} from '@tabler/icons-react'

import { useTraefikStatus } from '@/lib/api'
import { useLastActiveTab } from '@/hooks/use-last-active-tab'

const TraefikOverview: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: status, isLoading, error } = useTraefikStatus()
  const { updateActiveTab } = useLastActiveTab()

  // Mapping from workload names to their corresponding routes
  const workloadRoutes: Record<string, string> = {
    'ingressroutes': '/ingressroutes',
    'ingressroutetcps': '/ingressroutetcps',
    'ingressrouteudps': '/ingressrouteudps',
    'middlewares': '/middlewares',
    'middlewaretcps': '/middlewaretcps',
    'tlsoptions': '/tlsoptions',
    'tlsstores': '/tlsstores',
    'traefikservices': '/traefikservices',
    'serverstransports': '/serverstransports',
  }

  const handleWorkloadClick = (workloadName: string) => {
    const route = workloadRoutes[workloadName]
    if (route) {
      // 记住当前是在traefik tab
      updateActiveTab('traefik')
      navigate(route)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <IconLayoutDashboard className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.traefik')} {t('common.overview')}</h2>
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <IconLayoutDashboard className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.traefik')} {t('common.overview')}</h2>
        </div>
        <Alert>
          <IconInfoCircle className="h-4 w-4" />
          <AlertDescription>
            {t('common.errorLoading')}: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!status?.installed) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <IconLayoutDashboard className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.traefik')} {t('common.overview')}</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconInfoCircle className="h-5 w-5 text-blue-500" />
              {t('traefik.notInstalled')}
            </CardTitle>
            <CardDescription>
              {t('traefik.notInstalledDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('common.installInstructions')}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild>
                <a
                  href="https://doc.traefik.io/traefik/getting-started/install-traefik/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <IconDownload className="h-4 w-4" />
                  {t('common.installGuide')}
                  <IconExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="https://doc.traefik.io/traefik/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  {t('common.learnMore')}
                  <IconExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Traefik is installed, show overview with statistics
  const availableWorkloads = status.workloads || []
  const workloadMap = new Map(availableWorkloads.map(w => [w.name, w]))

  // Workload categories
  const workloadCategories = [
    {
      title: t('traefik.ingressroutes.title'),
      icon: <IconRoute className="h-4 w-4" />,
      workloads: ['ingressroutes', 'ingressroutetcps', 'ingressrouteudps'],
      color: 'text-blue-600'
    },
    {
      title: t('traefik.middlewares.title'),
      icon: <IconSettings className="h-4 w-4" />,
      workloads: ['middlewares', 'middlewaretcps'],
      color: 'text-green-600'
    },
    {
      title: 'TLS & Security',
      icon: <IconShield className="h-4 w-4" />,
      workloads: ['tlsoptions', 'tlsstores'],
      color: 'text-orange-600'
    },
    {
      title: 'Services & Transport',
      icon: <IconLayoutDashboard className="h-4 w-4" />,
      workloads: ['traefikservices', 'serverstransports'],
      color: 'text-purple-600'
    }
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconLayoutDashboard className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('nav.traefik')} {t('common.overview')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            ✓ {t('common.available')}
          </Badge>
          {status.version && (
            <Badge variant="outline">
              {t('common.version')}: {status.version}
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Statistics */}
      {availableWorkloads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('common.summary')}</CardTitle>
            <CardDescription>
              {t('traefik.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {availableWorkloads.filter(w => w.available).length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('traefik.availableWorkloads')}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {availableWorkloads.reduce((sum, w) => sum + w.count, 0)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('traefik.totalInstances')}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {status.version || 'Unknown'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('common.version')}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {availableWorkloads.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('traefik.supportedTypes')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workload Categories */}
      {workloadCategories.map((category, categoryIndex) => (
        <Card key={categoryIndex}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className={category.color}>{category.icon}</span>
              {category.title}
            </CardTitle>
            <CardDescription>
              {categoryIndex === 0 && "HTTP/HTTPS and TCP/UDP routing rules"}
              {categoryIndex === 1 && "Request and response processing middleware"}
              {categoryIndex === 2 && "TLS configuration and certificate management"}
              {categoryIndex === 3 && "Backend services and transport configuration"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {category.workloads.map((workloadName) => {
                const workload = workloadMap.get(workloadName)
                const isAvailable = workload?.available || false
                const count = workload?.count || 0

                return (
                  <Card 
                    key={workloadName} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isAvailable 
                        ? 'border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 opacity-60'
                    }`}
                    onClick={() => isAvailable && handleWorkloadClick(workloadName)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-sm">
                        <span>{t(`nav.${workloadName}`)}</span>
                        <div className="flex items-center gap-1">
                          {isAvailable ? (
                            <>
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs">
                                {t('common.available')}
                              </Badge>
                              {count > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {count}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {t('common.unavailable')}
                            </Badge>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        {workload?.description || t(`traefik.${workloadName}.description`)}
                      </p>
                      {workload && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${
                            isAvailable ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                          <span className="text-xs text-muted-foreground">
                            {workload.apiVersion || 'traefik.containo.us/v1alpha1'}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common Traefik management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/ingressroutes')}
            >
              <IconRoute className="h-5 w-5 text-blue-600" />
              <div className="text-sm font-medium">{t('traefik.ingressroutes.title')}</div>
              <Badge variant="secondary" className="text-xs">
                {workloadMap.get('ingressroutes')?.count || 0} routes
              </Badge>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/middlewares')}
            >
              <IconSettings className="h-5 w-5 text-green-600" />
              <div className="text-sm font-medium">{t('traefik.middlewares.title')}</div>
              <Badge variant="secondary" className="text-xs">
                {workloadMap.get('middlewares')?.count || 0} middlewares
              </Badge>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/tlsoptions')}
            >
              <IconShield className="h-5 w-5 text-orange-600" />
              <div className="text-sm font-medium">{t('traefik.tlsoptions.title')}</div>
              <Badge variant="secondary" className="text-xs">
                {workloadMap.get('tlsoptions')?.count || 0} options
              </Badge>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/traefikservices')}
            >
              <IconLayoutDashboard className="h-5 w-5 text-purple-600" />
              <div className="text-sm font-medium">{t('traefik.traefikservices.title')}</div>
              <Badge variant="secondary" className="text-xs">
                {workloadMap.get('traefikservices')?.count || 0} services
              </Badge>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* External Resources */}
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <a
            href="https://doc.traefik.io/traefik/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            {t('common.learnMore')}
            <IconExternalLink className="h-4 w-4" />
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a
            href="https://github.com/traefik/traefik"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            GitHub
            <IconExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}

export default TraefikOverview

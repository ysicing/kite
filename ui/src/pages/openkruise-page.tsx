import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { IconExternalLink, IconInfoCircle, IconDownload } from '@tabler/icons-react'

import { useOpenKruiseStatus } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function OpenKruisePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: status, isLoading, error } = useOpenKruiseStatus()

  // Mapping from workload names to their corresponding routes
  const workloadRoutes: Record<string, string> = {
    'clonesets': '/clonesets',
    'advancedstatefulsets': '/advancedstatefulsets',
    'advanceddaemonsets': '/advanceddaemonsets', 
    'broadcastjobs': '/broadcastjobs',
    'advancedcronjobs': '/advancedcronjobs',
    'sidecarsets': '/sidecarsets',
    'imagepulljobs': '/imagepulljobs',
    'nodeimages': '/nodeimages',
    // Additional resources that are not in sidebar but still clickable
    'uniteddeployments': '/uniteddeployments',
    'workloadspreads': '/workloadspreads',
    'containerrecreaterequest': '/containerrecreaterequest',
    'resourcedistributions': '/resourcedistributions',
    'persistentpodstates': '/persistentpodstates',
    'podprobemarkers': '/podprobemarkers',
    'podunavailablebudgets': '/podunavailablebudgets',
  }

  const handleWorkloadClick = (workloadName: string) => {
    const route = workloadRoutes[workloadName]
    if (route) {
      navigate(route)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">{t('openkruise.title')}</h1>
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">{t('openkruise.title')}</h1>
        </div>
        <Alert variant="destructive">
          <IconInfoCircle className="h-4 w-4" />
          <AlertDescription>
            {t('common.error')}: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!status?.installed) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">{t('openkruise.title')}</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconInfoCircle className="h-5 w-5 text-blue-500" />
              {t('openkruise.notInstalled')}
            </CardTitle>
            <CardDescription>
              {t('openkruise.notInstalledDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild>
                <a
                  href="https://openkruise.io/zh/docs/installation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <IconDownload className="h-4 w-4" />
                  {t('openkruise.installGuide')}
                  <IconExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="https://openkruise.io/zh/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  {t('openkruise.learnMore')}
                  <IconExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // OpenKruise is installed, show workloads
  const workloadCategories = [
    {
      title: t('openkruise.categories.advancedWorkloads'),
      workloads: ['clonesets', 'advancedstatefulsets', 'advanceddaemonsets', 'broadcastjobs', 'advancedcronjobs'],
    },
    {
      title: t('openkruise.categories.sidecarManagement'),
      workloads: ['sidecarsets'],
    },
    {
      title: t('openkruise.categories.multiDomainManagement'),
      workloads: ['uniteddeployments', 'workloadspreads'],
    },
    {
      title: t('openkruise.categories.enhancedOperations'),
      workloads: ['imagepulljobs', 'containerrecreaterequest', 'resourcedistributions', 'persistentpodstates', 'podprobemarkers', 'nodeimages'],
    },
    {
      title: t('openkruise.categories.applicationProtection'),
      workloads: ['podunavailablebudgets'],
    },
  ]

  const availableWorkloads = status.workloads || []
  const workloadMap = new Map(availableWorkloads.map(w => [w.name, w]))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('openkruise.title')}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              ✓ Installed
            </Badge>
            {status.version && (
              <Badge variant="outline">
                {t('openkruise.version')}: {status.version}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a
              href="https://openkruise.io/zh/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              {t('openkruise.learnMore')}
              <IconExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {availableWorkloads.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('openkruise.summary')}</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {availableWorkloads.filter(w => w.available).length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('openkruise.availableWorkloads')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {availableWorkloads.reduce((sum, w) => sum + w.count, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('openkruise.totalInstances')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {status.version || 'Unknown'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('openkruise.version')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {availableWorkloads.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('openkruise.supportedTypes')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {workloadCategories.map((category, categoryIndex) => (
        <div key={categoryIndex} className="space-y-4">
          <h2 className="text-lg font-semibold">{category.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {category.workloads.map((workloadName) => {
              const workload = workloadMap.get(workloadName)
              const isAvailable = workload?.available || false
              const count = workload?.count || 0
              
              return (
                <Card 
                  key={workloadName} 
                  className={`cursor-pointer transition-all hover:shadow-md ${isAvailable ? 'border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                  onClick={() => handleWorkloadClick(workloadName)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{t(`openkruise.${workloadName}.title`)}</span>
                      {isAvailable ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            {t('openkruise.available')}
                          </Badge>
                          {count > 0 && (
                            <Badge variant="outline">
                              {count}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline">{t('openkruise.unavailable')}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {workload?.description || t(`openkruise.${workloadName}.description`)}
                    </p>
                    {workload && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        API: {workload.apiVersion}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
} 

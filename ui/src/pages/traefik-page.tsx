import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { IconExternalLink, IconInfoCircle, IconDownload } from '@tabler/icons-react'

import { useTraefikStatus } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function TraefikPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: status, isLoading, error } = useTraefikStatus()

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
      navigate(route)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">{t('traefik.title')}</h1>
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
          <h1 className="text-2xl font-bold">{t('traefik.title')}</h1>
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
          <h1 className="text-2xl font-bold">{t('traefik.title')}</h1>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{t('traefik.notInstalled')}</CardTitle>
            </div>
            <CardDescription>
              {t('traefik.notInstalledDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t('traefik.installInstructions')}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
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
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Traefik is installed, show workloads
  const workloadCategories = [
    {
      title: t('traefik.categories'),
      workloads: ['ingressroutes', 'ingressroutetcps', 'ingressrouteudps', 'middlewares', 'middlewaretcps', 'tlsoptions', 'tlsstores', 'traefikservices', 'serverstransports'],
    },
  ]

  const availableWorkloads = status.workloads || []
  const workloadMap = new Map(availableWorkloads.map(w => [w.name, w]))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t('traefik.title')}</h1>
        <p className="text-muted-foreground">
          {t('traefik.description')}
        </p>
      </div>

      {/* Installation Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            {t('common.available')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('common.version')}: <span className="font-medium">{status.version || 'Unknown'}</span>
              </p>
            </div>
            <Badge variant="secondary">
              {availableWorkloads.filter(w => w.available).length} / {availableWorkloads.length} {t('common.available')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {availableWorkloads.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('common.summary')}</h2>
          <Card>
            <CardContent className="pt-6">
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
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    isAvailable ? '' : 'opacity-60'
                  }`}
                  onClick={() => isAvailable && handleWorkloadClick(workloadName)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {t(`nav.${workloadName}`)}
                      </CardTitle>
                      <Badge variant={isAvailable ? "default" : "secondary"}>
                        {count}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {workload?.description || t(`traefik.${workloadName}.description`)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        isAvailable ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <span className="text-xs text-muted-foreground">
                        {isAvailable ? t('common.available') : t('common.unavailable')}
                      </span>
                    </div>
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

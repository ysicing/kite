import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { AdmissionController } from '@/types/api'
import { useResource } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface AdmissionControllerDetailProps {
  name: string
  type?: string
}

export function AdmissionControllerDetail({ name, type }: AdmissionControllerDetailProps) {
  const { t } = useTranslation()

  const {
    data: controller,
    isLoading,
    isError,
    error,
  } = useResource('admission-controllers', name, undefined, {
    queryParams: type ? { type } : undefined
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError || !controller) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            <h3 className="text-lg font-medium mb-2">
              {t('common.errorLoadingResource', { resource: 'Admission Controller' })}
            </h3>
            <p className="text-muted-foreground">
              {(error as Error)?.message || 'Unknown error'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const admissionController = controller as AdmissionController
  const webhooks = (admissionController.spec?.webhooks as any[]) || []

  return (
    <div className="space-y-6">
      {/* Header with name and type */}
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">{admissionController.metadata.name}</h1>
        <Badge 
          variant={admissionController.type === 'validating' ? 'default' : 'secondary'}
          className={
            admissionController.type === 'validating' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-blue-100 text-blue-800'
          }
        >
          {admissionController.type === 'validating' ? t('nav.validatingWebhooks') : t('nav.mutatingWebhooks')}
        </Badge>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('common.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium mb-2">{t('resources.webhooks')}</h4>
              <p className="text-muted-foreground">
                {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">{t('common.created')}</h4>
              <p className="text-muted-foreground">
                {formatDate(admissionController.metadata.creationTimestamp)}
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">UID</h4>
              <p className="text-muted-foreground text-xs font-mono">
                {admissionController.metadata.uid}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks Information */}
      {webhooks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {webhooks.map((webhook: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <h5 className="font-medium mb-1">Name</h5>
                      <p className="text-muted-foreground">{webhook.name}</p>
                    </div>
                    {webhook.clientConfig?.service && (
                      <div>
                        <h5 className="font-medium mb-1">Service</h5>
                        <p className="text-muted-foreground">
                          {webhook.clientConfig.service.namespace}/{webhook.clientConfig.service.name}
                          {webhook.clientConfig.service.path && `:${webhook.clientConfig.service.path}`}
                        </p>
                      </div>
                    )}
                    {webhook.clientConfig?.url && (
                      <div>
                        <h5 className="font-medium mb-1">URL</h5>
                        <p className="text-muted-foreground text-xs break-all">
                          {webhook.clientConfig.url}
                        </p>
                      </div>
                    )}
                    {webhook.rules && webhook.rules.length > 0 && (
                      <div className="md:col-span-2 lg:col-span-3">
                        <h5 className="font-medium mb-1">Rules</h5>
                        <div className="text-muted-foreground text-sm">
                          {webhook.rules.map((rule: any, ruleIndex: number) => (
                            <div key={ruleIndex} className="mb-2">
                              <span className="font-medium">Operations:</span> {rule.operations?.join(', ')}<br />
                              <span className="font-medium">Resources:</span> {rule.resources?.join(', ')}<br />
                              {rule.apiGroups && (
                                <>
                                  <span className="font-medium">API Groups:</span> {rule.apiGroups.join(', ')}<br />
                                </>
                              )}
                              {rule.apiVersions && (
                                <>
                                  <span className="font-medium">API Versions:</span> {rule.apiVersions.join(', ')}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Route wrapper for AdmissionControllerDetail
export default function AdmissionControllerDetailWrapper() {
  const { name } = useParams<{ name: string }>()
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type')
  
  return <AdmissionControllerDetail name={name || ''} type={type || undefined} />
}

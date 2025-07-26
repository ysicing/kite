import { Ingress } from 'kubernetes-types/networking/v1'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export function TLSInfo({ ingress }: { ingress: Ingress }) {
  const { t } = useTranslation()
  
  // Extract TLS information from the ingress
  const tls = ingress.spec?.tls || []
  
  if (tls.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">{t('ingress.noTLSConfigured')}</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="space-y-4">
      {tls.map((tlsEntry, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('ingress.tlsConfiguration')} {index + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">
                {t('common.hosts')}
              </Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {tlsEntry.hosts?.map((host, hostIndex) => (
                  <Badge key={hostIndex} variant="secondary">
                    {host}
                  </Badge>
                )) || <span className="text-muted-foreground">N/A</span>}
              </div>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">
                {t('ingress.secretName')}
              </Label>
              <p className="text-sm">
                {tlsEntry.secretName ? (
                  <Link 
                    to={`/secrets/${ingress.metadata?.namespace}/${tlsEntry.secretName}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {tlsEntry.secretName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">N/A</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

import { useMemo } from 'react'
import { Ingress } from 'kubernetes-types/networking/v1'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Column, SimpleTable } from './simple-table'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'

// Define the type for our table data
interface IngressRule {
  host: string
  path: string
  service: string
  servicePort: string | number
  tlsEnabled: boolean
  secret: string | undefined
  namespace: string | undefined
}

export function IngressRulesTable(props: {
  ingress: Ingress
}) {
  const { t } = useTranslation()
  const { ingress } = props
  
  // Extract TLS hosts for quick lookup
  const tlsHosts = useMemo(() => {
    const hosts = new Set<string>()
    ingress.spec?.tls?.forEach(tls => {
      tls.hosts?.forEach(host => hosts.add(host))
    })
    return hosts
  }, [ingress.spec?.tls])
  
  // Extract TLS secrets for quick lookup
  const tlsSecrets = useMemo(() => {
    const secrets = new Map<string, string>()
    ingress.spec?.tls?.forEach(tls => {
      if (tls.hosts && tls.secretName) {
        tls.hosts.forEach(host => secrets.set(host, tls.secretName!))
      }
    })
    return secrets
  }, [ingress.spec?.tls])
  
  // Prepare data for the table
  const rulesData = useMemo((): IngressRule[] => {
    const data: IngressRule[] = []
    ingress.spec?.rules?.forEach(rule => {
      rule.http?.paths?.forEach(path => {
        data.push({
          host: rule.host || '',
          path: path.path || '/',
          service: path.backend.service?.name || '',
          servicePort: path.backend.service?.port?.number || path.backend.service?.port?.name || '',
          tlsEnabled: rule.host ? tlsHosts.has(rule.host) : false,
          secret: rule.host ? tlsSecrets.get(rule.host) : undefined,
          namespace: ingress.metadata?.namespace
        })
      })
    })
    return data
  }, [ingress.spec?.rules, tlsHosts, tlsSecrets, ingress.metadata?.namespace])

  // Table columns
  const columns = useMemo(
    (): Column<IngressRule>[] => [
      {
        header: t('common.hosts'),
        accessor: (rule) => rule.host,
        cell: (value: unknown) => (
          <div className="font-medium">{value as string || '*'}</div>
        ),
      },
      {
        header: t('ingress.path'),
        accessor: (rule) => rule.path,
        cell: (value: unknown) => value as string,
      },
      {
        header: t('common.services'),
        accessor: (rule) => ({ service: rule.service, namespace: rule.namespace }),
        cell: (value: unknown) => {
          const data = value as { service: string; namespace: string | undefined }
          return data.service ? (
            <Link
              to={`/services/${data.namespace}/${data.service}`}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {data.service}
            </Link>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
        },
      },
      {
        header: t('common.port'),
        accessor: (rule) => rule.servicePort,
        cell: (value: unknown) => value as string || '-',
      },
      {
        header: t('ingress.tls'),
        accessor: (rule) => rule.tlsEnabled,
        cell: (value: unknown) => {
          return value ? (
            <Badge variant="default">{t('common.true')}</Badge>
          ) : (
            <Badge variant="secondary">{t('common.false')}</Badge>
          )
        },
      },
      {
        header: t('ingress.secret'),
        accessor: (rule) => ({ secret: rule.secret, namespace: rule.namespace }),
        cell: (value: unknown) => {
          const data = value as { secret: string | undefined; namespace: string | undefined }
          return data.secret ? (
            <Link
              to={`/secrets/${data.namespace}/${data.secret}`}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {data.secret}
            </Link>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
        },
      },
    ],
    [t]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('ingress.rules')}</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleTable
          data={rulesData}
          columns={columns}
          emptyMessage={t('common.emptyState.noResourcesFound', { resource: 'rules' })}
        />
      </CardContent>
    </Card>
  )
}

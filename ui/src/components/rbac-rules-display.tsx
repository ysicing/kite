import { useTranslation } from 'react-i18next'
import { IconApi, IconKey, IconServer, IconShield } from '@tabler/icons-react'
import { ClusterRole, Role } from 'kubernetes-types/rbac/v1'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface RBACRulesDisplayProps {
  resource: Role | ClusterRole
}

export function RBACRulesDisplay({ resource }: RBACRulesDisplayProps) {
  const { t } = useTranslation()

  const rules = resource.rules || []

  const getVerbColor = (verb: string) => {
    switch (verb.toLowerCase()) {
      case 'get':
      case 'list':
      case 'watch':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'create':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'update':
      case 'patch':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'delete':
      case 'deletecollection':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case '*':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const getResourceIcon = (resources: string[]) => {
    if (resources.some(r => r.includes('pod'))) {
      return <IconServer className="w-4 h-4" />
    }
    if (resources.some(r => r.includes('secret') || r.includes('configmap'))) {
      return <IconKey className="w-4 h-4" />
    }
    if (resources.some(r => r.includes('service') || r.includes('endpoint'))) {
      return <IconApi className="w-4 h-4" />
    }
    return <IconShield className="w-4 h-4" />
  }

  const formatResources = (resources: string[]) => {
    if (!resources || resources.length === 0) return ['*']
    return resources
  }

  const formatApiGroups = (apiGroups: string[]) => {
    if (!apiGroups || apiGroups.length === 0) return ['core']
    return apiGroups.map(group => group === '' ? 'core' : group)
  }

  if (rules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconShield className="w-5 h-5" />
            {t('rbac.permissions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t('rbac.noPermissions')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconShield className="w-5 h-5" />
          {t('rbac.permissions')}
          <Badge variant="secondary" className="ml-auto">
            {rules.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {getResourceIcon(formatResources(rule.resources || []))}
                </div>
                <div className="flex-1 space-y-3">
                  {/* API Groups */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {t('rbac.apiGroups')}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {formatApiGroups(rule.apiGroups || []).map((group, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="text-xs bg-slate-50 dark:bg-slate-800"
                        >
                          {group}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Resources */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {t('rbac.resources')}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {formatResources(rule.resources || []).map((resource, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline"
                          className="text-xs bg-blue-50 dark:bg-blue-900/20"
                        >
                          {resource}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Resource Names (if specified) */}
                  {rule.resourceNames && rule.resourceNames.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t('rbac.resourceNames')}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {rule.resourceNames.map((name, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline"
                            className="text-xs bg-cyan-50 dark:bg-cyan-900/20"
                          >
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verbs */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {t('rbac.verbs')}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(rule.verbs || []).map((verb, idx) => (
                        <Badge 
                          key={idx} 
                          className={`text-xs border-0 ${getVerbColor(verb)}`}
                        >
                          {verb}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Non-Resource URLs (for ClusterRoles) */}
                  {rule.nonResourceURLs && rule.nonResourceURLs.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t('rbac.nonResourceURLs')}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {rule.nonResourceURLs.map((url, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline"
                            className="text-xs bg-orange-50 dark:bg-orange-900/20 font-mono"
                          >
                            {url}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
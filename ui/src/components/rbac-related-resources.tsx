import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IconExternalLink, IconUser, IconUserCheck, IconShield, IconKey, IconLink } from '@tabler/icons-react'

import { useResource, useResources } from '@/lib/api'
import { extractRBACRelatedResources, findBindingsForRole, getRBACResourcePath, RBACRelatedResource } from '@/lib/rbac-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type RBACResourceType = 'clusterroles' | 'clusterrolebindings' | 'roles' | 'rolebindings'

interface RBACRelatedResourcesProps {
  resourceType: RBACResourceType
  name: string
  namespace?: string
}

export function RBACRelatedResources({ resourceType, name, namespace }: RBACRelatedResourcesProps) {
  const { t } = useTranslation()
  
  const { data: resource } = useResource(resourceType, name, namespace)
  
  // Only fetch bindings when viewing roles, not when viewing bindings themselves
  const shouldFetchBindings = resourceType === 'roles' || resourceType === 'clusterroles'
  
  // For roles, we need to fetch all bindings to find reverse relationships
  const { data: allRoleBindings, isLoading: isLoadingRoleBindings } = useResources('rolebindings', undefined, {
    disable: !shouldFetchBindings
  })
  
  const { data: allClusterRoleBindings, isLoading: isLoadingClusterRoleBindings } = useResources('clusterrolebindings', undefined, {
    disable: !shouldFetchBindings
  })
  
  const relatedResources = useMemo(() => {
    if (!resource) return []
    
    // For bindings, show the roles and subjects they bind
    if (resourceType === 'rolebindings' || resourceType === 'clusterrolebindings') {
      return extractRBACRelatedResources(resource, resourceType)
    }
    
    // For roles, show the bindings that reference them
    if ((resourceType === 'roles' || resourceType === 'clusterroles')) {
      // Show loading state while fetching bindings
      if (isLoadingRoleBindings || isLoadingClusterRoleBindings) {
        return []
      }
      
      if (allRoleBindings && allClusterRoleBindings) {
        const roleKind = resourceType === 'roles' ? 'Role' : 'ClusterRole'
        return findBindingsForRole(
          name,
          roleKind,
          namespace,
          allRoleBindings,
          allClusterRoleBindings
        )
      }
    }
    
    return []
  }, [resource, resourceType, name, namespace, allRoleBindings, allClusterRoleBindings, isLoadingRoleBindings, isLoadingClusterRoleBindings])

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'Role':
      case 'ClusterRole':
        return <IconShield className="w-4 h-4" />
      case 'RoleBinding':
      case 'ClusterRoleBinding':
        return <IconLink className="w-4 h-4" />
      case 'ServiceAccount':
        return <IconUser className="w-4 h-4" />
      case 'User':
        return <IconUser className="w-4 h-4" />
      case 'Group':
        return <IconUserCheck className="w-4 h-4" />
      default:
        return <IconKey className="w-4 h-4" />
    }
  }

  const getResourceTypeColor = (type: string) => {
    switch (type) {
      case 'Role':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'ClusterRole':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'RoleBinding':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300'
      case 'ClusterRoleBinding':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
      case 'ServiceAccount':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'User':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'Group':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const getResourceGroupTitle = (type: string) => {
    switch (type) {
      case 'Role':
        return t('rbac.referencedRole')
      case 'ClusterRole':
        return t('rbac.referencedClusterRole')
      case 'RoleBinding':
        return t('rbac.referencingRoleBindings')
      case 'ClusterRoleBinding':
        return t('rbac.referencingClusterRoleBindings')
      case 'ServiceAccount':
        return t('rbac.boundServiceAccounts')
      case 'User':
        return t('rbac.boundUsers')
      case 'Group':
        return t('rbac.boundGroups')
      default:
        return type
    }
  }

  const isLoading = shouldFetchBindings && (isLoadingRoleBindings || isLoadingClusterRoleBindings)

  if (!resource || (isLoading && shouldFetchBindings)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('common.relatedResources')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t('common.loading')}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (relatedResources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('common.relatedResources')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t('rbac.noRelatedResources')}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Group resources by type
  const groupedResources = relatedResources.reduce((acc, resource) => {
    if (!acc[resource.type]) {
      acc[resource.type] = []
    }
    acc[resource.type].push(resource)
    return acc
  }, {} as Record<string, RBACRelatedResource[]>)

  return (
    <div className="space-y-4">
      {Object.entries(groupedResources).map(([type, resources]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {getResourceIcon(type)}
              {getResourceGroupTitle(type)}
              <Badge variant="secondary" className="ml-auto">
                {resources.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resources.map((relatedResource, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className={getResourceTypeColor(relatedResource.type)}>
                      {relatedResource.type}
                    </Badge>
                    <div>
                      <p className="font-medium">{relatedResource.name}</p>
                      {relatedResource.namespace && (
                        <p className="text-sm text-muted-foreground">
                          {t('common.namespace')}: {relatedResource.namespace}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action button */}
                  <div className="flex items-center gap-2">
                    {(relatedResource.type === 'Role' || 
                      relatedResource.type === 'ClusterRole' || 
                      relatedResource.type === 'RoleBinding' ||
                      relatedResource.type === 'ClusterRoleBinding' ||
                      relatedResource.type === 'ServiceAccount') && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link to={getRBACResourcePath(relatedResource)}>
                          <IconExternalLink className="w-4 h-4 mr-1" />
                          {t('common.view')}
                        </Link>
                      </Button>
                    )}
                    
                    {(relatedResource.type === 'User' || relatedResource.type === 'Group') && (
                      <Badge variant="outline" className="text-xs">
                        {t('rbac.externalIdentity')}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
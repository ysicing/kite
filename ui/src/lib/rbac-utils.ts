import { ClusterRole, ClusterRoleBinding, Role, RoleBinding } from 'kubernetes-types/rbac/v1'

export interface RBACRelatedResource {
  type: 'Role' | 'ClusterRole' | 'ServiceAccount' | 'User' | 'Group' | 'RoleBinding' | 'ClusterRoleBinding'
  name: string
  namespace?: string
  apiVersion?: string
  kind?: string
}

export function extractRBACRelatedResources(
  resource: RoleBinding | ClusterRoleBinding | Role | ClusterRole,
  resourceType: 'rolebindings' | 'clusterrolebindings' | 'roles' | 'clusterroles'
): RBACRelatedResource[] {
  const relatedResources: RBACRelatedResource[] = []

  // For RoleBinding and ClusterRoleBinding
  if (resourceType === 'rolebindings' || resourceType === 'clusterrolebindings') {
    const binding = resource as RoleBinding | ClusterRoleBinding
    
    // Add the referenced role
    if (binding.roleRef) {
      // Validate roleRef.kind before type assertion
      const roleKind = binding.roleRef.kind
      if (roleKind !== 'Role' && roleKind !== 'ClusterRole') {
        console.warn(`Unexpected roleRef.kind: ${roleKind}`)
        return relatedResources
      }
      
      relatedResources.push({
        type: roleKind,
        name: binding.roleRef.name,
        namespace: roleKind === 'Role' ? binding.metadata?.namespace : undefined,
        apiVersion: binding.roleRef.apiGroup ? `${binding.roleRef.apiGroup}/v1` : 'rbac.authorization.k8s.io/v1',
        kind: roleKind
      })
    }

    // Add subjects (ServiceAccounts, Users, Groups)
    if (binding.subjects) {
      binding.subjects.forEach(subject => {
        // Validate subject.kind before type assertion
        const subjectKind = subject.kind
        if (subjectKind !== 'ServiceAccount' && subjectKind !== 'User' && subjectKind !== 'Group') {
          console.warn(`Unexpected subject.kind: ${subjectKind}`)
          return
        }
        
        relatedResources.push({
          type: subjectKind,
          name: subject.name,
          namespace: subjectKind === 'ServiceAccount' ? subject.namespace : undefined,
          apiVersion: subject.apiGroup ? `${subject.apiGroup}/v1` : 
                     subjectKind === 'ServiceAccount' ? 'v1' : undefined,
          kind: subjectKind
        })
      })
    }
  }

  // For Role and ClusterRole, we return empty array here since we need to query bindings
  // This will be handled by the component using the findBindingsForRole function

  return relatedResources
}

// Function to find all bindings that reference a specific role
export function findBindingsForRole(
  roleName: string,
  roleKind: 'Role' | 'ClusterRole',
  roleNamespace: string | undefined,
  allRoleBindings: RoleBinding[],
  allClusterRoleBindings: ClusterRoleBinding[]
): RBACRelatedResource[] {
  const relatedBindings: RBACRelatedResource[] = []

  // Check RoleBindings
  allRoleBindings.forEach(binding => {
    if (binding.roleRef && 
        binding.roleRef.name === roleName && 
        binding.roleRef.kind === roleKind) {
      // For Role references, also check namespace match
      if (roleKind === 'Role' && binding.metadata?.namespace !== roleNamespace) {
        return
      }
      
      relatedBindings.push({
        type: 'RoleBinding',
        name: binding.metadata?.name || `unnamed-rolebinding-${Math.random().toString(36).substr(2, 9)}`,
        namespace: binding.metadata?.namespace,
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding'
      })
    }
  })

  // Check ClusterRoleBindings (can reference both Role and ClusterRole)
  allClusterRoleBindings.forEach(binding => {
    if (binding.roleRef && 
        binding.roleRef.name === roleName && 
        binding.roleRef.kind === roleKind) {
      
      relatedBindings.push({
        type: 'ClusterRoleBinding',
        name: binding.metadata?.name || `unnamed-clusterrolebinding-${Math.random().toString(36).substr(2, 9)}`,
        namespace: undefined, // ClusterRoleBindings are cluster-scoped
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding'
      })
    }
  })

  return relatedBindings
}

export function getRBACResourcePath(resource: RBACRelatedResource): string {
  switch (resource.type) {
    case 'Role':
      return `/roles/${resource.namespace}/${resource.name}`
    case 'ClusterRole':
      return `/clusterroles/${resource.name}`
    case 'RoleBinding':
      return `/rolebindings/${resource.namespace}/${resource.name}`
    case 'ClusterRoleBinding':
      return `/clusterrolebindings/${resource.name}`
    case 'ServiceAccount':
      return `/serviceaccounts/${resource.namespace}/${resource.name}`
    case 'User':
    case 'Group':
      // Users and Groups are not Kubernetes resources, they're external
      return '#'
    default:
      return '#'
  }
}
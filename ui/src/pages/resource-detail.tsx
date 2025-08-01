import { useParams } from 'react-router-dom'

import { ResourceType } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'

import { AdvancedDaemonSetDetail } from './advanced-daemonset-detail'
import { CloneSetDetail } from './cloneset-detail'
import { ClusterRoleDetail } from './clusterrole-detail'
import { ClusterRoleBindingDetail } from './clusterrolebinding-detail'
import { DaemonSetDetail } from './daemonset-detail'
import { DeploymentDetail } from './deployment-detail'
import { IngressDetail } from './ingress-detail'
import { NodeDetail } from './node-detail'
import { PodDetail } from './pod-detail'
import { ProxyClassDetail } from './proxyclass-detail'
import { PVDetailPage } from './pv-detail-page'
import { RoleDetail } from './role-detail'
import { RoleBindingDetail } from './rolebinding-detail'
import { SimpleResourceDetail } from './simple-resource-detail'
import { StatefulSetDetail } from './statefulset-detail'
import UpgradePlanDetail from './upgrade-plan-detail'
import { MiddlewareDetail } from './middleware-detail'
import { IngressRouteDetail } from './ingressroute-detail'
import { ServiceAccountDetail } from './serviceaccount-detail'

export function ResourceDetail() {
  const { resource, namespace, name } = useParams()
  if (!resource || !name) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Invalid parameters. name are required.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  switch (resource) {
    case 'deployments':
      return <DeploymentDetail namespace={namespace!} name={name} />
    case 'clonesets':
      return <CloneSetDetail namespace={namespace!} name={name} />
    case 'pods':
      return <PodDetail namespace={namespace!} name={name} />
    case 'daemonsets':
      return <DaemonSetDetail namespace={namespace!} name={name} />
    case 'advanceddaemonsets':
      return <AdvancedDaemonSetDetail namespace={namespace!} name={name} />
    case 'statefulsets':
      return <StatefulSetDetail namespace={namespace!} name={name} />
    case 'nodes':
      return <NodeDetail name={name} />
    case 'proxyclasses':
      return <ProxyClassDetail name={name} />
    case 'plans':
      return <UpgradePlanDetail />
    case 'persistentvolumes':
      return <PVDetailPage name={name} />
    case 'middlewares':
      return <MiddlewareDetail namespace={namespace!} name={name} />
    case 'ingresses':
      return <IngressDetail namespace={namespace!} name={name} />
    case 'ingressroutes':
      return <IngressRouteDetail namespace={namespace!} name={name} />
    case 'serviceaccounts':
      return <ServiceAccountDetail namespace={namespace!} name={name} />
    // RBAC resources
    case 'clusterroles':
      return <ClusterRoleDetail name={name} />
    case 'clusterrolebindings':
      return <ClusterRoleBindingDetail name={name} />
    case 'roles':
      return <RoleDetail namespace={namespace!} name={name} />
    case 'rolebindings':
      return <RoleBindingDetail namespace={namespace!} name={name} />
    default:
      return (
        <SimpleResourceDetail
          resourceType={resource as ResourceType}
          namespace={namespace}
          name={name}
        />
      )
  }
}

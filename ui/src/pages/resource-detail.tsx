import { useParams } from 'react-router-dom'

import { ResourceType } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'

import { AdvancedDaemonSetDetail } from './advanced-daemonset-detail'
import { CloneSetDetail } from './cloneset-detail'
import { DaemonSetDetail } from './daemonset-detail'
import { DeploymentDetail } from './deployment-detail'
import { NodeDetail } from './node-detail'
import { PodDetail } from './pod-detail'
import { ProxyClassDetail } from './proxyclass-detail'
import { SimpleResourceDetail } from './simple-resource-detail'
import { StatefulSetDetail } from './statefulset-detail'
import UpgradePlanDetail from './upgrade-plan-detail'

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

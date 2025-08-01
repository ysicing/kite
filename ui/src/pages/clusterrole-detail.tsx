import { RBACResourceDetail } from './rbac-resource-detail'

export function ClusterRoleDetail(props: { name: string }) {
  return (
    <RBACResourceDetail
      resourceType="clusterroles"
      name={props.name}
    />
  )
}
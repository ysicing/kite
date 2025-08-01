import { RBACResourceDetail } from './rbac-resource-detail'

export function ClusterRoleBindingDetail(props: { name: string }) {
  return (
    <RBACResourceDetail
      resourceType="clusterrolebindings"
      name={props.name}
    />
  )
}
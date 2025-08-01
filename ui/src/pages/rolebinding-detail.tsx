import { RBACResourceDetail } from './rbac-resource-detail'

export function RoleBindingDetail(props: { namespace: string; name: string }) {
  return (
    <RBACResourceDetail
      resourceType="rolebindings"
      name={props.name}
      namespace={props.namespace}
    />
  )
}
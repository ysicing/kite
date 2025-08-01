import { RBACResourceDetail } from './rbac-resource-detail'

export function RoleDetail(props: { namespace: string; name: string }) {
  return (
    <RBACResourceDetail
      resourceType="roles"
      name={props.name}
      namespace={props.namespace}
    />
  )
}
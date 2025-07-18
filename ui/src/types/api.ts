// API types for Custom Resources

import { CustomResourceDefinition } from 'kubernetes-types/apiextensions/v1'
import {
  DaemonSet,
  Deployment,
  ReplicaSet,
  StatefulSet,
} from 'kubernetes-types/apps/v1'
import { CronJob, Job } from 'kubernetes-types/batch/v1'
import {
  ConfigMap,
  Event,
  Namespace,
  Node,
  PersistentVolume,
  PersistentVolumeClaim,
  Pod,
  Secret,
  Service,
} from 'kubernetes-types/core/v1'
import { Ingress } from 'kubernetes-types/networking/v1'
import { StorageClass } from 'kubernetes-types/storage/v1'

import { CloneSet } from '@/types/k8s'

// Cluster types
export interface Cluster {
  name: string
  version: string
  isDefault: boolean
}

export interface CustomResource {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace?: string
    creationTimestamp: string
    uid?: string
    resourceVersion?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
}

export interface CustomResourceList {
  apiVersion: string
  kind: string
  items: CustomResource[]
  metadata?: {
    continue?: string
    remainingItemCount?: number
  }
}

export interface DeploymentRelatedResource {
  events: Event[]
  pods: Pod[]
  services: Service[]
}

// Resource type definitions
export type ResourceType =
  | 'pods'
  | 'deployments'
  | 'statefulsets'
  | 'daemonsets'
  | 'jobs'
  | 'cronjobs'
  | 'services'
  | 'configmaps'
  | 'secrets'
  | 'ingresses'
  | 'namespaces'
  | 'crds'
  | 'crs'
  | 'nodes'
  | 'events'
  | 'persistentvolumes'
  | 'persistentvolumeclaims'
  | 'storageclasses'
  | 'podmetrics'
  | 'replicasets'
  | 'clonesets'
  | 'nodeimages'
  | 'connectors'
  | 'proxyclasses'
  | 'proxygroups'
  | 'plans'

export const clusterScopeResources: ResourceType[] = [
  'crds',
  'namespaces',
  'persistentvolumes',
  'nodes',
  'events',
  'storageclasses',
  'nodeimages',
  'connectors',
  'proxyclasses',
  'proxygroups',
  'plans',
]

type listMetadataType = {
  continue?: string
  remainingItemCount?: number
}

// Define resource type mappings
export interface ResourcesTypeMap {
  pods: {
    items: Pod[]
    metadata?: listMetadataType
  }
  deployments: {
    items: Deployment[]
    metadata?: listMetadataType
  }
  statefulsets: {
    items: StatefulSet[]
    metadata?: listMetadataType
  }
  daemonsets: {
    items: DaemonSet[]
    metadata?: listMetadataType
  }
  jobs: {
    items: Job[]
    metadata?: listMetadataType
  }
  cronjobs: {
    items: CronJob[]
    metadata?: listMetadataType
  }
  services: {
    items: Service[]
    metadata?: listMetadataType
  }
  configmaps: {
    items: ConfigMap[]
    metadata?: listMetadataType
  }
  secrets: {
    items: Secret[]
    metadata?: listMetadataType
  }
  persistentvolumeclaims: {
    items: PersistentVolumeClaim[]
    metadata?: listMetadataType
  }
  ingresses: {
    items: Ingress[]
    metadata?: listMetadataType
  }
  namespaces: {
    items: Namespace[]
    metadata?: listMetadataType
  }
  crds: {
    items: CustomResourceDefinition[]
    metadata?: listMetadataType
  }
  crs: {
    items: CustomResource[]
    metadata?: listMetadataType
  }
  nodes: {
    items: Node[]
    metadata?: listMetadataType
  }
  events: {
    items: Event[]
    metadata?: listMetadataType
  }
  persistentvolumes: {
    items: PersistentVolume[]
    metadata?: listMetadataType
  }
  storageclasses: {
    items: StorageClass[]
    metadata?: listMetadataType
  }
  podmetrics: {
    items: PodMetrics[]
    metadata?: listMetadataType
  }
  replicasets: {
    items: ReplicaSet[]
    metadata?: listMetadataType
  }
  clonesets: {
    items: CloneSet[]
    metadata?: listMetadataType
  }
  nodeimages: {
    items: CustomResource[]
    metadata?: listMetadataType
  }
  connectors: {
    items: CustomResource[]
    metadata?: listMetadataType
  }
  proxyclasses: {
    items: CustomResource[]
    metadata?: listMetadataType
  }
  proxygroups: {
    items: CustomResource[]
    metadata?: listMetadataType
  }
  plans: {
    items: CustomResource[]
    metadata?: listMetadataType
  }
}

export interface PodMetrics {
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    creationTimestamp?: string
    uid?: string
    resourceVersion?: string
  }
  containers: {
    name: string // container name
    usage: {
      cpu: string // 214572390n
      memory: string // 2956516Ki
    }
  }[]
}

export interface ResourceTypeMap {
  pods: Pod
  deployments: Deployment
  statefulsets: StatefulSet
  daemonsets: DaemonSet
  jobs: Job
  cronjobs: CronJob
  services: Service
  configmaps: ConfigMap
  secrets: Secret
  persistentvolumeclaims: PersistentVolumeClaim
  ingresses: Ingress
  namespaces: Namespace
  crds: CustomResourceDefinition
  crs: CustomResource
  nodes: Node
  events: Event
  persistentvolumes: PersistentVolume
  storageclasses: StorageClass
  replicasets: ReplicaSet
  podmetrics: PodMetrics
  clonesets: CloneSet
  nodeimages: CustomResource
  connectors: CustomResource
  proxyclasses: CustomResource
  proxygroups: CustomResource
  plans: CustomResource
}

export interface RecentEvent {
  type: string
  reason: string
  message: string
  involvedObjectKind: string
  involvedObjectName: string
  namespace?: string
  timestamp: string
}

export interface UsageDataPoint {
  timestamp: string
  value: number
}

export interface ResourceUsageHistory {
  cpu: UsageDataPoint[]
  memory: UsageDataPoint[]
  networkIn: UsageDataPoint[]
  networkOut: UsageDataPoint[]
  diskRead: UsageDataPoint[]
  diskWrite: UsageDataPoint[]
}

// Pod monitoring types
export interface PodMetrics {
  cpu: UsageDataPoint[]
  memory: UsageDataPoint[]
  networkIn?: UsageDataPoint[]
  networkOut?: UsageDataPoint[]
  diskRead?: UsageDataPoint[]
  diskWrite?: UsageDataPoint[]
  fallback?: boolean
}

export interface OverviewData {
  totalNodes: number
  readyNodes: number
  totalPods: number
  runningPods: number
  totalNamespaces: number
  totalServices: number
  prometheusEnabled: boolean
  resource: {
    cpu: {
      allocatable: number
      requested: number
      limited: number
    }
    memory: {
      allocatable: number
      requested: number
      limited: number
    }
  }
}

// Pagination types
export interface PaginationInfo {
  hasNextPage: boolean
  nextContinueToken?: string
  remainingItems?: number
}

export interface PaginationOptions {
  limit?: number
  continueToken?: string
}

// Pod current metrics types
export interface PodCurrentMetrics {
  podName: string
  namespace: string
  cpu: number // CPU cores
  memory: number // Memory in MB
}

// Node detailed information
export interface NodeDetailInfo extends Node {
  // 资源使用情况 (原始Quantity字符串)
  cpuUsage?: string
  memoryUsage?: string
  
  // 资源分配情况 (原始Quantity字符串)
  cpuRequested?: string
  memoryRequested?: string
  cpuLimited?: string
  memoryLimited?: string
  
  // 资源使用情况 (转换为核心数/字节数)
  cpuUsageCores: number
  memoryUsageBytes: number
  
  // 资源分配情况 (转换为核心数/字节数)
  cpuRequestedCores: number
  memoryRequestedBytes: number
  cpuLimitedCores: number
  memoryLimitedBytes: number
  
  // 资源容量 (转换为核心数/字节数)
  cpuCapacityCores: number
  memoryCapacityBytes: number
  cpuAllocatableCores: number
  memoryAllocatableBytes: number
  
  // Pod信息
  podCount: number
  podCapacity: number
  
  // 存活时间
  age: string
  
  // 使用率百分比
  cpuUsagePercent: number
  memoryUsagePercent: number
  cpuRequestedPercent: number
  memoryRequestedPercent: number
  podUsagePercent: number
}

export interface NodeDetailList {
  items: NodeDetailInfo[]
}

// System Upgrade Controller Types
export interface UpgradePlan extends CustomResource {
  spec: {
    concurrency?: number
    nodeSelector?: {
      matchLabels?: Record<string, string>
      matchExpressions?: Array<{
        key: string
        operator: string
        values?: string[]
      }>
    }
    serviceAccountName?: string
    upgrade: {
      image: string
      command?: string[]
      args?: string[]
      envs?: Array<{
        name: string
        value?: string
        valueFrom?: any
      }>
    }
    drain?: {
      enabled?: boolean
      timeout?: string
      ignoreDaemonSets?: boolean
      deleteLocalData?: boolean
    }
    version?: string
    channel?: string
  }
  status?: {
    conditions?: Array<{
      type: string
      status: string
      lastUpdateTime: string
      reason?: string
      message?: string
    }>
    applying?: Array<{
      name: string
      image: string
      phase: string
    }>
  }
}

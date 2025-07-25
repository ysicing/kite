export type DeploymentStatusType =
  | 'Unknown'
  | 'Paused'
  | 'Scaled Down'
  | 'Not Available'
  | 'Progressing'
  | 'Terminating'
  | 'Available'

export type CloneSetStatusType = DeploymentStatusType

export type AdvancedDaemonSetStatusType =
  | 'Unknown'
  | 'Pending'
  | 'Available'
  | 'In Progress'

// CloneSet types based on OpenKruise API
export interface CloneSet {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace?: string
    creationTimestamp?: string
    uid?: string
    resourceVersion?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    deletionTimestamp?: string
    ownerReferences?: Array<{
      apiVersion: string
      kind: string
      name: string
      uid: string
      controller?: boolean
    }>
  }
  spec: {
    replicas?: number
    selector: {
      matchLabels?: Record<string, string>
    }
    template: {
      metadata?: {
        labels?: Record<string, string>
        annotations?: Record<string, string>
      }
      spec: {
        containers: Array<{
          name: string
          image: string
          ports?: Array<{
            containerPort: number
            protocol?: string
          }>
          env?: Array<{
            name: string
            value?: string
          }>
          resources?: {
            requests?: {
              cpu?: string
              memory?: string
            }
            limits?: {
              cpu?: string
              memory?: string
            }
          }
          volumeMounts?: Array<{
            name: string
            mountPath: string
          }>
          imagePullPolicy?: string
        }>
        volumes?: Array<{
          name: string
          configMap?: {
            name: string
          }
          secret?: {
            secretName: string
          }
          persistentVolumeClaim?: {
            claimName: string
          }
          emptyDir?: Record<string, unknown>
        }>
        restartPolicy?: string
        serviceAccountName?: string
        imagePullSecrets?: Array<{
          name: string
        }>
      }
    }
    updateStrategy?: {
      type?: string
      rollingUpdate?: {
        maxUnavailable?: number | string
        maxSurge?: number | string
        partition?: number
      }
    }
    scaleStrategy?: {
      podsToDelete?: string[]
      disablePVCReuse?: boolean
    }
    volumeClaimTemplates?: Array<{
      metadata: {
        name: string
      }
      spec: {
        accessModes: string[]
        resources: {
          requests: {
            storage: string
          }
        }
        storageClassName?: string
      }
    }>
  }
  status?: {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
    updatedReplicas?: number
    currentReplicas?: number
    collisionCount?: number
    conditions?: Array<{
      type: string
      status: string
      lastTransitionTime?: string
      lastUpdateTime?: string
      reason?: string
      message?: string
    }>
    observedGeneration?: number
  }
}

// AdvancedDaemonSet types based on OpenKruise API
export interface AdvancedDaemonSet {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace?: string
    creationTimestamp?: string
    uid?: string
    resourceVersion?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    deletionTimestamp?: string
    ownerReferences?: Array<{
      apiVersion: string
      kind: string
      name: string
      uid: string
      controller?: boolean
    }>
  }
  spec: {
    selector: {
      matchLabels: Record<string, string>
    }
    template: {
      metadata?: {
        labels?: Record<string, string>
        annotations?: Record<string, string>
      }
      spec: {
        containers: Array<{
          name: string
          image: string
          ports?: Array<{
            containerPort: number
            protocol?: string
          }>
          env?: Array<{
            name: string
            value?: string
          }>
          resources?: {
            requests?: {
              cpu?: string
              memory?: string
            }
            limits?: {
              cpu?: string
              memory?: string
            }
          }
          volumeMounts?: Array<{
            name: string
            mountPath: string
          }>
          imagePullPolicy?: string
        }>
        volumes?: Array<{
          name: string
          configMap?: {
            name: string
          }
          secret?: {
            secretName: string
          }
          persistentVolumeClaim?: {
            claimName: string
          }
          emptyDir?: Record<string, unknown>
        }>
        restartPolicy?: string
        serviceAccountName?: string
        imagePullSecrets?: Array<{
          name: string
        }>
        nodeSelector?: Record<string, string>
        tolerations?: Array<{
          key?: string
          operator?: string
          value?: string
          effect?: string
          tolerationSeconds?: number
        }>
        hostNetwork?: boolean
        hostPID?: boolean
        hostIPC?: boolean
        dnsPolicy?: string
      }
    }
    updateStrategy?: {
      type?: string
      rollingUpdate?: {
        maxUnavailable?: number | string
        partition?: number
      }
    }
    revisionHistoryLimit?: number
    minReadySeconds?: number
  }
  status?: {
    currentNumberScheduled?: number
    desiredNumberScheduled?: number
    numberMisscheduled?: number
    numberReady?: number
    updatedNumberScheduled?: number
    numberAvailable?: number
    numberUnavailable?: number
    observedGeneration?: number
    conditions?: Array<{
      type: string
      status: string
      lastTransitionTime?: string
      lastUpdateTime?: string
      reason?: string
      message?: string
    }>
    collisionCount?: number
  }
}

package resources

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/types"

	"github.com/zxh326/kite/pkg/cluster"

	kruiseappsv1alpha1 "github.com/openkruise/kruise-api/apps/v1alpha1"
	kruiseappsv1beta1 "github.com/openkruise/kruise-api/apps/v1beta1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
)

// KruiseOperationType defines the type of operation to perform
type KruiseOperationType string

const (
	KruiseScale   KruiseOperationType = "scale"
	KruiseRestart KruiseOperationType = "restart"
)

// RestartedEnvKey is the environment variable key used for triggering restarts
// This matches the approach used by kruise-tools
const RestartedEnvKey = "RESTARTED_AT"

// RestartAnnotationKey is the annotation key used for triggering restarts for native Kubernetes resources
// This matches the approach used by kubectl rollout restart
const RestartAnnotationKey = "kiteplus.kubernetes.io/restartedAt"

// KruiseWorkloadType defines the supported OpenKruise workload types
type KruiseWorkloadType string

const (
	CloneSetType            KruiseWorkloadType = "CloneSet"
	AdvancedStatefulSetType KruiseWorkloadType = "AdvancedStatefulSet"
	AdvancedDaemonSetType   KruiseWorkloadType = "AdvancedDaemonSet"
	AdvancedCronJobType     KruiseWorkloadType = "AdvancedCronJob"
	UnitedDeploymentType    KruiseWorkloadType = "UnitedDeployment"
	SidecarSetType          KruiseWorkloadType = "SidecarSet"
	// Native Kubernetes workload types
	StatefulSetType KruiseWorkloadType = "StatefulSet"
	DaemonSetType   KruiseWorkloadType = "DaemonSet"
	DeploymentType  KruiseWorkloadType = "Deployment"
)

// KruiseOperationRequest represents a request for Kruise workload operations
type KruiseOperationRequest struct {
	WorkloadType KruiseWorkloadType  `json:"workloadType"`
	Operation    KruiseOperationType `json:"operation"`
	Namespace    string              `json:"namespace"`
	Name         string              `json:"name"`
	Replicas     *int32              `json:"replicas,omitempty"` // For scale operations
}

// updateContainerEnv updates environment variables for a container
// It adds the restart environment variable while preserving existing ones
func updateContainerEnv(envVars []corev1.EnvVar, restartedAt string) []corev1.EnvVar {
	// Remove existing RESTARTED_AT env var if it exists
	filtered := make([]corev1.EnvVar, 0, len(envVars))
	for _, env := range envVars {
		if env.Name != RestartedEnvKey {
			filtered = append(filtered, env)
		}
	}

	// Add the new restart environment variable
	restartEnv := corev1.EnvVar{
		Name:  RestartedEnvKey,
		Value: restartedAt,
	}
	filtered = append(filtered, restartEnv)

	return filtered
}

// KruiseOperationResult represents the result of a Kruise operation
type KruiseOperationResult struct {
	Success         bool   `json:"success"`
	Message         string `json:"message"`
	ErrorDetail     string `json:"error,omitempty"`
	RestartedAt     string `json:"restartedAt,omitempty"`     // For restart operations
	CurrentReplicas *int32 `json:"currentReplicas,omitempty"` // For scale operations
}

// KruiseOperationsInterface defines operations for OpenKruise workloads
type KruiseOperationsInterface interface {
	Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error
	Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) (string, error) // Returns restartedAt timestamp
	GetWorkloadType() KruiseWorkloadType
	ValidateRestart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error // Validate if restart is possible
}

// CloneSetOperations implements operations for CloneSet
type CloneSetOperations struct{}

func (o *CloneSetOperations) GetWorkloadType() KruiseWorkloadType {
	return CloneSetType
}

func (o *CloneSetOperations) Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error {
	var cloneSet kruiseappsv1alpha1.CloneSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &cloneSet); err != nil {
		return fmt.Errorf("failed to get CloneSet %s/%s: %w", namespace, name, err)
	}

	cloneSet.Spec.Replicas = &replicas
	if err := cs.K8sClient.Update(ctx, &cloneSet); err != nil {
		return fmt.Errorf("failed to update CloneSet replicas: %w", err)
	}

	return nil
}

func (o *CloneSetOperations) ValidateRestart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var cloneSet kruiseappsv1alpha1.CloneSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &cloneSet); err != nil {
		return fmt.Errorf("failed to get CloneSet %s/%s: %w", namespace, name, err)
	}

	// Check if CloneSet is in a valid state for restart
	if cloneSet.Spec.Replicas != nil && *cloneSet.Spec.Replicas == 0 {
		return fmt.Errorf("cannot restart CloneSet with 0 replicas")
	}

	return nil
}

func (o *CloneSetOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) (string, error) {
	// Validate first
	if err := o.ValidateRestart(ctx, cs, namespace, name); err != nil {
		return "", err
	}

	var cloneSet kruiseappsv1alpha1.CloneSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &cloneSet); err != nil {
		return "", fmt.Errorf("failed to get CloneSet %s/%s: %w", namespace, name, err)
	}

	// Generate restart timestamp
	restartedAt := time.Now().Format(time.RFC3339)

	// Update environment variables for all containers
	for i := range cloneSet.Spec.Template.Spec.Containers {
		cloneSet.Spec.Template.Spec.Containers[i].Env = updateContainerEnv(
			cloneSet.Spec.Template.Spec.Containers[i].Env,
			restartedAt,
		)
	}

	if err := cs.K8sClient.Update(ctx, &cloneSet); err != nil {
		return "", fmt.Errorf("failed to restart CloneSet: %w", err)
	}

	return restartedAt, nil
}

// AdvancedStatefulSetOperations implements operations for AdvancedStatefulSet
type AdvancedStatefulSetOperations struct{}

func (o *AdvancedStatefulSetOperations) GetWorkloadType() KruiseWorkloadType {
	return AdvancedStatefulSetType
}

func (o *AdvancedStatefulSetOperations) Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error {
	var statefulSet kruiseappsv1beta1.StatefulSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &statefulSet); err != nil {
		return fmt.Errorf("failed to get AdvancedStatefulSet %s/%s: %w", namespace, name, err)
	}

	statefulSet.Spec.Replicas = &replicas
	if err := cs.K8sClient.Update(ctx, &statefulSet); err != nil {
		return fmt.Errorf("failed to update AdvancedStatefulSet replicas: %w", err)
	}

	return nil
}

func (o *AdvancedStatefulSetOperations) ValidateRestart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var statefulSet kruiseappsv1beta1.StatefulSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &statefulSet); err != nil {
		return fmt.Errorf("failed to get AdvancedStatefulSet %s/%s: %w", namespace, name, err)
	}

	// Check if StatefulSet is in a valid state for restart
	if statefulSet.Spec.Replicas != nil && *statefulSet.Spec.Replicas == 0 {
		return fmt.Errorf("cannot restart AdvancedStatefulSet with 0 replicas")
	}

	return nil
}

func (o *AdvancedStatefulSetOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) (string, error) {
	// Validate first
	if err := o.ValidateRestart(ctx, cs, namespace, name); err != nil {
		return "", err
	}

	var statefulSet kruiseappsv1beta1.StatefulSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &statefulSet); err != nil {
		return "", fmt.Errorf("failed to get AdvancedStatefulSet %s/%s: %w", namespace, name, err)
	}

	// Generate restart timestamp
	restartedAt := time.Now().Format(time.RFC3339)

	// Update environment variables for all containers
	for i := range statefulSet.Spec.Template.Spec.Containers {
		statefulSet.Spec.Template.Spec.Containers[i].Env = updateContainerEnv(
			statefulSet.Spec.Template.Spec.Containers[i].Env,
			restartedAt,
		)
	}

	if err := cs.K8sClient.Update(ctx, &statefulSet); err != nil {
		return "", fmt.Errorf("failed to restart AdvancedStatefulSet: %w", err)
	}

	return restartedAt, nil
}

// UnitedDeploymentOperations implements operations for UnitedDeployment
type UnitedDeploymentOperations struct{}

func (o *UnitedDeploymentOperations) GetWorkloadType() KruiseWorkloadType {
	return UnitedDeploymentType
}

func (o *UnitedDeploymentOperations) Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error {
	var unitedDeployment kruiseappsv1alpha1.UnitedDeployment
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &unitedDeployment); err != nil {
		return fmt.Errorf("failed to get UnitedDeployment %s/%s: %w", namespace, name, err)
	}

	unitedDeployment.Spec.Replicas = &replicas
	if err := cs.K8sClient.Update(ctx, &unitedDeployment); err != nil {
		return fmt.Errorf("failed to update UnitedDeployment replicas: %w", err)
	}

	return nil
}

func (o *UnitedDeploymentOperations) ValidateRestart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var unitedDeployment kruiseappsv1alpha1.UnitedDeployment
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &unitedDeployment); err != nil {
		return fmt.Errorf("failed to get UnitedDeployment %s/%s: %w", namespace, name, err)
	}

	// Check if UnitedDeployment is in a valid state for restart
	if unitedDeployment.Spec.Replicas != nil && *unitedDeployment.Spec.Replicas == 0 {
		return fmt.Errorf("cannot restart UnitedDeployment with 0 replicas")
	}

	// Validate that at least one supported template is defined
	hasTemplate := unitedDeployment.Spec.Template.StatefulSetTemplate != nil ||
		unitedDeployment.Spec.Template.AdvancedStatefulSetTemplate != nil ||
		unitedDeployment.Spec.Template.CloneSetTemplate != nil ||
		unitedDeployment.Spec.Template.DeploymentTemplate != nil

	if !hasTemplate {
		return fmt.Errorf("UnitedDeployment has no valid template defined (supported: StatefulSet, AdvancedStatefulSet, CloneSet, Deployment)")
	}

	return nil
}

func (o *UnitedDeploymentOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) (string, error) {
	// Validate first
	if err := o.ValidateRestart(ctx, cs, namespace, name); err != nil {
		return "", err
	}

	var unitedDeployment kruiseappsv1alpha1.UnitedDeployment
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &unitedDeployment); err != nil {
		return "", fmt.Errorf("failed to get UnitedDeployment %s/%s: %w", namespace, name, err)
	}

	// Generate restart timestamp
	restartedAt := time.Now().Format(time.RFC3339)

	// Handle different template types with appropriate restart methods:
	// - Kruise resources (CloneSet, AdvancedStatefulSet): use environment variables
	// - Native Kubernetes resources (StatefulSet, Deployment): use annotations

	// Check for native StatefulSet template
	if unitedDeployment.Spec.Template.StatefulSetTemplate != nil {
		// Use annotation for native StatefulSet
		if unitedDeployment.Spec.Template.StatefulSetTemplate.Spec.Template.Annotations == nil {
			unitedDeployment.Spec.Template.StatefulSetTemplate.Spec.Template.Annotations = make(map[string]string)
		}
		unitedDeployment.Spec.Template.StatefulSetTemplate.Spec.Template.Annotations[RestartAnnotationKey] = restartedAt
	}

	// Check for AdvancedStatefulSet template (Kruise resource)
	if unitedDeployment.Spec.Template.AdvancedStatefulSetTemplate != nil {
		// Use environment variables for Kruise AdvancedStatefulSet
		for i := range unitedDeployment.Spec.Template.AdvancedStatefulSetTemplate.Spec.Template.Spec.Containers {
			unitedDeployment.Spec.Template.AdvancedStatefulSetTemplate.Spec.Template.Spec.Containers[i].Env = updateContainerEnv(
				unitedDeployment.Spec.Template.AdvancedStatefulSetTemplate.Spec.Template.Spec.Containers[i].Env,
				restartedAt,
			)
		}
	}

	// Check for CloneSet template (Kruise resource)
	if unitedDeployment.Spec.Template.CloneSetTemplate != nil {
		// Use environment variables for Kruise CloneSet
		for i := range unitedDeployment.Spec.Template.CloneSetTemplate.Spec.Template.Spec.Containers {
			unitedDeployment.Spec.Template.CloneSetTemplate.Spec.Template.Spec.Containers[i].Env = updateContainerEnv(
				unitedDeployment.Spec.Template.CloneSetTemplate.Spec.Template.Spec.Containers[i].Env,
				restartedAt,
			)
		}
	}

	// Check for native Deployment template
	if unitedDeployment.Spec.Template.DeploymentTemplate != nil {
		// Use annotation for native Deployment
		if unitedDeployment.Spec.Template.DeploymentTemplate.Spec.Template.Annotations == nil {
			unitedDeployment.Spec.Template.DeploymentTemplate.Spec.Template.Annotations = make(map[string]string)
		}
		unitedDeployment.Spec.Template.DeploymentTemplate.Spec.Template.Annotations[RestartAnnotationKey] = restartedAt
	}

	if err := cs.K8sClient.Update(ctx, &unitedDeployment); err != nil {
		return "", fmt.Errorf("failed to restart UnitedDeployment: %w", err)
	}

	return restartedAt, nil
}

// AdvancedDaemonSetOperations implements operations for AdvancedDaemonSet
type AdvancedDaemonSetOperations struct{}

func (o *AdvancedDaemonSetOperations) GetWorkloadType() KruiseWorkloadType {
	return AdvancedDaemonSetType
}

func (o *AdvancedDaemonSetOperations) Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error {
	// DaemonSets don't support replica scaling - they run one pod per node
	return fmt.Errorf("AdvancedDaemonSet does not support replica scaling")
}

func (o *AdvancedDaemonSetOperations) ValidateRestart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var daemonSet kruiseappsv1alpha1.DaemonSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &daemonSet); err != nil {
		return fmt.Errorf("failed to get AdvancedDaemonSet %s/%s: %w", namespace, name, err)
	}

	// DaemonSets are generally always restartable since they don't have replicas
	// Just ensure the resource exists and is accessible
	return nil
}

func (o *AdvancedDaemonSetOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) (string, error) {
	// Validate first
	if err := o.ValidateRestart(ctx, cs, namespace, name); err != nil {
		return "", err
	}

	var daemonSet kruiseappsv1alpha1.DaemonSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &daemonSet); err != nil {
		return "", fmt.Errorf("failed to get AdvancedDaemonSet %s/%s: %w", namespace, name, err)
	}

	// Generate restart timestamp
	restartedAt := time.Now().Format(time.RFC3339)

	// Update environment variables for all containers
	for i := range daemonSet.Spec.Template.Spec.Containers {
		daemonSet.Spec.Template.Spec.Containers[i].Env = updateContainerEnv(
			daemonSet.Spec.Template.Spec.Containers[i].Env,
			restartedAt,
		)
	}

	if err := cs.K8sClient.Update(ctx, &daemonSet); err != nil {
		return "", fmt.Errorf("failed to restart AdvancedDaemonSet: %w", err)
	}

	return restartedAt, nil
}

// Native Kubernetes Resource Operations

// StatefulSetOperations implements operations for native StatefulSet
type StatefulSetOperations struct{}

func (o *StatefulSetOperations) GetWorkloadType() KruiseWorkloadType {
	return StatefulSetType
}

func (o *StatefulSetOperations) Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error {
	var statefulSet appsv1.StatefulSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &statefulSet); err != nil {
		return fmt.Errorf("failed to get StatefulSet %s/%s: %w", namespace, name, err)
	}

	statefulSet.Spec.Replicas = &replicas
	if err := cs.K8sClient.Update(ctx, &statefulSet); err != nil {
		return fmt.Errorf("failed to update StatefulSet replicas: %w", err)
	}

	return nil
}

func (o *StatefulSetOperations) ValidateRestart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var statefulSet appsv1.StatefulSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &statefulSet); err != nil {
		return fmt.Errorf("failed to get StatefulSet %s/%s: %w", namespace, name, err)
	}

	// Check if StatefulSet is in a valid state for restart
	if statefulSet.Spec.Replicas != nil && *statefulSet.Spec.Replicas == 0 {
		return fmt.Errorf("cannot restart StatefulSet with 0 replicas")
	}

	return nil
}

func (o *StatefulSetOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) (string, error) {
	// Validate first
	if err := o.ValidateRestart(ctx, cs, namespace, name); err != nil {
		return "", err
	}

	var statefulSet appsv1.StatefulSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &statefulSet); err != nil {
		return "", fmt.Errorf("failed to get StatefulSet %s/%s: %w", namespace, name, err)
	}

	// Generate restart timestamp
	restartedAt := time.Now().Format(time.RFC3339)

	// Add restart annotation to trigger rolling update for native StatefulSet
	if statefulSet.Spec.Template.Annotations == nil {
		statefulSet.Spec.Template.Annotations = make(map[string]string)
	}
	statefulSet.Spec.Template.Annotations[RestartAnnotationKey] = restartedAt

	if err := cs.K8sClient.Update(ctx, &statefulSet); err != nil {
		return "", fmt.Errorf("failed to restart StatefulSet: %w", err)
	}

	return restartedAt, nil
}

// DaemonSetOperations implements operations for native DaemonSet
type DaemonSetOperations struct{}

func (o *DaemonSetOperations) GetWorkloadType() KruiseWorkloadType {
	return DaemonSetType
}

func (o *DaemonSetOperations) Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error {
	// DaemonSets don't support replica scaling - they run one pod per node
	return fmt.Errorf("DaemonSet does not support replica scaling")
}

func (o *DaemonSetOperations) ValidateRestart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var daemonSet appsv1.DaemonSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &daemonSet); err != nil {
		return fmt.Errorf("failed to get DaemonSet %s/%s: %w", namespace, name, err)
	}

	// DaemonSets are generally always restartable since they don't have replicas
	// Just ensure the resource exists and is accessible
	return nil
}

func (o *DaemonSetOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) (string, error) {
	// Validate first
	if err := o.ValidateRestart(ctx, cs, namespace, name); err != nil {
		return "", err
	}

	var daemonSet appsv1.DaemonSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &daemonSet); err != nil {
		return "", fmt.Errorf("failed to get DaemonSet %s/%s: %w", namespace, name, err)
	}

	// Generate restart timestamp
	restartedAt := time.Now().Format(time.RFC3339)

	// Add restart annotation to trigger rolling update for native DaemonSet
	if daemonSet.Spec.Template.Annotations == nil {
		daemonSet.Spec.Template.Annotations = make(map[string]string)
	}
	daemonSet.Spec.Template.Annotations[RestartAnnotationKey] = restartedAt

	if err := cs.K8sClient.Update(ctx, &daemonSet); err != nil {
		return "", fmt.Errorf("failed to restart DaemonSet: %w", err)
	}

	return restartedAt, nil
}

// DeploymentOperations implements operations for native Deployment
type DeploymentOperations struct{}

func (o *DeploymentOperations) GetWorkloadType() KruiseWorkloadType {
	return DeploymentType
}

func (o *DeploymentOperations) Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error {
	var deployment appsv1.Deployment
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &deployment); err != nil {
		return fmt.Errorf("failed to get Deployment %s/%s: %w", namespace, name, err)
	}

	deployment.Spec.Replicas = &replicas
	if err := cs.K8sClient.Update(ctx, &deployment); err != nil {
		return fmt.Errorf("failed to update Deployment replicas: %w", err)
	}

	return nil
}

func (o *DeploymentOperations) ValidateRestart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var deployment appsv1.Deployment
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &deployment); err != nil {
		return fmt.Errorf("failed to get Deployment %s/%s: %w", namespace, name, err)
	}

	// Check if Deployment is in a valid state for restart
	if deployment.Spec.Replicas != nil && *deployment.Spec.Replicas == 0 {
		return fmt.Errorf("cannot restart Deployment with 0 replicas")
	}

	return nil
}

func (o *DeploymentOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) (string, error) {
	// Validate first
	if err := o.ValidateRestart(ctx, cs, namespace, name); err != nil {
		return "", err
	}

	var deployment appsv1.Deployment
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &deployment); err != nil {
		return "", fmt.Errorf("failed to get Deployment %s/%s: %w", namespace, name, err)
	}

	// Generate restart timestamp
	restartedAt := time.Now().Format(time.RFC3339)

	// Add restart annotation to trigger rolling update for native Deployment
	if deployment.Spec.Template.Annotations == nil {
		deployment.Spec.Template.Annotations = make(map[string]string)
	}
	deployment.Spec.Template.Annotations[RestartAnnotationKey] = restartedAt

	if err := cs.K8sClient.Update(ctx, &deployment); err != nil {
		return "", fmt.Errorf("failed to restart Deployment: %w", err)
	}

	return restartedAt, nil
}

// KruiseOperationsManager manages operations for different Kruise workload types
type KruiseOperationsManager struct {
	operations map[KruiseWorkloadType]KruiseOperationsInterface
}

// NewKruiseOperationsManager creates a new manager with all supported operations
func NewKruiseOperationsManager() *KruiseOperationsManager {
	manager := &KruiseOperationsManager{
		operations: make(map[KruiseWorkloadType]KruiseOperationsInterface),
	}

	// Register Kruise workload operations
	manager.operations[CloneSetType] = &CloneSetOperations{}
	manager.operations[AdvancedStatefulSetType] = &AdvancedStatefulSetOperations{}
	manager.operations[AdvancedDaemonSetType] = &AdvancedDaemonSetOperations{}
	manager.operations[UnitedDeploymentType] = &UnitedDeploymentOperations{}

	// Register native Kubernetes workload operations
	manager.operations[StatefulSetType] = &StatefulSetOperations{}
	manager.operations[DaemonSetType] = &DaemonSetOperations{}
	manager.operations[DeploymentType] = &DeploymentOperations{}

	return manager
}

// GetOperations returns the operations interface for a given workload type
func (m *KruiseOperationsManager) GetOperations(workloadType KruiseWorkloadType) (KruiseOperationsInterface, error) {
	ops, exists := m.operations[workloadType]
	if !exists {
		return nil, fmt.Errorf("operations for workload type %s not supported", workloadType)
	}
	return ops, nil
}

// ExecuteOperation executes the specified operation on a Kruise workload
func (m *KruiseOperationsManager) ExecuteOperation(ctx context.Context, cs *cluster.ClientSet, req *KruiseOperationRequest) *KruiseOperationResult {
	ops, err := m.GetOperations(req.WorkloadType)
	if err != nil {
		return &KruiseOperationResult{
			Success:     false,
			Message:     "Operation failed",
			ErrorDetail: err.Error(),
		}
	}

	switch req.Operation {
	case KruiseScale:
		if req.Replicas == nil {
			return &KruiseOperationResult{
				Success:     false,
				Message:     "Scale operation failed",
				ErrorDetail: "replicas parameter is required for scale operation",
			}
		}
		err = ops.Scale(ctx, cs, req.Namespace, req.Name, *req.Replicas)
		if err != nil {
			return &KruiseOperationResult{
				Success:     false,
				Message:     "Scale operation failed",
				ErrorDetail: err.Error(),
			}
		}
		return &KruiseOperationResult{
			Success: true,
			Message: fmt.Sprintf("%s %s/%s scaled to %d replicas successfully", req.WorkloadType, req.Namespace, req.Name, *req.Replicas),
		}

	case KruiseRestart:
		restartedAt, err := ops.Restart(ctx, cs, req.Namespace, req.Name)
		if err != nil {
			return &KruiseOperationResult{
				Success:     false,
				Message:     "Restart operation failed",
				ErrorDetail: err.Error(),
			}
		}
		return &KruiseOperationResult{
			Success:     true,
			Message:     fmt.Sprintf("%s %s/%s restarted", req.WorkloadType, req.Namespace, req.Name),
			RestartedAt: restartedAt,
		}

	default:
		return &KruiseOperationResult{
			Success:     false,
			Message:     "Operation failed",
			ErrorDetail: fmt.Sprintf("unsupported operation: %s", req.Operation),
		}
	}
}

// ParseWorkloadTypeFromResource converts resource name to workload type
func ParseWorkloadTypeFromResource(resource string) (KruiseWorkloadType, error) {
	switch resource {
	// Kruise resources
	case "clonesets":
		return CloneSetType, nil
	case "advancedstatefulsets":
		return AdvancedStatefulSetType, nil
	case "advanceddaemonsets":
		return AdvancedDaemonSetType, nil
	case "advancedcronjobs":
		return AdvancedCronJobType, nil
	case "uniteddeployments":
		return UnitedDeploymentType, nil
	case "sidecarsets":
		return SidecarSetType, nil
	// Native Kubernetes resources
	case "statefulsets":
		return StatefulSetType, nil
	case "daemonsets":
		return DaemonSetType, nil
	case "deployments":
		return DeploymentType, nil
	default:
		return "", fmt.Errorf("unsupported resource type: %s", resource)
	}
}

// Global manager instance
var globalKruiseManager = NewKruiseOperationsManager()

// GetKruiseOperationsManager returns the global operations manager
func GetKruiseOperationsManager() *KruiseOperationsManager {
	return globalKruiseManager
}

// KruiseOperationHandler provides HTTP handlers for Kruise operations
type KruiseOperationHandler struct{}

// ScaleKruiseWorkload handles scaling requests for Kruise workloads
func (h *KruiseOperationHandler) ScaleKruiseWorkload(c *gin.Context) {
	resource := c.Param("resource")
	if resource == "" {
		// Try to get from context (for dynamic routing)
		if resourceFromCtx, exists := c.Get("resource"); exists {
			resource = resourceFromCtx.(string)
		}
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	workloadType, err := ParseWorkloadTypeFromResource(resource)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var scaleRequest struct {
		Replicas *int32 `json:"replicas" binding:"required,min=0"`
	}

	if err := c.ShouldBindJSON(&scaleRequest); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	cs := c.MustGet("cluster").(*cluster.ClientSet)
	req := &KruiseOperationRequest{
		WorkloadType: workloadType,
		Operation:    KruiseScale,
		Namespace:    namespace,
		Name:         name,
		Replicas:     scaleRequest.Replicas,
	}

	result := GetKruiseOperationsManager().ExecuteOperation(c.Request.Context(), cs, req)

	if result.Success {
		c.JSON(200, gin.H{
			"message":  result.Message,
			"replicas": *scaleRequest.Replicas,
		})
	} else {
		c.JSON(500, gin.H{
			"error":  result.Message,
			"detail": result.ErrorDetail,
		})
	}
}

// RestartKruiseWorkload handles restart requests for Kruise workloads
func (h *KruiseOperationHandler) RestartKruiseWorkload(c *gin.Context) {
	resource := c.Param("resource")
	if resource == "" {
		// Try to get from context (for dynamic routing)
		if resourceFromCtx, exists := c.Get("resource"); exists {
			resource = resourceFromCtx.(string)
		}
	}

	namespace := c.Param("namespace")
	name := c.Param("name")

	workloadType, err := ParseWorkloadTypeFromResource(resource)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	cs := c.MustGet("cluster").(*cluster.ClientSet)
	req := &KruiseOperationRequest{
		WorkloadType: workloadType,
		Operation:    KruiseRestart,
		Namespace:    namespace,
		Name:         name,
	}

	result := GetKruiseOperationsManager().ExecuteOperation(c.Request.Context(), cs, req)

	if result.Success {
		response := gin.H{
			"message": result.Message,
		}
		if result.RestartedAt != "" {
			response["restartedAt"] = result.RestartedAt
		}
		c.JSON(200, response)
	} else {
		c.JSON(500, gin.H{
			"error":  result.Message,
			"detail": result.ErrorDetail,
		})
	}
}

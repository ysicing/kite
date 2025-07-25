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
)

// KruiseOperationType defines the type of operation to perform
type KruiseOperationType string

const (
	KruiseScale   KruiseOperationType = "scale"
	KruiseRestart KruiseOperationType = "restart"
)

// KruiseWorkloadType defines the supported OpenKruise workload types
type KruiseWorkloadType string

const (
	CloneSetType            KruiseWorkloadType = "CloneSet"
	AdvancedStatefulSetType KruiseWorkloadType = "AdvancedStatefulSet"
	AdvancedDaemonSetType   KruiseWorkloadType = "AdvancedDaemonSet"
	BroadcastJobType        KruiseWorkloadType = "BroadcastJob"
	AdvancedCronJobType     KruiseWorkloadType = "AdvancedCronJob"
	UnitedDeploymentType    KruiseWorkloadType = "UnitedDeployment"
	SidecarSetType          KruiseWorkloadType = "SidecarSet"
)

// KruiseOperationRequest represents a request for Kruise workload operations
type KruiseOperationRequest struct {
	WorkloadType KruiseWorkloadType  `json:"workloadType"`
	Operation    KruiseOperationType `json:"operation"`
	Namespace    string              `json:"namespace"`
	Name         string              `json:"name"`
	Replicas     *int32              `json:"replicas,omitempty"` // For scale operations
}

// KruiseOperationResult represents the result of a Kruise operation
type KruiseOperationResult struct {
	Success     bool   `json:"success"`
	Message     string `json:"message"`
	ErrorDetail string `json:"error,omitempty"`
}

// KruiseOperationsInterface defines operations for OpenKruise workloads
type KruiseOperationsInterface interface {
	Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error
	Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error
	GetWorkloadType() KruiseWorkloadType
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

func (o *CloneSetOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var cloneSet kruiseappsv1alpha1.CloneSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &cloneSet); err != nil {
		return fmt.Errorf("failed to get CloneSet %s/%s: %w", namespace, name, err)
	}

	// Add restart annotation to trigger rolling update
	if cloneSet.Spec.Template.Annotations == nil {
		cloneSet.Spec.Template.Annotations = make(map[string]string)
	}
	cloneSet.Spec.Template.Annotations["kite.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	if err := cs.K8sClient.Update(ctx, &cloneSet); err != nil {
		return fmt.Errorf("failed to restart CloneSet: %w", err)
	}

	return nil
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

func (o *AdvancedStatefulSetOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var statefulSet kruiseappsv1beta1.StatefulSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &statefulSet); err != nil {
		return fmt.Errorf("failed to get AdvancedStatefulSet %s/%s: %w", namespace, name, err)
	}

	// Add restart annotation to trigger rolling update
	if statefulSet.Spec.Template.Annotations == nil {
		statefulSet.Spec.Template.Annotations = make(map[string]string)
	}
	statefulSet.Spec.Template.Annotations["kite.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	if err := cs.K8sClient.Update(ctx, &statefulSet); err != nil {
		return fmt.Errorf("failed to restart AdvancedStatefulSet: %w", err)
	}

	return nil
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

func (o *UnitedDeploymentOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var unitedDeployment kruiseappsv1alpha1.UnitedDeployment
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &unitedDeployment); err != nil {
		return fmt.Errorf("failed to get UnitedDeployment %s/%s: %w", namespace, name, err)
	}

	// Add restart annotation to the template based on the workload type
	// UnitedDeployment can manage different types of workloads
	restartAnnotation := time.Now().Format(time.RFC3339)

	// Check for StatefulSet template
	if unitedDeployment.Spec.Template.StatefulSetTemplate != nil {
		if unitedDeployment.Spec.Template.StatefulSetTemplate.Spec.Template.Annotations == nil {
			unitedDeployment.Spec.Template.StatefulSetTemplate.Spec.Template.Annotations = make(map[string]string)
		}
		unitedDeployment.Spec.Template.StatefulSetTemplate.Spec.Template.Annotations["kite.kubernetes.io/restartedAt"] = restartAnnotation
	}

	// Check for CloneSet template
	if unitedDeployment.Spec.Template.CloneSetTemplate != nil {
		if unitedDeployment.Spec.Template.CloneSetTemplate.Spec.Template.Annotations == nil {
			unitedDeployment.Spec.Template.CloneSetTemplate.Spec.Template.Annotations = make(map[string]string)
		}
		unitedDeployment.Spec.Template.CloneSetTemplate.Spec.Template.Annotations["kite.kubernetes.io/restartedAt"] = restartAnnotation
	}

	// Check for Deployment template
	if unitedDeployment.Spec.Template.DeploymentTemplate != nil {
		if unitedDeployment.Spec.Template.DeploymentTemplate.Spec.Template.Annotations == nil {
			unitedDeployment.Spec.Template.DeploymentTemplate.Spec.Template.Annotations = make(map[string]string)
		}
		unitedDeployment.Spec.Template.DeploymentTemplate.Spec.Template.Annotations["kite.kubernetes.io/restartedAt"] = restartAnnotation
	}

	if err := cs.K8sClient.Update(ctx, &unitedDeployment); err != nil {
		return fmt.Errorf("failed to restart UnitedDeployment: %w", err)
	}

	return nil
}

// BroadcastJobOperations implements operations for BroadcastJob
type BroadcastJobOperations struct{}

func (o *BroadcastJobOperations) GetWorkloadType() KruiseWorkloadType {
	return BroadcastJobType
}

func (o *BroadcastJobOperations) Scale(ctx context.Context, cs *cluster.ClientSet, namespace, name string, replicas int32) error {
	// BroadcastJob doesn't support traditional replica scaling - it runs on selected nodes
	return fmt.Errorf("BroadcastJob does not support replica scaling - it runs on selected nodes")
}

func (o *BroadcastJobOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var broadcastJob kruiseappsv1alpha1.BroadcastJob
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &broadcastJob); err != nil {
		return fmt.Errorf("failed to get BroadcastJob %s/%s: %w", namespace, name, err)
	}

	// Add restart annotation to trigger job restart
	if broadcastJob.Spec.Template.Annotations == nil {
		broadcastJob.Spec.Template.Annotations = make(map[string]string)
	}
	broadcastJob.Spec.Template.Annotations["kite.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	if err := cs.K8sClient.Update(ctx, &broadcastJob); err != nil {
		return fmt.Errorf("failed to restart BroadcastJob: %w", err)
	}

	return nil
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

func (o *AdvancedDaemonSetOperations) Restart(ctx context.Context, cs *cluster.ClientSet, namespace, name string) error {
	var daemonSet kruiseappsv1alpha1.DaemonSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &daemonSet); err != nil {
		return fmt.Errorf("failed to get AdvancedDaemonSet %s/%s: %w", namespace, name, err)
	}

	// Add restart annotation to trigger rolling update
	if daemonSet.Spec.Template.Annotations == nil {
		daemonSet.Spec.Template.Annotations = make(map[string]string)
	}
	daemonSet.Spec.Template.Annotations["kite.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	if err := cs.K8sClient.Update(ctx, &daemonSet); err != nil {
		return fmt.Errorf("failed to restart AdvancedDaemonSet: %w", err)
	}

	return nil
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

	// Register all supported operations
	manager.operations[CloneSetType] = &CloneSetOperations{}
	manager.operations[AdvancedStatefulSetType] = &AdvancedStatefulSetOperations{}
	manager.operations[AdvancedDaemonSetType] = &AdvancedDaemonSetOperations{}
	manager.operations[UnitedDeploymentType] = &UnitedDeploymentOperations{}
	manager.operations[BroadcastJobType] = &BroadcastJobOperations{}

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
		err = ops.Restart(ctx, cs, req.Namespace, req.Name)
		if err != nil {
			return &KruiseOperationResult{
				Success:     false,
				Message:     "Restart operation failed",
				ErrorDetail: err.Error(),
			}
		}
		return &KruiseOperationResult{
			Success: true,
			Message: fmt.Sprintf("%s %s/%s restarted successfully", req.WorkloadType, req.Namespace, req.Name),
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
	case "clonesets":
		return CloneSetType, nil
	case "advancedstatefulsets":
		return AdvancedStatefulSetType, nil
	case "advanceddaemonsets":
		return AdvancedDaemonSetType, nil
	case "broadcastjobs":
		return BroadcastJobType, nil
	case "advancedcronjobs":
		return AdvancedCronJobType, nil
	case "uniteddeployments":
		return UnitedDeploymentType, nil
	case "sidecarsets":
		return SidecarSetType, nil
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
		c.JSON(200, gin.H{
			"message": result.Message,
		})
	} else {
		c.JSON(500, gin.H{
			"error":  result.Message,
			"detail": result.ErrorDetail,
		})
	}
}

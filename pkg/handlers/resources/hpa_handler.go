package resources

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/zxh326/kite/pkg/cluster"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// HPAHandler handles HPA-specific operations
type HPAHandler struct {
	*GenericResourceHandler[*autoscalingv2.HorizontalPodAutoscaler, *autoscalingv2.HorizontalPodAutoscalerList]
}

// NewHPAHandler creates a new HPA handler
func NewHPAHandler() *HPAHandler {
	return &HPAHandler{
		GenericResourceHandler: NewGenericResourceHandler[*autoscalingv2.HorizontalPodAutoscaler, *autoscalingv2.HorizontalPodAutoscalerList](
			"horizontalpodautoscalers",
			false, // namespace-scoped
			true,  // searchable
		),
	}
}

// HPARecommendation represents recommended HPA settings
type HPARecommendation struct {
	MinReplicas       int32  `json:"minReplicas"`
	MaxReplicas       int32  `json:"maxReplicas"`
	TargetCPUPercent  *int32 `json:"targetCPUPercent,omitempty"`
	TargetMemPercent  *int32 `json:"targetMemoryPercent,omitempty"`
	HasCPURequests    bool   `json:"hasCPURequests"`
	HasMemoryRequests bool   `json:"hasMemoryRequests"`
}

// GetRecommendation returns recommended HPA settings for a workload
func (h *HPAHandler) GetRecommendation(c *gin.Context) {
	namespace := c.Param("namespace")
	workloadType := c.Query("type") // deployment, statefulset, etc.
	workloadName := c.Query("name")

	if workloadType == "" || workloadName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type and name query parameters are required"})
		return
	}

	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := context.Background()

	var replicas int32 = 1
	var hasCPURequests, hasMemoryRequests bool

	// Get the workload to check current replicas and resource requests
	switch workloadType {
	case "deployment", "Deployment":
		deployment, err := cs.K8sClient.ClientSet.AppsV1().Deployments(namespace).Get(ctx, workloadName, metav1.GetOptions{})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("deployment not found: %v", err)})
			return
		}
		if deployment.Spec.Replicas != nil {
			replicas = *deployment.Spec.Replicas
		}
		hasCPURequests, hasMemoryRequests = checkResourceRequests(deployment.Spec.Template.Spec.Containers)

	case "statefulset", "StatefulSet":
		statefulset, err := cs.K8sClient.ClientSet.AppsV1().StatefulSets(namespace).Get(ctx, workloadName, metav1.GetOptions{})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("statefulset not found: %v", err)})
			return
		}
		if statefulset.Spec.Replicas != nil {
			replicas = *statefulset.Spec.Replicas
		}
		hasCPURequests, hasMemoryRequests = checkResourceRequests(statefulset.Spec.Template.Spec.Containers)

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported workload type"})
		return
	}

	// Calculate recommendations
	recommendation := HPARecommendation{
		MinReplicas:       max(1, replicas-1),
		MaxReplicas:       replicas + 3,
		HasCPURequests:    hasCPURequests,
		HasMemoryRequests: hasMemoryRequests,
	}

	// Only recommend CPU/Memory targets if resources are set
	if hasCPURequests {
		cpuTarget := int32(80)
		recommendation.TargetCPUPercent = &cpuTarget
	}
	if hasMemoryRequests {
		memTarget := int32(80)
		recommendation.TargetMemPercent = &memTarget
	}

	c.JSON(http.StatusOK, recommendation)
}

// CreateHPARequest represents a request to create an HPA
type CreateHPARequest struct {
	Name             string `json:"name" binding:"required"`
	Namespace        string `json:"namespace" binding:"required"`
	TargetKind       string `json:"targetKind" binding:"required"`
	TargetName       string `json:"targetName" binding:"required"`
	MinReplicas      *int32 `json:"minReplicas"`
	MaxReplicas      int32  `json:"maxReplicas" binding:"required,min=1"`
	TargetCPUPercent *int32 `json:"targetCPUPercent,omitempty"`
	TargetMemPercent *int32 `json:"targetMemoryPercent,omitempty"`
}

// CreateHPA creates a new HPA with basic settings
func (h *HPAHandler) CreateHPA(c *gin.Context) {
	var req CreateHPARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := context.Background()

	// Build the HPA object
	hpa := &autoscalingv2.HorizontalPodAutoscaler{
		ObjectMeta: metav1.ObjectMeta{
			Name:      req.Name,
			Namespace: req.Namespace,
		},
		Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
			ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
				APIVersion: "apps/v1",
				Kind:       req.TargetKind,
				Name:       req.TargetName,
			},
			MinReplicas: req.MinReplicas,
			MaxReplicas: req.MaxReplicas,
			Metrics:     []autoscalingv2.MetricSpec{},
		},
	}

	// Add CPU metric if specified
	if req.TargetCPUPercent != nil {
		cpuMetric := autoscalingv2.MetricSpec{
			Type: autoscalingv2.ResourceMetricSourceType,
			Resource: &autoscalingv2.ResourceMetricSource{
				Name: "cpu",
				Target: autoscalingv2.MetricTarget{
					Type:               autoscalingv2.UtilizationMetricType,
					AverageUtilization: req.TargetCPUPercent,
				},
			},
		}
		hpa.Spec.Metrics = append(hpa.Spec.Metrics, cpuMetric)
	}

	// Add Memory metric if specified
	if req.TargetMemPercent != nil {
		memMetric := autoscalingv2.MetricSpec{
			Type: autoscalingv2.ResourceMetricSourceType,
			Resource: &autoscalingv2.ResourceMetricSource{
				Name: "memory",
				Target: autoscalingv2.MetricTarget{
					Type:               autoscalingv2.UtilizationMetricType,
					AverageUtilization: req.TargetMemPercent,
				},
			},
		}
		hpa.Spec.Metrics = append(hpa.Spec.Metrics, memMetric)
	}

	// Create the HPA
	createdHPA, err := cs.K8sClient.ClientSet.AutoscalingV2().HorizontalPodAutoscalers(req.Namespace).Create(ctx, hpa, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create HPA: %v", err)})
		return
	}

	c.JSON(http.StatusCreated, createdHPA)
}

// registerCustomRoutes registers custom HPA routes
func (h *HPAHandler) registerCustomRoutes(group *gin.RouterGroup) {
	// Add recommendation endpoint
	group.GET("/:namespace/recommendation", h.GetRecommendation)
	// Add create HPA endpoint
	group.POST("/create", h.CreateHPA)
}

// checkResourceRequests checks if containers have CPU and memory requests
func checkResourceRequests(containers []corev1.Container) (hasCPU, hasMemory bool) {
	for _, container := range containers {
		if container.Resources.Requests != nil {
			if _, ok := container.Resources.Requests["cpu"]; ok {
				hasCPU = true
			}
			if _, ok := container.Resources.Requests["memory"]; ok {
				hasMemory = true
			}
		}
		if hasCPU && hasMemory {
			break
		}
	}
	return
}

// Helper function for max
func max(a, b int32) int32 {
	if a > b {
		return a
	}
	return b
}

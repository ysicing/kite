package resources

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/zxh326/kite/pkg/cluster"

	kruiseappsv1alpha1 "github.com/openkruise/kruise-api/apps/v1alpha1"
	corev1 "k8s.io/api/core/v1"
)

type AdvancedDaemonSetHandler struct {
	*GenericResourceHandler[*kruiseappsv1alpha1.DaemonSet, *kruiseappsv1alpha1.DaemonSetList]
	kruiseOps *KruiseOperationHandler
}

func NewAdvancedDaemonSetHandler() *AdvancedDaemonSetHandler {
	return &AdvancedDaemonSetHandler{
		GenericResourceHandler: NewGenericResourceHandler[*kruiseappsv1alpha1.DaemonSet, *kruiseappsv1alpha1.DaemonSetList](
			"advanceddaemonsets",
			false, // AdvancedDaemonSets are namespaced resources
			true,  // AdvancedDaemonSets are searchable
		),
		kruiseOps: &KruiseOperationHandler{},
	}
}

// RestartAdvancedDaemonSet restarts an AdvancedDaemonSet by updating the restart annotation
func (h *AdvancedDaemonSetHandler) RestartAdvancedDaemonSet(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Use the unified Kruise operations manager
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	req := &KruiseOperationRequest{
		WorkloadType: AdvancedDaemonSetType,
		Operation:    KruiseRestart,
		Namespace:    namespace,
		Name:         name,
	}

	result := GetKruiseOperationsManager().ExecuteOperation(c.Request.Context(), cs, req)

	if result.Success {
		c.JSON(http.StatusOK, gin.H{
			"message": result.Message,
		})
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  result.Message,
			"detail": result.ErrorDetail,
		})
	}
}

// Restart implements the Restartable interface for AdvancedDaemonSet
func (h *AdvancedDaemonSetHandler) Restart(c *gin.Context, namespace, name string) error {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	req := &KruiseOperationRequest{
		WorkloadType: AdvancedDaemonSetType,
		Operation:    KruiseRestart,
		Namespace:    namespace,
		Name:         name,
	}

	result := GetKruiseOperationsManager().ExecuteOperation(c.Request.Context(), cs, req)
	if !result.Success {
		return errors.NewInternalError(fmt.Errorf(result.ErrorDetail))
	}

	return nil
}

// ScaleAdvancedDaemonSet handles scaling requests (returns error since DaemonSets don't support scaling)
func (h *AdvancedDaemonSetHandler) ScaleAdvancedDaemonSet(c *gin.Context) {
	c.JSON(http.StatusBadRequest, gin.H{
		"error": "AdvancedDaemonSet does not support replica scaling - it runs one pod per eligible node",
	})
}

// ListAdvancedDaemonSetRelatedResources lists resources related to an AdvancedDaemonSet
func (h *AdvancedDaemonSetHandler) ListAdvancedDaemonSetRelatedResources(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Validate parameters
	if namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace and name are required"})
		return
	}

	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	// First, get the daemonset to access its labels
	var daemonSet kruiseappsv1alpha1.DaemonSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &daemonSet); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "AdvancedDaemonSet not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get AdvancedDaemonSet: %v", err)})
		return
	}

	// Get daemonset selector labels to find related resources
	selector := daemonSet.Spec.Selector
	if selector == nil || selector.MatchLabels == nil {
		c.JSON(http.StatusOK, gin.H{
			"services": []corev1.Service{},
			"pods":     []corev1.Pod{},
		})
		return
	}

	// Initialize response structure
	response := gin.H{
		"services": []corev1.Service{},
		"pods":     []corev1.Pod{},
	}

	// Find related services (services that may select this daemonset's pods)
	var serviceList corev1.ServiceList
	serviceListOpts := &client.ListOptions{
		Namespace: namespace,
	}
	if err := cs.K8sClient.List(ctx, &serviceList, serviceListOpts); err != nil {
		// Log error but don't fail the entire request
		c.Header("X-Services-Error", fmt.Sprintf("Failed to list services: %v", err))
	} else {
		// Filter services that select the daemonset's pods
		var relatedServices []corev1.Service
		for _, service := range serviceList.Items {
			if service.Spec.Selector != nil {
				serviceSelector := labels.SelectorFromSet(service.Spec.Selector)
				// Check if the service selector matches any of the daemonset's pod labels
				if serviceSelector.Matches(labels.Set(selector.MatchLabels)) {
					relatedServices = append(relatedServices, service)
				}
			}
		}
		response["services"] = relatedServices
	}

	// Find related pods managed by this daemonset
	var podList corev1.PodList
	podListOpts := &client.ListOptions{
		Namespace:     namespace,
		LabelSelector: labels.SelectorFromSet(selector.MatchLabels),
	}
	if err := cs.K8sClient.List(ctx, &podList, podListOpts); err != nil {
		// Log error but don't fail the entire request
		c.Header("X-Pods-Error", fmt.Sprintf("Failed to list pods: %v", err))
	} else {
		response["pods"] = podList.Items
	}

	c.JSON(http.StatusOK, response)
}

// GetAdvancedDaemonSetStatus provides detailed status information about the AdvancedDaemonSet
func (h *AdvancedDaemonSetHandler) GetAdvancedDaemonSetStatus(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Validate parameters
	if namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace and name are required"})
		return
	}

	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	// Get the daemonset
	var daemonSet kruiseappsv1alpha1.DaemonSet
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &daemonSet); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "AdvancedDaemonSet not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get AdvancedDaemonSet: %v", err)})
		return
	}

	// Initialize status with basic DaemonSet status
	status := gin.H{
		"currentNumberScheduled": daemonSet.Status.CurrentNumberScheduled,
		"desiredNumberScheduled": daemonSet.Status.DesiredNumberScheduled,
		"numberMisscheduled":     daemonSet.Status.NumberMisscheduled,
		"numberReady":            daemonSet.Status.NumberReady,
		"updatedNumberScheduled": daemonSet.Status.UpdatedNumberScheduled,
		"numberAvailable":        daemonSet.Status.NumberAvailable,
		"numberUnavailable":      daemonSet.Status.NumberUnavailable,
		"observedGeneration":     daemonSet.Status.ObservedGeneration,
		"conditions":             daemonSet.Status.Conditions,
		"eligibleNodes":          0,
		"scheduledNodes":         0,
	}

	// Get all nodes to calculate potential vs actual pods
	var nodeList corev1.NodeList
	if err := cs.K8sClient.List(ctx, &nodeList); err != nil {
		// Don't fail the entire request, just log the error
		c.Header("X-Nodes-Error", fmt.Sprintf("Failed to list nodes: %v", err))
		c.JSON(http.StatusOK, status)
		return
	}

	// Count eligible nodes (nodes that match the daemonset's node selector)
	eligibleNodes := 0
	scheduledNodes := make(map[string]bool)

	// Get pods managed by this daemonset
	selector := daemonSet.Spec.Selector
	if selector != nil && selector.MatchLabels != nil {
		var podList corev1.PodList
		podListOpts := &client.ListOptions{
			Namespace:     namespace,
			LabelSelector: labels.SelectorFromSet(selector.MatchLabels),
		}
		if err := cs.K8sClient.List(ctx, &podList, podListOpts); err == nil {
			for _, pod := range podList.Items {
				if pod.Spec.NodeName != "" {
					scheduledNodes[pod.Spec.NodeName] = true
				}
			}
		}
	}

	// Count eligible nodes based on node selector
	nodeSelector := daemonSet.Spec.Template.Spec.NodeSelector
	for _, node := range nodeList.Items {
		// Check if node is schedulable
		if node.Spec.Unschedulable {
			continue
		}

		// Check node selector
		nodeLabels := labels.Set(node.Labels)
		if nodeSelector != nil {
			selectorSet := labels.Set(nodeSelector)
			if !selectorSet.AsSelector().Matches(nodeLabels) {
				continue
			}
		}

		eligibleNodes++
	}

	// Update calculated values
	status["eligibleNodes"] = eligibleNodes
	status["scheduledNodes"] = len(scheduledNodes)

	c.JSON(http.StatusOK, status)
}

func (h *AdvancedDaemonSetHandler) registerCustomRoutes(group *gin.RouterGroup) {
	// DaemonSets don't support scaling, but we provide an endpoint that explains why
	group.POST("/:namespace/:name/scale", h.ScaleAdvancedDaemonSet)
	group.POST("/:namespace/:name/restart", h.RestartAdvancedDaemonSet)
	group.GET("/:namespace/:name/status", h.GetAdvancedDaemonSetStatus)
}

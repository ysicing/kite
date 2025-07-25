package resources

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/zxh326/kite/pkg/cluster"

	kruiseappsv1beta1 "github.com/openkruise/kruise-api/apps/v1beta1"
)

type AdvancedStatefulSetHandler struct {
	*GenericResourceHandler[*kruiseappsv1beta1.StatefulSet, *kruiseappsv1beta1.StatefulSetList]
	kruiseOps *KruiseOperationHandler
}

func NewAdvancedStatefulSetHandler() *AdvancedStatefulSetHandler {
	return &AdvancedStatefulSetHandler{
		GenericResourceHandler: NewGenericResourceHandler[*kruiseappsv1beta1.StatefulSet, *kruiseappsv1beta1.StatefulSetList](
			"advancedstatefulsets",
			false, // AdvancedStatefulSets are namespaced resources
			true,  // AdvancedStatefulSets are searchable
		),
		kruiseOps: &KruiseOperationHandler{},
	}
}

// ScaleAdvancedStatefulSet scales an AdvancedStatefulSet to the specified number of replicas
func (h *AdvancedStatefulSetHandler) ScaleAdvancedStatefulSet(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	var scaleRequest struct {
		Replicas *int32 `json:"replicas" binding:"required,min=0"`
	}

	if err := c.ShouldBindJSON(&scaleRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	if scaleRequest.Replicas == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "replicas field is required"})
		return
	}

	// Use the unified Kruise operations manager
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	req := &KruiseOperationRequest{
		WorkloadType: AdvancedStatefulSetType,
		Operation:    KruiseScale,
		Namespace:    namespace,
		Name:         name,
		Replicas:     scaleRequest.Replicas,
	}

	result := GetKruiseOperationsManager().ExecuteOperation(c.Request.Context(), cs, req)

	if result.Success {
		c.JSON(http.StatusOK, gin.H{
			"message":  result.Message,
			"replicas": *scaleRequest.Replicas,
		})
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  result.Message,
			"detail": result.ErrorDetail,
		})
	}
}

// RestartAdvancedStatefulSet restarts an AdvancedStatefulSet by updating the restart annotation
func (h *AdvancedStatefulSetHandler) RestartAdvancedStatefulSet(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Use the unified Kruise operations manager
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	req := &KruiseOperationRequest{
		WorkloadType: AdvancedStatefulSetType,
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

// Restart implements the Restartable interface for AdvancedStatefulSet
func (h *AdvancedStatefulSetHandler) Restart(c *gin.Context, namespace, name string) error {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	req := &KruiseOperationRequest{
		WorkloadType: AdvancedStatefulSetType,
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

func (h *AdvancedStatefulSetHandler) registerCustomRoutes(group *gin.RouterGroup) {
	group.POST("/:namespace/:name/scale", h.ScaleAdvancedStatefulSet)
	group.POST("/:namespace/:name/restart", h.RestartAdvancedStatefulSet)
}

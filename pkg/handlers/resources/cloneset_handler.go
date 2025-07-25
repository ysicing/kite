package resources

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/zxh326/kite/pkg/cluster"

	kruiseappsv1alpha1 "github.com/openkruise/kruise-api/apps/v1alpha1"
)

type CloneSetHandler struct {
	*GenericResourceHandler[*kruiseappsv1alpha1.CloneSet, *kruiseappsv1alpha1.CloneSetList]
	kruiseOps *KruiseOperationHandler
}

func NewCloneSetHandler() *CloneSetHandler {
	return &CloneSetHandler{
		GenericResourceHandler: NewGenericResourceHandler[*kruiseappsv1alpha1.CloneSet, *kruiseappsv1alpha1.CloneSetList](
			"clonesets",
			false, // CloneSets are namespaced resources
			true,  // CloneSets are searchable
		),
		kruiseOps: &KruiseOperationHandler{},
	}
}

// ScaleCloneSet scales a CloneSet to the specified number of replicas
func (h *CloneSetHandler) ScaleCloneSet(c *gin.Context) {
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
		WorkloadType: CloneSetType,
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

// RestartCloneSet restarts a CloneSet by updating the restart annotation
func (h *CloneSetHandler) RestartCloneSet(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Use the unified Kruise operations manager
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	req := &KruiseOperationRequest{
		WorkloadType: CloneSetType,
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

// Restart implements the Restartable interface for CloneSet
func (h *CloneSetHandler) Restart(c *gin.Context, namespace, name string) error {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	req := &KruiseOperationRequest{
		WorkloadType: CloneSetType,
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

func (h *CloneSetHandler) registerCustomRoutes(group *gin.RouterGroup) {
	group.POST("/:namespace/:name/scale", h.ScaleCloneSet)
	group.POST("/:namespace/:name/restart", h.RestartCloneSet)
}

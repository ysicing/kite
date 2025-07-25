package resources

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/zxh326/kite/pkg/cluster"

	kruiseappsv1alpha1 "github.com/openkruise/kruise-api/apps/v1alpha1"
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

func (h *AdvancedDaemonSetHandler) registerCustomRoutes(group *gin.RouterGroup) {
	// DaemonSets don't support scaling, only restart
	group.POST("/:namespace/:name/restart", h.RestartAdvancedDaemonSet)
}

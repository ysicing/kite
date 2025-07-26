package resources

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/zxh326/kite/pkg/cluster"
	"github.com/zxh326/kite/pkg/common"

	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// AdmissionController represents a unified admission controller (both validating and mutating)
type AdmissionController struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Type              string                 `json:"type"` // "validating" or "mutating"
	Spec              map[string]interface{} `json:"spec,omitempty"`
}

// AdmissionControllerList represents a list of admission controllers
type AdmissionControllerList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []AdmissionController `json:"items"`
}

// AdmissionControllerHandler handles admission controller operations
type AdmissionControllerHandler struct{}

// NewAdmissionControllerHandler creates a new admission controller handler
func NewAdmissionControllerHandler() *AdmissionControllerHandler {
	return &AdmissionControllerHandler{}
}

// List returns all admission controllers (both validating and mutating)
func (h *AdmissionControllerHandler) List(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	// Get validating webhooks
	var validatingList admissionregistrationv1.ValidatingWebhookConfigurationList
	if err := cs.K8sClient.List(ctx, &validatingList); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to list validating webhooks: %v", err)})
		return
	}

	// Get mutating webhooks
	var mutatingList admissionregistrationv1.MutatingWebhookConfigurationList
	if err := cs.K8sClient.List(ctx, &mutatingList); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to list mutating webhooks: %v", err)})
		return
	}

	// Combine into unified list
	var items []AdmissionController

	// Add validating webhooks
	for _, vw := range validatingList.Items {
		spec := map[string]interface{}{
			"webhooks": vw.Webhooks,
		}
		items = append(items, AdmissionController{
			TypeMeta: metav1.TypeMeta{
				APIVersion: vw.APIVersion,
				Kind:       "AdmissionController",
			},
			ObjectMeta: vw.ObjectMeta,
			Type:       "validating",
			Spec:       spec,
		})
	}

	// Add mutating webhooks
	for _, mw := range mutatingList.Items {
		spec := map[string]interface{}{
			"webhooks": mw.Webhooks,
		}
		items = append(items, AdmissionController{
			TypeMeta: metav1.TypeMeta{
				APIVersion: mw.APIVersion,
				Kind:       "AdmissionController",
			},
			ObjectMeta: mw.ObjectMeta,
			Type:       "mutating",
			Spec:       spec,
		})
	}

	result := AdmissionControllerList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "v1",
			Kind:       "AdmissionControllerList",
		},
		ListMeta: metav1.ListMeta{
			ResourceVersion: "1",
		},
		Items: items,
	}

	c.JSON(http.StatusOK, result)
}

// Get returns a specific admission controller
func (h *AdmissionControllerHandler) Get(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()
	name := c.Param("name")
	webhookType := c.Query("type") // "validating" or "mutating"

	if webhookType == "" {
		// Try to find in both types
		if item, found := h.findAdmissionController(ctx, cs, name, "validating"); found {
			c.JSON(http.StatusOK, item)
			return
		}
		if item, found := h.findAdmissionController(ctx, cs, name, "mutating"); found {
			c.JSON(http.StatusOK, item)
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Admission controller not found"})
		return
	}

	if item, found := h.findAdmissionController(ctx, cs, name, webhookType); found {
		c.JSON(http.StatusOK, item)
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Admission controller not found"})
}

// findAdmissionController finds a specific admission controller by name and type
func (h *AdmissionControllerHandler) findAdmissionController(ctx context.Context, cs *cluster.ClientSet, name, webhookType string) (AdmissionController, bool) {
	switch webhookType {
	case "validating":
		var vw admissionregistrationv1.ValidatingWebhookConfiguration
		if err := cs.K8sClient.Get(ctx, client.ObjectKey{Name: name}, &vw); err != nil {
			return AdmissionController{}, false
		}
		spec := map[string]interface{}{
			"webhooks": vw.Webhooks,
		}
		return AdmissionController{
			TypeMeta: metav1.TypeMeta{
				APIVersion: vw.APIVersion,
				Kind:       "AdmissionController",
			},
			ObjectMeta: vw.ObjectMeta,
			Type:       "validating",
			Spec:       spec,
		}, true

	case "mutating":
		var mw admissionregistrationv1.MutatingWebhookConfiguration
		if err := cs.K8sClient.Get(ctx, client.ObjectKey{Name: name}, &mw); err != nil {
			return AdmissionController{}, false
		}
		spec := map[string]interface{}{
			"webhooks": mw.Webhooks,
		}
		return AdmissionController{
			TypeMeta: metav1.TypeMeta{
				APIVersion: mw.APIVersion,
				Kind:       "AdmissionController",
			},
			ObjectMeta: mw.ObjectMeta,
			Type:       "mutating",
			Spec:       spec,
		}, true

	default:
		return AdmissionController{}, false
	}
}

// Create creates a new admission controller (not implemented - redirect to specific type)
func (h *AdmissionControllerHandler) Create(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Use specific validating or mutating webhook endpoints for creation"})
}

// Update updates an admission controller (not implemented - redirect to specific type)
func (h *AdmissionControllerHandler) Update(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Use specific validating or mutating webhook endpoints for updates"})
}

// Delete deletes an admission controller (not implemented - redirect to specific type)
func (h *AdmissionControllerHandler) Delete(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Use specific validating or mutating webhook endpoints for deletion"})
}

// IsClusterScoped returns true as admission controllers are cluster-scoped
func (h *AdmissionControllerHandler) IsClusterScoped() bool {
	return true
}

// Searchable returns true as admission controllers can be searched
func (h *AdmissionControllerHandler) Searchable() bool {
	return true
}

// Search searches admission controllers
func (h *AdmissionControllerHandler) Search(c *gin.Context, query string, limit int64) ([]common.SearchResult, error) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	var results []common.SearchResult

	// Search validating webhooks
	var validatingList admissionregistrationv1.ValidatingWebhookConfigurationList
	if err := cs.K8sClient.List(ctx, &validatingList); err == nil {
		for _, item := range validatingList.Items {
			if matchesQuery(item.Name, query) {
				results = append(results, common.SearchResult{
					ID:           item.Name,
					Name:         item.Name,
					ResourceType: "admission-controllers",
					CreatedAt:    item.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				})
			}
		}
	}

	// Search mutating webhooks
	var mutatingList admissionregistrationv1.MutatingWebhookConfigurationList
	if err := cs.K8sClient.List(ctx, &mutatingList); err == nil {
		for _, item := range mutatingList.Items {
			if matchesQuery(item.Name, query) {
				results = append(results, common.SearchResult{
					ID:           item.Name,
					Name:         item.Name,
					ResourceType: "admission-controllers",
					CreatedAt:    item.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				})
			}
		}
	}

	// Apply limit
	if limit > 0 && int64(len(results)) > limit {
		results = results[:limit]
	}

	return results, nil
}

// matchesQuery checks if a name matches the search query
func matchesQuery(name, query string) bool {
	return len(query) == 0 ||
		len(name) >= len(query) &&
			name[:len(query)] == query
}

// GetResource returns a specific admission controller resource
func (h *AdmissionControllerHandler) GetResource(c *gin.Context, namespace, name string) (interface{}, error) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	// Try validating first
	if item, found := h.findAdmissionController(ctx, cs, name, "validating"); found {
		return item, nil
	}

	// Try mutating
	if item, found := h.findAdmissionController(ctx, cs, name, "mutating"); found {
		return item, nil
	}

	return nil, fmt.Errorf("admission controller not found: %s", name)
}

// registerCustomRoutes registers custom routes for admission controllers
func (h *AdmissionControllerHandler) registerCustomRoutes(group *gin.RouterGroup) {
	// No custom routes needed for now
}

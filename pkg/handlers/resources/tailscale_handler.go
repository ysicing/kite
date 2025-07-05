package resources

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/zxh326/kite/pkg/cluster"
	"github.com/zxh326/kite/pkg/common"
	"github.com/zxh326/kite/pkg/kube"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TailscaleResourceHandler handles API operations for Tailscale Custom Resources
// All Tailscale resources are cluster-scoped
type TailscaleResourceHandler struct {
	resourceName string
	crdName      string
	kind         string
	group        string
	version      string
}

// NewTailscaleResourceHandler creates a new TailscaleResourceHandler
func NewTailscaleResourceHandler(resourceName, crdName, kind, group, version string) *TailscaleResourceHandler {
	return &TailscaleResourceHandler{
		resourceName: resourceName,
		crdName:      crdName,
		kind:         kind,
		group:        group,
		version:      version,
	}
}

// getCRDByName retrieves the CRD definition by name
func (h *TailscaleResourceHandler) getCRDByName(ctx context.Context, client *kube.K8sClient, crdName string) (*apiextensionsv1.CustomResourceDefinition, error) {
	var crd apiextensionsv1.CustomResourceDefinition
	if err := client.Get(ctx, types.NamespacedName{Name: crdName}, &crd); err != nil {
		return nil, err
	}
	return &crd, nil
}

// getGVR returns the GroupVersionResource for this handler
func (h *TailscaleResourceHandler) getGVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    h.group,
		Version:  h.version,
		Resource: h.resourceName,
	}
}

func (h *TailscaleResourceHandler) List(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	// Get the CRD definition to ensure it exists
	crd, err := h.getCRDByName(ctx, cs.K8sClient, h.crdName)
	if err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "CustomResourceDefinition not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create GVR from handler config
	gvr := h.getGVR()

	// Create unstructured list object
	crList := &unstructured.UnstructuredList{}
	crList.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   gvr.Group,
		Version: gvr.Version,
		Kind:    crd.Spec.Names.ListKind,
	})

	// List all resources (cluster-scoped, no namespace filtering)
	if err := cs.K8sClient.List(ctx, crList); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, crList)
}

func (h *TailscaleResourceHandler) Get(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Resource name is required"})
		return
	}

	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	// Get the CRD definition to ensure it exists
	crd, err := h.getCRDByName(ctx, cs.K8sClient, h.crdName)
	if err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "CustomResourceDefinition not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create GVR from handler config
	gvr := h.getGVR()

	// Create unstructured object
	cr := &unstructured.Unstructured{}
	cr.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   gvr.Group,
		Version: gvr.Version,
		Kind:    crd.Spec.Names.Kind,
	})

	// For cluster-scoped resources, only use name
	namespacedName := types.NamespacedName{Name: name}

	if err := cs.K8sClient.Get(ctx, namespacedName, cr); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Custom resource not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cr)
}

func (h *TailscaleResourceHandler) Create(c *gin.Context) {
	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	// Get the CRD definition to ensure it exists
	crd, err := h.getCRDByName(ctx, cs.K8sClient, h.crdName)
	if err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "CustomResourceDefinition not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create GVR from handler config
	gvr := h.getGVR()

	// Parse the request body into unstructured object
	var cr unstructured.Unstructured
	if err := c.ShouldBindJSON(&cr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set correct GVK
	cr.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   gvr.Group,
		Version: gvr.Version,
		Kind:    crd.Spec.Names.Kind,
	})

	// No namespace needed for cluster-scoped resources

	if err := cs.K8sClient.Create(ctx, &cr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cr)
}

func (h *TailscaleResourceHandler) Update(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Resource name is required"})
		return
	}

	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	// Get the CRD definition to ensure it exists
	crd, err := h.getCRDByName(ctx, cs.K8sClient, h.crdName)
	if err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "CustomResourceDefinition not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create GVR from handler config
	gvr := h.getGVR()

	// First get the existing custom resource
	existingCR := &unstructured.Unstructured{}
	existingCR.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   gvr.Group,
		Version: gvr.Version,
		Kind:    crd.Spec.Names.Kind,
	})

	// For cluster-scoped resources, only use name
	namespacedName := types.NamespacedName{Name: name}

	if err := cs.K8sClient.Get(ctx, namespacedName, existingCR); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Custom resource not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Parse the request body into unstructured object
	var updatedCR unstructured.Unstructured
	if err := c.ShouldBindJSON(&updatedCR); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Preserve important metadata
	updatedCR.SetGroupVersionKind(existingCR.GroupVersionKind())
	updatedCR.SetName(name)
	updatedCR.SetResourceVersion(existingCR.GetResourceVersion())
	updatedCR.SetUID(existingCR.GetUID())

	// No namespace for cluster-scoped resources

	if err := cs.K8sClient.Update(ctx, &updatedCR); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedCR)
}

func (h *TailscaleResourceHandler) Delete(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Resource name is required"})
		return
	}

	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	// Get the CRD definition to ensure it exists
	crd, err := h.getCRDByName(ctx, cs.K8sClient, h.crdName)
	if err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "CustomResourceDefinition not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create GVR from handler config
	gvr := h.getGVR()

	// Create unstructured object to delete
	cr := &unstructured.Unstructured{}
	cr.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   gvr.Group,
		Version: gvr.Version,
		Kind:    crd.Spec.Names.Kind,
	})

	// For cluster-scoped resources, only use name
	namespacedName := types.NamespacedName{Name: name}
	cr.SetName(name)

	// First check if the resource exists
	if err := cs.K8sClient.Get(ctx, namespacedName, cr); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Custom resource not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Delete the custom resource
	if err := cs.K8sClient.Delete(ctx, cr, &client.DeleteOptions{
		PropagationPolicy: &[]metav1.DeletionPropagation{metav1.DeletePropagationForeground}[0],
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Custom resource deleted successfully"})
}

// IsClusterScoped returns true since all Tailscale resources are cluster-scoped
func (h *TailscaleResourceHandler) IsClusterScoped() bool {
	return true
}

// Searchable returns whether the resource supports search
func (h *TailscaleResourceHandler) Searchable() bool {
	return false
}

// Search implements search functionality for custom resources
func (h *TailscaleResourceHandler) Search(c *gin.Context, query string, limit int64) ([]common.SearchResult, error) {
	return nil, fmt.Errorf("search not implemented for Tailscale resources")
}

// GetResource retrieves a specific custom resource
func (h *TailscaleResourceHandler) GetResource(c *gin.Context, namespace, name string) (interface{}, error) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	// Get the CRD definition to ensure it exists
	crd, err := h.getCRDByName(ctx, cs.K8sClient, h.crdName)
	if err != nil {
		return nil, err
	}

	// Create GVR from handler config
	gvr := h.getGVR()

	// Create unstructured object
	cr := &unstructured.Unstructured{}
	cr.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   gvr.Group,
		Version: gvr.Version,
		Kind:    crd.Spec.Names.Kind,
	})

	// For cluster-scoped resources, ignore namespace parameter
	namespacedName := types.NamespacedName{Name: name}

	if err := cs.K8sClient.Get(ctx, namespacedName, cr); err != nil {
		return nil, err
	}

	return cr, nil
}

// registerCustomRoutes registers custom routes for the resource
func (h *TailscaleResourceHandler) registerCustomRoutes(group *gin.RouterGroup) {
	// No custom routes for TailscaleResourceHandler
}

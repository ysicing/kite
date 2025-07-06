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

// TraefikResourceHandler handles API operations for Traefik Custom Resources
// Traefik resources are namespace-scoped
type TraefikResourceHandler struct {
	resourceName string
	crdName      string
	kind         string
	group        string
	version      string
}

// NewTraefikResourceHandler creates a new TraefikResourceHandler
func NewTraefikResourceHandler(resourceName, crdName, kind, group, version string) *TraefikResourceHandler {
	return &TraefikResourceHandler{
		resourceName: resourceName,
		crdName:      crdName,
		kind:         kind,
		group:        group,
		version:      version,
	}
}

// getCRDByName retrieves the CRD definition by name
func (h *TraefikResourceHandler) getCRDByName(ctx context.Context, client *kube.K8sClient, crdName string) (*apiextensionsv1.CustomResourceDefinition, error) {
	var crd apiextensionsv1.CustomResourceDefinition
	if err := client.Get(ctx, types.NamespacedName{Name: crdName}, &crd); err != nil {
		return nil, err
	}
	return &crd, nil
}

// getGVR returns the GroupVersionResource for this handler
func (h *TraefikResourceHandler) getGVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    h.group,
		Version:  h.version,
		Resource: h.resourceName,
	}
}

func (h *TraefikResourceHandler) List(c *gin.Context) {
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

	// List resources with namespace filtering
	var listOpts []client.ListOption
	namespace := c.Param("namespace")
	if namespace != "" && namespace != "_all" {
		listOpts = append(listOpts, client.InNamespace(namespace))
	}

	if err := cs.K8sClient.List(ctx, crList, listOpts...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, crList)
}

func (h *TraefikResourceHandler) Get(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")
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

	// For namespace-scoped resources, use namespace and name
	namespacedName := types.NamespacedName{Name: name}
	if namespace != "" && namespace != "_all" {
		namespacedName.Namespace = namespace
	}

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

func (h *TraefikResourceHandler) Create(c *gin.Context) {
	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	namespace := c.Param("namespace")

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

	// Set namespace for namespace-scoped resources
	if namespace != "" && namespace != "_all" {
		cr.SetNamespace(namespace)
	}

	if err := cs.K8sClient.Create(ctx, &cr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cr)
}

func (h *TraefikResourceHandler) Update(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")
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

	// For namespace-scoped resources, use namespace and name
	namespacedName := types.NamespacedName{Name: name}
	if namespace != "" && namespace != "_all" {
		namespacedName.Namespace = namespace
	}

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

	// Set namespace for namespace-scoped resources
	if namespace != "" && namespace != "_all" {
		updatedCR.SetNamespace(namespace)
	}

	if err := cs.K8sClient.Update(ctx, &updatedCR); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedCR)
}

func (h *TraefikResourceHandler) Delete(c *gin.Context) {
	name := c.Param("name")
	namespace := c.Param("namespace")
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

	// For namespace-scoped resources, use namespace and name
	namespacedName := types.NamespacedName{Name: name}
	if namespace != "" && namespace != "_all" {
		namespacedName.Namespace = namespace
	}
	cr.SetName(name)
	if namespace != "" && namespace != "_all" {
		cr.SetNamespace(namespace)
	}

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

// IsClusterScoped returns false since Traefik resources are namespace-scoped
func (h *TraefikResourceHandler) IsClusterScoped() bool {
	return false
}

// Searchable returns whether the resource supports search
func (h *TraefikResourceHandler) Searchable() bool {
	return false
}

// Search implements search functionality for custom resources
func (h *TraefikResourceHandler) Search(c *gin.Context, query string, limit int64) ([]common.SearchResult, error) {
	return nil, fmt.Errorf("search not implemented for Traefik resources")
}

// GetResource retrieves a specific custom resource
func (h *TraefikResourceHandler) GetResource(c *gin.Context, namespace, name string) (interface{}, error) {
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

	// For namespace-scoped resources, use namespace and name
	namespacedName := types.NamespacedName{Name: name}
	if namespace != "" && namespace != "_all" {
		namespacedName.Namespace = namespace
	}

	if err := cs.K8sClient.Get(ctx, namespacedName, cr); err != nil {
		return nil, err
	}

	return cr, nil
}

// registerCustomRoutes registers custom routes for the resource
func (h *TraefikResourceHandler) registerCustomRoutes(group *gin.RouterGroup) {
	// No custom routes for TraefikResourceHandler
}

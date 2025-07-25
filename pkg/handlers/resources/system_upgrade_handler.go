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

// SystemUpgradeResourceHandler handles API operations for System Upgrade Controller Custom Resources
// All System Upgrade Controller resources are cluster-scoped
type SystemUpgradeResourceHandler struct {
	resourceName string
	crdName      string
	kind         string
	group        string
	version      string
}

// NewSystemUpgradeResourceHandler creates a new SystemUpgradeResourceHandler
func NewSystemUpgradeResourceHandler(resourceName, crdName, kind, group, version string) *SystemUpgradeResourceHandler {
	return &SystemUpgradeResourceHandler{
		resourceName: resourceName,
		crdName:      crdName,
		kind:         kind,
		group:        group,
		version:      version,
	}
}

// getCRDByName retrieves the CRD definition by name
func (h *SystemUpgradeResourceHandler) getCRDByName(ctx context.Context, client *kube.K8sClient, crdName string) (*apiextensionsv1.CustomResourceDefinition, error) {
	var crd apiextensionsv1.CustomResourceDefinition
	if err := client.Get(ctx, types.NamespacedName{Name: crdName}, &crd); err != nil {
		return nil, err
	}
	return &crd, nil
}

// getGVR returns the GroupVersionResource for this handler
func (h *SystemUpgradeResourceHandler) getGVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    h.group,
		Version:  h.version,
		Resource: h.resourceName,
	}
}

func (h *SystemUpgradeResourceHandler) List(c *gin.Context) {
	namespace := c.Param("namespace")
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
	listOptions := []client.ListOption{}
	if namespace != "" {
		listOptions = append(listOptions, client.InNamespace(namespace))
	}

	if err := cs.K8sClient.List(ctx, crList, listOptions...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, crList)
}

func (h *SystemUpgradeResourceHandler) Get(c *gin.Context) {
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

	// For namespace-scoped resources, use both namespace and name
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

func (h *SystemUpgradeResourceHandler) Create(c *gin.Context) {
	namespace := c.Param("namespace")
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

func (h *SystemUpgradeResourceHandler) Update(c *gin.Context) {
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

	// For namespace-scoped resources, use both namespace and name
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

func (h *SystemUpgradeResourceHandler) Delete(c *gin.Context) {
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

	// For namespace-scoped resources, use both namespace and name
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

// IsClusterScoped returns false since Plan resources are namespace-scoped
func (h *SystemUpgradeResourceHandler) IsClusterScoped() bool {
	return false
}

// Searchable returns whether the resource supports search
func (h *SystemUpgradeResourceHandler) Searchable() bool {
	return false
}

// Search implements search functionality for custom resources
func (h *SystemUpgradeResourceHandler) Search(c *gin.Context, query string, limit int64) ([]common.SearchResult, error) {
	return nil, fmt.Errorf("search not implemented for System Upgrade Controller resources")
}

// GetResource retrieves a specific custom resource
func (h *SystemUpgradeResourceHandler) GetResource(c *gin.Context, namespace, name string) (interface{}, error) {
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
func (h *SystemUpgradeResourceHandler) registerCustomRoutes(group *gin.RouterGroup) {
	// No custom routes for SystemUpgradeResourceHandler
}

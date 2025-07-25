package resources

import (
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/zxh326/kite/pkg/cluster"
	"github.com/zxh326/kite/pkg/common"

	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// StorageClassWithInfo extends StorageClass with additional information
type StorageClassWithInfo struct {
	storagev1.StorageClass
	IsDefault     bool `json:"isDefault"`
	AssociatedPVC int  `json:"associatedPVC"`
}

// StorageClassListWithInfo represents a list of StorageClass with additional info
type StorageClassListWithInfo struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []StorageClassWithInfo `json:"items"`
}

// StorageClassHandler handles StorageClass operations with enhanced functionality
type StorageClassHandler struct {
	*GenericResourceHandler[*storagev1.StorageClass, *storagev1.StorageClassList]
}

// NewStorageClassHandler creates a new StorageClass handler
func NewStorageClassHandler() *StorageClassHandler {
	return &StorageClassHandler{
		GenericResourceHandler: NewGenericResourceHandler[*storagev1.StorageClass, *storagev1.StorageClassList]("storageclasses", true, false),
	}
}

// List returns enhanced StorageClass list with default annotation and PVC count
func (h *StorageClassHandler) List(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	var listOpts []client.ListOption

	// Handle query parameters
	if c.Query("limit") != "" {
		limit, err := strconv.ParseInt(c.Query("limit"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit parameter"})
			return
		}
		listOpts = append(listOpts, client.Limit(limit))
	}

	if c.Query("continue") != "" {
		continueToken := c.Query("continue")
		listOpts = append(listOpts, client.Continue(continueToken))
	}

	// Add label selector support
	if c.Query("labelSelector") != "" {
		labelSelector := c.Query("labelSelector")
		selector, err := metav1.ParseToLabelSelector(labelSelector)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid labelSelector parameter: " + err.Error()})
			return
		}
		labelSelectorOption, err := metav1.LabelSelectorAsSelector(selector)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to convert labelSelector: " + err.Error()})
			return
		}
		listOpts = append(listOpts, client.MatchingLabelsSelector{Selector: labelSelectorOption})
	}

	if c.Query("fieldSelector") != "" {
		fieldSelector := c.Query("fieldSelector")
		fieldSelectorOption, err := fields.ParseSelector(fieldSelector)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid fieldSelector parameter: " + err.Error()})
			return
		}
		listOpts = append(listOpts, client.MatchingFieldsSelector{Selector: fieldSelectorOption})
	}

	// Get StorageClass list
	var scList storagev1.StorageClassList
	if err := cs.K8sClient.List(ctx, &scList, listOpts...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get PVC list to count associations
	var pvcList corev1.PersistentVolumeClaimList
	if err := cs.K8sClient.List(ctx, &pvcList); err != nil {
		klog.Warningf("Failed to list PVCs for StorageClass association count: %v", err)
	}

	// Count PVCs for each StorageClass
	pvcCount := make(map[string]int)
	for _, pvc := range pvcList.Items {
		if pvc.Spec.StorageClassName != nil {
			pvcCount[*pvc.Spec.StorageClassName]++
		}
	}

	// Build enhanced StorageClass list
	var enhancedItems []StorageClassWithInfo
	for _, sc := range scList.Items {
		isDefault := h.isDefaultStorageClass(&sc)
		associatedPVC := pvcCount[sc.Name]

		enhancedSC := StorageClassWithInfo{
			StorageClass:  sc,
			IsDefault:     isDefault,
			AssociatedPVC: associatedPVC,
		}

		// Clear managed fields for cleaner response
		enhancedSC.StorageClass.SetManagedFields(nil)
		anno := enhancedSC.StorageClass.GetAnnotations()
		if anno != nil {
			delete(anno, common.KubectlAnnotation)
		}

		enhancedItems = append(enhancedItems, enhancedSC)
	}

	// Sort by creation timestamp in descending order (newest first)
	sort.Slice(enhancedItems, func(i, j int) bool {
		t1 := enhancedItems[i].GetCreationTimestamp()
		t2 := enhancedItems[j].GetCreationTimestamp()
		if t1.Equal(&t2) {
			return enhancedItems[i].GetName() < enhancedItems[j].GetName()
		}
		return t1.After(t2.Time)
	})

	result := StorageClassListWithInfo{
		TypeMeta: scList.TypeMeta,
		ListMeta: scList.ListMeta,
		Items:    enhancedItems,
	}

	c.JSON(http.StatusOK, result)
}

// Get returns a single StorageClass with enhanced information
func (h *StorageClassHandler) Get(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()
	name := c.Param("name")

	var sc storagev1.StorageClass
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Name: name}, &sc); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Count associated PVCs
	var pvcList corev1.PersistentVolumeClaimList
	if err := cs.K8sClient.List(ctx, &pvcList); err != nil {
		klog.Warningf("Failed to list PVCs for StorageClass association count: %v", err)
	}

	associatedPVC := 0
	for _, pvc := range pvcList.Items {
		if pvc.Spec.StorageClassName != nil && *pvc.Spec.StorageClassName == name {
			associatedPVC++
		}
	}

	isDefault := h.isDefaultStorageClass(&sc)

	enhancedSC := StorageClassWithInfo{
		StorageClass:  sc,
		IsDefault:     isDefault,
		AssociatedPVC: associatedPVC,
	}

	// Clear managed fields for cleaner response
	enhancedSC.StorageClass.SetManagedFields(nil)
	anno := enhancedSC.StorageClass.GetAnnotations()
	if anno != nil {
		delete(anno, common.KubectlAnnotation)
	}

	c.JSON(http.StatusOK, enhancedSC)
}

// GetRelatedPVCs returns PVCs that use this StorageClass
func (h *StorageClassHandler) GetRelatedPVCs(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()
	storageClassName := c.Param("name")

	var pvcList corev1.PersistentVolumeClaimList
	if err := cs.K8sClient.List(ctx, &pvcList); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var relatedPVCs []corev1.PersistentVolumeClaim
	for _, pvc := range pvcList.Items {
		if pvc.Spec.StorageClassName != nil && *pvc.Spec.StorageClassName == storageClassName {
			// Clear managed fields for cleaner response
			pvc.SetManagedFields(nil)
			anno := pvc.GetAnnotations()
			if anno != nil {
				delete(anno, common.KubectlAnnotation)
			}
			relatedPVCs = append(relatedPVCs, pvc)
		}
	}

	// Sort by creation timestamp in descending order (newest first)
	sort.Slice(relatedPVCs, func(i, j int) bool {
		t1 := relatedPVCs[i].GetCreationTimestamp()
		t2 := relatedPVCs[j].GetCreationTimestamp()
		if t1.Equal(&t2) {
			return relatedPVCs[i].GetName() < relatedPVCs[j].GetName()
		}
		return t1.After(t2.Time)
	})

	result := corev1.PersistentVolumeClaimList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "v1",
			Kind:       "PersistentVolumeClaimList",
		},
		Items: relatedPVCs,
	}

	c.JSON(http.StatusOK, result)
}

// isDefaultStorageClass checks if the StorageClass is marked as default
func (h *StorageClassHandler) isDefaultStorageClass(sc *storagev1.StorageClass) bool {
	annotations := sc.GetAnnotations()
	if annotations == nil {
		return false
	}

	// Check both possible default annotations
	defaultAnnotations := []string{
		"storageclass.kubernetes.io/is-default-class",
		"storageclass.beta.kubernetes.io/is-default-class",
	}

	for _, annotation := range defaultAnnotations {
		if value, exists := annotations[annotation]; exists {
			return strings.ToLower(value) == "true"
		}
	}

	return false
}

// registerCustomRoutes registers custom routes for StorageClass handler
func (h *StorageClassHandler) registerCustomRoutes(group *gin.RouterGroup) {
	// Route to get related PVCs for a StorageClass
	group.GET("/_all/:name/pvcs", h.GetRelatedPVCs)
}

// Search implementation for StorageClass
func (h *StorageClassHandler) Search(c *gin.Context, q string, limit int64) ([]common.SearchResult, error) {
	if len(q) < 3 {
		return nil, nil
	}

	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	var scList storagev1.StorageClassList
	if err := cs.K8sClient.List(ctx, &scList); err != nil {
		klog.Errorf("failed to list storageclasses: %v", err)
		return nil, err
	}

	results := make([]common.SearchResult, 0, limit)

	for _, sc := range scList.Items {
		if !strings.Contains(strings.ToLower(sc.Name), strings.ToLower(q)) {
			continue
		}

		result := common.SearchResult{
			ID:           string(sc.GetUID()),
			Name:         sc.GetName(),
			Namespace:    sc.GetNamespace(),
			ResourceType: "storageclasses",
			CreatedAt:    sc.GetCreationTimestamp().String(),
		}
		results = append(results, result)
		if limit > 0 && int64(len(results)) >= limit {
			break
		}
	}

	return results, nil
}

// GetResource returns a StorageClass resource
func (h *StorageClassHandler) GetResource(c *gin.Context, namespace, name string) (interface{}, error) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	var sc storagev1.StorageClass
	namespacedName := types.NamespacedName{Name: name}
	if err := cs.K8sClient.Get(c.Request.Context(), namespacedName, &sc); err != nil {
		return nil, err
	}
	return &sc, nil
}

// Implement other required interface methods by delegating to the embedded handler
func (h *StorageClassHandler) Create(c *gin.Context) {
	h.GenericResourceHandler.Create(c)
}

func (h *StorageClassHandler) Update(c *gin.Context) {
	h.GenericResourceHandler.Update(c)
}

func (h *StorageClassHandler) Delete(c *gin.Context) {
	h.GenericResourceHandler.Delete(c)
}

func (h *StorageClassHandler) IsClusterScoped() bool {
	return h.GenericResourceHandler.IsClusterScoped()
}

func (h *StorageClassHandler) Searchable() bool {
	return true
}
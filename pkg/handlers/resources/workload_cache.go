package resources

import (
	"context"
	"strings"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/zxh326/kite/pkg/cluster"

	kruiseappsv1alpha1 "github.com/openkruise/kruise-api/apps/v1alpha1"
	kruiseappsv1beta1 "github.com/openkruise/kruise-api/apps/v1beta1"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
)

// WorkloadCache caches workload availability and count information
type WorkloadCache struct {
	mu              sync.RWMutex
	crdCache        map[string]*CRDCacheEntry
	workloadCache   map[string]*WorkloadCacheEntry
	cacheTTL        time.Duration
	lastCleanup     time.Time
	cleanupInterval time.Duration
}

// CRDCacheEntry stores CRD existence information
type CRDCacheEntry struct {
	exists    bool
	timestamp time.Time
}

// WorkloadCacheEntry stores workload count information
type WorkloadCacheEntry struct {
	available bool
	count     int
	timestamp time.Time
}

// NewWorkloadCache creates a new workload cache
func NewWorkloadCache() *WorkloadCache {
	return &WorkloadCache{
		crdCache:        make(map[string]*CRDCacheEntry),
		workloadCache:   make(map[string]*WorkloadCacheEntry),
		cacheTTL:        30 * time.Second, // Cache for 30 seconds
		cleanupInterval: 5 * time.Minute,  // Cleanup every 5 minutes
		lastCleanup:     time.Now(),
	}
}

// Global cache instance
var globalWorkloadCache = NewWorkloadCache()

// GetCachedWorkloadStatus returns cached workload status or fetches if not cached
func (wc *WorkloadCache) GetCachedWorkloadStatus(ctx context.Context, cs *cluster.ClientSet, workloads []OpenKruiseWorkload) []OpenKruiseWorkload {
	wc.cleanupExpiredEntries()

	result := make([]OpenKruiseWorkload, len(workloads))

	// First pass: check cache
	var toFetch []int
	for i, workload := range workloads {
		result[i] = workload

		cacheKey := workload.Kind + ":" + workload.APIVersion
		if entry := wc.getCachedEntry(cacheKey); entry != nil {
			result[i].Available = entry.available
			result[i].Count = entry.count
		} else {
			toFetch = append(toFetch, i)
		}
	}

	// Second pass: fetch missing data in batch
	if len(toFetch) > 0 {
		wc.batchFetchWorkloads(ctx, cs, result, toFetch)
	}

	return result
}

// GetCachedTailscaleWorkloadStatus returns cached Tailscale workload status
func (wc *WorkloadCache) GetCachedTailscaleWorkloadStatus(ctx context.Context, cs *cluster.ClientSet, workloads []TailscaleWorkload) []TailscaleWorkload {
	wc.cleanupExpiredEntries()

	result := make([]TailscaleWorkload, len(workloads))

	var toFetch []int
	for i, workload := range workloads {
		result[i] = workload

		cacheKey := "tailscale:" + workload.Kind + ":" + workload.APIVersion
		if entry := wc.getCachedEntry(cacheKey); entry != nil {
			result[i].Available = entry.available
			result[i].Count = entry.count
		} else {
			toFetch = append(toFetch, i)
		}
	}

	if len(toFetch) > 0 {
		wc.batchFetchTailscaleWorkloads(ctx, cs, result, toFetch)
	}

	return result
}

// GetCachedTraefikWorkloadStatus returns cached Traefik workload status
func (wc *WorkloadCache) GetCachedTraefikWorkloadStatus(ctx context.Context, cs *cluster.ClientSet, workloads []TraefikWorkload) []TraefikWorkload {
	wc.cleanupExpiredEntries()

	result := make([]TraefikWorkload, len(workloads))

	var toFetch []int
	for i, workload := range workloads {
		result[i] = workload

		cacheKey := "traefik:" + workload.Kind + ":" + workload.APIVersion
		if entry := wc.getCachedEntry(cacheKey); entry != nil {
			result[i].Available = entry.available
			result[i].Count = entry.count
		} else {
			toFetch = append(toFetch, i)
		}
	}

	if len(toFetch) > 0 {
		wc.batchFetchTraefikWorkloads(ctx, cs, result, toFetch)
	}

	return result
}

// getCachedEntry returns cached entry if valid
func (wc *WorkloadCache) getCachedEntry(key string) *WorkloadCacheEntry {
	wc.mu.RLock()
	defer wc.mu.RUnlock()

	if entry, exists := wc.workloadCache[key]; exists {
		if time.Since(entry.timestamp) < wc.cacheTTL {
			return entry
		}
	}
	return nil
}

// setCacheEntry sets cache entry
func (wc *WorkloadCache) setCacheEntry(key string, available bool, count int) {
	wc.mu.Lock()
	defer wc.mu.Unlock()

	wc.workloadCache[key] = &WorkloadCacheEntry{
		available: available,
		count:     count,
		timestamp: time.Now(),
	}
}

// checkCRDExistence checks if CRD exists with caching
func (wc *WorkloadCache) checkCRDExistence(ctx context.Context, cs *cluster.ClientSet, crdName string) bool {
	wc.mu.RLock()
	if entry, exists := wc.crdCache[crdName]; exists {
		if time.Since(entry.timestamp) < wc.cacheTTL {
			wc.mu.RUnlock()
			return entry.exists
		}
	}
	wc.mu.RUnlock()

	// Check CRD existence
	var crd apiextensionsv1.CustomResourceDefinition
	exists := cs.K8sClient.Get(ctx, types.NamespacedName{Name: crdName}, &crd) == nil

	// Cache the result
	wc.mu.Lock()
	wc.crdCache[crdName] = &CRDCacheEntry{
		exists:    exists,
		timestamp: time.Now(),
	}
	wc.mu.Unlock()

	return exists
}

// batchFetchWorkloads fetches multiple workloads efficiently
func (wc *WorkloadCache) batchFetchWorkloads(ctx context.Context, cs *cluster.ClientSet, result []OpenKruiseWorkload, indices []int) {
	// Group by resource type to minimize API calls
	typeGroups := make(map[string][]int)
	for _, idx := range indices {
		workload := result[idx]
		typeGroups[workload.Kind] = append(typeGroups[workload.Kind], idx)
	}

	// Fetch each type once
	for kind, idxList := range typeGroups {
		available, count := wc.fetchWorkloadByKind(ctx, cs, kind, result[idxList[0]])

		// Update all workloads of this type
		for _, idx := range idxList {
			result[idx].Available = available
			result[idx].Count = count

			cacheKey := result[idx].Kind + ":" + result[idx].APIVersion
			wc.setCacheEntry(cacheKey, available, count)
		}
	}
}

// fetchWorkloadByKind fetches workload count by kind
func (wc *WorkloadCache) fetchWorkloadByKind(ctx context.Context, cs *cluster.ClientSet, kind string, workload OpenKruiseWorkload) (bool, int) {
	crdName := getCRDName(kind)
	if crdName == "" {
		return false, 0
	}

	if !wc.checkCRDExistence(ctx, cs, crdName) {
		return false, 0
	}

	switch kind {
	case "CloneSet":
		var list kruiseappsv1alpha1.CloneSetList
		if err := cs.K8sClient.List(ctx, &list); err != nil {
			return true, 0
		}
		return true, len(list.Items)
	case "AdvancedDaemonSet":
		var list kruiseappsv1alpha1.DaemonSetList
		if err := cs.K8sClient.List(ctx, &list); err != nil {
			return true, 0
		}
		return true, len(list.Items)
	case "AdvancedStatefulSet":
		var list kruiseappsv1beta1.StatefulSetList
		if err := cs.K8sClient.List(ctx, &list); err != nil {
			return true, 0
		}
		return true, len(list.Items)
	case "BroadcastJob":
		var list kruiseappsv1alpha1.BroadcastJobList
		if err := cs.K8sClient.List(ctx, &list); err != nil {
			return true, 0
		}
		return true, len(list.Items)
	case "AdvancedCronJob":
		var list kruiseappsv1alpha1.AdvancedCronJobList
		if err := cs.K8sClient.List(ctx, &list); err != nil {
			return true, 0
		}
		return true, len(list.Items)
	case "SidecarSet":
		var list kruiseappsv1alpha1.SidecarSetList
		if err := cs.K8sClient.List(ctx, &list); err != nil {
			return true, 0
		}
		return true, len(list.Items)
	case "ImagePullJob":
		var list kruiseappsv1alpha1.ImagePullJobList
		if err := cs.K8sClient.List(ctx, &list); err != nil {
			return true, 0
		}
		return true, len(list.Items)
	default:
		return wc.fetchUnstructuredWorkload(ctx, cs, workload)
	}
}

// fetchUnstructuredWorkload fetches unstructured workload count
func (wc *WorkloadCache) fetchUnstructuredWorkload(ctx context.Context, cs *cluster.ClientSet, workload OpenKruiseWorkload) (bool, int) {
	parts := strings.Split(workload.APIVersion, "/")
	if len(parts) != 2 {
		return false, 0
	}

	group := parts[0]
	version := parts[1]

	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    workload.Kind + "List",
	})

	if err := cs.K8sClient.List(ctx, list); err != nil {
		return true, 0
	}

	return true, len(list.Items)
}

// batchFetchTailscaleWorkloads fetches Tailscale workloads efficiently
func (wc *WorkloadCache) batchFetchTailscaleWorkloads(ctx context.Context, cs *cluster.ClientSet, result []TailscaleWorkload, indices []int) {
	typeGroups := make(map[string][]int)
	for _, idx := range indices {
		workload := result[idx]
		typeGroups[workload.Kind] = append(typeGroups[workload.Kind], idx)
	}

	for kind, idxList := range typeGroups {
		available, count := wc.fetchTailscaleWorkloadByKind(ctx, cs, kind, result[idxList[0]])

		for _, idx := range idxList {
			result[idx].Available = available
			result[idx].Count = count

			cacheKey := "tailscale:" + result[idx].Kind + ":" + result[idx].APIVersion
			wc.setCacheEntry(cacheKey, available, count)
		}
	}
}

// fetchTailscaleWorkloadByKind fetches Tailscale workload by kind
func (wc *WorkloadCache) fetchTailscaleWorkloadByKind(ctx context.Context, cs *cluster.ClientSet, kind string, workload TailscaleWorkload) (bool, int) {
	crdName := getTailscaleCRDName(kind)
	if crdName == "" {
		return false, 0
	}

	if !wc.checkCRDExistence(ctx, cs, crdName) {
		return false, 0
	}

	parts := strings.Split(workload.APIVersion, "/")
	if len(parts) != 2 {
		return false, 0
	}

	group := parts[0]
	version := parts[1]

	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    workload.Kind + "List",
	})

	if err := cs.K8sClient.List(ctx, list); err != nil {
		return true, 0
	}

	return true, len(list.Items)
}

// batchFetchTraefikWorkloads fetches Traefik workloads efficiently
func (wc *WorkloadCache) batchFetchTraefikWorkloads(ctx context.Context, cs *cluster.ClientSet, result []TraefikWorkload, indices []int) {
	typeGroups := make(map[string][]int)
	for _, idx := range indices {
		workload := result[idx]
		typeGroups[workload.Kind] = append(typeGroups[workload.Kind], idx)
	}

	for kind, idxList := range typeGroups {
		available, count := wc.fetchTraefikWorkloadByKind(ctx, cs, kind, result[idxList[0]])

		for _, idx := range idxList {
			result[idx].Available = available
			result[idx].Count = count

			cacheKey := "traefik:" + result[idx].Kind + ":" + result[idx].APIVersion
			wc.setCacheEntry(cacheKey, available, count)
		}
	}
}

// fetchTraefikWorkloadByKind fetches Traefik workload by kind
func (wc *WorkloadCache) fetchTraefikWorkloadByKind(ctx context.Context, cs *cluster.ClientSet, kind string, workload TraefikWorkload) (bool, int) {
	crdName := getTraefikCRDName(kind)
	if crdName == "" {
		return false, 0
	}

	if !wc.checkCRDExistence(ctx, cs, crdName) {
		return false, 0
	}

	parts := strings.Split(workload.APIVersion, "/")
	if len(parts) != 2 {
		return false, 0
	}

	group := parts[0]
	version := parts[1]

	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    workload.Kind + "List",
	})

	if err := cs.K8sClient.List(ctx, list); err != nil {
		return true, 0
	}

	return true, len(list.Items)
}

// cleanupExpiredEntries removes expired cache entries
func (wc *WorkloadCache) cleanupExpiredEntries() {
	if time.Since(wc.lastCleanup) < wc.cleanupInterval {
		return
	}

	wc.mu.Lock()
	defer wc.mu.Unlock()

	now := time.Now()

	// Clean CRD cache
	for key, entry := range wc.crdCache {
		if now.Sub(entry.timestamp) > wc.cacheTTL {
			delete(wc.crdCache, key)
		}
	}

	// Clean workload cache
	for key, entry := range wc.workloadCache {
		if now.Sub(entry.timestamp) > wc.cacheTTL {
			delete(wc.workloadCache, key)
		}
	}

	wc.lastCleanup = now
}

// ClearCache clears all cached data
func (wc *WorkloadCache) ClearCache() {
	wc.mu.Lock()
	defer wc.mu.Unlock()

	wc.crdCache = make(map[string]*CRDCacheEntry)
	wc.workloadCache = make(map[string]*WorkloadCacheEntry)
}

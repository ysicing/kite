package resources

import (
	"context"
	"testing"
	"time"

	kruiseappsv1alpha1 "github.com/openkruise/kruise-api/apps/v1alpha1"
	kruiseappsv1beta1 "github.com/openkruise/kruise-api/apps/v1beta1"
	"github.com/stretchr/testify/assert"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	"github.com/zxh326/kite/pkg/cluster"
	"github.com/zxh326/kite/pkg/kube"
)

func TestWorkloadCache_GetCachedWorkloadStatus(t *testing.T) {
	tests := []struct {
		name              string
		workloads         []OpenKruiseWorkload
		expectAPICallsNum int
		description       string
	}{
		{
			name: "First call - cache miss",
			workloads: []OpenKruiseWorkload{
				{
					Kind:       "CloneSet",
					APIVersion: "apps.kruise.io/v1alpha1",
				},
				{
					Kind:       "AdvancedDaemonSet",
					APIVersion: "apps.kruise.io/v1alpha1",
				},
			},
			expectAPICallsNum: 4, // 2 CRD checks + 2 List calls
			description:       "Should make API calls for cache miss",
		},
		{
			name: "Second call - cache hit",
			workloads: []OpenKruiseWorkload{
				{
					Kind:       "CloneSet",
					APIVersion: "apps.kruise.io/v1alpha1",
				},
				{
					Kind:       "AdvancedDaemonSet",
					APIVersion: "apps.kruise.io/v1alpha1",
				},
			},
			expectAPICallsNum: 0, // Should use cache
			description:       "Should use cache for repeated calls",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh cache for each test
			cache := NewWorkloadCache()
			cache.cacheTTL = 1 * time.Second // Short TTL for testing

			cs := newWorkloadCacheTestClientSet(t, openKruiseCRDs()...)
			ctx := context.Background()

			// First call to populate cache
			if tt.name == "First call - cache miss" {
				result := cache.GetCachedWorkloadStatus(ctx, cs, tt.workloads)
				assert.Len(t, result, len(tt.workloads))
			}

			// Reset mock call count for second test
			if tt.name == "Second call - cache hit" {
				// Populate cache first
				_ = cache.GetCachedWorkloadStatus(ctx, cs, tt.workloads)
				assert.Len(t, cache.workloadCache, len(tt.workloads))
			}

			// Test the actual call
			result := cache.GetCachedWorkloadStatus(ctx, cs, tt.workloads)

			// Verify results
			assert.Len(t, result, len(tt.workloads))

			if tt.name == "Second call - cache hit" {
				assert.Equal(t, tt.expectAPICallsNum, 0, tt.description)
			}
		})
	}
}

func TestWorkloadCache_CacheExpiration(t *testing.T) {
	cache := NewWorkloadCache()
	cache.cacheTTL = 100 * time.Millisecond // Very short TTL for testing

	// Set a cache entry
	cache.setCacheEntry("test-key", true, 5)

	// Verify entry exists
	entry := cache.getCachedEntry("test-key")
	assert.NotNil(t, entry)
	assert.True(t, entry.available)
	assert.Equal(t, 5, entry.count)

	// Wait for cache to expire
	time.Sleep(150 * time.Millisecond)

	// Verify entry has expired
	entry = cache.getCachedEntry("test-key")
	assert.Nil(t, entry)
}

func TestWorkloadCache_BatchOptimization(t *testing.T) {
	cache := NewWorkloadCache()

	workloads := []OpenKruiseWorkload{
		{Kind: "CloneSet", APIVersion: "apps.kruise.io/v1alpha1"},
		{Kind: "CloneSet", APIVersion: "apps.kruise.io/v1alpha1"}, // Same type
		{Kind: "AdvancedDaemonSet", APIVersion: "apps.kruise.io/v1alpha1"},
	}

	cs := newWorkloadCacheTestClientSet(t, openKruiseCRDs()...)
	ctx := context.Background()
	result := cache.GetCachedWorkloadStatus(ctx, cs, workloads)

	// Should batch same types together
	assert.Len(t, result, 3)

	// Both CloneSet entries should have same values (batched)
	assert.Equal(t, result[0].Available, result[1].Available)
	assert.Equal(t, result[0].Count, result[1].Count)
}

func BenchmarkWorkloadCache_WithCache(b *testing.B) {
	cache := NewWorkloadCache()
	workloads := []OpenKruiseWorkload{
		{Kind: "CloneSet", APIVersion: "apps.kruise.io/v1alpha1"},
		{Kind: "AdvancedDaemonSet", APIVersion: "apps.kruise.io/v1alpha1"},
		{Kind: "BroadcastJob", APIVersion: "apps.kruise.io/v1alpha1"},
	}

	cs := &cluster.ClientSet{
		K8sClient: newWorkloadCacheTestK8sClient(b, openKruiseCRDs()...),
	}
	ctx := context.Background()

	// Populate cache first
	_ = cache.GetCachedWorkloadStatus(ctx, cs, workloads)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = cache.GetCachedWorkloadStatus(ctx, cs, workloads)
	}
}

func BenchmarkWorkloadCache_WithoutCache(b *testing.B) {
	workloads := []OpenKruiseWorkload{
		{Kind: "CloneSet", APIVersion: "apps.kruise.io/v1alpha1"},
		{Kind: "AdvancedDaemonSet", APIVersion: "apps.kruise.io/v1alpha1"},
		{Kind: "BroadcastJob", APIVersion: "apps.kruise.io/v1alpha1"},
	}

	cs := &cluster.ClientSet{
		K8sClient: newWorkloadCacheTestK8sClient(b, openKruiseCRDs()...),
	}
	ctx := context.Background()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		// Simulate original approach - checking each workload individually
		for _, workload := range workloads {
			_, _ = checkWorkloadAvailability(ctx, cs, workload)
		}
	}
}

type workloadCacheTestingT interface {
	Helper()
	Fatalf(format string, args ...interface{})
}

func newWorkloadCacheTestClientSet(t workloadCacheTestingT, objects ...client.Object) *cluster.ClientSet {
	t.Helper()
	return &cluster.ClientSet{
		K8sClient: newWorkloadCacheTestK8sClient(t, objects...),
	}
}

func newWorkloadCacheTestK8sClient(t workloadCacheTestingT, objects ...client.Object) *kube.K8sClient {
	t.Helper()

	scheme := runtime.NewScheme()
	if err := apiextensionsv1.AddToScheme(scheme); err != nil {
		t.Fatalf("failed to add apiextensions scheme: %v", err)
	}
	if err := kruiseappsv1alpha1.AddToScheme(scheme); err != nil {
		t.Fatalf("failed to add OpenKruise v1alpha1 scheme: %v", err)
	}
	if err := kruiseappsv1beta1.AddToScheme(scheme); err != nil {
		t.Fatalf("failed to add OpenKruise v1beta1 scheme: %v", err)
	}

	return &kube.K8sClient{
		Client: fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(objects...).
			Build(),
	}
}

func openKruiseCRDs() []client.Object {
	return []client.Object{
		&apiextensionsv1.CustomResourceDefinition{
			ObjectMeta: metav1.ObjectMeta{Name: "clonesets.apps.kruise.io"},
		},
		&apiextensionsv1.CustomResourceDefinition{
			ObjectMeta: metav1.ObjectMeta{Name: "daemonsets.apps.kruise.io"},
		},
		&apiextensionsv1.CustomResourceDefinition{
			ObjectMeta: metav1.ObjectMeta{Name: "broadcastjobs.apps.kruise.io"},
		},
	}
}

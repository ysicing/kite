package resources

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/apimachinery/pkg/types"

	"github.com/zxh326/kite/pkg/cluster"
	"github.com/zxh326/kite/pkg/kube"
)

// MockK8sClient is a mock implementation of K8sClient for testing
type MockK8sClient struct {
	mock.Mock
}

func (m *MockK8sClient) Get(ctx context.Context, name types.NamespacedName, obj interface{}) error {
	args := m.Called(ctx, name, obj)
	return args.Error(0)
}

func (m *MockK8sClient) List(ctx context.Context, list interface{}, opts ...interface{}) error {
	args := m.Called(ctx, list, opts)
	return args.Error(0)
}

// MockClusterSet is a mock implementation of cluster.ClientSet
type MockClusterSet struct {
	K8sClient *MockK8sClient
}

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

			mockK8sClient := &MockK8sClient{}
			cs := &cluster.ClientSet{
				K8sClient: &kube.K8sClient{},
			}

			// Mock CRD existence check
			mockK8sClient.On("Get", mock.Anything, mock.Anything, mock.AnythingOfType("*v1.CustomResourceDefinition")).Return(nil)

			// Mock List calls
			mockK8sClient.On("List", mock.Anything, mock.Anything, mock.Anything).Return(nil)

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
				mockK8sClient.Calls = nil // Reset call count
			}

			// Test the actual call
			result := cache.GetCachedWorkloadStatus(ctx, cs, tt.workloads)

			// Verify results
			assert.Len(t, result, len(tt.workloads))

			// Check number of API calls made
			if tt.name == "Second call - cache hit" {
				assert.Equal(t, tt.expectAPICallsNum, len(mockK8sClient.Calls), tt.description)
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

	mockK8sClient := &MockK8sClient{}
	cs := &cluster.ClientSet{
		K8sClient: &kube.K8sClient{},
	}

	// Mock CRD existence check
	mockK8sClient.On("Get", mock.Anything, mock.Anything, mock.AnythingOfType("*v1.CustomResourceDefinition")).Return(nil)

	// Mock List calls
	mockK8sClient.On("List", mock.Anything, mock.Anything, mock.Anything).Return(nil)

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
		K8sClient: &kube.K8sClient{},
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
		K8sClient: &kube.K8sClient{},
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

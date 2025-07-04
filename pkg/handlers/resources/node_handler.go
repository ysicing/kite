package resources

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/zxh326/kite/pkg/cluster"
	"github.com/zxh326/kite/pkg/kube"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NodeDetailInfo 节点详细信息
type NodeDetailInfo struct {
	*corev1.Node `json:",inline"`

	// 资源使用情况 (原始Quantity)
	CPUUsage    *resource.Quantity `json:"cpuUsage,omitempty"`
	MemoryUsage *resource.Quantity `json:"memoryUsage,omitempty"`

	// 资源分配情况 (原始Quantity)
	CPURequested    *resource.Quantity `json:"cpuRequested,omitempty"`
	MemoryRequested *resource.Quantity `json:"memoryRequested,omitempty"`
	CPULimited      *resource.Quantity `json:"cpuLimited,omitempty"`
	MemoryLimited   *resource.Quantity `json:"memoryLimited,omitempty"`

	// 资源使用情况 (转换为核心数/字节数)
	CPUUsageCores    float64 `json:"cpuUsageCores"`
	MemoryUsageBytes int64   `json:"memoryUsageBytes"`

	// 资源分配情况 (转换为核心数/字节数)
	CPURequestedCores    float64 `json:"cpuRequestedCores"`
	MemoryRequestedBytes int64   `json:"memoryRequestedBytes"`
	CPULimitedCores      float64 `json:"cpuLimitedCores"`
	MemoryLimitedBytes   int64   `json:"memoryLimitedBytes"`

	// 资源容量 (转换为核心数/字节数)
	CPUCapacityCores       float64 `json:"cpuCapacityCores"`
	MemoryCapacityBytes    int64   `json:"memoryCapacityBytes"`
	CPUAllocatableCores    float64 `json:"cpuAllocatableCores"`
	MemoryAllocatableBytes int64   `json:"memoryAllocatableBytes"`

	// Pod信息
	PodCount    int `json:"podCount"`
	PodCapacity int `json:"podCapacity"`

	// 存活时间
	Age string `json:"age"`

	// 使用率百分比
	CPUUsagePercent        float64 `json:"cpuUsagePercent"`
	MemoryUsagePercent     float64 `json:"memoryUsagePercent"`
	CPURequestedPercent    float64 `json:"cpuRequestedPercent"`
	MemoryRequestedPercent float64 `json:"memoryRequestedPercent"`
	PodUsagePercent        float64 `json:"podUsagePercent"`
}

type NodeHandler struct {
	*GenericResourceHandler[*corev1.Node, *corev1.NodeList]
}

func NewNodeHandler() *NodeHandler {
	return &NodeHandler{
		GenericResourceHandler: NewGenericResourceHandler[*corev1.Node, *corev1.NodeList](
			"nodes",
			true, // Nodes are cluster-scoped resources
			true,
		),
	}
}

// GetNodesWithDetails 获取所有节点的详细信息
func (h *NodeHandler) GetNodesWithDetails(c *gin.Context) {
	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	// 获取所有节点
	var nodes corev1.NodeList
	if err := cs.K8sClient.List(ctx, &nodes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 获取所有Pod用于计算资源分配
	var pods corev1.PodList
	if err := cs.K8sClient.List(ctx, &pods); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 为每个节点创建详细信息
	nodeDetails := make([]NodeDetailInfo, 0, len(nodes.Items))
	for _, node := range nodes.Items {
		nodeDetail := NodeDetailInfo{
			Node: &node,
		}

		// 计算存活时间
		if !node.CreationTimestamp.IsZero() {
			nodeDetail.Age = formatDuration(time.Since(node.CreationTimestamp.Time))
		}

		// 获取Pod容量
		if podCapacity, ok := node.Status.Capacity[corev1.ResourcePods]; ok {
			nodeDetail.PodCapacity = int(podCapacity.Value())
		}

		// 计算该节点上的Pod数量和资源使用
		var cpuRequested, memoryRequested, cpuLimited, memoryLimited resource.Quantity
		podCount := 0
		for _, pod := range pods.Items {
			if pod.Spec.NodeName == node.Name {
				podCount++
				for _, container := range pod.Spec.Containers {
					if container.Resources.Requests != nil {
						if cpu, ok := container.Resources.Requests[corev1.ResourceCPU]; ok {
							cpuRequested.Add(cpu)
						}
						if memory, ok := container.Resources.Requests[corev1.ResourceMemory]; ok {
							memoryRequested.Add(memory)
						}
					}
					if container.Resources.Limits != nil {
						if cpu, ok := container.Resources.Limits[corev1.ResourceCPU]; ok {
							cpuLimited.Add(cpu)
						}
						if memory, ok := container.Resources.Limits[corev1.ResourceMemory]; ok {
							memoryLimited.Add(memory)
						}
					}
				}
			}
		}

		nodeDetail.PodCount = podCount
		nodeDetail.CPURequested = &cpuRequested
		nodeDetail.MemoryRequested = &memoryRequested
		nodeDetail.CPULimited = &cpuLimited
		nodeDetail.MemoryLimited = &memoryLimited

		// 转换资源分配情况为核心数/字节数
		nodeDetail.CPURequestedCores = convertCPUToCores(&cpuRequested)
		nodeDetail.MemoryRequestedBytes = convertMemoryToBytes(&memoryRequested)
		nodeDetail.CPULimitedCores = convertCPUToCores(&cpuLimited)
		nodeDetail.MemoryLimitedBytes = convertMemoryToBytes(&memoryLimited)

		// 转换资源容量为核心数/字节数
		if node.Status.Capacity != nil {
			if cpuCapacity, ok := node.Status.Capacity[corev1.ResourceCPU]; ok {
				nodeDetail.CPUCapacityCores = convertCPUToCores(&cpuCapacity)
			}
			if memoryCapacity, ok := node.Status.Capacity[corev1.ResourceMemory]; ok {
				nodeDetail.MemoryCapacityBytes = convertMemoryToBytes(&memoryCapacity)
			}
		}

		if node.Status.Allocatable != nil {
			if cpuAllocatable, ok := node.Status.Allocatable[corev1.ResourceCPU]; ok {
				nodeDetail.CPUAllocatableCores = convertCPUToCores(&cpuAllocatable)
			}
			if memoryAllocatable, ok := node.Status.Allocatable[corev1.ResourceMemory]; ok {
				nodeDetail.MemoryAllocatableBytes = convertMemoryToBytes(&memoryAllocatable)
			}
		}

		// 尝试获取节点实际使用情况（从metrics server）
		if cs.K8sClient.MetricsClient != nil {
			if nodeMetrics, err := cs.K8sClient.MetricsClient.MetricsV1beta1().NodeMetricses().Get(ctx, node.Name, metav1.GetOptions{}); err == nil {
				if cpuUsage, ok := nodeMetrics.Usage[corev1.ResourceCPU]; ok {
					nodeDetail.CPUUsage = &cpuUsage
					nodeDetail.CPUUsageCores = convertCPUToCores(&cpuUsage)
				}
				if memoryUsage, ok := nodeMetrics.Usage[corev1.ResourceMemory]; ok {
					nodeDetail.MemoryUsage = &memoryUsage
					nodeDetail.MemoryUsageBytes = convertMemoryToBytes(&memoryUsage)
				}
			}
		}

		// 计算使用率百分比
		if nodeDetail.CPUUsage != nil && node.Status.Capacity != nil {
			if cpuCapacity, ok := node.Status.Capacity[corev1.ResourceCPU]; ok {
				nodeDetail.CPUUsagePercent = float64(nodeDetail.CPUUsage.MilliValue()) / float64(cpuCapacity.MilliValue()) * 100
			}
		}

		if nodeDetail.MemoryUsage != nil && node.Status.Capacity != nil {
			if memoryCapacity, ok := node.Status.Capacity[corev1.ResourceMemory]; ok {
				nodeDetail.MemoryUsagePercent = float64(nodeDetail.MemoryUsage.Value()) / float64(memoryCapacity.Value()) * 100
			}
		}

		if node.Status.Allocatable != nil {
			if cpuAllocatable, ok := node.Status.Allocatable[corev1.ResourceCPU]; ok {
				nodeDetail.CPURequestedPercent = float64(cpuRequested.MilliValue()) / float64(cpuAllocatable.MilliValue()) * 100
			}
			if memoryAllocatable, ok := node.Status.Allocatable[corev1.ResourceMemory]; ok {
				nodeDetail.MemoryRequestedPercent = float64(memoryRequested.Value()) / float64(memoryAllocatable.Value()) * 100
			}
		}

		if nodeDetail.PodCapacity > 0 {
			nodeDetail.PodUsagePercent = float64(nodeDetail.PodCount) / float64(nodeDetail.PodCapacity) * 100
		}

		nodeDetails = append(nodeDetails, nodeDetail)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": nodeDetails,
	})
}

// GetNodeDetails 获取节点详细信息
func (h *NodeHandler) GetNodeDetails(c *gin.Context) {
	nodeName := c.Param("name")
	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	// 获取节点基本信息
	var node corev1.Node
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Name: nodeName}, &node); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	nodeDetail := &NodeDetailInfo{
		Node: &node,
	}

	// 计算存活时间
	if !node.CreationTimestamp.IsZero() {
		nodeDetail.Age = formatDuration(time.Since(node.CreationTimestamp.Time))
	}

	// 获取Pod容量
	if podCapacity, ok := node.Status.Capacity[corev1.ResourcePods]; ok {
		nodeDetail.PodCapacity = int(podCapacity.Value())
	}

	// 获取该节点上的所有Pod
	var pods corev1.PodList
	if err := cs.K8sClient.List(ctx, &pods, &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector("spec.nodeName", nodeName),
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get pods: %v", err)})
		return
	}

	nodeDetail.PodCount = len(pods.Items)

	// 计算资源请求和限制
	var cpuRequested, memoryRequested, cpuLimited, memoryLimited resource.Quantity
	for _, pod := range pods.Items {
		for _, container := range pod.Spec.Containers {
			if container.Resources.Requests != nil {
				if cpu, ok := container.Resources.Requests[corev1.ResourceCPU]; ok {
					cpuRequested.Add(cpu)
				}
				if memory, ok := container.Resources.Requests[corev1.ResourceMemory]; ok {
					memoryRequested.Add(memory)
				}
			}
			if container.Resources.Limits != nil {
				if cpu, ok := container.Resources.Limits[corev1.ResourceCPU]; ok {
					cpuLimited.Add(cpu)
				}
				if memory, ok := container.Resources.Limits[corev1.ResourceMemory]; ok {
					memoryLimited.Add(memory)
				}
			}
		}
	}

	nodeDetail.CPURequested = &cpuRequested
	nodeDetail.MemoryRequested = &memoryRequested
	nodeDetail.CPULimited = &cpuLimited
	nodeDetail.MemoryLimited = &memoryLimited

	// 转换资源分配情况为核心数/字节数
	nodeDetail.CPURequestedCores = convertCPUToCores(&cpuRequested)
	nodeDetail.MemoryRequestedBytes = convertMemoryToBytes(&memoryRequested)
	nodeDetail.CPULimitedCores = convertCPUToCores(&cpuLimited)
	nodeDetail.MemoryLimitedBytes = convertMemoryToBytes(&memoryLimited)

	// 转换资源容量为核心数/字节数
	if node.Status.Capacity != nil {
		if cpuCapacity, ok := node.Status.Capacity[corev1.ResourceCPU]; ok {
			nodeDetail.CPUCapacityCores = convertCPUToCores(&cpuCapacity)
		}
		if memoryCapacity, ok := node.Status.Capacity[corev1.ResourceMemory]; ok {
			nodeDetail.MemoryCapacityBytes = convertMemoryToBytes(&memoryCapacity)
		}
	}

	if node.Status.Allocatable != nil {
		if cpuAllocatable, ok := node.Status.Allocatable[corev1.ResourceCPU]; ok {
			nodeDetail.CPUAllocatableCores = convertCPUToCores(&cpuAllocatable)
		}
		if memoryAllocatable, ok := node.Status.Allocatable[corev1.ResourceMemory]; ok {
			nodeDetail.MemoryAllocatableBytes = convertMemoryToBytes(&memoryAllocatable)
		}
	}

	// 尝试获取节点实际使用情况（从metrics server）
	if cs.K8sClient.MetricsClient != nil {
		if nodeMetrics, err := cs.K8sClient.MetricsClient.MetricsV1beta1().NodeMetricses().Get(ctx, nodeName, metav1.GetOptions{}); err == nil {
			if cpuUsage, ok := nodeMetrics.Usage[corev1.ResourceCPU]; ok {
				nodeDetail.CPUUsage = &cpuUsage
				nodeDetail.CPUUsageCores = convertCPUToCores(&cpuUsage)
			}
			if memoryUsage, ok := nodeMetrics.Usage[corev1.ResourceMemory]; ok {
				nodeDetail.MemoryUsage = &memoryUsage
				nodeDetail.MemoryUsageBytes = convertMemoryToBytes(&memoryUsage)
			}
		}
	}

	// 计算使用率百分比
	if nodeDetail.CPUUsage != nil && node.Status.Capacity != nil {
		if cpuCapacity, ok := node.Status.Capacity[corev1.ResourceCPU]; ok {
			nodeDetail.CPUUsagePercent = float64(nodeDetail.CPUUsage.MilliValue()) / float64(cpuCapacity.MilliValue()) * 100
		}
	}

	if nodeDetail.MemoryUsage != nil && node.Status.Capacity != nil {
		if memoryCapacity, ok := node.Status.Capacity[corev1.ResourceMemory]; ok {
			nodeDetail.MemoryUsagePercent = float64(nodeDetail.MemoryUsage.Value()) / float64(memoryCapacity.Value()) * 100
		}
	}

	if node.Status.Allocatable != nil {
		if cpuAllocatable, ok := node.Status.Allocatable[corev1.ResourceCPU]; ok {
			nodeDetail.CPURequestedPercent = float64(cpuRequested.MilliValue()) / float64(cpuAllocatable.MilliValue()) * 100
		}
		if memoryAllocatable, ok := node.Status.Allocatable[corev1.ResourceMemory]; ok {
			nodeDetail.MemoryRequestedPercent = float64(memoryRequested.Value()) / float64(memoryAllocatable.Value()) * 100
		}
	}

	if nodeDetail.PodCapacity > 0 {
		nodeDetail.PodUsagePercent = float64(nodeDetail.PodCount) / float64(nodeDetail.PodCapacity) * 100
	}

	c.JSON(http.StatusOK, nodeDetail)
}

// formatDuration 格式化持续时间
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	} else if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	} else if d < 24*time.Hour {
		return fmt.Sprintf("%dh", int(d.Hours()))
	} else {
		days := int(d.Hours()) / 24
		hours := int(d.Hours()) % 24
		if hours > 0 {
			return fmt.Sprintf("%dd%dh", days, hours)
		}
		return fmt.Sprintf("%dd", days)
	}
}

// DrainNode drains a node by evicting all pods
func (h *NodeHandler) DrainNode(c *gin.Context) {
	nodeName := c.Param("name")
	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	// Parse the request body for drain options
	var drainRequest struct {
		Force            bool `json:"force" binding:"required"`
		GracePeriod      int  `json:"gracePeriod" binding:"min=0"`
		DeleteLocal      bool `json:"deleteLocalData"`
		IgnoreDaemonsets bool `json:"ignoreDaemonsets"`
	}

	if err := c.ShouldBindJSON(&drainRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Get the node first to ensure it exists
	var node corev1.Node
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Name: nodeName}, &node); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// TODO: Implement actual drain logic
	// For now, we'll simulate the drain operation
	// In a real implementation, you would:
	// 1. Mark the node as unschedulable (cordon)
	// 2. Evict all pods from the node
	// 3. Handle daemonsets appropriately
	// 4. Wait for pods to be evicted or force delete them

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Node %s drain operation initiated", nodeName),
		"node":    nodeName,
		"options": drainRequest,
	})
}

func (h *NodeHandler) markNodeSchedulable(ctx context.Context, client *kube.K8sClient, nodeName string, schedulable bool) error {
	// Get the current node
	var node corev1.Node
	if err := client.Get(ctx, types.NamespacedName{Name: nodeName}, &node); err != nil {
		return err
	}
	node.Spec.Unschedulable = !schedulable
	if err := client.Update(ctx, &node); err != nil {
		return err
	}
	return nil
}

// CordonNode marks a node as unschedulable
func (h *NodeHandler) CordonNode(c *gin.Context) {
	nodeName := c.Param("name")
	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	if err := h.markNodeSchedulable(ctx, cs.K8sClient, nodeName, false); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
			return
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Node %s cordoned successfully", nodeName),
	})
}

// UncordonNode marks a node as schedulable
func (h *NodeHandler) UncordonNode(c *gin.Context) {
	nodeName := c.Param("name")
	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	if err := h.markNodeSchedulable(ctx, cs.K8sClient, nodeName, true); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
			return
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Node %s uncordoned successfully", nodeName),
	})
}

// TaintNode adds or updates taints on a node
func (h *NodeHandler) TaintNode(c *gin.Context) {
	nodeName := c.Param("name")
	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	// Parse the request body for taint information
	var taintRequest struct {
		Key    string `json:"key" binding:"required"`
		Value  string `json:"value"`
		Effect string `json:"effect" binding:"required,oneof=NoSchedule PreferNoSchedule NoExecute"`
	}

	if err := c.ShouldBindJSON(&taintRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Get the current node
	var node corev1.Node
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Name: nodeName}, &node); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create the new taint
	newTaint := corev1.Taint{
		Key:    taintRequest.Key,
		Value:  taintRequest.Value,
		Effect: corev1.TaintEffect(taintRequest.Effect),
	}

	// Check if taint with same key already exists and update it, otherwise add new taint
	found := false
	for i, taint := range node.Spec.Taints {
		if taint.Key == taintRequest.Key {
			node.Spec.Taints[i] = newTaint
			found = true
			break
		}
	}

	if !found {
		node.Spec.Taints = append(node.Spec.Taints, newTaint)
	}

	// Update the node
	if err := cs.K8sClient.Update(ctx, &node); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to taint node: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Node %s tainted successfully", nodeName),
		"node":    node.Name,
		"taint":   newTaint,
	})
}

// UntaintNode removes a taint from a node
func (h *NodeHandler) UntaintNode(c *gin.Context) {
	nodeName := c.Param("name")
	ctx := c.Request.Context()
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	// Parse the request body for taint key to remove
	var untaintRequest struct {
		Key string `json:"key" binding:"required"`
	}

	if err := c.ShouldBindJSON(&untaintRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Get the current node
	var node corev1.Node
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Name: nodeName}, &node); err != nil {
		if errors.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Find and remove the taint with the specified key
	originalLength := len(node.Spec.Taints)
	var newTaints []corev1.Taint
	for _, taint := range node.Spec.Taints {
		if taint.Key != untaintRequest.Key {
			newTaints = append(newTaints, taint)
		}
	}
	node.Spec.Taints = newTaints

	if len(newTaints) == originalLength {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Taint with key '%s' not found on node", untaintRequest.Key)})
		return
	}

	// Update the node
	if err := cs.K8sClient.Update(ctx, &node); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to untaint node: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         fmt.Sprintf("Taint with key '%s' removed from node %s successfully", untaintRequest.Key, nodeName),
		"node":            node.Name,
		"removedTaintKey": untaintRequest.Key,
	})
}

func (h *NodeHandler) registerCustomRoutes(group *gin.RouterGroup) {
	group.GET("/_all/details", h.GetNodesWithDetails)
	group.GET("/_all/:name/details", h.GetNodeDetails)
	group.POST("/_all/:name/drain", h.DrainNode)
	group.POST("/_all/:name/cordon", h.CordonNode)
	group.POST("/_all/:name/uncordon", h.UncordonNode)
	group.POST("/_all/:name/taint", h.TaintNode)
	group.POST("/_all/:name/untaint", h.UntaintNode)
}

// convertCPUToCores 将CPU资源转换为核心数
func convertCPUToCores(q *resource.Quantity) float64 {
	if q == nil {
		return 0
	}
	// 使用MilliValue()获取毫核数，然后转换为核心数
	return float64(q.MilliValue()) / 1000.0
}

// convertMemoryToBytes 将内存资源转换为字节数
func convertMemoryToBytes(q *resource.Quantity) int64 {
	if q == nil {
		return 0
	}
	return q.Value()
}

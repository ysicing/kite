package prometheus

import (
	"context"
	"testing"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes/fake"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestPrometheusDiscovery_DiscoverFromServices(t *testing.T) {
	// 创建测试数据
	objects := []runtime.Object{
		&corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: "monitoring",
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "prometheus-server",
				Namespace: "monitoring",
				Labels: map[string]string{
					"app": "prometheus",
				},
			},
			Spec: corev1.ServiceSpec{
				Type: corev1.ServiceTypeClusterIP,
				Ports: []corev1.ServicePort{
					{
						Name:       "http",
						Port:       9090,
						TargetPort: intstr.FromInt(9090),
						Protocol:   corev1.ProtocolTCP,
					},
				},
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "prometheus-nodeport",
				Namespace: "monitoring",
				Labels: map[string]string{
					"app.kubernetes.io/name": "prometheus",
				},
			},
			Spec: corev1.ServiceSpec{
				Type: corev1.ServiceTypeNodePort,
				Ports: []corev1.ServicePort{
					{
						Name:       "web",
						Port:       9090,
						TargetPort: intstr.FromInt(9090),
						NodePort:   30090,
						Protocol:   corev1.ProtocolTCP,
					},
				},
			},
		},
		&corev1.Node{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-node",
			},
			Status: corev1.NodeStatus{
				Addresses: []corev1.NodeAddress{
					{
						Type:    corev1.NodeInternalIP,
						Address: "192.168.1.100",
					},
				},
			},
		},
	}

	client := fake.NewSimpleClientset(objects...)
	discovery := NewPrometheusDiscovery(client)

	ctx := context.Background()
	endpoints, err := discovery.DiscoverPrometheusEndpoints(ctx)

	if err != nil {
		t.Fatalf("DiscoverPrometheusEndpoints failed: %v", err)
	}

	if len(endpoints) == 0 {
		t.Fatal("Expected to find prometheus endpoints, but found none")
	}

	// 验证发现的端点
	foundClusterIP := false
	foundNodePort := false

	for _, endpoint := range endpoints {
		t.Logf("Found endpoint: %+v", endpoint)

		if endpoint.Method == "ClusterIP" && endpoint.Service == "prometheus-server" {
			foundClusterIP = true
			expectedURL := "http://prometheus-server.monitoring.svc.cluster.local:9090"
			if endpoint.URL != expectedURL {
				t.Errorf("Expected ClusterIP URL %s, got %s", expectedURL, endpoint.URL)
			}
		}

		if endpoint.Method == "NodePort" && endpoint.Service == "prometheus-nodeport" {
			foundNodePort = true
			expectedURL := "http://192.168.1.100:30090"
			if endpoint.URL != expectedURL {
				t.Errorf("Expected NodePort URL %s, got %s", expectedURL, endpoint.URL)
			}
		}
	}

	if !foundClusterIP {
		t.Error("Expected to find ClusterIP service endpoint")
	}
	if !foundNodePort {
		t.Error("Expected to find NodePort service endpoint")
	}
}

func TestPrometheusDiscovery_ServiceIdentification(t *testing.T) {
	discovery := NewPrometheusDiscovery(nil)

	testCases := []struct {
		name     string
		service  *corev1.Service
		expected bool
	}{
		{
			name: "prometheus-server by name",
			service: &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Name: "prometheus-server",
				},
			},
			expected: true,
		},
		{
			name: "prometheus by label",
			service: &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-service",
					Labels: map[string]string{
						"app": "prometheus",
					},
				},
			},
			expected: true,
		},
		{
			name: "prometheus by port",
			service: &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-service",
				},
				Spec: corev1.ServiceSpec{
					Ports: []corev1.ServicePort{
						{
							Port: 9090,
						},
					},
				},
			},
			expected: true,
		},
		{
			name: "non-prometheus service",
			service: &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Name: "redis-service",
				},
				Spec: corev1.ServiceSpec{
					Ports: []corev1.ServicePort{
						{
							Port: 6379,
						},
					},
				},
			},
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := discovery.isPrometheusService(tc.service)
			if result != tc.expected {
				t.Errorf("Expected %v for service %s, got %v", tc.expected, tc.service.Name, result)
			}
		})
	}
}

func TestPrometheusDiscovery_PriorityCalculation(t *testing.T) {
	discovery := NewPrometheusDiscovery(nil)

	endpoints := []PrometheusEndpoint{
		{
			Namespace: "default",
			Service:   "my-prometheus",
			Method:    "ClusterIP",
			URL:       "http://my-prometheus.default.svc.cluster.local:9090",
		},
		{
			Namespace: "monitoring",
			Service:   "prometheus-server",
			Method:    "LoadBalancer",
			URL:       "http://10.0.0.1:9090",
		},
		{
			Namespace: "kube-system",
			Service:   "prometheus",
			Method:    "NodePort",
			URL:       "http://192.168.1.100:30090",
		},
	}

	discovery.calculatePriorities(endpoints)

	// monitoring namespace + LoadBalancer + prometheus-server + :9090 应该有最高优先级
	maxPriority := 0
	maxIndex := -1
	for i, endpoint := range endpoints {
		if endpoint.Priority > maxPriority {
			maxPriority = endpoint.Priority
			maxIndex = i
		}
	}

	if maxIndex != 1 {
		t.Errorf("Expected endpoint 1 (monitoring namespace, LoadBalancer) to have highest priority, but endpoint %d had highest priority", maxIndex)
	}

	expectedHighest := endpoints[1]
	if expectedHighest.Namespace != "monitoring" || expectedHighest.Method != "LoadBalancer" {
		t.Errorf("Priority calculation is incorrect")
	}
}

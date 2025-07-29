package prometheus

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// PrometheusEndpoint 表示发现的prometheus端点
type PrometheusEndpoint struct {
	URL       string            `json:"url"`
	Namespace string            `json:"namespace"`
	Service   string            `json:"service"`
	Type      string            `json:"type"`   // service, ingress
	Method    string            `json:"method"` // ClusterIP, NodePort, LoadBalancer, Ingress
	Priority  int               `json:"priority"`
	Labels    map[string]string `json:"labels"`
	Reachable bool              `json:"reachable"`
}

// PrometheusDiscovery 用于在kubernetes集群中发现prometheus服务
type PrometheusDiscovery struct {
	client kubernetes.Interface
}

// NewPrometheusDiscovery 创建新的prometheus发现器
func NewPrometheusDiscovery(client kubernetes.Interface) *PrometheusDiscovery {
	return &PrometheusDiscovery{
		client: client,
	}
}

// 常见的prometheus部署命名空间，按优先级排序
var commonNamespaces = []string{
	"monitoring",
	"prometheus",
}

// 常见的prometheus服务名称模式
var commonServicePatterns = []string{
	"kube-prometheus-prometheus",
	"kube-prometheus-stack-prometheus",
	"prometheus-prometheus",
	"prometheus",
}

// DiscoverPrometheusEndpoints 发现集群中的prometheus端点
func (pd *PrometheusDiscovery) DiscoverPrometheusEndpoints(ctx context.Context) ([]PrometheusEndpoint, error) {
	var endpoints []PrometheusEndpoint

	// 1. 通过Service发现
	serviceEndpoints, err := pd.discoverFromServices(ctx)
	if err == nil {
		endpoints = append(endpoints, serviceEndpoints...)
	}

	// 2. 通过Ingress发现
	ingressEndpoints, err := pd.discoverFromIngresses(ctx)
	if err == nil {
		endpoints = append(endpoints, ingressEndpoints...)
	}

	// 计算优先级并排序
	pd.calculatePriorities(endpoints)
	sort.Slice(endpoints, func(i, j int) bool {
		return endpoints[i].Priority > endpoints[j].Priority
	})

	return endpoints, nil
}

// discoverFromServices 从kubernetes services中发现prometheus
func (pd *PrometheusDiscovery) discoverFromServices(ctx context.Context) ([]PrometheusEndpoint, error) {
	var endpoints []PrometheusEndpoint

	// 遍历常见命名空间
	for _, namespace := range commonNamespaces {
		services, err := pd.client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}

		for _, svc := range services.Items {
			if pd.isPrometheusService(&svc) {
				svcEndpoints := pd.createEndpointsFromService(&svc)
				endpoints = append(endpoints, svcEndpoints...)
			}
		}
	}

	// 如果在常见命名空间中没找到，搜索所有命名空间
	if len(endpoints) == 0 {
		allNamespaces, err := pd.client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
		if err != nil {
			return endpoints, err
		}

		for _, ns := range allNamespaces.Items {
			// 跳过已经搜索过的命名空间
			if pd.isCommonNamespace(ns.Name) {
				continue
			}

			services, err := pd.client.CoreV1().Services(ns.Name).List(ctx, metav1.ListOptions{})
			if err != nil {
				continue
			}

			for _, svc := range services.Items {
				if pd.isPrometheusService(&svc) {
					svcEndpoints := pd.createEndpointsFromService(&svc)
					endpoints = append(endpoints, svcEndpoints...)
				}
			}
		}
	}

	return endpoints, nil
}

// discoverFromIngresses 从kubernetes ingresses中发现prometheus
func (pd *PrometheusDiscovery) discoverFromIngresses(ctx context.Context) ([]PrometheusEndpoint, error) {
	var endpoints []PrometheusEndpoint

	// 搜索所有命名空间的ingress
	allNamespaces, err := pd.client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return endpoints, err
	}

	for _, ns := range allNamespaces.Items {
		ingresses, err := pd.client.NetworkingV1().Ingresses(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}

		for _, ingress := range ingresses.Items {
			if pd.isPrometheusIngress(&ingress) {
				ingressEndpoints := pd.createEndpointsFromIngress(&ingress)
				endpoints = append(endpoints, ingressEndpoints...)
			}
		}
	}

	return endpoints, nil
}

// isPrometheusService 判断service是否是prometheus服务
func (pd *PrometheusDiscovery) isPrometheusService(svc *corev1.Service) bool {
	// 检查服务名称
	for _, pattern := range commonServicePatterns {
		if strings.Contains(strings.ToLower(svc.Name), strings.ToLower(pattern)) {
			return true
		}
	}

	// 检查标签
	labels := svc.Labels
	if labels != nil {
		// 常见的prometheus标签
		prometheusLabels := []string{
			"app=prometheus",
			"app.kubernetes.io/name=prometheus",
			"app.kubernetes.io/component=prometheus",
			"component=prometheus",
			"k8s-app=prometheus",
		}

		for _, label := range prometheusLabels {
			parts := strings.Split(label, "=")
			if len(parts) == 2 && labels[parts[0]] == parts[1] {
				return true
			}
		}
	}

	// 检查端口
	for _, port := range svc.Spec.Ports {
		if port.Port == 9090 || port.TargetPort.IntVal == 9090 ||
			strings.ToLower(port.Name) == "prometheus" ||
			strings.ToLower(port.Name) == "web" ||
			strings.ToLower(port.Name) == "http" {
			return true
		}
	}

	return false
}

// isPrometheusIngress 判断ingress是否指向prometheus服务
func (pd *PrometheusDiscovery) isPrometheusIngress(ingress *networkingv1.Ingress) bool {
	// 检查ingress名称
	name := strings.ToLower(ingress.Name)
	if strings.Contains(name, "prometheus") {
		return true
	}

	// 检查标签
	labels := ingress.Labels
	if labels != nil {
		for key, value := range labels {
			if strings.Contains(strings.ToLower(key), "prometheus") ||
				strings.Contains(strings.ToLower(value), "prometheus") {
				return true
			}
		}
	}

	// 检查规则中的服务名
	for _, rule := range ingress.Spec.Rules {
		if rule.HTTP != nil {
			for _, path := range rule.HTTP.Paths {
				serviceName := strings.ToLower(path.Backend.Service.Name)
				for _, pattern := range commonServicePatterns {
					if strings.Contains(serviceName, strings.ToLower(pattern)) {
						return true
					}
				}
			}
		}
	}

	return false
}

// createEndpointsFromService 从service创建端点
func (pd *PrometheusDiscovery) createEndpointsFromService(svc *corev1.Service) []PrometheusEndpoint {
	var endpoints []PrometheusEndpoint

	// 找到prometheus端口
	prometheusPort := int32(0)
	for _, port := range svc.Spec.Ports {
		if port.Port == 9090 || port.TargetPort.IntVal == 9090 ||
			strings.ToLower(port.Name) == "prometheus" ||
			strings.ToLower(port.Name) == "web" {
			prometheusPort = port.Port
			break
		}
	}

	// 如果没找到特定端口，使用第一个端口
	if prometheusPort == 0 && len(svc.Spec.Ports) > 0 {
		prometheusPort = svc.Spec.Ports[0].Port
	}

	switch svc.Spec.Type {
	case corev1.ServiceTypeLoadBalancer:
		for _, ingress := range svc.Status.LoadBalancer.Ingress {
			url := ""
			if ingress.IP != "" {
				url = fmt.Sprintf("http://%s:%d", ingress.IP, prometheusPort)
			} else if ingress.Hostname != "" {
				url = fmt.Sprintf("http://%s:%d", ingress.Hostname, prometheusPort)
			}
			if url != "" {
				endpoints = append(endpoints, PrometheusEndpoint{
					URL:       url,
					Namespace: svc.Namespace,
					Service:   svc.Name,
					Type:      "service",
					Method:    "LoadBalancer",
					Labels:    svc.Labels,
				})
			}
		}
	case corev1.ServiceTypeNodePort:
		// 对于NodePort，我们需要获取节点信息
		nodes, err := pd.client.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
		if err == nil && len(nodes.Items) > 0 {
			// 使用第一个节点的IP
			node := nodes.Items[0]
			nodeIP := ""
			for _, addr := range node.Status.Addresses {
				if addr.Type == corev1.NodeExternalIP {
					nodeIP = addr.Address
					break
				}
			}
			if nodeIP == "" {
				for _, addr := range node.Status.Addresses {
					if addr.Type == corev1.NodeInternalIP {
						nodeIP = addr.Address
						break
					}
				}
			}

			if nodeIP != "" {
				for _, port := range svc.Spec.Ports {
					if port.Port == prometheusPort && port.NodePort != 0 {
						url := fmt.Sprintf("http://%s:%d", nodeIP, port.NodePort)
						endpoints = append(endpoints, PrometheusEndpoint{
							URL:       url,
							Namespace: svc.Namespace,
							Service:   svc.Name,
							Type:      "service",
							Method:    "NodePort",
							Labels:    svc.Labels,
						})
					}
				}
			}
		}
	case corev1.ServiceTypeClusterIP:
		// 对于ClusterIP，创建集群内访问的URL
		url := fmt.Sprintf("http://%s.%s.svc.cluster.local:%d", svc.Name, svc.Namespace, prometheusPort)
		endpoints = append(endpoints, PrometheusEndpoint{
			URL:       url,
			Namespace: svc.Namespace,
			Service:   svc.Name,
			Type:      "service",
			Method:    "ClusterIP",
			Labels:    svc.Labels,
		})
	}

	return endpoints
}

// createEndpointsFromIngress 从ingress创建端点
func (pd *PrometheusDiscovery) createEndpointsFromIngress(ingress *networkingv1.Ingress) []PrometheusEndpoint {
	var endpoints []PrometheusEndpoint

	for _, rule := range ingress.Spec.Rules {
		host := rule.Host
		if host == "" {
			continue
		}

		scheme := "http"
		// 检查TLS配置
		for _, tls := range ingress.Spec.TLS {
			for _, tlsHost := range tls.Hosts {
				if tlsHost == host {
					scheme = "https"
					break
				}
			}
		}

		if rule.HTTP != nil {
			for _, path := range rule.HTTP.Paths {
				pathStr := path.Path
				if pathStr == "" {
					pathStr = "/"
				}
				url := fmt.Sprintf("%s://%s%s", scheme, host, pathStr)
				endpoints = append(endpoints, PrometheusEndpoint{
					URL:       url,
					Namespace: ingress.Namespace,
					Service:   path.Backend.Service.Name,
					Type:      "ingress",
					Method:    "Ingress",
					Labels:    ingress.Labels,
				})
			}
		}
	}

	return endpoints
}

// calculatePriorities 计算端点优先级
func (pd *PrometheusDiscovery) calculatePriorities(endpoints []PrometheusEndpoint) {
	for i := range endpoints {
		priority := 0

		// 命名空间优先级
		switch endpoints[i].Namespace {
		case "monitoring":
			priority += 100
		case "prometheus":
			priority += 90
		case "kube-system":
			priority += 80
		case "observability":
			priority += 70
		case "metrics":
			priority += 60
		case "default":
			priority += 50
		}

		// 访问方式优先级
		switch endpoints[i].Method {
		case "LoadBalancer":
			priority += 50
		case "Ingress":
			priority += 40
		case "NodePort":
			priority += 30
		case "ClusterIP":
			priority += 20
		}

		// 服务名称优先级
		serviceName := strings.ToLower(endpoints[i].Service)
		if strings.Contains(serviceName, "prometheus-server") {
			priority += 30
		} else if strings.Contains(serviceName, "prometheus-operated") {
			priority += 25
		} else if serviceName == "prometheus" {
			priority += 20
		} else if strings.Contains(serviceName, "prometheus") {
			priority += 15
		}

		// URL包含标准端口优先级
		if strings.Contains(endpoints[i].URL, ":9090") {
			priority += 10
		}

		endpoints[i].Priority = priority
	}
}

// isCommonNamespace 检查是否是常见命名空间
func (pd *PrometheusDiscovery) isCommonNamespace(namespace string) bool {
	for _, ns := range commonNamespaces {
		if ns == namespace {
			return true
		}
	}
	return false
}

// GetBestPrometheusEndpoint 获取最佳的prometheus端点
func (pd *PrometheusDiscovery) GetBestPrometheusEndpoint(ctx context.Context) (*PrometheusEndpoint, error) {
	endpoints, err := pd.DiscoverPrometheusEndpoints(ctx)
	if err != nil {
		return nil, err
	}

	if len(endpoints) == 0 {
		return nil, fmt.Errorf("no prometheus endpoints found")
	}

	// 测试连通性
	for i := range endpoints {
		if pd.testEndpointReachability(ctx, &endpoints[i]) {
			endpoints[i].Reachable = true
			return &endpoints[i], nil
		}
	}

	// 如果都不可达，返回优先级最高的
	return &endpoints[0], nil
}

// testEndpointReachability 测试端点连通性
func (pd *PrometheusDiscovery) testEndpointReachability(ctx context.Context, endpoint *PrometheusEndpoint) bool {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	// 测试prometheus API健康检查端点
	healthURL := strings.TrimSuffix(endpoint.URL, "/") + "/-/healthy"
	req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
	if err != nil {
		return false
	}

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// AutoDiscoverPrometheusURL 自动发现并返回最佳的prometheus URL
func AutoDiscoverPrometheusURL(ctx context.Context, client kubernetes.Interface) (string, error) {
	discovery := NewPrometheusDiscovery(client)
	endpoint, err := discovery.GetBestPrometheusEndpoint(ctx)
	if err != nil {
		return "", err
	}

	klog.Infof("Auto-discovered Prometheus endpoint: %s (namespace: %s, service: %s, method: %s)",
		endpoint.URL, endpoint.Namespace, endpoint.Service, endpoint.Method)

	return endpoint.URL, nil
}

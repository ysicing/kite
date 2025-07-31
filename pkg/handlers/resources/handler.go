package resources

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/zxh326/kite/pkg/cluster"
	"github.com/zxh326/kite/pkg/common"

	kruiseappsv1alpha1 "github.com/openkruise/kruise-api/apps/v1alpha1"
	kruiseappsv1beta1 "github.com/openkruise/kruise-api/apps/v1beta1"
	kruisepolicyv1alpha1 "github.com/openkruise/kruise-api/policy/v1alpha1"
	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	metricsv1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
	gatewayapiv1 "sigs.k8s.io/gateway-api/apis/v1"
)

// OpenKruiseWorkload represents a supported OpenKruise workload
type OpenKruiseWorkload struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	APIVersion  string `json:"apiVersion"`
	Available   bool   `json:"available"`
	Count       int    `json:"count"`
	Description string `json:"description"`
}

// OpenKruiseStatus represents the status of OpenKruise installation
type OpenKruiseStatus struct {
	Installed bool                 `json:"installed"`
	Version   string               `json:"version,omitempty"`
	Workloads []OpenKruiseWorkload `json:"workloads"`
}

// TailscaleWorkload represents a supported Tailscale workload
type TailscaleWorkload struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	APIVersion  string `json:"apiVersion"`
	Available   bool   `json:"available"`
	Count       int    `json:"count"`
	Description string `json:"description"`
}

// TailscaleStatus represents the status of Tailscale Operator installation
type TailscaleStatus struct {
	Installed bool                `json:"installed"`
	Version   string              `json:"version,omitempty"`
	Workloads []TailscaleWorkload `json:"workloads"`
}

// TraefikWorkload represents a supported Traefik workload
type TraefikWorkload struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	APIVersion  string `json:"apiVersion"`
	Available   bool   `json:"available"`
	Count       int    `json:"count"`
	Description string `json:"description"`
}

// TraefikStatus represents the status of Traefik installation
type TraefikStatus struct {
	Installed bool              `json:"installed"`
	Version   string            `json:"version,omitempty"`
	Workloads []TraefikWorkload `json:"workloads"`
}

// SystemUpgradeWorkload represents a supported System Upgrade Controller workload
type SystemUpgradeWorkload struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	APIVersion  string `json:"apiVersion"`
	Available   bool   `json:"available"`
	Count       int    `json:"count"`
	Description string `json:"description"`
}

// SystemUpgradeStatus represents the status of System Upgrade Controller installation
type SystemUpgradeStatus struct {
	Installed bool                    `json:"installed"`
	Version   string                  `json:"version,omitempty"`
	Workloads []SystemUpgradeWorkload `json:"workloads"`
}

// GetOpenKruiseStatus checks if OpenKruise is installed in the cluster
func GetOpenKruiseStatus(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	status := &OpenKruiseStatus{
		Installed: false,
		Workloads: []OpenKruiseWorkload{},
	}

	// Check supported workloads
	workloads := []OpenKruiseWorkload{
		// Advanced Workloads
		{
			Name:        "clonesets",
			Kind:        "CloneSet",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "CloneSet provides enhanced deployment capabilities",
		},
		{
			Name:        "advanceddaemonsets",
			Kind:        "AdvancedDaemonSet",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "AdvancedDaemonSet provides enhanced DaemonSet capabilities",
		},
		{
			Name:        "advancedstatefulsets",
			Kind:        "AdvancedStatefulSet",
			APIVersion:  "apps.kruise.io/v1beta1",
			Description: "AdvancedStatefulSet provides enhanced StatefulSet capabilities",
		},
		{
			Name:        "broadcastjobs",
			Kind:        "BroadcastJob",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "BroadcastJob runs pods on all or selected nodes",
		},
		{
			Name:        "advancedcronjobs",
			Kind:        "AdvancedCronJob",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "AdvancedCronJob provides enhanced CronJob capabilities",
		},

		// Sidecar Container Management
		{
			Name:        "sidecarsets",
			Kind:        "SidecarSet",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "SidecarSet manages sidecar containers",
		},

		// Multi-domain Management
		{
			Name:        "uniteddeployments",
			Kind:        "UnitedDeployment",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "UnitedDeployment manages multi-domain deployments",
		},
		{
			Name:        "workloadspreads",
			Kind:        "WorkloadSpread",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "WorkloadSpread constrains workload spread across domains",
		},

		// Enhanced Operations
		{
			Name:        "imagepulljobs",
			Kind:        "ImagePullJob",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "ImagePullJob pre-pulls images on nodes",
		},
		{
			Name:        "containerrecreaterequests",
			Kind:        "ContainerRecreateRequest",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "ContainerRecreateRequest restarts containers in running pods",
		},
		{
			Name:        "resourcedistributions",
			Kind:        "ResourceDistribution",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "ResourceDistribution distributes resources across namespaces",
		},
		{
			Name:        "persistentpodstates",
			Kind:        "PersistentPodState",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "PersistentPodState maintains pod state across restarts",
		},
		{
			Name:        "podprobemarkers",
			Kind:        "PodProbeMarker",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "PodProbeMarker customizes pod readiness probes",
		},
		{
			Name:        "nodeimages",
			Kind:        "NodeImage",
			APIVersion:  "apps.kruise.io/v1alpha1",
			Description: "NodeImage manages image pre-downloading on nodes",
		},

		// Application Protection
		{
			Name:        "podunavailablebudgets",
			Kind:        "PodUnavailableBudget",
			APIVersion:  "policy.kruise.io/v1alpha1",
			Description: "PodUnavailableBudget protects application availability",
		},
	}

	// Use cached workload status check to reduce API calls
	workloads = globalWorkloadCache.GetCachedWorkloadStatus(ctx, cs, workloads)

	// Check if any workload is installed
	for _, workload := range workloads {
		if workload.Available {
			status.Installed = true
			break
		}
	}

	// Try to get version from kruise-manager deployment
	if status.Installed {
		var deployment appsv1.Deployment
		if err := cs.K8sClient.Get(ctx, types.NamespacedName{
			Name:      "kruise-controller-manager",
			Namespace: "kruise-system",
		}, &deployment); err == nil {
			// Extract version from image tag if possible
			for _, container := range deployment.Spec.Template.Spec.Containers {
				if container.Name == "manager" {
					status.Version = extractVersionFromImage(container.Image)
					break
				}
			}
		}
	}

	status.Workloads = workloads
	c.JSON(http.StatusOK, status)
}

// GetTailscaleStatus checks if Tailscale Operator is installed in the cluster
func GetTailscaleStatus(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	status := &TailscaleStatus{
		Installed: false,
		Workloads: []TailscaleWorkload{},
	}

	// Check supported workloads
	workloads := []TailscaleWorkload{
		// Core Resources
		{
			Name:        "connectors",
			Kind:        "Connector",
			APIVersion:  "tailscale.com/v1alpha1",
			Description: "Connector manages subnet routers, exit nodes, and app connectors",
		},
		{
			Name:        "proxyclasses",
			Kind:        "ProxyClass",
			APIVersion:  "tailscale.com/v1alpha1",
			Description: "ProxyClass customizes proxy configuration",
		},
		{
			Name:        "proxygroups",
			Kind:        "ProxyGroup",
			APIVersion:  "tailscale.com/v1alpha1",
			Description: "ProxyGroup manages high-availability proxy groups",
		},
	}

	// Use cached workload status check to reduce API calls
	workloads = globalWorkloadCache.GetCachedTailscaleWorkloadStatus(ctx, cs, workloads)

	// Check if any workload is installed
	for _, workload := range workloads {
		if workload.Available {
			status.Installed = true
			break
		}
	}

	// Try to get version from tailscale-operator deployment
	if status.Installed {
		// Try multiple common deployment names and namespaces
		deploymentConfigs := []struct {
			name       string
			namespace  string
			containers []string
		}{
			{"operator", "tailscale", []string{"operator", "tailscale-operator"}},
			{"tailscale-operator", "tailscale", []string{"operator", "tailscale-operator"}},
			{"tailscale-operator", "kube-system", []string{"operator", "tailscale-operator"}},
			{"tailscale-operator", "default", []string{"operator", "tailscale-operator"}},
			{"operator", "kube-system", []string{"operator", "tailscale-operator"}},
		}

		for _, config := range deploymentConfigs {
			var deployment appsv1.Deployment
			if err := cs.K8sClient.Get(ctx, types.NamespacedName{
				Name:      config.name,
				Namespace: config.namespace,
			}, &deployment); err == nil {
				// Extract version from image tag if possible
				for _, container := range deployment.Spec.Template.Spec.Containers {
					for _, containerName := range config.containers {
						if container.Name == containerName {
							version := extractVersionFromImage(container.Image)
							if version != "unknown" {
								status.Version = version
								goto versionFound
							}
						}
					}
				}
			}
		}
	versionFound:
	}

	status.Workloads = workloads
	c.JSON(http.StatusOK, status)
}

// GetTraefikStatus checks if Traefik is installed in the cluster
func GetTraefikStatus(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	status := &TraefikStatus{
		Installed: false,
		Workloads: []TraefikWorkload{},
	}

	// Check supported workloads
	workloads := []TraefikWorkload{
		// Core Resources
		{
			Name:        "ingressroutes",
			Kind:        "IngressRoute",
			APIVersion:  "traefik.io/v1alpha1",
			Description: "IngressRoute manages HTTP/HTTPS routing rules",
		},
		{
			Name:        "ingressroutetcps",
			Kind:        "IngressRouteTCP",
			APIVersion:  "traefik.io/v1alpha1",
			Description: "IngressRouteTCP manages TCP routing rules",
		},
		{
			Name:        "ingressrouteudps",
			Kind:        "IngressRouteUDP",
			APIVersion:  "traefik.io/v1alpha1",
			Description: "IngressRouteUDP manages UDP routing rules",
		},
		{
			Name:        "middlewares",
			Kind:        "Middleware",
			APIVersion:  "traefik.io/v1alpha1",
			Description: "Middleware defines request/response processing rules",
		},
		{
			Name:        "middlewaretcps",
			Kind:        "MiddlewareTCP",
			APIVersion:  "traefik.io/v1alpha1",
			Description: "MiddlewareTCP defines TCP processing rules",
		},
		{
			Name:        "tlsoptions",
			Kind:        "TLSOption",
			APIVersion:  "traefik.io/v1alpha1",
			Description: "TLSOption defines TLS configuration options",
		},
		{
			Name:        "tlsstores",
			Kind:        "TLSStore",
			APIVersion:  "traefik.io/v1alpha1",
			Description: "TLSStore defines TLS certificate stores",
		},
		{
			Name:        "traefikservices",
			Kind:        "TraefikService",
			APIVersion:  "traefik.io/v1alpha1",
			Description: "TraefikService defines load balancing and service discovery",
		},
		{
			Name:        "serverstransports",
			Kind:        "ServersTransport",
			APIVersion:  "traefik.io/v1alpha1",
			Description: "ServersTransport defines transport configuration for backend servers",
		},
	}

	// Use cached workload status check to reduce API calls
	workloads = globalWorkloadCache.GetCachedTraefikWorkloadStatus(ctx, cs, workloads)

	// Check if any workload is installed
	for _, workload := range workloads {
		if workload.Available {
			status.Installed = true
			break
		}
	}

	// Try to get version from traefik deployment
	if status.Installed {
		var deployment appsv1.Deployment
		if err := cs.K8sClient.Get(ctx, types.NamespacedName{
			Name:      "traefik",
			Namespace: "traefik-system",
		}, &deployment); err == nil {
			// Extract version from image tag if possible
			for _, container := range deployment.Spec.Template.Spec.Containers {
				if container.Name == "traefik" {
					status.Version = extractVersionFromImage(container.Image)
					break
				}
			}
		} else {
			// Try common namespace alternatives
			for _, ns := range []string{"traefik-v2", "traefik", "kube-system", "default"} {
				if err := cs.K8sClient.Get(ctx, types.NamespacedName{
					Name:      "traefik",
					Namespace: ns,
				}, &deployment); err == nil {
					for _, container := range deployment.Spec.Template.Spec.Containers {
						if container.Name == "traefik" {
							status.Version = extractVersionFromImage(container.Image)
							break
						}
					}
					break
				}
			}
		}
	}

	status.Workloads = workloads
	c.JSON(http.StatusOK, status)
}

// GetSystemUpgradeStatus checks if System Upgrade Controller is installed in the cluster
func GetSystemUpgradeStatus(c *gin.Context) {
	cs := c.MustGet("cluster").(*cluster.ClientSet)
	ctx := c.Request.Context()

	status := &SystemUpgradeStatus{
		Installed: false,
		Workloads: []SystemUpgradeWorkload{},
	}

	// Check supported workloads
	workloads := []SystemUpgradeWorkload{
		// Core Resources
		{
			Name:        "plans",
			Kind:        "Plan",
			APIVersion:  "upgrade.cattle.io/v1",
			Description: "Plan defines upgrade specifications for nodes",
		},
		{
			Name:        "jobs",
			Kind:        "Job",
			APIVersion:  "batch/v1",
			Description: "Job executes upgrade operations on target nodes",
		},
	}

	// Check each workload availability and count
	for i, workload := range workloads {
		available, count := checkSystemUpgradeWorkloadAvailability(ctx, cs, workload)
		workloads[i].Available = available
		workloads[i].Count = count

		if available {
			status.Installed = true
		}
	}

	// Try to get version from system-upgrade-controller deployment
	if status.Installed {
		var deployment appsv1.Deployment
		if err := cs.K8sClient.Get(ctx, types.NamespacedName{
			Name:      "system-upgrade-controller",
			Namespace: "system-upgrade",
		}, &deployment); err == nil {
			// Extract version from image tag if possible
			for _, container := range deployment.Spec.Template.Spec.Containers {
				if container.Name == "system-upgrade-controller" {
					status.Version = extractVersionFromImage(container.Image)
					break
				}
			}
		} else {
			// Try common namespace alternatives
			for _, ns := range []string{"cattle-system", "kube-system", "default"} {
				if err := cs.K8sClient.Get(ctx, types.NamespacedName{
					Name:      "system-upgrade-controller",
					Namespace: ns,
				}, &deployment); err == nil {
					for _, container := range deployment.Spec.Template.Spec.Containers {
						if container.Name == "system-upgrade-controller" {
							status.Version = extractVersionFromImage(container.Image)
							break
						}
					}
					break
				}
			}
		}
	}

	status.Workloads = workloads
	c.JSON(http.StatusOK, status)
}

// checkWorkloadAvailability checks if a specific workload type is available and returns count
func checkWorkloadAvailability(ctx context.Context, cs *cluster.ClientSet, workload OpenKruiseWorkload) (bool, int) {
	// First check if the CRD exists
	crdName := getCRDName(workload.Kind)
	if crdName == "" {
		return false, 0
	}

	var crd apiextensionsv1.CustomResourceDefinition
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Name: crdName}, &crd); err != nil {
		// CRD doesn't exist, workload not available
		return false, 0
	}

	// CRD exists, now try to list resources
	switch workload.Kind {
	case "CloneSet":
		var list kruiseappsv1alpha1.CloneSetList
		if err := cs.K8sClient.List(ctx, &list); err != nil {
			return true, 0 // CRD exists but listing failed, still consider available
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
		// For other resource types that we don't have specific types for,
		// we use unstructured list to check availability
		return checkUnstructuredWorkload(ctx, cs, workload)
	}
}

// checkTailscaleWorkloadAvailability checks if a specific Tailscale workload type is available and returns count
func checkTailscaleWorkloadAvailability(ctx context.Context, cs *cluster.ClientSet, workload TailscaleWorkload) (bool, int) {
	// First check if the CRD exists
	crdName := getTailscaleCRDName(workload.Kind)
	if crdName == "" {
		return false, 0
	}

	var crd apiextensionsv1.CustomResourceDefinition
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Name: crdName}, &crd); err != nil {
		// CRD doesn't exist, workload not available
		return false, 0
	}

	// CRD exists, now try to list resources using unstructured list
	return checkTailscaleUnstructuredWorkload(ctx, cs, workload)
}

// checkUnstructuredWorkload checks workload availability using unstructured list
func checkUnstructuredWorkload(ctx context.Context, cs *cluster.ClientSet, workload OpenKruiseWorkload) (bool, int) {
	// Parse the API version
	parts := strings.Split(workload.APIVersion, "/")
	if len(parts) != 2 {
		return false, 0
	}

	group := parts[0]
	version := parts[1]

	// Try to list resources using dynamic client
	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    workload.Kind + "List",
	})

	if err := cs.K8sClient.List(ctx, list); err != nil {
		return true, 0 // CRD exists but listing failed, still consider available
	}

	return true, len(list.Items)
}

// checkTailscaleUnstructuredWorkload checks workload availability using unstructured list
func checkTailscaleUnstructuredWorkload(ctx context.Context, cs *cluster.ClientSet, workload TailscaleWorkload) (bool, int) {
	// Parse the API version
	parts := strings.Split(workload.APIVersion, "/")
	if len(parts) != 2 {
		return false, 0
	}

	group := parts[0]
	version := parts[1]

	// Try to list resources using dynamic client
	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    workload.Kind + "List",
	})

	if err := cs.K8sClient.List(ctx, list); err != nil {
		return true, 0 // CRD exists but listing failed, still consider available
	}

	return true, len(list.Items)
}

// checkTraefikWorkloadAvailability checks if a specific Traefik workload type is available and returns count
func checkTraefikWorkloadAvailability(ctx context.Context, cs *cluster.ClientSet, workload TraefikWorkload) (bool, int) {
	// First check if the CRD exists
	crdName := getTraefikCRDName(workload.Kind)
	if crdName == "" {
		return false, 0
	}

	var crd apiextensionsv1.CustomResourceDefinition
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Name: crdName}, &crd); err != nil {
		// CRD doesn't exist, workload not available
		return false, 0
	}

	// CRD exists, now try to list resources using unstructured list
	return checkTraefikUnstructuredWorkload(ctx, cs, workload)
}

// checkSystemUpgradeWorkloadAvailability checks if a specific System Upgrade Controller workload type is available and returns count
func checkSystemUpgradeWorkloadAvailability(ctx context.Context, cs *cluster.ClientSet, workload SystemUpgradeWorkload) (bool, int) {
	// For Plan resources, first check if the CRD exists
	crdName := getSystemUpgradeCRDName(workload.Kind)
	if crdName == "" {
		return false, 0
	}

	var crd apiextensionsv1.CustomResourceDefinition
	if err := cs.K8sClient.Get(ctx, types.NamespacedName{Name: crdName}, &crd); err != nil {
		// CRD doesn't exist, workload not available
		return false, 0
	}

	// CRD exists, now try to list resources using unstructured list
	return checkSystemUpgradeUnstructuredWorkload(ctx, cs, workload)
}

// checkSystemUpgradeUnstructuredWorkload checks workload availability using unstructured list
func checkSystemUpgradeUnstructuredWorkload(ctx context.Context, cs *cluster.ClientSet, workload SystemUpgradeWorkload) (bool, int) {
	// Parse the API version
	parts := strings.Split(workload.APIVersion, "/")
	if len(parts) != 2 {
		return false, 0
	}

	group := parts[0]
	version := parts[1]

	// Try to list resources using dynamic client
	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    workload.Kind + "List",
	})

	if err := cs.K8sClient.List(ctx, list); err != nil {
		return false, 0 // CRD exists but listing failed, workload not available
	}

	return true, len(list.Items)
}

// checkTraefikUnstructuredWorkload checks workload availability using unstructured list
func checkTraefikUnstructuredWorkload(ctx context.Context, cs *cluster.ClientSet, workload TraefikWorkload) (bool, int) {
	// Parse the API version
	parts := strings.Split(workload.APIVersion, "/")
	if len(parts) != 2 {
		return false, 0
	}

	group := parts[0]
	version := parts[1]

	// Try to list resources using dynamic client
	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    workload.Kind + "List",
	})

	if err := cs.K8sClient.List(ctx, list); err != nil {
		return true, 0 // CRD exists but listing failed, still consider available
	}

	return true, len(list.Items)
}

// getCRDName returns the CRD name for a given workload kind
func getCRDName(kind string) string {
	switch kind {
	// Advanced Workloads
	case "CloneSet":
		return "clonesets.apps.kruise.io"
	case "AdvancedDaemonSet":
		return "daemonsets.apps.kruise.io"
	case "AdvancedStatefulSet":
		return "statefulsets.apps.kruise.io"
	case "BroadcastJob":
		return "broadcastjobs.apps.kruise.io"
	case "AdvancedCronJob":
		return "advancedcronjobs.apps.kruise.io"

	// Sidecar Container Management
	case "SidecarSet":
		return "sidecarsets.apps.kruise.io"

	// Multi-domain Management
	case "UnitedDeployment":
		return "uniteddeployments.apps.kruise.io"
	case "WorkloadSpread":
		return "workloadspreads.apps.kruise.io"

	// Enhanced Operations
	case "ImagePullJob":
		return "imagepulljobs.apps.kruise.io"
	case "ContainerRecreateRequest":
		return "containerrecreaterequests.apps.kruise.io"
	case "ResourceDistribution":
		return "resourcedistributions.apps.kruise.io"
	case "PersistentPodState":
		return "persistentpodstates.apps.kruise.io"
	case "PodProbeMarker":
		return "podprobemarkers.apps.kruise.io"
	case "NodeImage":
		return "nodeimages.apps.kruise.io"

	// Application Protection
	case "PodUnavailableBudget":
		return "podunavailablebudgets.policy.kruise.io"

	default:
		return ""
	}
}

// getTailscaleCRDName returns the CRD name for a given Tailscale workload kind
func getTailscaleCRDName(kind string) string {
	switch kind {
	case "Connector":
		return "connectors.tailscale.com"
	case "ProxyClass":
		return "proxyclasses.tailscale.com"
	case "ProxyGroup":
		return "proxygroups.tailscale.com"
	default:
		return ""
	}
}

// getSystemUpgradeCRDName returns the CRD name for a given System Upgrade Controller workload kind
func getSystemUpgradeCRDName(kind string) string {
	switch kind {
	case "Plan":
		return "plans.upgrade.cattle.io"
	default:
		return ""
	}
}

// getTraefikCRDName returns the CRD name for a given Traefik workload kind
func getTraefikCRDName(kind string) string {
	switch kind {
	case "IngressRoute":
		return "ingressroutes.traefik.io"
	case "IngressRouteTCP":
		return "ingressroutetcps.traefik.io"
	case "IngressRouteUDP":
		return "ingressrouteudps.traefik.io"
	case "Middleware":
		return "middlewares.traefik.io"
	case "MiddlewareTCP":
		return "middlewaretcps.traefik.io"
	case "TLSOption":
		return "tlsoptions.traefik.io"
	case "TLSStore":
		return "tlsstores.traefik.io"
	case "TraefikService":
		return "traefikservices.traefik.io"
	case "ServersTransport":
		return "serverstransports.traefik.io"
	default:
		return ""
	}
}

// extractVersionFromImage extracts version from container image
func extractVersionFromImage(image string) string {
	// Remove any registry prefix and get just the image:tag part
	parts := strings.Split(image, "/")
	imageWithTag := parts[len(parts)-1]

	// Split by colon to get tag
	tagParts := strings.Split(imageWithTag, ":")
	if len(tagParts) > 1 {
		tag := tagParts[len(tagParts)-1]

		// Skip common non-version tags
		if tag == "latest" || tag == "stable" || tag == "main" || tag == "master" {
			return "unknown"
		}

		// Return the tag (which should be the version)
		return tag
	}
	return "unknown"
}

type resourceHandler interface {
	List(c *gin.Context)
	Get(c *gin.Context)
	Create(c *gin.Context)
	Update(c *gin.Context)
	Delete(c *gin.Context)

	IsClusterScoped() bool
	Searchable() bool
	Search(c *gin.Context, query string, limit int64) ([]common.SearchResult, error)

	GetResource(c *gin.Context, namespace, name string) (interface{}, error)

	registerCustomRoutes(group *gin.RouterGroup)
}

type Restartable interface {
	Restart(c *gin.Context, namespace, name string) error
}

var handlers = map[string]resourceHandler{}

func RegisterRoutes(group *gin.RouterGroup) {
	// Note: All handlers now get the k8s client from gin context instead of being passed it during initialization
	// We pass nil as the k8sClient parameter since handlers will get it from context
	handlers = map[string]resourceHandler{
		"namespaces":                      NewGenericResourceHandler[*corev1.Namespace, *corev1.NamespaceList]("namespaces", true, false),
		"persistentvolumes":               NewGenericResourceHandler[*corev1.PersistentVolume, *corev1.PersistentVolumeList]("persistentvolumes", true, false),
		"persistentvolumeclaims":          NewGenericResourceHandler[*corev1.PersistentVolumeClaim, *corev1.PersistentVolumeClaimList]("persistentvolumeclaims", false, false),
		"configmaps":                      NewGenericResourceHandler[*corev1.ConfigMap, *corev1.ConfigMapList]("configmaps", false, true),
		"secrets":                         NewGenericResourceHandler[*corev1.Secret, *corev1.SecretList]("secrets", false, true),
		"serviceaccounts":                 NewGenericResourceHandler[*corev1.ServiceAccount, *corev1.ServiceAccountList]("serviceaccounts", false, true),
		"services":                        NewGenericResourceHandler[*corev1.Service, *corev1.ServiceList]("services", false, true),
		"endpoints":                       NewGenericResourceHandler[*corev1.Endpoints, *corev1.EndpointsList]("endpoints", false, false),
		"endpointslices":                  NewGenericResourceHandler[*discoveryv1.EndpointSlice, *discoveryv1.EndpointSliceList]("endpointslices", false, false),
		"pods":                            NewGenericResourceHandler[*corev1.Pod, *corev1.PodList]("pods", false, true),
		"replicasets":                     NewGenericResourceHandler[*appsv1.ReplicaSet, *appsv1.ReplicaSetList]("replicasets", false, false),
		"statefulsets":                    NewGenericResourceHandler[*appsv1.StatefulSet, *appsv1.StatefulSetList]("statefulsets", false, false),
		"daemonsets":                      NewGenericResourceHandler[*appsv1.DaemonSet, *appsv1.DaemonSetList]("daemonsets", false, true),
		"jobs":                            NewGenericResourceHandler[*batchv1.Job, *batchv1.JobList]("jobs", false, false),
		"cronjobs":                        NewGenericResourceHandler[*batchv1.CronJob, *batchv1.CronJobList]("cronjobs", false, false),
		"ingresses":                       NewGenericResourceHandler[*networkingv1.Ingress, *networkingv1.IngressList]("ingresses", false, false),
		"storageclasses":                  NewStorageClassHandler(),
		"roles":                           NewGenericResourceHandler[*rbacv1.Role, *rbacv1.RoleList]("roles", false, false),
		"rolebindings":                    NewGenericResourceHandler[*rbacv1.RoleBinding, *rbacv1.RoleBindingList]("rolebindings", false, false),
		"clusterroles":                    NewGenericResourceHandler[*rbacv1.ClusterRole, *rbacv1.ClusterRoleList]("clusterroles", true, false),
		"clusterrolebindings":             NewGenericResourceHandler[*rbacv1.ClusterRoleBinding, *rbacv1.ClusterRoleBindingList]("clusterrolebindings", true, false),
		"crds":                            NewGenericResourceHandler[*apiextensionsv1.CustomResourceDefinition, *apiextensionsv1.CustomResourceDefinitionList]("crds", true, false),
		"validatingwebhookconfigurations": NewGenericResourceHandler[*admissionregistrationv1.ValidatingWebhookConfiguration, *admissionregistrationv1.ValidatingWebhookConfigurationList]("validatingwebhookconfigurations", true, false),
		"mutatingwebhookconfigurations":   NewGenericResourceHandler[*admissionregistrationv1.MutatingWebhookConfiguration, *admissionregistrationv1.MutatingWebhookConfigurationList]("mutatingwebhookconfigurations", true, false),
		"admission-controllers":           NewAdmissionControllerHandler(),

		"events":      NewEventHandler(),
		"deployments": NewDeploymentHandler(),
		"nodes":       NewNodeHandler(),

		// OpenKruise resources
		"clonesets":                 NewCloneSetHandler(),
		"advancedstatefulsets":      NewAdvancedStatefulSetHandler(),
		"advanceddaemonsets":        NewAdvancedDaemonSetHandler(),
		"broadcastjobs":             NewGenericResourceHandler[*kruiseappsv1alpha1.BroadcastJob, *kruiseappsv1alpha1.BroadcastJobList]("broadcastjobs", false, false),
		"advancedcronjobs":          NewGenericResourceHandler[*kruiseappsv1alpha1.AdvancedCronJob, *kruiseappsv1alpha1.AdvancedCronJobList]("advancedcronjobs", false, false),
		"sidecarsets":               NewGenericResourceHandler[*kruiseappsv1alpha1.SidecarSet, *kruiseappsv1alpha1.SidecarSetList]("sidecarsets", true, false),
		"imagepulljobs":             NewGenericResourceHandler[*kruiseappsv1alpha1.ImagePullJob, *kruiseappsv1alpha1.ImagePullJobList]("imagepulljobs", false, false),
		"nodeimages":                NewGenericResourceHandler[*kruiseappsv1alpha1.NodeImage, *kruiseappsv1alpha1.NodeImageList]("nodeimages", true, false),
		"uniteddeployments":         NewGenericResourceHandler[*kruiseappsv1alpha1.UnitedDeployment, *kruiseappsv1alpha1.UnitedDeploymentList]("uniteddeployments", false, false),
		"workloadspreads":           NewGenericResourceHandler[*kruiseappsv1alpha1.WorkloadSpread, *kruiseappsv1alpha1.WorkloadSpreadList]("workloadspreads", false, false),
		"containerrecreaterequests": NewGenericResourceHandler[*kruiseappsv1alpha1.ContainerRecreateRequest, *kruiseappsv1alpha1.ContainerRecreateRequestList]("containerrecreaterequests", false, false),
		"resourcedistributions":     NewGenericResourceHandler[*kruiseappsv1alpha1.ResourceDistribution, *kruiseappsv1alpha1.ResourceDistributionList]("resourcedistributions", false, false),
		"persistentpodstates":       NewGenericResourceHandler[*kruiseappsv1alpha1.PersistentPodState, *kruiseappsv1alpha1.PersistentPodStateList]("persistentpodstates", false, false),
		"podprobemarkers":           NewGenericResourceHandler[*kruiseappsv1alpha1.PodProbeMarker, *kruiseappsv1alpha1.PodProbeMarkerList]("podprobemarkers", false, false),
		"podunavailablebudgets":     NewGenericResourceHandler[*kruisepolicyv1alpha1.PodUnavailableBudget, *kruisepolicyv1alpha1.PodUnavailableBudgetList]("podunavailablebudgets", false, false),

		// Tailscale resources (cluster-scoped)
		"connectors":   NewTailscaleResourceHandler("connectors", "connectors.tailscale.com", "Connector", "tailscale.com", "v1alpha1"),
		"proxyclasses": NewTailscaleResourceHandler("proxyclasses", "proxyclasses.tailscale.com", "ProxyClass", "tailscale.com", "v1alpha1"),
		"proxygroups":  NewTailscaleResourceHandler("proxygroups", "proxygroups.tailscale.com", "ProxyGroup", "tailscale.com", "v1alpha1"),

		// System Upgrade Controller resources (cluster-scoped)
		"plans": NewSystemUpgradeResourceHandler("plans", "plans.upgrade.cattle.io", "Plan", "upgrade.cattle.io", "v1"),

		// Traefik resources (namespace-scoped)
		"ingressroutes":     NewTraefikResourceHandler("ingressroutes", "ingressroutes.traefik.io", "IngressRoute", "traefik.io", "v1alpha1"),
		"ingressroutetcps":  NewTraefikResourceHandler("ingressroutetcps", "ingressroutetcps.traefik.io", "IngressRouteTCP", "traefik.io", "v1alpha1"),
		"ingressrouteudps":  NewTraefikResourceHandler("ingressrouteudps", "ingressrouteudps.traefik.io", "IngressRouteUDP", "traefik.io", "v1alpha1"),
		"middlewares":       NewTraefikResourceHandler("middlewares", "middlewares.traefik.io", "Middleware", "traefik.io", "v1alpha1"),
		"middlewaretcps":    NewTraefikResourceHandler("middlewaretcps", "middlewaretcps.traefik.io", "MiddlewareTCP", "traefik.io", "v1alpha1"),
		"tlsoptions":        NewTraefikResourceHandler("tlsoptions", "tlsoptions.traefik.io", "TLSOption", "traefik.io", "v1alpha1"),
		"tlsstores":         NewTraefikResourceHandler("tlsstores", "tlsstores.traefik.io", "TLSStore", "traefik.io", "v1alpha1"),
		"traefikservices":   NewTraefikResourceHandler("traefikservices", "traefikservices.traefik.io", "TraefikService", "traefik.io", "v1alpha1"),
		"serverstransports": NewTraefikResourceHandler("serverstransports", "serverstransports.traefik.io", "ServersTransport", "traefik.io", "v1alpha1"),

		"podmetrics":  NewGenericResourceHandler[*metricsv1.PodMetrics, *metricsv1.PodMetricsList]("metrics.k8s.io", false, false),
		"nodemetrics": NewGenericResourceHandler[*metricsv1.NodeMetrics, *metricsv1.NodeMetricsList]("metrics.k8s.io", false, false),
		"gateways":    NewGenericResourceHandler[*gatewayapiv1.Gateway, *gatewayapiv1.GatewayList]("gateways", false, true),
		"httproutes":  NewGenericResourceHandler[*gatewayapiv1.HTTPRoute, *gatewayapiv1.HTTPRouteList]("httproutes", false, true),
	}

	for name, handler := range handlers {
		g := group.Group("/" + name)
		handler.registerCustomRoutes(g)
		if handler.IsClusterScoped() {
			registerClusterScopeRoutes(g, handler)
		} else {
			registerNamespaceScopeRoutes(g, handler)
		}

		if handler.Searchable() {
			RegisterSearchFunc(name, handler.Search)
		}
	}

	// OpenKruise detection endpoint
	group.GET("/openkruise/status", GetOpenKruiseStatus)

	// Tailscale detection endpoint
	group.GET("/tailscale/status", GetTailscaleStatus)

	// System Upgrade Controller detection endpoint
	group.GET("/system-upgrade/status", GetSystemUpgradeStatus)

	// Traefik detection endpoint
	group.GET("/traefik/status", GetTraefikStatus)

	// Add unified Kruise operations routes for remaining workload types that support scaling
	kruiseOpsHandler := &KruiseOperationHandler{}
	kruiseScalableResources := []string{"uniteddeployments"}
	for _, resourceType := range kruiseScalableResources {
		if handler, exists := handlers[resourceType]; exists && !handler.IsClusterScoped() {
			g := group.Group("/" + resourceType)
			g.POST("/:namespace/:name/scale", func(c *gin.Context) {
				c.Set("resource", resourceType)
				kruiseOpsHandler.ScaleKruiseWorkload(c)
			})
			g.POST("/:namespace/:name/restart", func(c *gin.Context) {
				c.Set("resource", resourceType)
				kruiseOpsHandler.RestartKruiseWorkload(c)
			})
		}
	}

	// Register related resources route for supported resource types
	supportedRelatedResourceTypes := []string{"pods", "deployments", "statefulsets", "daemonsets", "configmaps", "secrets", "persistentvolumeclaims", "httproutes"}
	for _, resourceType := range supportedRelatedResourceTypes {
		if handler, exists := handlers[resourceType]; exists && !handler.IsClusterScoped() {
			g := group.Group("/" + resourceType)
			g.GET("/:namespace/:name/related", func(c *gin.Context) {
				// Set the resource type in the context for GetRelatedResources
				c.Set("resource", resourceType)
				GetRelatedResources(c)
			})
		}
	}

	crHandler := NewCRHandler()
	otherGroup := group.Group("/:crd")
	{
		otherGroup.GET("", crHandler.List)
		otherGroup.GET("/_all", crHandler.List)
		otherGroup.GET("/_all/:name", crHandler.Get)
		otherGroup.PUT("/_all/:name", crHandler.Update)
		otherGroup.DELETE("/_all/:name", crHandler.Delete)

		otherGroup.GET("/:namespace", crHandler.List)
		otherGroup.GET("/:namespace/:name", crHandler.Get)
		otherGroup.PUT("/:namespace/:name", crHandler.Update)
		otherGroup.DELETE("/:namespace/:name", crHandler.Delete)
	}
}

func registerClusterScopeRoutes(group *gin.RouterGroup, handler resourceHandler) {
	group.GET("", handler.List)
	group.GET("/_all", handler.List)
	group.GET("/_all/:name", handler.Get)
	group.POST("/_all", handler.Create)
	group.PUT("/_all/:name", handler.Update)
	group.DELETE("/_all/:name", handler.Delete)
}

func registerNamespaceScopeRoutes(group *gin.RouterGroup, handler resourceHandler) {
	group.GET("", handler.List)
	group.GET("/:namespace", handler.List)
	group.GET("/:namespace/:name", handler.Get)
	group.POST("/:namespace", handler.Create)
	group.PUT("/:namespace/:name", handler.Update)
	group.DELETE("/:namespace/:name", handler.Delete)
}

var SearchFuncs = map[string]func(c *gin.Context, query string, limit int64) ([]common.SearchResult, error){}

func RegisterSearchFunc(resourceType string, searchFunc func(c *gin.Context, query string, limit int64) ([]common.SearchResult, error)) {
	SearchFuncs[resourceType] = searchFunc
}

func GetResource(c *gin.Context, resource, namespace, name string) (interface{}, error) {
	handler, exists := handlers[resource]
	if !exists {
		return nil, fmt.Errorf("resource handler for %s not found", resource)
	}
	return handler.GetResource(c, namespace, name)
}

func GetHandler(resource string) (resourceHandler, error) {
	handler, exists := handlers[resource]
	if !exists {
		return nil, fmt.Errorf("handler for resource %s not found", resource)
	}
	return handler, nil
}

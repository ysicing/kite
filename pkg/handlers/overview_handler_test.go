package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	"github.com/zxh326/kite/pkg/cluster"
	"github.com/zxh326/kite/pkg/kube"
)

func TestGetOverviewCountsReadyAndCompletedPods(t *testing.T) {
	t.Helper()

	scheme := runtime.NewScheme()
	if err := corev1.AddToScheme(scheme); err != nil {
		t.Fatalf("AddToScheme() error = %v", err)
	}

	node := &corev1.Node{
		ObjectMeta: metav1.ObjectMeta{Name: "node-1"},
		Status: corev1.NodeStatus{
			Allocatable: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("4"),
				corev1.ResourceMemory: resource.MustParse("8Gi"),
			},
			Conditions: []corev1.NodeCondition{
				{Type: corev1.NodeReady, Status: corev1.ConditionTrue},
			},
		},
	}

	readyPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "ready-pod", Namespace: "default"},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{Name: "app"},
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			Conditions: []corev1.PodCondition{
				{Type: corev1.PodReady, Status: corev1.ConditionTrue},
			},
		},
	}

	unreadyRunningPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "unready-pod", Namespace: "default"},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{Name: "app"},
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			Conditions: []corev1.PodCondition{
				{Type: corev1.PodReady, Status: corev1.ConditionFalse},
			},
		},
	}

	completedPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "completed-pod", Namespace: "default"},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{Name: "job"},
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodSucceeded,
		},
	}

	namespace := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "default"}}
	service := &corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "svc", Namespace: "default"}}

	k8sClient := &kube.K8sClient{
		Client: fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(node, readyPod, unreadyRunningPod, completedPod, namespace, service).
			Build(),
	}

	clusterSet := &cluster.ClientSet{K8sClient: k8sClient}

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/overview", nil)
	ctx.Set("cluster", clusterSet)

	GetOverview(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}

	var overview OverviewData
	if err := json.Unmarshal(recorder.Body.Bytes(), &overview); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if overview.TotalPods != 3 {
		t.Fatalf("TotalPods = %d, want %d", overview.TotalPods, 3)
	}
	if overview.RunningPods != 2 {
		t.Fatalf("RunningPods = %d, want %d", overview.RunningPods, 2)
	}
}

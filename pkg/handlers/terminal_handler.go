package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/net/websocket"
	"k8s.io/klog/v2"

	"github.com/zxh326/kite/pkg/cluster"
	"github.com/zxh326/kite/pkg/kube"
)

type TerminalHandler struct {
}

func NewTerminalHandler() *TerminalHandler {
	return &TerminalHandler{}
}

// HandleTerminalWebSocket handles WebSocket connections for terminal sessions
func (h *TerminalHandler) HandleTerminalWebSocket(c *gin.Context) {
	// Get cluster info from context
	cs := c.MustGet("cluster").(*cluster.ClientSet)

	// Get path parameters
	namespace := c.Param("namespace")
	podName := c.Param("podName")
	container := c.Query("container")

	klog.Infof("Terminal WebSocket request: namespace=%s, pod=%s, container=%s", namespace, podName, container)

	if namespace == "" || podName == "" {
		klog.Errorf("Missing required parameters: namespace=%s, podName=%s", namespace, podName)
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace and podName are required"})
		return
	}

	websocket.Handler(func(ws *websocket.Conn) {
		klog.Infof("WebSocket connection established for pod %s/%s", namespace, podName)
		ctx, cancel := context.WithCancel(c.Request.Context())
		defer cancel()
		session := kube.NewTerminalSession(cs.K8sClient, ws, namespace, podName, container)
		defer session.Close()

		if err := session.Start(ctx, "exec"); err != nil {
			klog.Errorf("Terminal session error for pod %s/%s: %v", namespace, podName, err)
		} else {
			klog.Infof("Terminal session ended normally for pod %s/%s", namespace, podName)
		}
	}).ServeHTTP(c.Writer, c.Request)
}

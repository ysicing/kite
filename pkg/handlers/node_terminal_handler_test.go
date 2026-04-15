package handlers

import (
	"strings"
	"testing"

	"github.com/zxh326/kite/pkg/common"
)

func TestBuildNodeTerminalPodName(t *testing.T) {
	tests := []struct {
		name     string
		nodeName string
	}{
		{name: "short node name", nodeName: "worker-1"},
		{name: "long node name", nodeName: strings.Repeat("a", 80)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			podName := buildNodeTerminalPodName(test.nodeName)
			if len(podName) > 63 {
				t.Fatalf("len(%q) = %d, want <= 63", podName, len(podName))
			}
			if !strings.HasPrefix(podName, common.NodeTerminalPodName+"-") {
				t.Fatalf("podName = %q, want prefix %q", podName, common.NodeTerminalPodName+"-")
			}
		})
	}
}

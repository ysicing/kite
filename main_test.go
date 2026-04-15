package main

import (
	"net/http"
	"testing"
	"time"

	"github.com/zxh326/kite/pkg/common"
)

func TestNewHTTPServerAppliesSecurityTimeouts(t *testing.T) {
	oldPort := common.Port
	defer func() {
		common.Port = oldPort
	}()

	common.Port = "18080"
	server := newHTTPServer(http.NewServeMux())

	if server.Addr != ":18080" {
		t.Fatalf("Addr = %q, want %q", server.Addr, ":18080")
	}
	if server.ReadHeaderTimeout != 10*time.Second {
		t.Fatalf("ReadHeaderTimeout = %v, want %v", server.ReadHeaderTimeout, 10*time.Second)
	}
	if server.IdleTimeout != 120*time.Second {
		t.Fatalf("IdleTimeout = %v, want %v", server.IdleTimeout, 120*time.Second)
	}
}

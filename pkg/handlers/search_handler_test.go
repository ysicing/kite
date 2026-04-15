package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/zxh326/kite/pkg/common"
	"github.com/zxh326/kite/pkg/handlers/resources"
	"github.com/zxh326/kite/pkg/middleware"
)

func TestNormalizeSearchQuery(t *testing.T) {
	got := normalizeSearchQuery("  pod   target\t\n")
	if got != "pod target" {
		t.Fatalf("normalizeSearchQuery() = %q, want %q", got, "pod target")
	}
}

func TestNormalizeSearchLimit(t *testing.T) {
	tests := []struct {
		name  string
		input int
		want  int
	}{
		{name: "lower bound", input: 1, want: 1},
		{name: "upper bound", input: 100, want: 100},
		{name: "zero defaults", input: 0, want: defaultSearchLimit},
		{name: "negative defaults", input: -1, want: defaultSearchLimit},
		{name: "too large defaults", input: 101, want: defaultSearchLimit},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := normalizeSearchLimit(test.input)
			if got != test.want {
				t.Fatalf("normalizeSearchLimit(%d) = %d, want %d", test.input, got, test.want)
			}
		})
	}
}

func TestSortResults(t *testing.T) {
	results := []common.SearchResult{
		{Name: "pod-1", ResourceType: "pods"},
		{Name: "target", ResourceType: "namespaces"},
		{Name: "target", ResourceType: "deployments"},
		{Name: "target-x", ResourceType: "services"},
	}

	sortResults(results, "target")

	if results[0].Name != "target" || results[0].ResourceType != "deployments" {
		t.Fatalf("first result = %s/%s, want deployments exact match", results[0].Name, results[0].ResourceType)
	}
	if results[1].Name != "target" || results[1].ResourceType != "namespaces" {
		t.Fatalf("second result = %s/%s, want namespaces exact match", results[1].Name, results[1].ResourceType)
	}
}

func TestGetSearchClusterNamePrecedence(t *testing.T) {
	t.Run("context first", func(t *testing.T) {
		ctx := newSearchContextWithCookie()
		ctx.Set(middleware.ClusterNameKey, "context-cluster")
		ctx.Request.Header.Set(middleware.ClusterNameHeader, "header-cluster")
		ctx.Request.URL.RawQuery = middleware.ClusterNameHeader + "=query-cluster"

		if got := getSearchClusterName(ctx); got != "context-cluster" {
			t.Fatalf("getSearchClusterName() = %q, want %q", got, "context-cluster")
		}
	})

	t.Run("header next", func(t *testing.T) {
		ctx := newSearchContextWithCookie()
		ctx.Request.Header.Set(middleware.ClusterNameHeader, "header-cluster")
		ctx.Request.URL.RawQuery = middleware.ClusterNameHeader + "=query-cluster"

		if got := getSearchClusterName(ctx); got != "header-cluster" {
			t.Fatalf("getSearchClusterName() = %q, want %q", got, "header-cluster")
		}
	})

	t.Run("query next", func(t *testing.T) {
		ctx := newSearchContextWithCookie()
		ctx.Request.URL.RawQuery = middleware.ClusterNameHeader + "=query-cluster"

		if got := getSearchClusterName(ctx); got != "query-cluster" {
			t.Fatalf("getSearchClusterName() = %q, want %q", got, "query-cluster")
		}
	})

	t.Run("cookie fallback", func(t *testing.T) {
		ctx := newSearchContextWithCookie()
		if got := getSearchClusterName(ctx); got != "cookie-cluster" {
			t.Fatalf("getSearchClusterName() = %q, want %q", got, "cookie-cluster")
		}
	})
}

func TestGlobalSearchNegativeLimitDoesNotPanic(t *testing.T) {
	oldSearchFuncs := resources.SearchFuncs
	resources.SearchFuncs = map[string]func(*gin.Context, string, int64) ([]common.SearchResult, error){}
	t.Cleanup(func() {
		resources.SearchFuncs = oldSearchFuncs
	})

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/search?q=po&limit=-1", nil)

	handler := NewSearchHandler()

	defer func() {
		if recovered := recover(); recovered != nil {
			t.Fatalf("GlobalSearch panicked with negative limit: %v", recovered)
		}
	}()

	handler.GlobalSearch(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestGlobalSearchCacheKeyIncludesClusterAndLimit(t *testing.T) {
	oldSearchFuncs := resources.SearchFuncs
	resources.SearchFuncs = map[string]func(*gin.Context, string, int64) ([]common.SearchResult, error){
		"pods": func(c *gin.Context, _ string, _ int64) ([]common.SearchResult, error) {
			switch c.GetString(middleware.ClusterNameKey) {
			case "cluster-a":
				return []common.SearchResult{
					{Name: "target-a-1", ResourceType: "pods"},
					{Name: "target-a-2", ResourceType: "pods"},
					{Name: "target-a-3", ResourceType: "pods"},
				}, nil
			case "cluster-b":
				return []common.SearchResult{
					{Name: "target-b-1", ResourceType: "pods"},
					{Name: "target-b-2", ResourceType: "pods"},
				}, nil
			default:
				return nil, fmt.Errorf("unexpected cluster")
			}
		},
	}
	t.Cleanup(func() {
		resources.SearchFuncs = oldSearchFuncs
	})

	handler := NewSearchHandler()

	ctx := newSearchContext("cluster-a")
	if _, err := handler.Search(ctx, "po target", 1); err != nil {
		t.Fatalf("Search() error = %v", err)
	}

	resp := performGlobalSearch(t, handler, "cluster-a", "/search?q=po+target&limit=3")
	if resp.Total != 3 {
		t.Fatalf("cluster-a total = %d, want 3", resp.Total)
	}

	resp = performGlobalSearch(t, handler, "cluster-b", "/search?q=po+target&limit=3")
	if resp.Total != 2 {
		t.Fatalf("cluster-b total = %d, want 2", resp.Total)
	}
	if len(resp.Results) == 0 || resp.Results[0].Name != "target-b-1" {
		t.Fatalf("unexpected cluster-b results: %#v", resp.Results)
	}
}

func newSearchContext(clusterName string) *gin.Context {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/search", nil)
	if clusterName != "" {
		ctx.Set(middleware.ClusterNameKey, clusterName)
	}
	return ctx
}

func newSearchContextWithCookie() *gin.Context {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodGet, "/search", nil)
	req.AddCookie(&http.Cookie{Name: middleware.ClusterNameHeader, Value: "cookie-cluster"})
	ctx.Request = req
	return ctx
}

func performGlobalSearch(t *testing.T, handler *SearchHandler, clusterName, target string) SearchResponse {
	t.Helper()

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	if clusterName != "" {
		ctx.Set(middleware.ClusterNameKey, clusterName)
	}

	handler.GlobalSearch(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var response SearchResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	return response
}

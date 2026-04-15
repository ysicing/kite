package utils

import "testing"

func TestGuessSearchResources(t *testing.T) {
	testCases := []struct {
		name             string
		query            string
		wantResourceType string
		wantKeyword      string
	}{
		{name: "empty query", query: "   ", wantResourceType: "all", wantKeyword: ""},
		{name: "single token query", query: "nginx", wantResourceType: "all", wantKeyword: "nginx"},
		{name: "known resource alias", query: "po nginx", wantResourceType: "pods", wantKeyword: "nginx"},
		{name: "mixed case with extra spaces", query: "  SVC    kube-dns   ", wantResourceType: "services", wantKeyword: "kube-dns"},
		{name: "unknown prefix", query: "xyz kube-system", wantResourceType: "all", wantKeyword: "xyz kube-system"},
		{name: "multi word keyword", query: "deploy api server", wantResourceType: "deployments", wantKeyword: "api server"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			gotResourceType, gotKeyword := GuessSearchResources(testCase.query)
			if gotResourceType != testCase.wantResourceType || gotKeyword != testCase.wantKeyword {
				t.Fatalf(
					"GuessSearchResources(%q) = (%q, %q), want (%q, %q)",
					testCase.query,
					gotResourceType,
					gotKeyword,
					testCase.wantResourceType,
					testCase.wantKeyword,
				)
			}
		})
	}
}

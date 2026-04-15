package common

import (
	"os"
	"reflect"
	"testing"
)

func TestLoadEnvsParsesCORSAllowedOrigins(t *testing.T) {
	oldOrigins := CORSAllowedOrigins
	t.Cleanup(func() {
		CORSAllowedOrigins = oldOrigins
	})

	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("OAUTH_ENABLED", "false")
	t.Setenv("CORS_ALLOWED_ORIGINS", " http://localhost:5173,https://example.com ,, ")

	LoadEnvs()

	want := []string{"http://localhost:5173", "https://example.com"}
	if !reflect.DeepEqual(CORSAllowedOrigins, want) {
		t.Fatalf("CORSAllowedOrigins = %#v, want %#v", CORSAllowedOrigins, want)
	}

	os.Unsetenv("CORS_ALLOWED_ORIGINS")
	LoadEnvs()
	if len(CORSAllowedOrigins) != 0 {
		t.Fatalf("CORSAllowedOrigins should reset when env is empty, got %#v", CORSAllowedOrigins)
	}
}

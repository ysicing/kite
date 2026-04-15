package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func DevCORS(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		normalized := strings.TrimRight(strings.TrimSpace(origin), "/")
		if normalized != "" {
			allowed[normalized] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		if len(allowed) == 0 {
			c.Next()
			return
		}

		origin := strings.TrimRight(strings.TrimSpace(c.Request.Header.Get("Origin")), "/")
		if origin == "" {
			c.Next()
			return
		}
		if _, ok := allowed[origin]; !ok {
			c.Next()
			return
		}

		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-Cluster-Name",
		)
		c.Writer.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, PATCH, OPTIONS",
		)
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")
		c.Writer.Header().Add("Vary", "Origin")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func CORS() gin.HandlerFunc {
	return DevCORS(nil)
}

package common

import (
	"os"

	"k8s.io/klog/v2"

	"github.com/zxh326/kite/pkg/utils"
)

const (
	JWTExpirationSeconds = 24 * 60 * 60 // 24 hours

	NodeTerminalPodName = "kite-node-terminal-agent"

	KubectlAnnotation = "kubectl.kubernetes.io/last-applied-configuration"
)

var (
	Port            = "8080"
	JwtSecret       = ""
	OAuthEnabled    = false
	OAuthProviders  = ""
	OAuthAllowUsers = ""
	EnableAnalytics = false

	NodeTerminalImage = "busybox:latest"

	WebhookUsername = "kite-webhook"
	WebhookPassword = "kite-webhook-password"

	KiteUsername         = os.Getenv("KITE_USERNAME")
	KitePassword         = os.Getenv("KITE_PASSWORD")
	PasswordLoginEnabled = KiteUsername != "" && KitePassword != ""

	Readonly = false
)

func LoadEnvs() {
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		JwtSecret = secret
	} else {
		klog.Warning("JWT_SECRET is not set, using random secret key, restart server will lose all sessions")
		JwtSecret = utils.RandomString(32)
	}

	if enabled := os.Getenv("OAUTH_ENABLED"); enabled == "true" {
		OAuthEnabled = true
		if providers := os.Getenv("OAUTH_PROVIDERS"); providers != "" {
			OAuthProviders = providers
		} else {
			klog.Warning("OAUTH_PROVIDERS is not set, OAuth will not work as expected")
		}
		if allowUsers := os.Getenv("OAUTH_ALLOW_USERS"); allowUsers != "" {
			OAuthAllowUsers = allowUsers
		} else {
			klog.Warning("OAUTH_ALLOW_USERS is not set, OAuth will not work as expected")
		}
	} else {
		klog.Warning("OAUTH_ENABLED is not set to true, do not use in PRODUCTION")
	}

	if port := os.Getenv("PORT"); port != "" {
		Port = port
	}

	if analytics := os.Getenv("ENABLE_ANALYTICS"); analytics == "true" {
		EnableAnalytics = true
	}

	if nodeTerminalImage := os.Getenv("NODE_TERMINAL_IMAGE"); nodeTerminalImage != "" {
		NodeTerminalImage = nodeTerminalImage
	}

	if webhookUsername := os.Getenv("WEBHOOK_USERNAME"); webhookUsername != "" {
		WebhookUsername = webhookUsername
	}
	if webhookPassword := os.Getenv("WEBHOOK_PASSWORD"); webhookPassword != "" {
		WebhookPassword = webhookPassword
	} else {
		klog.Warning("WEBHOOK_PASSWORD is not set, using default password")
	}
	if readonly := os.Getenv("READONLY"); readonly == "true" {
		Readonly = true
	}
}

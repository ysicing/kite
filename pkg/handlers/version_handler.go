package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"k8s.io/klog/v2"
)

// 版本信息结构
type VersionInfo struct {
	Current     string    `json:"current"`
	Latest      string    `json:"latest"`
	HasUpdate   bool      `json:"hasUpdate"`
	ReleaseURL  string    `json:"releaseUrl,omitempty"`
	ReleaseDate string    `json:"releaseDate,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// GitHub API 响应结构 - 用于获取最新提交
type GitHubCommit struct {
	SHA    string `json:"sha"`
	Commit struct {
		Author struct {
			Date string `json:"date"`
		} `json:"author"`
		Message string `json:"message"`
	} `json:"commit"`
	HTMLURL string `json:"html_url"`
}

// 版本处理器
type VersionHandler struct {
	currentVersion string
	cachedVersion  *VersionInfo
	lastCheck      time.Time
}

// 创建新的版本处理器
func NewVersionHandler() *VersionHandler {
	return &VersionHandler{
		currentVersion: getCurrentVersion(),
	}
}

// 获取当前版本信息（git commit SHA）
func getCurrentVersion() string {
	// 从环境变量获取版本，如果没有设置则使用默认值
	version := os.Getenv("KITE_VERSION")
	if version == "" {
		version = "unknown" // 默认值，表示未知版本
	}
	return version
}

// 检查是否有新版本
func (h *VersionHandler) checkForUpdates() (*VersionInfo, error) {
	// 如果缓存存在且在1小时内，直接返回缓存
	if h.cachedVersion != nil && time.Since(h.lastCheck) < time.Hour {
		return h.cachedVersion, nil
	}

	// 获取GitHub仓库最新提交的SHA
	resp, err := http.Get("https://api.github.com/repos/ysicing/kite/commits/main")
	if err != nil {
		klog.Warningf("Failed to check for updates: %v", err)
		// 返回当前版本信息，标记为无更新
		return &VersionInfo{
			Current:   h.currentVersion,
			Latest:    h.currentVersion,
			HasUpdate: false,
			UpdatedAt: time.Now(),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		klog.Warningf("GitHub API returned status: %d", resp.StatusCode)
		return &VersionInfo{
			Current:   h.currentVersion,
			Latest:    h.currentVersion,
			HasUpdate: false,
			UpdatedAt: time.Now(),
		}, nil
	}

	var commit GitHubCommit
	if err := json.NewDecoder(resp.Body).Decode(&commit); err != nil {
		klog.Warningf("Failed to decode GitHub commit: %v", err)
		return &VersionInfo{
			Current:   h.currentVersion,
			Latest:    h.currentVersion,
			HasUpdate: false,
			UpdatedAt: time.Now(),
		}, nil
	}

	// 比较当前版本（SHA）与最新提交的SHA
	hasUpdate := h.currentVersion != commit.SHA && h.currentVersion != "unknown"

	// 解析提交时间
	commitDate := ""
	if parsedTime, err := time.Parse(time.RFC3339, commit.Commit.Author.Date); err == nil {
		commitDate = parsedTime.Format("2006-01-02")
	}

	versionInfo := &VersionInfo{
		Current:     h.currentVersion,
		Latest:      commit.SHA,
		HasUpdate:   hasUpdate,
		ReleaseURL:  commit.HTMLURL,
		ReleaseDate: commitDate,
		UpdatedAt:   time.Now(),
	}

	// 更新缓存
	h.cachedVersion = versionInfo
	h.lastCheck = time.Now()

	return versionInfo, nil
}

// 获取版本信息的HTTP处理器
func (h *VersionHandler) GetVersionInfo(c *gin.Context) {
	versionInfo, err := h.checkForUpdates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get version information",
		})
		return
	}

	c.JSON(http.StatusOK, versionInfo)
}

// 仅获取当前版本的HTTP处理器
func (h *VersionHandler) GetCurrentVersion(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"version": h.currentVersion,
	})
}

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2025-09-27]

### Fixed
- **后端编译错误**: 修复 Go 代码中 fmt.Errorf 使用非常量格式字符串的错误
  - 修复 advanced_daemonset_handler.go 中的格式化错误
  - 修复 advanced_statefulset_handler.go 中的格式化错误
  - 修复 cloneset_handler.go 中的格式化错误
- **前端 TypeScript 编译错误**: 修复多个类型定义和组件属性问题
  - 添加 HorizontalPodAutoscaler 到 ResourcesTypeMap 类型映射
  - 修复 create-hpa-dialog.tsx 中未使用的 axios 导入和 API 调用方法
  - 修复 hpa-detail.tsx 和 hpa-list-page.tsx 中的类型不匹配问题
  - 修复 Badge 组件 variant 属性值（移除无效的 'success' 和 'warning'）
  - 修复 EventTable 组件属性（从 'kind' 改为 'resource'）
  - 修复 Switch 组件的 disabled 属性类型处理
- **数据处理类型错误**: 修复资源表格组件中的数据访问问题
  - 修复 resource-table.tsx 中的 memoizedData 类型处理
  - 修复 resource-pagination-table.tsx 中的数据长度检查

### Changed
- **性能分析优化**: pprof 性能分析工具现在仅在 EnablePprof 配置启用时才启动
- **代码质量改进**: 统一使用 memoizedData 替代直接访问数据，提高组件渲染性能

## [2025-09-26]

### Added
- **Horizontal Pod Autoscaler (HPA) 完整支持**: 实现了 Kubernetes HPA 资源的完整管理功能
  - 新增 HPA 列表页面，显示所有 HPA 资源及其实时状态
  - 新增 HPA 详情页面，展示完整的配置信息、指标状态和扩缩历史
  - 新增 HPA 创建对话框，支持从 Deployment 页面直接创建自动扩缩策略
  - 实现 HPA 专用 API 处理器，提供推荐配置和创建接口
- **HPA 智能推荐系统**:
  - 自动检测工作负载的资源请求配置
  - 基于当前副本数推荐合理的最小/最大副本范围
  - 智能提示缺少资源请求时的配置建议
- **HPA 指标监控**:
  - 实时显示 CPU/内存使用率与目标值对比
  - 扩缩状态可视化（稳定/扩容中/缩容中）
  - 条件状态监控（Active/Unable to Scale）
- **日志查看器重连功能**: 添加重连图标，支持手动重新连接日志流
- **日志查看器心跳机制**: 添加 WebSocket 心跳，保持连接稳定性

### Changed
- **日志系统重构**: 将日志查看器从轮询改为 WebSocket 实时推送
- **日志查看器滚动优化**: 改进自动滚动行为，提升用户体验
- **OAuth 配置简化**: 简化 OAuth 认证配置流程
- **UI 组件优化**: 为 Pod/Container 选择器添加最大宽度限制
- **导航菜单更新**: 在"配置"分组中添加"水平自动扩缩"菜单项（位于 ConfigMaps 之后）
- **Deployment 页面增强**: 添加 "Auto Scale" 按钮，支持快速创建 HPA

### Fixed
- **Pod 计数问题**: 修复未就绪 Pod 数量包含已完成 Pod 的问题 (#86)
- **命名空间默认值**: 修复缺少默认命名空间的问题 (#92)
- **日志错误显示**: 修复日志查看器错误日志显示问题
- **React Table 错误**: 修复 HPA 列表页面 accessor 缺少 ID 的问题

### Technical Details
- **后端实现**:
  - 新增 `pkg/handlers/resources/hpa_handler.go` 实现 HPA 专用处理器
  - 添加 HPA 推荐配置 API：`GET /:namespace/recommendation`
  - 添加 HPA 创建 API：`POST /create`
  - 集成 `k8s.io/api/autoscaling/v2` 支持 HPA v2 版本
- **前端实现**:
  - 新增 `ui/src/pages/hpa-list-page.tsx` HPA 列表页面
  - 新增 `ui/src/pages/hpa-detail.tsx` HPA 详情页面
  - 新增 `ui/src/components/create-hpa-dialog.tsx` HPA 创建对话框
  - 完整的国际化支持（中英文）
- **WebSocket 集成**: 日志系统使用 WebSocket 替代轮询机制

## [v2025.07.04-22:22] - 2025-07-04

### Added

#### OpenKruise 完整支持
- **新增 OpenKruise 集成**: 为 Kite 添加了完整的 OpenKruise 支持，实现了与标准 Kubernetes 工作负载同级的管理体验
- **智能菜单系统**: 
  - 未安装 OpenKruise 时，在"集群"分组中显示 OpenKruise 项目，点击显示未安装提示
  - 已安装 OpenKruise 时，同时显示"集群"分组中的概览信息和独立的"OpenKruise"工作负载分组
- **OpenKruise 总览页面**: 
  - 显示 OpenKruise 安装状态、版本信息和总体统计
  - 按 5 个类别分组展示所有 15 种 OpenKruise 资源类型
  - 支持点击跳转到具体资源管理页面
  - 总览统计信息置顶显示，提供更直观的用户体验

#### 支持的 OpenKruise 资源类型
- **高级工作负载** (5种):
  - CloneSets - 增强的 Deployment 功能
  - Advanced StatefulSets - 增强的 StatefulSet 功能  
  - Advanced DaemonSets - 增强的 DaemonSet 功能
  - Broadcast Jobs - 在所有或选定节点上运行 Pod
  - Advanced CronJobs - 增强的 CronJob 功能

- **边车容器管理** (1种):
  - Sidecar Sets - 管理边车容器

- **多域管理** (2种):
  - United Deployments - 多域部署管理
  - Workload Spreads - 工作负载分布约束

- **增强运维** (6种):
  - Image Pull Jobs - 节点镜像预拉取
  - Container Recreate Request - 运行中 Pod 的容器重启
  - Resource Distributions - 跨命名空间资源分发
  - Persistent Pod States - Pod 状态持久化
  - Pod Probe Markers - 自定义 Pod 就绪探测
  - Node Images - 节点镜像管理

- **应用保护** (1种):
  - Pod Unavailable Budgets - 应用可用性保护

#### 后端 API 实现
- **OpenKruise 状态检测**: 实现 `/api/v1/openkruise/status` API，检测集群中的 OpenKruise 安装状态
- **版本检测**: 通过 kruise-controller-manager 部署自动检测 OpenKruise 版本
- **CRD 检测机制**: 智能检测各种 OpenKruise CRD 的存在性和可用性
- **资源统计**: 实时统计各类型 OpenKruise 资源的实例数量
- **完整 CRUD API**: 为所有 15 种 OpenKruise 资源提供完整的增删改查 API 支持
- **官方 Client 集成**: 使用 `github.com/openkruise/kruise-api@v1.8.0` 官方客户端库
- **Scheme 注册**: 正确注册 kruiseappsv1alpha1、kruiseappsv1beta1 和 kruisepolicyv1alpha1 schemes

#### 前端界面实现
- **动态路由系统**: 为所有 OpenKruise 资源配置完整的前端路由
- **响应式设计**: 适配不同屏幕尺寸的 OpenKruise 资源展示
- **状态指示器**: 实时显示资源可用性和实例数量
- **交互式卡片**: 支持悬停效果和点击跳转功能
- **国际化支持**: 完整的中英文翻译覆盖所有 OpenKruise 相关术语

### Enhanced

#### 菜单和导航优化
- **侧边栏精简**: 在 OpenKruise 分组中只显示 8 个常用资源，保持界面简洁
- **智能显示逻辑**: 根据 OpenKruise 安装状态动态调整菜单结构
- **面包屑导航**: 支持 OpenKruise 资源页面的导航路径显示

#### 用户体验改进
- **加载状态管理**: 优化 OpenKruise 状态检测的加载体验
- **错误处理**: 为未安装的 CRD 提供友好的错误提示
- **视觉反馈**: 增加资源卡片的交互反馈效果

### Technical Details

#### 依赖更新
- 添加 `github.com/openkruise/kruise-api@v1.8.0` 依赖
- 集成 OpenKruise 官方 API 类型定义

#### 架构改进
- **Controller-Runtime 集成**: 正确配置 OpenKruise schemes 以支持自定义资源查询
- **Unstructured 资源处理**: 为没有具体类型定义的资源实现通用处理机制
- **动态客户端**: 支持运行时发现和操作 OpenKruise 资源

#### 代码质量
- **类型安全**: 使用 TypeScript 确保前端类型安全
- **错误处理**: 完善的错误处理和边界条件处理
- **代码复用**: 通过泛型资源处理器实现代码复用

### Testing

#### 功能验证
- ✅ OpenKruise 状态检测 API 正常工作
- ✅ 资源统计准确（检测到 42 个总实例：27 个 CloneSets + 2 个 AdvancedDaemonSets + 13 个 NodeImages）
- ✅ 前后端编译无错误
- ✅ 所有资源页面路由正常工作
- ✅ 点击跳转功能正常
- ✅ 国际化翻译完整

#### 兼容性测试
- ✅ 在已安装 OpenKruise 的集群中正常工作
- ✅ 在未安装 OpenKruise 的集群中优雅降级
- ✅ 支持不同版本的 OpenKruise

### Migration Notes

对于现有用户：
- 本次更新完全向后兼容，不影响现有功能
- 如果集群中已安装 OpenKruise，将自动显示相关功能
- 如果集群中未安装 OpenKruise，相关菜单项将显示为不可用状态

### Contributors

- 实现了完整的 OpenKruise 集成功能
- 优化了用户界面和交互体验
- 提供了完整的中英文国际化支持 

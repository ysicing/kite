# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

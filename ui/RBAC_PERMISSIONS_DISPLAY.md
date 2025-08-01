# RBAC权限规则显示测试

## 功能说明

为Role和ClusterRole资源的概览页面添加了权限规则显示功能，用户现在可以直观地看到角色具体拥有哪些权限。

## 功能特性

### 1. 视觉化权限展示
- 📋 以卡片形式展示每个权限规则
- 🎨 不同操作动作使用不同颜色标识
- 🔍 清晰显示API组、资源、资源名称和操作动作

### 2. 动作颜色编码
- 🔵 **蓝色**: `get`, `list`, `watch` (读取操作)
- 🟢 **绿色**: `create` (创建操作)
- 🟡 **黄色**: `update`, `patch` (更新操作)
- 🔴 **红色**: `delete`, `deletecollection` (删除操作)
- 🟣 **紫色**: `*` (全权限)
- ⚪ **灰色**: 其他操作

### 3. 详细信息显示
- **API组**: 显示资源所属的API组 (core, apps, extensions等)
- **资源**: 显示可操作的Kubernetes资源类型
- **资源名称**: 如果指定了特定资源名称，会单独显示
- **操作动作**: 显示允许的操作类型
- **非资源URL**: 对于ClusterRole，显示可访问的非K8s资源URL

### 4. 智能图标
- 根据资源类型自动选择合适的图标
- Pod相关资源使用服务器图标
- Secret/ConfigMap使用密钥图标
- Service/Endpoint使用API图标
- 默认使用盾牌图标

## 使用方法

1. 导航到任意Role或ClusterRole的详情页面
2. 在概览标签页中，可以看到新增的"权限规则"卡片
3. 每个权限规则都会以结构化的方式显示，包含：
   - 权限规则总数
   - 每个规则的详细权限信息
   - 彩色编码的操作动作标签

## 示例权限规则

### 典型的Pod管理权限
```yaml
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

### 典型的集群管理员权限
```yaml
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]
```

### 特定资源名称权限
```yaml
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["my-config"]
  verbs: ["get", "update"]
```

## 技术实现

- **组件**: `RBACRulesDisplay`
- **支持的资源**: Role, ClusterRole
- **国际化**: 支持中英文
- **响应式设计**: 适配各种屏幕尺寸

这个功能让RBAC权限管理变得更加直观和易懂，用户可以快速了解角色的权限范围，提高了安全管理的效率。
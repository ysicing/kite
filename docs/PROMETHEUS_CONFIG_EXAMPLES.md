# Prometheus 配置示例

本文档提供了各种场景下的Prometheus配置示例，帮助你在不同环境中快速部署和配置Kite监控功能。

## 📋 目录

- [环境变量配置](#环境变量配置)
- [单集群配置](#单集群配置)
- [多集群配置](#多集群配置)
- [不同部署方式的配置](#不同部署方式的配置)
- [Docker部署配置](#docker部署配置)
- [Kubernetes部署配置](#kubernetes部署配置)
- [生产环境最佳实践](#生产环境最佳实践)

## 🔧 环境变量配置

### 基本配置优先级

```bash
# 1. 集群特定配置 (最高优先级)
export PRODUCTION_PROMETHEUS_URL=http://prometheus-prod.monitoring.svc.cluster.local:9090
export STAGING_PROMETHEUS_URL=http://prometheus-staging.monitoring.svc.cluster.local:9090

# 2. 全局默认配置 (中等优先级)
export PROMETHEUS_URL=http://prometheus.monitoring.svc.cluster.local:9090

# 3. 自动发现 (最低优先级，无需配置)
# 当上述环境变量都未设置时，系统会自动发现集群中的Prometheus
```

### 集群名称转换规则

Kite会将集群名称转换为环境变量格式：

```bash
# 集群名称 -> 环境变量名
"my-cluster"          -> MY_CLUSTER_PROMETHEUS_URL
"prod.example.com"    -> PROD_EXAMPLE_COM_PROMETHEUS_URL
"kube-system"         -> KUBE_SYSTEM_PROMETHEUS_URL
"monitoring/cluster"  -> MONITORING_CLUSTER_PROMETHEUS_URL
```

## 🎯 单集群配置

### 场景1: 使用ClusterIP Service

```bash
# 集群内部访问
export PROMETHEUS_URL=http://prometheus-server.monitoring.svc.cluster.local:9090

# 或者使用短名称（如果在同一命名空间）
export PROMETHEUS_URL=http://prometheus-server:9090
```

对应的Kubernetes Service：
```yaml
apiVersion: v1
kind: Service
metadata:
  name: prometheus-server
  namespace: monitoring
spec:
  type: ClusterIP
  ports:
  - port: 9090
    targetPort: 9090
    name: prometheus
  selector:
    app: prometheus
```

### 场景2: 使用NodePort Service

```bash
# 使用节点IP和NodePort
export PROMETHEUS_URL=http://192.168.1.100:30090

# 或者使用域名
export PROMETHEUS_URL=http://k8s-node1.example.com:30090
```

对应的Kubernetes Service：
```yaml
apiVersion: v1
kind: Service
metadata:
  name: prometheus-nodeport
  namespace: monitoring
spec:
  type: NodePort
  ports:
  - port: 9090
    targetPort: 9090
    nodePort: 30090
    name: prometheus
  selector:
    app: prometheus
```

### 场景3: 使用LoadBalancer Service

```bash
# 使用LoadBalancer外部IP
export PROMETHEUS_URL=http://203.0.113.10:9090

# 或者使用域名
export PROMETHEUS_URL=http://prometheus.example.com:9090
```

### 场景4: 使用Ingress

```bash
# HTTP访问
export PROMETHEUS_URL=http://prometheus.k8s.example.com

# HTTPS访问
export PROMETHEUS_URL=https://prometheus.k8s.example.com

# 带路径的访问
export PROMETHEUS_URL=https://monitoring.example.com/prometheus
```

对应的Ingress配置：
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: prometheus-ingress
  namespace: monitoring
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  tls:
  - hosts:
    - prometheus.k8s.example.com
    secretName: prometheus-tls
  rules:
  - host: prometheus.k8s.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: prometheus-server
            port:
              number: 9090
```

## 🌐 多集群配置

### 场景1: 不同环境使用不同Prometheus

```bash
# 生产环境配置
export PRODUCTION_PROMETHEUS_URL=https://prometheus-prod.monitoring.example.com

# 预发布环境配置
export STAGING_PROMETHEUS_URL=https://prometheus-staging.monitoring.example.com

# 开发环境配置
export DEVELOPMENT_PROMETHEUS_URL=http://192.168.1.100:30090

# 测试环境使用自动发现（无需配置）
```

### 场景2: 跨集群共享Prometheus

```bash
# 所有集群共享一个中央Prometheus
export PROMETHEUS_URL=https://central-prometheus.monitoring.example.com

# 特殊集群使用本地Prometheus
export EDGE_CLUSTER_PROMETHEUS_URL=http://edge-prometheus.local:9090
```

### 场景3: 混合云部署

```bash
# AWS集群
export AWS_PROD_PROMETHEUS_URL=https://prometheus.aws-prod.internal:9090

# Azure集群
export AZURE_PROD_PROMETHEUS_URL=https://prometheus.azure-prod.internal:9090

# 本地数据中心
export ONPREM_PROMETHEUS_URL=http://prometheus.dc1.company.local:9090

# 默认配置用于其他集群
export PROMETHEUS_URL=https://prometheus.shared.monitoring.com
```

## 🔧 不同部署方式的配置

### Prometheus Server (Helm Chart)

```bash
# 标准Helm部署
export PROMETHEUS_URL=http://prometheus-server.monitoring.svc.cluster.local:9090
```

```yaml
# values.yaml
server:
  service:
    type: ClusterIP
    servicePort: 9090
  ingress:
    enabled: true
    hosts:
      - prometheus.example.com
```

### Prometheus Operator

```bash
# Operator部署的Prometheus
export PROMETHEUS_URL=http://prometheus-operated.monitoring.svc.cluster.local:9090
```

```yaml
apiVersion: monitoring.coreos.com/v1
kind: Prometheus
metadata:
  name: prometheus
  namespace: monitoring
spec:
  serviceMonitorSelector: {}
  ruleSelector: {}
  resources:
    requests:
      memory: 400Mi
```

### Kube-Prometheus-Stack

```bash
# 完整的监控栈
export PROMETHEUS_URL=http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090
```

```yaml
# values.yaml for kube-prometheus-stack
prometheus:
  prometheusSpec:
    storageSpec:
      volumeClaimTemplate:
        spec:
          resources:
            requests:
              storage: 50Gi
  service:
    type: LoadBalancer
```

### Victoria Metrics (替代方案)

```bash
# 如果使用Victoria Metrics作为Prometheus替代
export PROMETHEUS_URL=http://victoria-metrics.monitoring.svc.cluster.local:8428
```

## 🐳 Docker部署配置

### Docker Compose示例

```yaml
# docker-compose.yml
version: '3.8'
services:
  kite:
    image: your-registry/kite:latest
    environment:
      - PROMETHEUS_URL=http://prometheus:9090
    ports:
      - "8080:8080"
    depends_on:
      - prometheus
    
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
```

### Docker Run示例

```bash
# 启动Prometheus容器
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  prom/prometheus:latest

# 启动Kite容器，连接到Prometheus
docker run -d \
  --name kite \
  --link prometheus \
  -e PROMETHEUS_URL=http://prometheus:9090 \
  -p 8080:8080 \
  your-registry/kite:latest
```

## ☸️ Kubernetes部署配置

### 基本Deployment配置

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kite
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kite
  template:
    metadata:
      labels:
        app: kite
    spec:
      containers:
      - name: kite
        image: your-registry/kite:latest
        env:
        # 使用自动发现，无需配置PROMETHEUS_URL
        - name: PORT
          value: "8080"
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 使用ConfigMap配置

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kite-config
  namespace: monitoring
data:
  PROMETHEUS_URL: "http://prometheus-server.monitoring.svc.cluster.local:9090"
  LOG_LEVEL: "info"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kite
  namespace: monitoring
spec:
  template:
    spec:
      containers:
      - name: kite
        image: your-registry/kite:latest
        envFrom:
        - configMapRef:
            name: kite-config
```

### 使用Secret配置敏感信息

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kite-secrets
  namespace: monitoring
type: Opaque
data:
  # base64编码的Prometheus URL
  PROMETHEUS_URL: aHR0cDovL3Byb21ldGhldXMuZXhhbXBsZS5jb206OTA5MA==
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kite
  namespace: monitoring
spec:
  template:
    spec:
      containers:
      - name: kite
        image: your-registry/kite:latest
        envFrom:
        - secretRef:
            name: kite-secrets
```

### 多集群部署配置

```yaml
# 生产集群配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: kite-prod-config
  namespace: monitoring
data:
  PRODUCTION_PROMETHEUS_URL: "https://prometheus-prod.monitoring.example.com"
  CLUSTER_NAME: "production"
---
# 测试集群配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: kite-test-config
  namespace: monitoring
data:
  TESTING_PROMETHEUS_URL: "http://prometheus-test.monitoring.svc.cluster.local:9090"
  CLUSTER_NAME: "testing"
```

## 🏭 生产环境最佳实践

### 高可用配置

```bash
# 使用多个Prometheus实例的负载均衡地址
export PROMETHEUS_URL=http://prometheus-lb.monitoring.svc.cluster.local:9090

# 或者配置多个备选地址（需要应用层支持）
export PROMETHEUS_URLS="http://prometheus-1.monitoring.svc.cluster.local:9090,http://prometheus-2.monitoring.svc.cluster.local:9090"
```

### 安全配置

```bash
# 使用HTTPS和认证
export PROMETHEUS_URL=https://prometheus.secure.example.com:9090

# 如果需要认证（通过Ingress或代理实现）
export PROMETHEUS_URL=https://user:password@prometheus.secure.example.com:9090
```

### 性能优化配置

```yaml
# Kubernetes资源限制
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "1Gi"
    cpu: "1000m"

# 环境变量优化
env:
- name: PROMETHEUS_URL
  value: "http://prometheus-server.monitoring.svc.cluster.local:9090"
- name: PROMETHEUS_TIMEOUT
  value: "30s"
- name: PROMETHEUS_MAX_CONNECTIONS
  value: "100"
```

### 监控和日志配置

```bash
# 启用详细日志
export LOG_LEVEL=debug

# 配置日志输出格式
export LOG_FORMAT=json

# 启用Prometheus指标暴露
export METRICS_ENABLED=true
export METRICS_PORT=9090
```

### 健康检查配置

```yaml
# Kubernetes健康检查
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

## 🔍 配置验证

### 验证配置是否生效

```bash
# 检查环境变量
env | grep PROMETHEUS

# 测试Prometheus连接
curl -f http://your-prometheus-url:9090/-/healthy

# 查看Kite日志
kubectl logs -f deployment/kite -n monitoring
```

### 常用调试命令

```bash
# 查看自动发现的端点
go run examples/prometheus_discovery_demo.go

# 测试配置
kubectl exec -it deployment/kite -n monitoring -- env | grep PROMETHEUS

# 查看服务发现状态
kubectl get svc -A | grep prometheus
kubectl get ingress -A | grep prometheus
```

## 📚 配置模板

### 开发环境模板

```bash
#!/bin/bash
# dev-config.sh
export PROMETHEUS_URL=http://localhost:9090
export LOG_LEVEL=debug
export METRICS_ENABLED=true
```

### 生产环境模板

```bash
#!/bin/bash
# prod-config.sh
export PRODUCTION_PROMETHEUS_URL=https://prometheus.prod.example.com
export LOG_LEVEL=info
export LOG_FORMAT=json
export METRICS_ENABLED=true
```

### CI/CD环境模板

```bash
#!/bin/bash
# ci-config.sh
export CI_PROMETHEUS_URL=http://prometheus-ci.monitoring.svc.cluster.local:9090
export LOG_LEVEL=warn
export PROMETHEUS_TIMEOUT=10s
```

这些配置示例涵盖了从开发到生产的各种场景，可以根据实际需求进行调整和组合使用。
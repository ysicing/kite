# Design Document

## Overview

This design document outlines the implementation of System Upgrade Controller support in Kite, following the established pattern used for Tailscale integration. The System Upgrade Controller uses Custom Resource Definitions (CRDs) to manage node upgrades through Kubernetes-native resources. The integration will provide a comprehensive web interface for managing upgrade plans, monitoring progress, and viewing upgrade history.

The System Upgrade Controller primarily uses the `Plan` custom resource (plans.upgrade.cattle.io) to define upgrade specifications, and creates `Job` resources to execute upgrades on target nodes.

## Architecture

### Backend Components

#### 1. System Upgrade Controller Resource Handler
- **File**: `pkg/handlers/resources/system_upgrade_handler.go`
- **Purpose**: Handles CRUD operations for System Upgrade Controller custom resources
- **Pattern**: Follows the same structure as `TailscaleResourceHandler`
- **Scope**: Cluster-scoped resources (Plans are cluster-wide)

#### 2. System Upgrade Controller Status Handler
- **File**: `pkg/handlers/resources/handler.go` (extension)
- **Purpose**: Checks installation status and available workload types
- **Function**: `GetSystemUpgradeStatus()`
- **Returns**: Installation status, version, and supported resource types

#### 3. Route Registration
- **File**: `pkg/handlers/resources/handler.go`
- **Purpose**: Register System Upgrade Controller resources in the resource handlers map
- **Resources**: 
  - `plans` (upgrade plans)
  - `jobs` (upgrade execution jobs - read-only view)

### Frontend Components

#### 1. System Upgrade Controller Overview Page
- **File**: `ui/src/pages/system-upgrade-overview-page.tsx`
- **Purpose**: Main dashboard showing upgrade status and statistics
- **Features**:
  - Installation status display
  - Summary statistics (total plans, active upgrades, recent completions)
  - Recent upgrade activity
  - Quick navigation to detailed views

#### 2. System Upgrade Controller Management Page
- **File**: `ui/src/pages/system-upgrade-page.tsx`
- **Purpose**: Main navigation and status page
- **Features**:
  - Installation status check
  - Available workload types
  - Navigation to specific resource types
  - Installation instructions if not installed

#### 3. Upgrade Plans List Page
- **File**: `ui/src/pages/upgrade-plans-list-page.tsx`
- **Purpose**: List and manage upgrade plans
- **Features**:
  - Tabular view of all upgrade plans
  - Status indicators (pending, active, completed, failed)
  - Quick actions (edit, delete, trigger)
  - Create new plan button

#### 4. Upgrade Plan Detail Page
- **File**: `ui/src/pages/upgrade-plan-detail.tsx`
- **Purpose**: Detailed view and editing of individual upgrade plans
- **Features**:
  - Plan configuration display/editing
  - Target node information
  - Upgrade history for this plan
  - Real-time status updates

#### 5. Upgrade Jobs List Page
- **File**: `ui/src/pages/upgrade-jobs-list-page.tsx`
- **Purpose**: View upgrade execution jobs
- **Features**:
  - List of all upgrade jobs
  - Job status and progress
  - Log viewing capabilities
  - Filtering by plan, node, status

## Components and Interfaces

### Backend API Endpoints

Following the established pattern from Tailscale integration:

```
GET    /api/v1/resources/plans                    # List all upgrade plans
POST   /api/v1/resources/plans                    # Create new upgrade plan
GET    /api/v1/resources/plans/:name              # Get specific upgrade plan
PUT    /api/v1/resources/plans/:name              # Update upgrade plan
DELETE /api/v1/resources/plans/:name              # Delete upgrade plan

GET    /api/v1/resources/jobs                     # List upgrade jobs (read-only)
GET    /api/v1/resources/jobs/:name               # Get specific upgrade job

GET    /api/v1/system-upgrade/status              # Get installation status
```

### Custom Resource Definitions

#### Plan Resource Structure
```yaml
apiVersion: upgrade.cattle.io/v1
kind: Plan
metadata:
  name: example-upgrade-plan
spec:
  concurrency: 1
  nodeSelector:
    matchLabels:
      kubernetes.io/os: linux
  serviceAccountName: system-upgrade
  upgrade:
    image: rancher/k3s-upgrade:v1.28.4-k3s1
  drain:
    enabled: true
    timeout: 300s
status:
  conditions:
    - type: Ready
      status: "True"
      lastUpdateTime: "2024-01-01T00:00:00Z"
```

### Frontend Data Models

#### SystemUpgradeStatus Interface
```typescript
interface SystemUpgradeStatus {
  installed: boolean
  version?: string
  workloads: SystemUpgradeWorkload[]
}

interface SystemUpgradeWorkload {
  name: string
  kind: string
  apiVersion: string
  description: string
  available: boolean
  count: number
}
```

#### UpgradePlan Interface
```typescript
interface UpgradePlan extends CustomResource {
  spec: {
    concurrency?: number
    nodeSelector?: {
      matchLabels?: Record<string, string>
      matchExpressions?: Array<{
        key: string
        operator: string
        values?: string[]
      }>
    }
    serviceAccountName?: string
    upgrade: {
      image: string
      command?: string[]
      args?: string[]
      envs?: Array<{
        name: string
        value?: string
        valueFrom?: any
      }>
    }
    drain?: {
      enabled?: boolean
      timeout?: string
      ignoreDaemonSets?: boolean
      deleteLocalData?: boolean
    }
    version?: string
    channel?: string
  }
  status?: {
    conditions?: Array<{
      type: string
      status: string
      lastUpdateTime: string
      reason?: string
      message?: string
    }>
    applying?: Array<{
      name: string
      image: string
      phase: string
    }>
  }
}
```

## Data Models

### Backend Go Structures

The backend will use unstructured.Unstructured objects to handle the custom resources, similar to the Tailscale implementation. This provides flexibility to handle different versions and schemas of the System Upgrade Controller CRDs.

### Frontend TypeScript Interfaces

All frontend interfaces will extend the base `CustomResource` interface and include proper typing for the System Upgrade Controller specific fields.

## Error Handling

### Backend Error Handling
- CRD not found: Return 404 with installation instructions
- Resource not found: Return 404 with appropriate error message
- Validation errors: Return 400 with detailed validation messages
- Kubernetes API errors: Return 500 with sanitized error information

### Frontend Error Handling
- Network errors: Display retry mechanisms and offline indicators
- Resource not found: Show helpful messages and navigation options
- Validation errors: Inline form validation with clear error messages
- Permission errors: Display appropriate access denied messages

## Testing Strategy

### Backend Testing
1. **Unit Tests**
   - Test SystemUpgradeResourceHandler CRUD operations
   - Test status checking functionality
   - Test error handling scenarios
   - Mock Kubernetes client interactions

2. **Integration Tests**
   - Test with actual System Upgrade Controller CRDs
   - Test resource creation, update, and deletion flows
   - Test status endpoint with various installation states

### Frontend Testing
1. **Component Tests**
   - Test individual page components with mock data
   - Test form validation and submission
   - Test error state handling
   - Test loading states

2. **Integration Tests**
   - Test complete user workflows
   - Test API integration with mock backend
   - Test navigation between pages
   - Test real-time status updates

3. **E2E Tests**
   - Test complete upgrade plan management workflow
   - Test installation status detection
   - Test error scenarios and recovery

### Test Data
- Mock System Upgrade Controller CRDs
- Sample upgrade plans with various configurations
- Mock job execution data
- Error response scenarios

## Implementation Phases

### Phase 1: Backend Foundation
- Implement SystemUpgradeResourceHandler
- Add status checking functionality
- Register routes and handlers
- Basic CRUD operations for Plans

### Phase 2: Frontend Core
- Create overview and management pages
- Implement upgrade plans list and detail views
- Basic form handling for plan creation/editing
- Status display and navigation

### Phase 3: Advanced Features
- Real-time status updates
- Job monitoring and log viewing
- Advanced filtering and search
- Upgrade history and reporting

### Phase 4: Polish and Testing
- Comprehensive error handling
- Performance optimization
- Complete test coverage
- Documentation and help text

## Security Considerations

- Validate all user inputs before creating/updating resources
- Ensure proper RBAC permissions for System Upgrade Controller operations
- Sanitize error messages to prevent information disclosure
- Implement proper authentication checks for all endpoints
- Validate upgrade images and configurations to prevent security issues

## Performance Considerations

- Implement efficient polling for status updates
- Use pagination for large lists of plans and jobs
- Cache installation status to reduce API calls
- Optimize bundle size by code splitting upgrade-related components
- Implement proper loading states to improve perceived performance

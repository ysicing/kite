import { createBrowserRouter, useParams } from 'react-router-dom'

import App from './App'
import { ProtectedRoute } from './components/protected-route'
import { CRListPage } from './pages/cr-list-page'
import { LoginPage } from './pages/login'
import { OpenKruisePage } from './pages/openkruise-page'
import { TailscalePage } from './pages/tailscale-page'
import { TraefikPage } from './pages/traefik-page'
import { SystemUpgradePage } from './pages/system-upgrade-page'
import ConnectorListPage from './pages/connector-list-page'
import ProxyClassListPage from './pages/proxyclass-list-page'
import TailscaleOverviewPage from './pages/tailscale-overview-page'
import SystemUpgradeOverviewPage from './pages/system-upgrade-overview-page'
import UpgradePlansListPage from './pages/upgrade-plans-list-page'
import { Overview } from './pages/overview'
import { ResourceDetail } from './pages/resource-detail'
import { ResourceList } from './pages/resource-list'
import { VersionTestPage } from './pages/version-test'
import { AdvancedDaemonSetListPage } from './pages/advanced-daemonset-list-page'
import { AdvancedDaemonSetDetail } from './pages/advanced-daemonset-detail'

// Route wrapper for AdvancedDaemonSetDetail
function AdvancedDaemonSetDetailWrapper() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>()
  return <AdvancedDaemonSetDetail namespace={namespace || ''} name={name || ''} />
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Overview />,
      },
      {
        path: 'dashboard',
        element: <Overview />,
      },
      {
        path: 'openkruise',
        element: <OpenKruisePage />,
      },
      {
        path: 'tailscale',
        element: <TailscalePage />,
      },
      {
        path: 'tailscale-overview',
        element: <TailscaleOverviewPage />,
      },
      {
        path: 'traefik',
        element: <TraefikPage />,
      },
      {
        path: 'system-upgrade',
        element: <SystemUpgradePage />,
      },
      {
        path: 'system-upgrade-overview',
        element: <SystemUpgradeOverviewPage />,
      },
      {
        path: 'connectors',
        element: <ConnectorListPage />,
      },
      {
        path: 'plans',
        element: <UpgradePlansListPage />,
      },
      {
        path: 'proxyclasses',
        element: <ProxyClassListPage />,
      },
      {
        path: 'version-test',
        element: <VersionTestPage />,
      },
      // AdvancedDaemonSet specific routes
      {
        path: 'advanceddaemonsets',
        element: <AdvancedDaemonSetListPage />,
      },
      {
        path: 'advanceddaemonsets/:namespace/:name',
        element: <AdvancedDaemonSetDetailWrapper />,
      },
      {
        path: 'crds/:crd',
        element: <CRListPage />,
      },
      // for namespaced CRD resources
      {
        path: 'crds/:resource/:namespace/:name',
        element: <ResourceDetail />,
      },
      // for cluster-scoped CRD resources
      {
        path: 'crds/:resource/:name',
        element: <ResourceDetail />,
      },
      {
        path: ':resource/:name',
        element: <ResourceDetail />,
      },
      {
        path: ':resource',
        element: <ResourceList />,
      },
      {
        path: ':resource/:namespace/:name',
        element: <ResourceDetail />,
      },
    ],
  },
])

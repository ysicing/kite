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
import AdvancedFeaturesOverview from './pages/advanced-features-overview'
import UpgradePlansListPage from './pages/upgrade-plans-list-page'
import { Overview } from './pages/overview'
import { ResourceDetail } from './pages/resource-detail'
import { ResourceList } from './pages/resource-list'
import { StorageClassDetailPage } from './pages/storageclass-detail-page'
import VersionTest from './pages/version-test'
import { AdvancedDaemonSetListPage } from './pages/advanced-daemonset-list-page'
import { AdvancedDaemonSetDetail } from './pages/advanced-daemonset-detail'
import { ConnectorDetail } from './pages/connector-detail'
import AdmissionControllerDetailWrapper from './pages/admission-controller-detail'
import { AdmissionControllerListPage } from './pages/admission-controller-list-page'

// Route wrapper for AdvancedDaemonSetDetail
function AdvancedDaemonSetDetailWrapper() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>()
  return <AdvancedDaemonSetDetail namespace={namespace || ''} name={name || ''} />
}

// Route wrapper for ConnectorDetail
function ConnectorDetailWrapper() {
  const { name } = useParams<{ name: string }>()
  return <ConnectorDetail name={name || ''} />
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
        path: 'advanced-features',
        element: <AdvancedFeaturesOverview />,
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
        element: <VersionTest />,
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
      // StorageClass specific routes
      {
        path: 'storageclasses/:name',
        element: <StorageClassDetailPage />,
      },
      // Connector specific routes
      {
        path: 'connectors/:name',
        element: <ConnectorDetailWrapper />,
      },
      // Admission Controller specific routes
      {
        path: 'admission-controllers',
        element: <AdmissionControllerListPage />,
      },
      {
        path: 'admission-controllers/:name',
        element: <AdmissionControllerDetailWrapper />,
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

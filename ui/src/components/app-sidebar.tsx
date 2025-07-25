import * as React from 'react'
import Icon from '@/assets/icon.svg'
import { CollapsibleContent } from '@radix-ui/react-collapsible'
import {
  IconBell,
  IconBox,
  IconBoxMultiple,
  IconClockHour4,
  IconCode,
  IconDatabase,
  IconFileDatabase,
  IconHttpConnect,
  IconLayoutDashboard,
  IconLock,
  IconMap,
  IconNetwork,
  IconPlayerPlay,
  IconRocket,
  IconRouter,
  IconServer2,
  IconStack2,
  IconStack3,
  IconTopologyBus,
  IconArrowUp,
} from '@tabler/icons-react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { useCluster } from '@/hooks/use-cluster'
import { useOpenKruiseStatus, useTailscaleStatus, useTraefikStatus, useSystemUpgradeStatus } from '@/lib/api'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

import { ClusterSelector } from './cluster-selector'
import { Collapsible, CollapsibleTrigger } from './ui/collapsible'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  const { clusters, isLoading } = useCluster()
  const { data: openKruiseStatus } = useOpenKruiseStatus()
  const { data: tailscaleStatus } = useTailscaleStatus()
  const { data: traefikStatus } = useTraefikStatus()
  const { data: systemUpgradeStatus } = useSystemUpgradeStatus()
  const shouldShowClusterSelector = !isLoading && clusters.length > 1

  const menus = {
    [t('nav.cluster')]: [
      {
        title: t('nav.nodes'),
        url: '/nodes',
        icon: IconServer2,
      },
      // Always show OpenKruise in cluster group
      {
        title: t('nav.openkruise'),
        url: '/openkruise',
        icon: IconStack3,
      },
      // Always show Tailscale in cluster group
      {
        title: t('nav.tailscale'),
        url: '/tailscale',
        icon: IconNetwork,
      },
      // Always show Traefik in traffic group
      {
        title: t('nav.traefik'),
        url: '/traefik',
        icon: IconLayoutDashboard,
      },
      // Always show System Upgrade Controller in cluster group
      {
        title: t('nav.systemUpgrade'),
        url: '/system-upgrade',
        icon: IconArrowUp,
      },
    ],
    [t('nav.workloads')]: [
      {
        title: t('common.pods'),
        url: '/pods',
        icon: IconBox,
      },
      {
        title: t('nav.deployments'),
        url: '/deployments',
        icon: IconRocket,
      },
      {
        title: t('nav.statefulsets'),
        url: '/statefulsets',
        icon: IconStack2,
      },
      {
        title: t('nav.daemonsets'),
        url: '/daemonsets',
        icon: IconTopologyBus,
      },
      {
        title: t('nav.jobs'),
        url: '/jobs',
        icon: IconPlayerPlay,
      },
      {
        title: t('nav.cronjobs'),
        url: '/cronjobs',
        icon: IconClockHour4,
      },
    ],
    ...(openKruiseStatus?.installed ? {
      [t('nav.openkruise')]: [
        {
          title: t('nav.clonesets'),
          url: '/clonesets',
          icon: IconRocket,
        },
        {
          title: t('nav.advancedstatefulsets'),
          url: '/advancedstatefulsets',
          icon: IconStack2,
        },
        {
          title: t('nav.advanceddaemonsets'),
          url: '/advanceddaemonsets',
          icon: IconTopologyBus,
        },
        {
          title: t('nav.broadcastjobs'),
          url: '/broadcastjobs',
          icon: IconPlayerPlay,
        },
        {
          title: t('nav.advancedcronjobs'),
          url: '/advancedcronjobs',
          icon: IconClockHour4,
        },
        {
          title: t('nav.sidecarsets'),
          url: '/sidecarsets',
          icon: IconBox,
        },
        // {
        //   title: t('nav.imagepulljobs'),
        //   url: '/imagepulljobs',
        //   icon: IconDatabase,
        // },
        // {
        //   title: t('nav.nodeimages'),
        //   url: '/nodeimages',
        //   icon: IconServer2,
        // },
      ]
    } : {}),
    ...(tailscaleStatus?.installed ? {
      [t('nav.tailscale')]: [
        {
          title: t('common.overview'),
          url: '/tailscale-overview',
          icon: IconLayoutDashboard,
        },
        {
          title: t('nav.connectors'),
          url: '/connectors',
          icon: IconHttpConnect,
        },
        {
          title: t('nav.proxyclasses'),
          url: '/proxyclasses',
          icon: IconRouter,
        },
        // ProxyGroups 默认隐藏，可以通过直接访问 URL 使用
        // {
        //   title: t('nav.proxygroups'),
        //   url: '/proxygroups',
        //   icon: IconNetwork,
        // },
      ]
    } : {}),
    ...(systemUpgradeStatus?.installed ? {
      [t('nav.systemUpgrade')]: [
        {
          title: t('common.overview'),
          url: '/system-upgrade-overview',
          icon: IconLayoutDashboard,
        },
        {
          title: t('nav.plans'),
          url: '/plans',
          icon: IconArrowUp,
        },
      ]
    } : {}),
    [t('nav.traffic')]: [
      {
        title: t('nav.services'),
        url: '/services',
        icon: IconNetwork,
      },
      {
        title: t('nav.ingresses'),
        url: '/ingresses',
        icon: IconRouter,
      },
    ...(traefikStatus?.installed ? [
        {
          title: t('nav.ingressroutes'),
          url: '/ingressroutes',
          icon: IconRouter,
        },
        {
          title: t('nav.middlewares'),
          url: '/middlewares',
          icon: IconCode,
        },
      ]:[]),
    ],
    [t('nav.storage')]: [
      {
        title: t('nav.storageClasses'),
        url: '/storageclasses',
        icon: IconFileDatabase,
      },
      {
        title: t('nav.persistentVolumeClaims'),
        url: '/persistentvolumeclaims',
        icon: IconFileDatabase,
      },
      {
        title: t('nav.persistentVolumes'),
        url: '/persistentvolumes',
        icon: IconDatabase,
      },
    ],
    [t('nav.config')]: [
      {
        title: t('nav.configMaps'),
        url: '/configmaps',
        icon: IconMap,
      },
      {
        title: t('nav.secrets'),
        url: '/secrets',
        icon: IconLock,
      },
    ],
    [t('common.other')]: [
      {
        title: t('nav.namespaces'),
        url: '/namespaces',
        icon: IconBoxMultiple,
      },
      {
        title: t('common.events'),
        url: '/events',
        icon: IconBell,
      },
      {
        title: 'CRDs',
        url: '/crds',
        icon: IconCode,
      },
    ],
  }

  // Function to check if current path matches menu item
  const isActive = (url: string) => {
    if (url === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(url)
  }

  // Handle menu item click on mobile - close sidebar
  const handleMenuItemClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/" onClick={handleMenuItemClick}>
                <img src={Icon} alt="Kite Logo" className="ml-1 h-8 w-8" />
                <span className="text-base font-semibold">Kite+</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t('common.overview')}
                asChild
                isActive={isActive('/')}
              >
                <Link to="/" onClick={handleMenuItemClick}>
                  <IconLayoutDashboard className="text-sidebar-primary" />
                  <span className="font-medium">{t('common.overview')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>



        {Object.entries(menus).map(([group, items]) => (
          <Collapsible defaultOpen className="group/collapsible" key={group}>
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger>
                  {group}
                  <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent className="flex flex-col gap-2">
                  <SidebarMenu>
                    {items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          tooltip={item.title}
                          asChild
                          isActive={isActive(item.url)}
                        >
                          <Link to={item.url} onClick={handleMenuItemClick}>
                            {item.icon && (
                              <item.icon className="text-sidebar-primary" />
                            )}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      {shouldShowClusterSelector && (
        <SidebarFooter>
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-muted/60 border border-border/80">
            <ClusterSelector />
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}

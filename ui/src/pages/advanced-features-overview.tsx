import React from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconStack3, IconNetwork, IconArrowUp, IconLayoutDashboard } from '@tabler/icons-react'

// Import existing overview components
import OpenKruiseOverview from './components/openkruise-overview'
import TailscaleOverview from './components/tailscale-overview'
import SystemUpgradeOverview from './components/systemupgrade-overview'
import TraefikOverview from './components/traefik-overview'

// Import the new hook
import { useLastActiveTab } from '@/hooks/use-last-active-tab'

const AdvancedFeaturesOverview: React.FC = () => {
  const { t } = useTranslation()
  const { activeTab, updateActiveTab } = useLastActiveTab('openkruise')

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <IconLayoutDashboard className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{t('nav.features')}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={updateActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="openkruise" className="flex items-center gap-2">
            <IconStack3 className="h-4 w-4" />
            {t('nav.openkruise')}
          </TabsTrigger>
          <TabsTrigger value="tailscale" className="flex items-center gap-2">
            <IconNetwork className="h-4 w-4" />
            {t('nav.tailscale')}
          </TabsTrigger>
          <TabsTrigger value="systemupgrade" className="flex items-center gap-2">
            <IconArrowUp className="h-4 w-4" />
            {t('nav.systemUpgrade')}
          </TabsTrigger>
          <TabsTrigger value="traefik" className="flex items-center gap-2">
            <IconLayoutDashboard className="h-4 w-4" />
            {t('nav.traefik')}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="openkruise" className="mt-6">
          <OpenKruiseOverview />
        </TabsContent>
        
        <TabsContent value="tailscale" className="mt-6">
          <TailscaleOverview />
        </TabsContent>
        
        <TabsContent value="systemupgrade" className="mt-6">
          <SystemUpgradeOverview />
        </TabsContent>
        
        <TabsContent value="traefik" className="mt-6">
          <TraefikOverview />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdvancedFeaturesOverview

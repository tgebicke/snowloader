import IdeTabs from './IdeTabs'
import ContractEditor from './editors/ContractEditor'
import PipelineEditor from './editors/PipelineEditor'
import type { Tab } from './types'

interface IdeMainAreaProps {
  tabs: Tab[]
  activeTabId: string | null
  onTabChange: (tabId: string) => void
  onCloseTab: (tabId: string) => void
}

export default function IdeMainArea({
  tabs,
  activeTabId,
  onTabChange,
  onCloseTab,
}: IdeMainAreaProps) {
  const activeTab = tabs.find(t => t.id === activeTabId)

  const renderEditor = (tab: Tab) => {
    switch (tab.type) {
      case 'contract':
        return <ContractEditor tab={tab} />
      case 'pipeline':
        return <PipelineEditor tab={tab} />
      default:
        return (
          <div className="flex items-center justify-center h-full text-[#858585]">
            <p>Editor for {tab.type} not yet implemented</p>
          </div>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <IdeTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={onTabChange}
        onCloseTab={onCloseTab}
      />
      
      <div className="flex-1 overflow-auto bg-[#181818]">
        {activeTab ? (
          renderEditor(activeTab)
        ) : (
          <div className="flex items-center justify-center h-full w-full text-[#858585]">
            <div className="text-center w-full px-8">
              <p className="text-lg mb-2 font-medium text-[#cccccc] whitespace-nowrap">Welcome to Snowloader IDE</p>
              <p className="text-sm whitespace-nowrap">Select a file from the sidebar to open it</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


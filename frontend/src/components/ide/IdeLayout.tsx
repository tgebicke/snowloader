import { useState } from 'react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import IdeSidebar from './IdeSidebar'
import IdeMainArea from './IdeMainArea'
import type { Tab } from './types'

export default function IdeLayout() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const handleOpenTab = (tab: Tab) => {
    // Check if tab already exists
    const existingTab = tabs.find(t => t.id === tab.id)
    if (existingTab) {
      setActiveTabId(tab.id)
      return
    }

    // Add new tab and make it active
    setTabs([...tabs, tab])
    setActiveTabId(tab.id)
  }

  const handleCloseTab = (tabId: string) => {
    const newTabs = tabs.filter(t => t.id !== tabId)
    setTabs(newTabs)
    
    // If we closed the active tab, switch to another tab or clear
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id)
      } else {
        setActiveTabId(null)
      }
    }
  }

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId)
  }

  return (
    <div className="h-screen w-screen bg-[#181818] text-[#cccccc] overflow-hidden flex flex-col">
      {/* Top Status Bar - VSCode style */}
      <div className="h-8 bg-[#007acc] flex items-center px-4 text-xs font-medium text-white shadow-sm">
        <span className="text-[#ffffff] font-semibold">Snowloader</span>
        <span className="mx-2 text-[#ffffff] opacity-50">•</span>
        <span className="text-[#ffffff] opacity-90">IDE</span>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <Allotment 
          defaultSizes={[1, 3]}
          minSize={150}
        >
          {/* Left Sidebar */}
          <div className="h-full bg-[#181818] border-r border-[#3e3e42]">
            <IdeSidebar onOpenTab={handleOpenTab} />
          </div>

          {/* Main Area */}
          <div className="h-full flex flex-col bg-[#181818]">
            <IdeMainArea
              tabs={tabs}
              activeTabId={activeTabId}
              onTabChange={handleTabChange}
              onCloseTab={handleCloseTab}
            />
          </div>
        </Allotment>
      </div>
    </div>
  )
}


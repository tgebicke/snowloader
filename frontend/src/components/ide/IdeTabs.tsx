import { X } from 'lucide-react'
import type { Tab } from './types'

interface IdeTabsProps {
  tabs: Tab[]
  activeTabId: string | null
  onTabChange: (tabId: string) => void
  onCloseTab: (tabId: string) => void
}

export default function IdeTabs({ tabs, activeTabId, onTabChange, onCloseTab }: IdeTabsProps) {
  if (tabs.length === 0) {
    return (
      <div className="h-9 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center px-4">
        <span className="text-xs text-[#858585]">No files open</span>
      </div>
    )
  }

  return (
    <div className="h-9 bg-[#2d2d30] border-b border-[#3e3e42] flex items-end overflow-x-auto">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-[#3e3e42] min-w-[120px] max-w-[200px] group ${
              isActive
                ? 'bg-[#181818] border-t-2 border-t-[#007acc] text-[#ffffff]'
                : 'bg-[#2d2d30] hover:bg-[#37373d] text-[#cccccc]'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="text-xs truncate flex-1 font-medium">{tab.name}</span>
            {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#cccccc]" />}
            <button
              className="opacity-0 group-hover:opacity-100 hover:bg-[#3e3e42] rounded p-0.5 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onCloseTab(tab.id)
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}


import type { Tab } from '../types'

interface PipelineEditorProps {
  tab: Tab
}

export default function PipelineEditor({ tab }: PipelineEditorProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-[#3e3e42] bg-[#252526]">
        <h3 className="text-sm font-medium text-[#cccccc]">{tab.name}</h3>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <div className="text-[#cccccc]">
          <p className="text-lg mb-4">Pipeline Editor</p>
          <p className="text-sm text-[#858585]">
            Pipeline editor UI will be implemented here. This is a placeholder.
          </p>
        </div>
      </div>
    </div>
  )
}


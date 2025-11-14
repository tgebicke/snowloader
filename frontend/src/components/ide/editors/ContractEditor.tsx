import { useState } from 'react'
import type { Tab } from '../types'

interface ContractEditorProps {
  tab: Tab
}

export default function ContractEditor({ tab }: ContractEditorProps) {
  const [content, setContent] = useState(`# Contract: ${tab.name}

# This is a placeholder contract editor
# Backend integration will be added later

schema:
  name: example_schema
  tables:
    - name: users
      columns:
        - name: id
          type: integer
        - name: name
          type: string
        - name: email
          type: string

data_governance:
  rules:
    - type: pii
      fields: [email]
      action: encrypt
`)

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-[#3e3e42] bg-[#252526]">
        <h3 className="text-sm font-medium text-[#cccccc]">{tab.name}</h3>
      </div>
      
      <div className="flex-1 overflow-auto bg-[#181818]">
        <div className="p-0">
          <div className="flex items-center px-4 py-1.5 bg-[#252526] border-b border-[#3e3e42] text-xs text-[#858585]">
            <span className="font-medium">Contract.yml</span>
            <span className="mx-2 text-[#3e3e42]">•</span>
            <span className="text-[#007acc]">YAML</span>
          </div>
          <div className="p-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-transparent text-[#d4d4d4] font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:ring-opacity-50 rounded leading-relaxed"
              style={{ 
                minHeight: 'calc(100vh - 250px)',
                fontFamily: 'Consolas, "Courier New", monospace',
                tabSize: 2,
              }}
              spellCheck={false}
              placeholder="Start typing your contract definition..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}


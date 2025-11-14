import { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Folder, FileCode, Database } from 'lucide-react'
import type { FileTreeNode, Tab, ObjectType } from './types'

interface IdeSidebarProps {
  onOpenTab: (tab: Tab) => void
}

// Mock data structure - will be replaced with backend data later
const initialTree: FileTreeNode[] = [
  {
    id: 'org-1',
    name: 'Organization',
    type: 'organization',
    children: [
      {
        id: 'proj-1',
        name: 'Project 1',
        type: 'project',
        parentId: 'org-1',
        children: [
          {
            id: 'src-1',
            name: 'Source 1',
            type: 'source',
            parentId: 'proj-1',
            children: [
              {
                id: 'contract-1',
                name: 'Contract.yml',
                type: 'contract',
                parentId: 'src-1',
              },
            ],
          },
        ],
      },
    ],
  },
]

export default function IdeSidebar({ onOpenTab }: IdeSidebarProps) {
  const [tree, setTree] = useState<FileTreeNode[]>(initialTree)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['org-1', 'proj-1', 'src-1']))
  const [showAddMenu, setShowAddMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [sectionsExpanded, setSectionsExpanded] = useState<Set<string>>(new Set(['pipes', 'connections']))

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpanded(newExpanded)
  }

  const toggleSection = (sectionId: string) => {
    const newSectionsExpanded = new Set(sectionsExpanded)
    if (newSectionsExpanded.has(sectionId)) {
      newSectionsExpanded.delete(sectionId)
    } else {
      newSectionsExpanded.add(sectionId)
    }
    setSectionsExpanded(newSectionsExpanded)
  }

  const handleNodeClick = (node: FileTreeNode) => {
    if (node.type === 'contract' || node.type === 'pipeline') {
      // Open in tab
      const tab: Tab = {
        id: node.id,
        name: node.name,
        type: node.type,
      }
      onOpenTab(tab)
    } else {
      // Toggle expansion for folders
      toggleExpanded(node.id)
    }
  }

  const handlePlusClick = (e: React.MouseEvent, node: FileTreeNode) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setShowAddMenu({
      nodeId: node.id,
      x: rect.left,
      y: rect.bottom,
    })
  }

  const findNodeById = (nodes: FileTreeNode[], id: string): FileTreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children) {
        const found = findNodeById(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  const handleAddItem = (parentNodeId: string, itemType: ObjectType) => {
    // This will be connected to backend later
    const newId = `${itemType}-${Date.now()}`
    const newName = itemType === 'contract' ? 'Contract.yml' : `New ${itemType}`
    
    const newNode: FileTreeNode = {
      id: newId,
      name: newName,
      type: itemType,
      parentId: parentNodeId,
    }

    // Add to tree
    const updateTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map(node => {
        if (node.id === parentNodeId) {
          return {
            ...node,
            children: [...(node.children || []), newNode],
          }
        }
        if (node.children) {
          return {
            ...node,
            children: updateTree(node.children),
          }
        }
        return node
      })
    }

    setTree(updateTree(tree))
    setShowAddMenu(null)
    
    // Auto-expand parent
    setExpanded(prev => new Set([...prev, parentNodeId]))
  }

  const getAddOptions = (nodeType: ObjectType): { label: string; type: ObjectType }[] => {
    switch (nodeType) {
      case 'organization':
        return [{ label: 'Add Project', type: 'project' }]
      case 'project':
        return [{ label: 'Add Source', type: 'source' }]
      case 'source':
        return [{ label: 'Add Contract', type: 'contract' }]
      default:
        return []
    }
  }

  const getIcon = (type: ObjectType) => {
    switch (type) {
      case 'organization':
      case 'project':
      case 'source':
        return <Folder className="w-4 h-4" />
      case 'contract':
        return <FileCode className="w-4 h-4" />
      case 'pipeline':
        return <Database className="w-4 h-4" />
      default:
        return null
    }
  }

  const renderNode = (node: FileTreeNode, depth: number = 0) => {
    const isExpanded = expanded.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const canAdd = ['organization', 'project', 'source'].includes(node.type)

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1 px-1 py-0.5 hover:bg-[#2a2d2e] cursor-pointer group transition-colors vscode-file-tree"
          style={{ paddingLeft: `${8 + depth * 8}px` }}
          onClick={() => handleNodeClick(node)}
        >
          {hasChildren ? (
            <button
              className="flex items-center justify-center w-4 h-4 flex-shrink-0 hover:text-[#ffffff]"
              style={{ color: 'rgb(240, 246, 252)' }}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpanded(node.id)
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <div className="w-4 flex-shrink-0" />
          )}
          
          <span className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="w-4 h-4 flex-shrink-0" style={{ color: 'rgb(240, 246, 252)' }}>{getIcon(node.type)}</span>
            <span className="text-[13px] leading-[22px] truncate" style={{ color: 'rgb(240, 246, 252)' }}>{node.name}</span>
          </span>

          {canAdd && (
            <button
              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center hover:bg-[#37373d] hover:text-[#007acc] rounded transition-colors flex-shrink-0"
              onClick={(e) => handlePlusClick(e, node)}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
      <div className="h-full flex flex-col bg-[#181818]">
      <div className="px-3 py-2.5 border-b border-[#3e3e42] bg-[#2d2d30]">
        <h2 
          draggable={true}
          className="text-[11px] font-semibold uppercase tracking-wider cursor-default select-none"
          style={{ 
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            color: 'rgb(230, 237, 243)'
          }}
        >
          Explorer
        </h2>
      </div>
      
      <div 
        className="monaco-scrollable-element flex-1"
        role="presentation"
        style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#181818' }}
      >
        <div className="overflow-y-auto h-full" style={{ backgroundColor: '#181818' }}>
          {/* Pipes Section */}
          <div className="border-b border-[#3e3e42]">
            <h3
              className="title px-3 py-1.5 cursor-pointer hover:bg-[#2a2d2e] transition-colors flex items-center gap-1.5"
              custom-hover="true"
              aria-label="Explorer Section: Pipes"
              onClick={() => toggleSection('pipes')}
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                color: 'rgb(230, 237, 243)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {sectionsExpanded.has('pipes') ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>PIPES</span>
            </h3>
            {sectionsExpanded.has('pipes') && (
              <div className="pb-1">
                {tree.map(node => renderNode(node))}
              </div>
            )}
          </div>

          {/* Connections Section */}
          <div>
            <h3
              className="title px-3 py-1.5 cursor-pointer hover:bg-[#2a2d2e] transition-colors flex items-center gap-1.5"
              custom-hover="true"
              aria-label="Explorer Section: Connections"
              onClick={() => toggleSection('connections')}
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                color: 'rgb(230, 237, 243)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {sectionsExpanded.has('connections') ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>CONNECTIONS</span>
            </h3>
            {sectionsExpanded.has('connections') && (
              <div className="pb-1 px-3 py-2 text-[13px] text-[#858585]">
                No connections
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Menu */}
      {showAddMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowAddMenu(null)}
          />
          <div
            className="fixed z-20 bg-[#252526] border border-[#3e3e42] rounded shadow-lg py-1 min-w-[160px]"
            style={{
              left: `${showAddMenu.x}px`,
              top: `${showAddMenu.y}px`,
            }}
          >
            {(() => {
              const node = findNodeById(tree, showAddMenu.nodeId)
              const options = node ? getAddOptions(node.type) : []
              return options.map(option => (
                <button
                  key={option.type}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2d2e] hover:text-[#007acc] text-[#cccccc] transition-colors"
                  onClick={() => {
                    if (node) {
                      handleAddItem(node.id, option.type)
                    }
                  }}
                >
                  {option.label}
                </button>
              ))
            })()}
          </div>
        </>
      )}
    </div>
  )
}


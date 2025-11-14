import { useState, useMemo } from 'react'
import type { Contract } from '../utils/api'

interface ContractTreeViewProps {
  contracts: Contract[]
  selectedContractId: number | null
  onSelectContract: (contractId: number | null) => void
  onNewContract: () => void
}

interface TreeNode {
  name: string
  type: 'organization' | 'department' | 'project' | 'source' | 'contract'
  children: Map<string, TreeNode>
  contractId?: number
}

export default function ContractTreeView({
  contracts,
  selectedContractId,
  onSelectContract,
  onNewContract,
}: ContractTreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Build tree structure from contracts
  const tree = useMemo(() => {
    const root: TreeNode = {
      name: 'root',
      type: 'organization',
      children: new Map(),
    }

    contracts.forEach((contract) => {
      const orgKey = `org:${contract.organization}`
      const deptKey = `dept:${contract.department}`
      const projKey = `proj:${contract.project_name}`
      const sourceKey = `source:${contract.source}`
      const contractKey = `contract:${contract.id}`

      // Organization level
      if (!root.children.has(orgKey)) {
        root.children.set(orgKey, {
          name: contract.organization,
          type: 'organization',
          children: new Map(),
        })
      }
      const orgNode = root.children.get(orgKey)!

      // Department level
      if (!orgNode.children.has(deptKey)) {
        orgNode.children.set(deptKey, {
          name: contract.department,
          type: 'department',
          children: new Map(),
        })
      }
      const deptNode = orgNode.children.get(deptKey)!

      // Project level
      if (!deptNode.children.has(projKey)) {
        deptNode.children.set(projKey, {
          name: contract.project_name,
          type: 'project',
          children: new Map(),
        })
      }
      const projNode = deptNode.children.get(projKey)!

      // Source level
      if (!projNode.children.has(sourceKey)) {
        projNode.children.set(sourceKey, {
          name: contract.source,
          type: 'source',
          children: new Map(),
        })
      }
      const sourceNode = projNode.children.get(sourceKey)!

      // Contract level
      sourceNode.children.set(contractKey, {
        name: contract.name,
        type: 'contract',
        children: new Map(),
        contractId: contract.id,
      })
    })

    return root
  }, [contracts])

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpanded(newExpanded)
  }

  const renderNode = (node: TreeNode, key: string, level: number = 0): React.ReactElement | null => {
    if (key === 'root' || node.name === 'root') {
      return (
        <div>
          {Array.from(node.children.entries()).map(([childKey, childNode]) =>
            renderNode(childNode, childKey, level + 1)
          )}
        </div>
      )
    }

    const isExpanded = expanded.has(key)
    const hasChildren = node.children.size > 0
    const indent = level * 20

    if (node.type === 'contract') {
      return (
        <div
          key={key}
          className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 ${
            selectedContractId === node.contractId ? 'bg-blue-50 border-l-4 border-blue-600' : ''
          }`}
          style={{ paddingLeft: `${indent + 20}px` }}
          onClick={() => node.contractId && onSelectContract(node.contractId)}
        >
          <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
          <span className="text-sm">{node.name}</span>
        </div>
      )
    }

    return (
      <div key={key}>
        <div
          className="flex items-center py-1 px-2 cursor-pointer hover:bg-gray-50"
          style={{ paddingLeft: `${indent}px` }}
          onClick={() => hasChildren && toggleExpanded(key)}
        >
          {hasChildren && (
            <svg
              className={`w-4 h-4 mr-2 text-gray-400 transform transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {!hasChildren && <span className="w-4 mr-2" />}
          <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            {node.type === 'organization' && (
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            )}
            {node.type === 'department' && (
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            )}
            {(node.type === 'project' || node.type === 'source') && (
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
            )}
          </svg>
          <span className="text-sm font-medium">{node.name}</span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {Array.from(node.children.entries()).map(([childKey, childNode]) =>
              renderNode(childNode, childKey, level + 1)
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col border-r border-gray-200 bg-white">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold">Contracts</h2>
        <button
          onClick={onNewContract}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {contracts.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No contracts yet. Click "New" to create one.
          </div>
        ) : (
          renderNode(tree, 'root')
        )}
      </div>
    </div>
  )
}


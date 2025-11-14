import { useState, useEffect } from 'react'
import { contractsApi, type Contract } from '../utils/api'
import ContractTreeView from '../components/ContractTreeView'
import ContractBuilder from '../components/ContractBuilder'
import ContractDetails from '../components/ContractDetails'

type ViewMode = 'list' | 'create' | 'edit' | 'view'

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filters] = useState<{
    organization?: string
    department?: string
    project_name?: string
    source?: string
  }>({})

  useEffect(() => {
    loadContracts()
  }, [filters])

  const loadContracts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await contractsApi.list(filters)
      setContracts(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleNewContract = () => {
    setSelectedContractId(null)
    setViewMode('create')
  }

  const handleSelectContract = (contractId: number | null) => {
    setSelectedContractId(contractId)
    setViewMode(contractId ? 'view' : 'list')
  }

  const handleSaveContract = async (contractData: any) => {
    try {
      if (selectedContractId) {
        await contractsApi.update(selectedContractId, contractData)
      } else {
        await contractsApi.create(contractData)
      }
      await loadContracts()
      setViewMode('list')
      setSelectedContractId(null)
    } catch (err) {
      throw err
    }
  }

  const handleDeleteContract = async () => {
    if (!selectedContractId) return
    if (!confirm('Are you sure you want to delete this contract?')) return

    try {
      await contractsApi.delete(selectedContractId)
      await loadContracts()
      setViewMode('list')
      setSelectedContractId(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleEditContract = () => {
    setViewMode('edit')
  }

  const selectedContract = contracts.find((c) => c.id === selectedContractId)

  return (
    <div className="flex" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Sidebar: Contract Tree */}
      <div className="w-64 flex-shrink-0">
        <ContractTreeView
          contracts={contracts}
          selectedContractId={selectedContractId}
          onSelectContract={handleSelectContract}
          onNewContract={handleNewContract}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'create' || viewMode === 'edit' ? (
          <ContractBuilder
            onSave={handleSaveContract}
            onCancel={() => {
              setViewMode('list')
              setSelectedContractId(null)
            }}
            initialData={selectedContract}
          />
        ) : selectedContract ? (
          <div className="p-6">
            <ContractDetails
              contract={selectedContract}
              onEdit={handleEditContract}
              onDelete={handleDeleteContract}
            />
          </div>
        ) : (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Contracts</h2>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            <div className="text-gray-500">
              Select a contract from the sidebar to view details, or click "New" to create one.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


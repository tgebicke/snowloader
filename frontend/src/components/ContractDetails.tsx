import { useState, useEffect } from 'react'
import { contractsApi, projectsApi, type Contract, type Project } from '../utils/api'

interface ContractDetailsProps {
  contract: Contract
  onEdit: () => void
  onDelete: () => void
}

export default function ContractDetails({ contract, onEdit, onDelete }: ContractDetailsProps) {
  const [previewEnvironment, setPreviewEnvironment] = useState('default')
  const [yamlPreview, setYamlPreview] = useState('')
  const [governance, setGovernance] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadYamlPreview()
    if (contract.project_id) {
      loadGovernance()
    }
  }, [contract.id, previewEnvironment])

  const loadYamlPreview = async () => {
    setLoading(true)
    try {
      const response = await contractsApi.getYaml(contract.id, previewEnvironment)
      setYamlPreview(response.yaml)
    } catch (err) {
      console.error('Failed to load YAML preview:', err)
      setYamlPreview('Error loading preview')
    } finally {
      setLoading(false)
    }
  }

  const loadGovernance = async () => {
    if (!contract.project_id) return
    try {
      const project = await projectsApi.get(contract.project_id)
      setGovernance(project as any)
    } catch (err) {
      console.error('Failed to load governance:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{contract.name}</h2>
          {contract.description && (
            <p className="text-gray-600 mt-1">{contract.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Organizational Info */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Organizational Hierarchy</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Organization:</span>
            <p className="font-medium">{contract.organization}</p>
          </div>
          <div>
            <span className="text-gray-600">Department:</span>
            <p className="font-medium">{contract.department}</p>
          </div>
          <div>
            <span className="text-gray-600">Project:</span>
            <p className="font-medium">{contract.project_name}</p>
          </div>
          <div>
            <span className="text-gray-600">Source:</span>
            <p className="font-medium">{contract.source}</p>
          </div>
        </div>
      </div>

      {/* Governance Metadata */}
      {governance?.data_governance && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="font-semibold mb-3">Data Governance</h3>
          {governance.data_governance.owners && governance.data_governance.owners.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Owners</h4>
              <ul className="text-sm text-gray-600">
                {governance.data_governance.owners.map((owner, idx) => (
                  <li key={idx}>
                    {owner.name} ({owner.email}) - {owner.role}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {governance.data_governance.stakeholders && governance.data_governance.stakeholders.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Stakeholders</h4>
              <ul className="text-sm text-gray-600">
                {governance.data_governance.stakeholders.map((stakeholder, idx) => (
                  <li key={idx}>
                    {stakeholder.name} ({stakeholder.email}) - {stakeholder.role}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {governance.data_governance.stewards && governance.data_governance.stewards.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Stewards</h4>
              <ul className="text-sm text-gray-600">
                {governance.data_governance.stewards.map((steward, idx) => (
                  <li key={idx}>
                    {steward.name} ({steward.email}) - {steward.role}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* YAML Preview */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Contract YAML</h3>
          <select
            value={previewEnvironment}
            onChange={(e) => setPreviewEnvironment(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="default">Default</option>
            <option value="dev">Dev</option>
            <option value="uat">UAT</option>
            <option value="prod">Prod</option>
          </select>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          {loading ? (
            <div className="text-gray-500">Loading preview...</div>
          ) : (
            <pre className="text-sm font-mono overflow-auto">
              <code>{yamlPreview || JSON.stringify(contract.contract_data, null, 2)}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}


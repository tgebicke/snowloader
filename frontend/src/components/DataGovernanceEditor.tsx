import { useState } from 'react'
import type { DataGovernance, DataGovernancePerson } from '../utils/api'

interface DataGovernanceEditorProps {
  governance: DataGovernance
  onChange: (governance: DataGovernance) => void
}

type GovernanceRole = 'owners' | 'stakeholders' | 'stewards'

export default function DataGovernanceEditor({ governance, onChange }: DataGovernanceEditorProps) {
  const [activeTab, setActiveTab] = useState<GovernanceRole>('owners')

  const addPerson = (role: GovernanceRole) => {
    const newPerson: DataGovernancePerson = {
      name: '',
      email: '',
      role: '',
    }
    const updated = {
      ...governance,
      [role]: [...(governance[role] || []), newPerson],
    }
    onChange(updated)
  }

  const removePerson = (role: GovernanceRole, index: number) => {
    const updated = {
      ...governance,
      [role]: (governance[role] || []).filter((_, i) => i !== index),
    }
    onChange(updated)
  }

  const updatePerson = (role: GovernanceRole, index: number, field: keyof DataGovernancePerson, value: string) => {
    const updated = { ...governance }
    if (!updated[role]) {
      updated[role] = []
    }
    updated[role] = [...(updated[role] || [])]
    updated[role]![index] = { ...updated[role]![index], [field]: value }
    onChange(updated)
  }

  const roles: { key: GovernanceRole; label: string; description: string }[] = [
    { key: 'owners', label: 'Owners', description: 'Data owners responsible for the data' },
    { key: 'stakeholders', label: 'Stakeholders', description: 'Business stakeholders with interest in the data' },
    { key: 'stewards', label: 'Stewards', description: 'Data stewards managing data quality and governance' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Data Governance</h3>
      </div>

      {/* Role Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4">
          {roles.map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() => setActiveTab(role.key)}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === role.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {role.label}
              <span className="ml-2 text-xs text-gray-400">
                ({(governance[role.key] || []).length})
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Active Role Editor */}
      <div className="pt-4">
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">{roles.find((r) => r.key === activeTab)?.description}</p>
          <button
            type="button"
            onClick={() => addPerson(activeTab)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            + Add {roles.find((r) => r.key === activeTab)?.label.slice(0, -1)}
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(governance[activeTab] || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No {roles.find((r) => r.key === activeTab)?.label.toLowerCase()} defined.
                  </td>
                </tr>
              ) : (
                (governance[activeTab] || []).map((person, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="text"
                        value={person.name}
                        onChange={(e) => updatePerson(activeTab, index, 'name', e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="email"
                        value={person.email}
                        onChange={(e) => updatePerson(activeTab, index, 'email', e.target.value)}
                        placeholder="john.doe@example.com"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="text"
                        value={person.role}
                        onChange={(e) => updatePerson(activeTab, index, 'role', e.target.value)}
                        placeholder="Data Owner"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => removePerson(activeTab, index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


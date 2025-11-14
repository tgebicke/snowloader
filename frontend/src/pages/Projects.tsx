import { useState, useEffect } from 'react'
import { projectsApi, type Project, type ProjectCreateData } from '../utils/api'
import DataGovernanceEditor from '../components/DataGovernanceEditor'

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  // Filters
  const [organizationFilter, setOrganizationFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')

  // Form state
  const [formData, setFormData] = useState<ProjectCreateData>({
    organization: '',
    department: '',
    project: '',
    data_governance: {
      owners: [],
      stakeholders: [],
      stewards: [],
    },
  })

  useEffect(() => {
    loadProjects()
  }, [organizationFilter, departmentFilter])

  const loadProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await projectsApi.list(organizationFilter || undefined, departmentFilter || undefined)
      setProjects(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.organization || !formData.department || !formData.project) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await projectsApi.create(formData)
      await loadProjects()
      setShowCreateForm(false)
      resetForm()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingProject) return

    setLoading(true)
    setError(null)

    try {
      await projectsApi.update(editingProject.id, formData)
      await loadProjects()
      setEditingProject(null)
      resetForm()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setFormData({
      organization: project.organization,
      department: project.department,
      project: project.project,
      data_governance: project.data_governance || {
        owners: [],
        stakeholders: [],
        stewards: [],
      },
    })
    setShowCreateForm(true)
  }

  const handleDelete = async (_projectId: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      // Note: Delete endpoint not in plan, but we can add it if needed
      setError('Delete functionality not yet implemented')
    } catch (err) {
      setError((err as Error).message)
    }
  }


  const resetForm = () => {
    setFormData({
      organization: '',
      department: '',
      project: '',
      data_governance: {
        owners: [],
        stakeholders: [],
        stewards: [],
      },
    })
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingProject(null)
    resetForm()
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Projects</h2>
        <button
          onClick={() => {
            setShowCreateForm(true)
            setEditingProject(null)
            resetForm()
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          + New Project
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {showCreateForm ? (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingProject ? 'Edit Project' : 'Create New Project'}
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.project}
                  onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <DataGovernanceEditor
              governance={formData.data_governance || { owners: [], stakeholders: [], stewards: [] }}
              onChange={(governance) => setFormData({ ...formData, data_governance: governance })}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingProject ? handleUpdate : handleCreate}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingProject ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white shadow rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Organization
                </label>
                <input
                  type="text"
                  value={organizationFilter}
                  onChange={(e) => setOrganizationFilter(e.target.value)}
                  placeholder="Organization name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Department
                </label>
                <input
                  type="text"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  placeholder="Department name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Projects List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
              No projects found. Click "New Project" to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="bg-white shadow rounded-lg p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {project.organization} / {project.department} / {project.project}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Created: {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(project)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {project.data_governance && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Data Governance</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Owners:</span>{' '}
                          <span className="font-medium">
                            {project.data_governance.owners?.length || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Stakeholders:</span>{' '}
                          <span className="font-medium">
                            {project.data_governance.stakeholders?.length || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Stewards:</span>{' '}
                          <span className="font-medium">
                            {project.data_governance.stewards?.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}


import { useState, useEffect } from 'react'
import { connectionsApi, type Connection, type ConnectionDetail, type S3ConnectionData, type SnowflakeConnectionData } from '../utils/api'
import S3ConnectionForm from '../components/S3ConnectionForm'
import SnowflakeConnectionForm from '../components/SnowflakeConnectionForm'

export default function Connections() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'s3' | 'snowflake'>('s3')
  const [showForm, setShowForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionDetail | null>(null)
  const [viewingConnection, setViewingConnection] = useState<ConnectionDetail | null>(null)

  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const data = await connectionsApi.list()
      setConnections(data)
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this connection?')) return
    
    try {
      await connectionsApi.delete(id)
      loadConnections()
    } catch (error) {
      alert('Failed to delete connection: ' + (error as Error).message)
    }
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingConnection(null)
    loadConnections()
  }

  const handleView = async (id: number) => {
    try {
      const connection = await connectionsApi.get(id)
      setViewingConnection(connection)
    } catch (error) {
      alert('Failed to load connection details: ' + (error as Error).message)
    }
  }

  const handleEdit = async (id: number) => {
    try {
      const connection = await connectionsApi.get(id)
      setEditingConnection(connection)
      setActiveTab(connection.type.toLowerCase() as 's3' | 'snowflake')
      setShowForm(true)
    } catch (error) {
      alert('Failed to load connection details: ' + (error as Error).message)
    }
  }

  const getInitialData = (connection: ConnectionDetail): S3ConnectionData | SnowflakeConnectionData | undefined => {
    if (connection.type.toLowerCase() === 's3') {
      return {
        name: connection.name,
        access_key_id: connection.credentials.access_key_id || '',
        secret_access_key: connection.credentials.secret_access_key || '',
        region: connection.credentials.region || 'us-east-1',
      }
    } else if (connection.type.toLowerCase() === 'snowflake') {
      return {
        name: connection.name,
        account: connection.credentials.account || '',
        user: connection.credentials.user || '',
        password: connection.credentials.password || '',
        role: connection.credentials.role || '',
      }
    }
    return undefined
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Connections</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'New Connection'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {editingConnection ? 'Edit Connection' : 'New Connection'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false)
                setEditingConnection(null)
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {!editingConnection && (
            <div className="border-b border-gray-200 mb-4">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('s3')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 's3'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  S3 Connection
                </button>
                <button
                  onClick={() => setActiveTab('snowflake')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'snowflake'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Snowflake Connection
                </button>
              </nav>
            </div>
          )}

          {activeTab === 's3' ? (
            <S3ConnectionForm
              onSuccess={handleFormSuccess}
              connectionId={editingConnection?.id}
              initialData={editingConnection ? getInitialData(editingConnection) as S3ConnectionData : undefined}
            />
          ) : (
            <SnowflakeConnectionForm
              onSuccess={handleFormSuccess}
              connectionId={editingConnection?.id}
              initialData={editingConnection ? getInitialData(editingConnection) as SnowflakeConnectionData : undefined}
            />
          )}
        </div>
      )}

      {viewingConnection && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={() => setViewingConnection(null)}>
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Connection Details</h3>
              <button
                onClick={() => setViewingConnection(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">{viewingConnection.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <p className="mt-1 text-sm text-gray-900">{viewingConnection.type.toUpperCase()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <p className="mt-1 text-sm text-gray-900">{new Date(viewingConnection.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Credentials</label>
                <div className="bg-gray-50 p-4 rounded-md">
                  {viewingConnection.type.toLowerCase() === 's3' ? (
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Access Key ID</dt>
                        <dd className="mt-1 text-sm text-gray-900 font-mono">{viewingConnection.credentials.access_key_id}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Secret Access Key</dt>
                        <dd className="mt-1 text-sm text-gray-900 font-mono">••••••••••••••••</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Region</dt>
                        <dd className="mt-1 text-sm text-gray-900">{viewingConnection.credentials.region}</dd>
                      </div>
                    </dl>
                  ) : (
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Account</dt>
                        <dd className="mt-1 text-sm text-gray-900">{viewingConnection.credentials.account}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">User</dt>
                        <dd className="mt-1 text-sm text-gray-900">{viewingConnection.credentials.user}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Password</dt>
                        <dd className="mt-1 text-sm text-gray-900 font-mono">••••••••••••••••</dd>
                      </div>
                      {viewingConnection.credentials.role && (
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Role</dt>
                          <dd className="mt-1 text-sm text-gray-900">{viewingConnection.credentials.role}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setViewingConnection(null)
                    handleEdit(viewingConnection.id)
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => setViewingConnection(null)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {connections.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No connections yet. Create one to get started.
                </td>
              </tr>
            ) : (
              connections.map((conn) => (
                <tr key={conn.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {conn.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {conn.type.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(conn.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleView(conn.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(conn.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(conn.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


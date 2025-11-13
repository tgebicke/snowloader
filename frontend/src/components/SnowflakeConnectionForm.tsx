import { useState } from 'react'
import { connectionsApi, type SnowflakeConnectionData } from '../utils/api'

interface SnowflakeConnectionFormProps {
  onSuccess: () => void
  connectionId?: number
  initialData?: SnowflakeConnectionData
}

export default function SnowflakeConnectionForm({ onSuccess, connectionId, initialData }: SnowflakeConnectionFormProps) {
  const [formData, setFormData] = useState<SnowflakeConnectionData>(
    initialData || {
      name: '',
      account: '',
      user: '',
      password: '',
      role: '',
    }
  )
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testSuccess, setTestSuccess] = useState<string | null>(null)

  const handleTestConnection = async () => {
    // Validate required fields for testing
    if (!formData.account || !formData.user || !formData.password) {
      setError('Please fill in all required fields before testing')
      setTestSuccess(null)
      return
    }

    setTesting(true)
    setError(null)
    setTestSuccess(null)

    try {
      await connectionsApi.testSnowflake(formData)
      setTestSuccess('Connection test successful!')
      setError(null)
    } catch (err) {
      setError((err as Error).message)
      setTestSuccess(null)
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setTestSuccess(null)

    try {
      if (connectionId) {
        await connectionsApi.updateSnowflake(connectionId, formData)
      } else {
        await connectionsApi.createSnowflake(formData)
      }
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {testSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {testSuccess}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Connection Name
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account
          </label>
          <input
            type="text"
            required
            value={formData.account}
            onChange={(e) => setFormData({ ...formData, account: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            User
          </label>
          <input
            type="text"
            required
            value={formData.user}
            onChange={(e) => setFormData({ ...formData, user: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          type="password"
          required
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Role <span className="text-gray-500 text-xs">(optional)</span>
        </label>
        <input
          type="text"
          value={formData.role || ''}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          placeholder="Leave empty to use default role"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional: Specify a Snowflake role to use for this connection
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing || loading}
          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          type="submit"
          disabled={loading || testing}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (connectionId ? 'Updating...' : 'Creating...') : (connectionId ? 'Update Connection' : 'Create Connection')}
        </button>
      </div>
    </form>
  )
}


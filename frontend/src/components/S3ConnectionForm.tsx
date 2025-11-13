import { useState } from 'react'
import { connectionsApi, type S3ConnectionData } from '../utils/api'

interface S3ConnectionFormProps {
  onSuccess: () => void
  connectionId?: number
  initialData?: S3ConnectionData
}

export default function S3ConnectionForm({ onSuccess, connectionId, initialData }: S3ConnectionFormProps) {
  const [formData, setFormData] = useState<S3ConnectionData>(
    initialData || {
      name: '',
      access_key_id: '',
      secret_access_key: '',
      region: 'us-east-1',
    }
  )
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testSuccess, setTestSuccess] = useState<string | null>(null)

  const handleTestConnection = async () => {
    // Validate required fields for testing
    if (!formData.access_key_id || !formData.secret_access_key || !formData.region) {
      setError('Please fill in all required fields before testing')
      setTestSuccess(null)
      return
    }

    setTesting(true)
    setError(null)
    setTestSuccess(null)

    try {
      await connectionsApi.testS3(formData)
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
        await connectionsApi.updateS3(connectionId, formData)
      } else {
        await connectionsApi.createS3(formData)
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Access Key ID
        </label>
        <input
          type="text"
          required
          value={formData.access_key_id}
          onChange={(e) => setFormData({ ...formData, access_key_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Secret Access Key
        </label>
        <input
          type="password"
          required
          value={formData.secret_access_key}
          onChange={(e) => setFormData({ ...formData, secret_access_key: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Region
        </label>
        <input
          type="text"
          required
          value={formData.region}
          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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


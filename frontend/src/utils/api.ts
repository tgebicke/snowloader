const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Legacy API functions - use useApi hook in components instead
// This is kept for backward compatibility but components should use useApi hook
async function getAuthHeaders(): Promise<HeadersInit> {
  // Try to get Clerk from window (set by ClerkProvider)
  const clerk = (window as any).Clerk
  let token = ''
  
  if (clerk?.session) {
    try {
      token = await clerk.session.getToken() || ''
    } catch (error) {
      console.error('Failed to get Clerk token:', error)
    }
  }
  
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }))
    throw new Error(error.detail || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

export interface ConnectionDetail extends Connection {
  credentials: Record<string, any>
}

// Connection APIs
export const connectionsApi = {
  list: () => apiRequest<Connection[]>('/api/connections'),
  get: (id: number) => apiRequest<ConnectionDetail>('/api/connections/' + id),
  createS3: (data: S3ConnectionData) => apiRequest<Connection>('/api/connections/s3', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createSnowflake: (data: SnowflakeConnectionData) => apiRequest<Connection>('/api/connections/snowflake', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateS3: (id: number, data: S3ConnectionData) => apiRequest<Connection>('/api/connections/' + id + '/s3', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  updateSnowflake: (id: number, data: SnowflakeConnectionData) => apiRequest<Connection>('/api/connections/' + id + '/snowflake', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  testS3: (data: S3ConnectionData) => apiRequest<{ status: string; message: string }>('/api/connections/s3/test', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  testSnowflake: (data: SnowflakeConnectionData) => apiRequest<{ status: string; message: string }>('/api/connections/snowflake/test', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  delete: (id: number) => apiRequest('/api/connections/' + id, { method: 'DELETE' }),
  getDatabases: (connectionId: number) => apiRequest<{ databases: string[] }>('/api/connections/' + connectionId + '/databases'),
  getSchemas: (connectionId: number, database?: string) => {
    const params = database ? '?database=' + encodeURIComponent(database) : ''
    return apiRequest<{ schemas: string[] }>('/api/connections/' + connectionId + '/schemas' + params)
  },
  getBuckets: (connectionId: number) => apiRequest<{ buckets: string[] }>('/api/connections/' + connectionId + '/buckets'),
}

// S3 APIs
export const s3Api = {
  list: (connectionId: number, bucket: string, prefix: string = '') => apiRequest<S3File[]>('/api/s3/list', {
    method: 'POST',
    body: JSON.stringify({ connection_id: connectionId, bucket, prefix }),
  }),
  preview: (connectionId: number, bucket: string, key: string, lines: number = 10) => apiRequest<{ lines: string[] }>('/api/s3/preview', {
    method: 'POST',
    body: JSON.stringify({ connection_id: connectionId, bucket, key, lines }),
  }),
}

// Pipeline APIs
export const pipelinesApi = {
  list: () => apiRequest<Pipeline[]>('/api/pipelines'),
  get: (id: number) => apiRequest<Pipeline>(`/api/pipelines/${id}`),
  create: (data: PipelineCreateData) => apiRequest<Pipeline>('/api/pipelines', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  run: (id: number) => apiRequest('/api/pipelines/' + id + '/run', { method: 'POST' }),
  getRuns: (id: number) => apiRequest<PipelineRun[]>(`/api/pipelines/${id}/runs`),
}

// Types
export interface Connection {
  id: number
  name: string
  type: string
  created_at: string
}

export interface S3ConnectionData {
  name: string
  access_key_id: string
  secret_access_key: string
  region: string
}

export interface SnowflakeConnectionData {
  name: string
  account: string
  user: string
  password: string
  role?: string
}

export interface S3File {
  key: string
  size: number
  last_modified: string
}

export interface Pipeline {
  id: number
  name: string
  ingestion_type: string
  status: string
  target_database: string
  target_schema: string
  target_table: string
  created_at: string
}

export interface PipelineCreateData {
  name: string
  ingestion_type: string
  s3_connection_id: number
  s3_bucket: string
  snowflake_connection_id: number
  s3_path: string
  target_database: string
  target_schema: string
  target_table?: string  // Optional - will be auto-generated if not provided
  file_format?: string  // Optional - will be auto-detected from file extension
  copy_options?: Record<string, any>  // Advanced copy options
}

export interface PipelineRun {
  id: number
  status: string
  started_at: string
  completed_at: string | null
  error_message: string | null
  rows_loaded: number | null
}


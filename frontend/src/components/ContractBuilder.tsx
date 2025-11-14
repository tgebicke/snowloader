import { useState, useEffect, useMemo } from 'react'
import { connectionsApi, s3Api, contractsApi, projectsApi, type Connection, type S3File, type Project, type ColumnSchema } from '../utils/api'
import SchemaEditor from './SchemaEditor'
import EnvironmentConfigEditor from './EnvironmentConfigEditor'

interface ContractBuilderProps {
  onSave: (contractData: any) => void
  onCancel: () => void
  initialData?: any // eslint-disable-line @typescript-eslint/no-unused-vars
}

export default function ContractBuilder({ onSave, onCancel }: ContractBuilderProps) {
  // Organizational hierarchy
  const [organization, setOrganization] = useState('')
  const [department, setDepartment] = useState('')
  const [projectName, setProjectName] = useState('')
  const [source, setSource] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  // Contract metadata
  const [contractName, setContractName] = useState('')
  const [description, setDescription] = useState('')

  // Source configuration
  const [s3Path, setS3Path] = useState('')
  const [sampleFile, setSampleFile] = useState('')
  const [selectedS3Connection, setSelectedS3Connection] = useState<number | null>(null)
  const [selectedBucket, setSelectedBucket] = useState('')
  const [buckets, setBuckets] = useState<string[]>([])
  const [s3Files, setS3Files] = useState<S3File[]>([])
  const [loadingBuckets, setLoadingBuckets] = useState(false)

  // Target configuration
  const [targetTable, setTargetTable] = useState('')

  // Schema
  const [schema, setSchema] = useState<ColumnSchema[]>([])

  // Ingestion
  const [ingestionType, setIngestionType] = useState<'one_time' | 'snowpipe'>('snowpipe')
  const [fileFormat, setFileFormat] = useState<'CSV' | 'JSON' | 'PARQUET'>('JSON')
  const [copyOptions] = useState<Record<string, any>>({})

  // Environment configs
  const [envConfigs, setEnvConfigs] = useState<any>({
    default: {
      source: { connection_name: '', bucket: '' },
      target: { connection_name: '', database: '', schema: '' },
    },
  })

  // Connections and projects
  const [connections, setConnections] = useState<Connection[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectingSchema, setDetectingSchema] = useState(false)

  // YAML preview environment selector
  const [previewEnvironment, setPreviewEnvironment] = useState('default')

  useEffect(() => {
    loadConnections()
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedS3Connection) {
      loadBuckets()
    }
  }, [selectedS3Connection])

  useEffect(() => {
    if (selectedS3Connection && selectedBucket) {
      loadS3Files()
    }
  }, [selectedS3Connection, selectedBucket])

  const loadBuckets = async () => {
    if (!selectedS3Connection) return
    setLoadingBuckets(true)
    try {
      const response = await connectionsApi.getBuckets(selectedS3Connection)
      setBuckets(response.buckets || [])
    } catch (err) {
      console.error('Failed to load buckets:', err)
      setBuckets([])
    } finally {
      setLoadingBuckets(false)
    }
  }

  const loadConnections = async () => {
    try {
      const conns = await connectionsApi.list()
      setConnections(conns)
    } catch (err) {
      console.error('Failed to load connections:', err)
    }
  }

  const loadProjects = async () => {
    try {
      const projs = await projectsApi.list()
      setProjects(projs)
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  }

  const loadS3Files = async () => {
    if (!selectedS3Connection || !selectedBucket) return
    try {
      const files = await s3Api.list(selectedS3Connection, selectedBucket, '')
      setS3Files(files)
    } catch (err) {
      console.error('Failed to load S3 files:', err)
    }
  }

  const handleDetectSchema = async () => {
    if (!selectedS3Connection || !selectedBucket || !sampleFile) {
      setError('Please select connection, bucket, and sample file')
      return
    }

    setDetectingSchema(true)
    setError(null)

    try {
      const detectedFormat = sampleFile.toLowerCase().endsWith('.json') ? 'JSON' :
                            sampleFile.toLowerCase().endsWith('.csv') ? 'CSV' : 'PARQUET'
      
      const response = await contractsApi.detectSchema({
        connection_id: selectedS3Connection,
        bucket: selectedBucket,
        sample_file: sampleFile,
        file_format: detectedFormat,
      })
      
      setSchema(response.schema)
      setFileFormat(detectedFormat as 'CSV' | 'JSON' | 'PARQUET')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDetectingSchema(false)
    }
  }

  // Generate YAML from form state
  const generateYaml = useMemo(() => {
    const contract: any = {
      version: '1.0',
      metadata: {
        name: contractName || 'untitled-contract',
        description: description || '',
        created_at: new Date().toISOString(),
        project_id: selectedProjectId || undefined,
      },
      source: {
        type: 's3',
        path: s3Path,
        ...(sampleFile && { sample_file: sampleFile }),
        default: {
          connection_name: envConfigs.default?.source?.connection_name || '',
          bucket: envConfigs.default?.source?.bucket || '',
        },
      },
      target: {
        table: targetTable,
        default: {
          connection_name: envConfigs.default?.target?.connection_name || '',
          database: envConfigs.default?.target?.database || '',
          schema: envConfigs.default?.target?.schema || '',
        },
      },
      schema: schema,
      ingestion: {
        type: ingestionType,
        file_format: fileFormat,
        ...(Object.keys(copyOptions).length > 0 && { copy_options: copyOptions }),
      },
    }

    // Add environment-specific configs
    if (envConfigs.dev) {
      contract.source.dev = envConfigs.dev.source
      contract.target.dev = envConfigs.dev.target
    }
    if (envConfigs.uat) {
      contract.source.uat = envConfigs.uat.source
      contract.target.uat = envConfigs.uat.target
    }
    if (envConfigs.prod) {
      contract.source.prod = envConfigs.prod.source
      contract.target.prod = envConfigs.prod.target
    }

    // Convert to YAML string (simple formatting)
    return JSON.stringify(contract, null, 2) // Using JSON for now, can enhance with js-yaml later
  }, [
    contractName,
    description,
    selectedProjectId,
    s3Path,
    sampleFile,
    targetTable,
    schema,
    ingestionType,
    fileFormat,
    copyOptions,
    envConfigs,
  ])

  const handleSave = async () => {
    if (!contractName || !organization || !department || !projectName || !source) {
      setError('Please fill in all required fields')
      return
    }

    if (!envConfigs.default?.source?.connection_name || !envConfigs.default?.target?.connection_name) {
      setError('Please configure at least the default environment')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const contractData = JSON.parse(generateYaml)
      await onSave({
        name: contractName,
        description,
        organization,
        department,
        project_name: projectName,
        source,
        project_id: selectedProjectId || undefined,
        contract_data: contractData,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const sourceConnections = connections.filter((c) => c.type === 's3')
  const targetConnections = connections.filter((c) => c.type === 'snowflake')

  return (
    <div className="flex" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Left side: Form */}
      <div className="w-1/2 overflow-y-auto p-6 border-r border-gray-200">
        <h2 className="text-2xl font-bold mb-6">Create Ingestion Contract</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Contract Metadata */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contract Information</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contract Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Organizational Hierarchy */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Organizational Hierarchy</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => {
                    const projectId = e.target.value ? parseInt(e.target.value) : null
                    setSelectedProjectId(projectId)
                    const project = projects.find((p) => p.id === projectId)
                    if (project) {
                      setProjectName(project.project)
                      setOrganization(project.organization)
                      setDepartment(project.department)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select or enter project name...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.organization}/{p.department}/{p.project}
                    </option>
                  ))}
                </select>
                {!selectedProjectId && (
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Or enter project name"
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Source Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Source Configuration</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                S3 Path <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={s3Path}
                onChange={(e) => setS3Path(e.target.value)}
                placeholder="events/user-events/"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sample File (for schema detection)
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedS3Connection || ''}
                  onChange={(e) => setSelectedS3Connection(e.target.value ? parseInt(e.target.value) : null)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select S3 connection...</option>
                  {sourceConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {selectedS3Connection && (
                  <select
                    value={selectedBucket}
                    onChange={(e) => setSelectedBucket(e.target.value)}
                    disabled={loadingBuckets}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">{loadingBuckets ? 'Loading buckets...' : 'Select bucket...'}</option>
                    {buckets.map((bucket) => (
                      <option key={bucket} value={bucket}>
                        {bucket}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {selectedS3Connection && selectedBucket && (
                <div className="mt-2">
                  <select
                    value={sampleFile}
                    onChange={(e) => setSampleFile(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select sample file...</option>
                    {s3Files.map((file) => (
                      <option key={file.key} value={file.key}>
                        {file.key}
                      </option>
                    ))}
                  </select>
                  {sampleFile && (
                    <button
                      type="button"
                      onClick={handleDetectSchema}
                      disabled={detectingSchema}
                      className="mt-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {detectingSchema ? 'Detecting...' : 'Detect Schema'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Target Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Target Configuration</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Table Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Schema Editor */}
          <SchemaEditor schema={schema} onChange={setSchema} />

          {/* Ingestion Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Ingestion Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingestion Type
                </label>
                <select
                  value={ingestionType}
                  onChange={(e) => setIngestionType(e.target.value as 'one_time' | 'snowpipe')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="one_time">One-Time</option>
                  <option value="snowpipe">Snowpipe (Continuous)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Format
                </label>
                <select
                  value={fileFormat}
                  onChange={(e) => setFileFormat(e.target.value as 'CSV' | 'JSON' | 'PARQUET')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CSV">CSV</option>
                  <option value="JSON">JSON</option>
                  <option value="PARQUET">Parquet</option>
                </select>
              </div>
            </div>
          </div>

          {/* Environment Configuration */}
          <EnvironmentConfigEditor
            sourceConnections={sourceConnections}
            targetConnections={targetConnections}
            configs={envConfigs}
            onChange={setEnvConfigs}
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Contract'}
            </button>
          </div>
        </div>
      </div>

      {/* Right side: YAML Preview */}
      <div className="w-1/2 border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold">Contract YAML Preview</h3>
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
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-sm font-mono bg-gray-50 p-4 rounded border border-gray-200 overflow-auto">
            <code>{generateYaml}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}


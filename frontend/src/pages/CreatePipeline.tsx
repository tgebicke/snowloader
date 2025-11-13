import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectionsApi, s3Api, pipelinesApi, type Connection, type S3File, type PipelineCreateData } from '../utils/api'

export default function CreatePipeline() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Ingestion type
  const [ingestionType, setIngestionType] = useState<'one_time' | 'snowpipe'>('one_time')

  // Step 2: Connections
  const [s3Connections, setS3Connections] = useState<Connection[]>([])
  const [snowflakeConnections, setSnowflakeConnections] = useState<Connection[]>([])
  const [selectedS3Connection, setSelectedS3Connection] = useState<number | null>(null)
  const [selectedSnowflakeConnection, setSelectedSnowflakeConnection] = useState<number | null>(null)
  const [buckets, setBuckets] = useState<string[]>([])
  const [selectedBucket, setSelectedBucket] = useState<string>('')
  const [bucketSearch, setBucketSearch] = useState<string>('')
  const [showBucketDropdown, setShowBucketDropdown] = useState(false)
  const [loadingBuckets, setLoadingBuckets] = useState(false)

  // Step 3: S3 files/path
  const [s3Files, setS3Files] = useState<S3File[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [s3Prefix, setS3Prefix] = useState('')

  // Step 4: Target configuration
  const [targetDatabase, setTargetDatabase] = useState('')
  const [targetSchema, setTargetSchema] = useState('')
  const [targetTable, setTargetTable] = useState('')
  const [pipelineName, setPipelineName] = useState('')
  const [detectedFileFormat, setDetectedFileFormat] = useState<string>('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [fileType, setFileType] = useState<string>('')
  const [copyOptions, setCopyOptions] = useState<Record<string, any>>({})
  const [databases, setDatabases] = useState<string[]>([])
  const [schemas, setSchemas] = useState<string[]>([])
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [loadingSchemas, setLoadingSchemas] = useState(false)

  useEffect(() => {
    loadConnections()
  }, [])

  useEffect(() => {
    if (selectedS3Connection && step >= 2) {
      loadBuckets()
    } else {
      setBuckets([])
      setSelectedBucket('')
      setBucketSearch('')
    }
  }, [selectedS3Connection, step])

  useEffect(() => {
    if (selectedS3Connection && selectedBucket && step === 3) {
      loadS3Files()
    }
  }, [selectedS3Connection, selectedBucket, step])

  useEffect(() => {
    // Auto-detect file format when file is selected
    if (selectedFile) {
      const ext = selectedFile.toLowerCase().split('.').pop()
      let format = 'CSV' // Default
      if (ext === 'json' || ext === 'jsonl') {
        format = 'JSON'
      } else if (ext === 'csv') {
        format = 'CSV'
      } else if (ext === 'parquet') {
        format = 'PARQUET'
      }
      setDetectedFileFormat(format)
      setFileType(format) // Also set file type for advanced options
    }
  }, [selectedFile])

  // Load databases when Snowflake connection is selected
  useEffect(() => {
    if (selectedSnowflakeConnection && step >= 4) {
      loadDatabases()
    }
  }, [selectedSnowflakeConnection, step])

  // Load schemas when database is selected
  useEffect(() => {
    if (selectedSnowflakeConnection && targetDatabase && step >= 4) {
      loadSchemas(targetDatabase)
    } else {
      setSchemas([])
      setTargetSchema('')
    }
  }, [selectedSnowflakeConnection, targetDatabase, step])

  const loadDatabases = async () => {
    if (!selectedSnowflakeConnection) return
    setLoadingDatabases(true)
    try {
      const response = await connectionsApi.getDatabases(selectedSnowflakeConnection)
      setDatabases(response.databases || [])
    } catch (error) {
      console.error('Failed to load databases:', error)
      setDatabases([])
    } finally {
      setLoadingDatabases(false)
    }
  }

  const loadSchemas = async (database: string) => {
    if (!selectedSnowflakeConnection || !database) return
    setLoadingSchemas(true)
    try {
      const response = await connectionsApi.getSchemas(selectedSnowflakeConnection, database)
      setSchemas(response.schemas || [])
    } catch (error) {
      console.error('Failed to load schemas:', error)
      setSchemas([])
    } finally {
      setLoadingSchemas(false)
    }
  }

  const loadConnections = async () => {
    try {
      const connections = await connectionsApi.list()
      setS3Connections(connections.filter(c => c.type === 's3'))
      setSnowflakeConnections(connections.filter(c => c.type === 'snowflake'))
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  const loadBuckets = async () => {
    if (!selectedS3Connection) return
    setLoadingBuckets(true)
    try {
      const response = await connectionsApi.getBuckets(selectedS3Connection)
      setBuckets(response.buckets || [])
    } catch (error) {
      console.error('Failed to load buckets:', error)
      setBuckets([])
    } finally {
      setLoadingBuckets(false)
    }
  }

  const loadS3Files = async () => {
    if (!selectedS3Connection || !selectedBucket) return
    try {
      const files = await s3Api.list(selectedS3Connection, selectedBucket, '')
      setS3Files(files)
    } catch (error) {
      console.error('Failed to load S3 files:', error)
    }
  }

  // Filter buckets based on search
  const filteredBuckets = buckets.filter(bucket =>
    bucket.toLowerCase().includes(bucketSearch.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!selectedS3Connection || !selectedSnowflakeConnection) {
      setError('Please select both S3 and Snowflake connections')
      return
    }

    if (!selectedBucket) {
      setError('Please select a bucket')
      return
    }

    if (ingestionType === 'one_time' && !selectedFile) {
      setError('Please select a file for one-time ingestion')
      return
    }

    if (ingestionType === 'snowpipe' && !s3Prefix) {
      setError('Please enter an S3 prefix/path for Snowpipe')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const pipelineData: PipelineCreateData = {
        name: pipelineName || `Pipeline_${Date.now()}`,
        ingestion_type: ingestionType,
        s3_connection_id: selectedS3Connection,
        s3_bucket: selectedBucket,
        snowflake_connection_id: selectedSnowflakeConnection,
        s3_path: ingestionType === 'one_time' ? selectedFile! : s3Prefix,
        target_database: targetDatabase,
        target_schema: targetSchema,
        target_table: targetTable || undefined, // Send undefined if empty to trigger auto-generation
        file_format: fileType || detectedFileFormat || undefined, // Use selected file type or auto-detect
        copy_options: Object.keys(copyOptions).length > 0 ? copyOptions : undefined,
      }

      await pipelinesApi.create(pipelineData)
      navigate('/pipelines')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return ingestionType !== null
      case 2:
        return selectedS3Connection !== null && selectedSnowflakeConnection !== null && selectedBucket !== ''
      case 3:
        if (ingestionType === 'one_time') {
          return selectedFile !== null
        } else {
          return s3Prefix.trim() !== ''
        }
      case 4:
        return targetDatabase.trim() !== '' && targetSchema.trim() !== ''
      default:
        return false
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Pipeline</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                  {s}
                </div>
                {s < 4 && (
                  <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>Type</span>
            <span>Connections</span>
            <span>{ingestionType === 'one_time' ? 'File' : 'Path'}</span>
            <span>Target</span>
          </div>
        </div>

        {/* Step 1: Ingestion Type */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Select Ingestion Type</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIngestionType('one_time')}
                className={`p-6 border-2 rounded-lg text-left ${ingestionType === 'one_time'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <h4 className="font-semibold mb-2">One-Time Ingestion</h4>
                <p className="text-sm text-gray-600">Load a specific file into Snowflake once</p>
              </button>
              <button
                onClick={() => setIngestionType('snowpipe')}
                className={`p-6 border-2 rounded-lg text-left ${ingestionType === 'snowpipe'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <h4 className="font-semibold mb-2">Continuous Ingestion (Snowpipe)</h4>
                <p className="text-sm text-gray-600">Automatically ingest files as they arrive in S3</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Connections */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Select Connections</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                S3 Connection
              </label>
              <select
                value={selectedS3Connection || ''}
                onChange={(e) => {
                  setSelectedS3Connection(Number(e.target.value))
                  setSelectedBucket('') // Reset bucket when connection changes
                  setBucketSearch('')
                  setShowBucketDropdown(false)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select S3 connection...</option>
                {s3Connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedS3Connection && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bucket <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedBucket || bucketSearch}
                    onChange={(e) => {
                      const value = e.target.value
                      setBucketSearch(value)
                      setShowBucketDropdown(true)
                      // Clear selection if user is typing something different
                      if (selectedBucket && value !== selectedBucket) {
                        setSelectedBucket('')
                      }
                    }}
                    onFocus={() => {
                      setShowBucketDropdown(true)
                      // When focusing with a selected bucket, allow editing
                      if (selectedBucket) {
                        setBucketSearch(selectedBucket)
                        setSelectedBucket('')
                      } else if (!bucketSearch && buckets.length > 0) {
                        // Show all buckets when focusing on empty input
                        setBucketSearch('')
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding dropdown to allow click events
                      setTimeout(() => setShowBucketDropdown(false), 200)
                    }}
                    placeholder={loadingBuckets ? 'Loading buckets...' : 'Type to search buckets...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loadingBuckets}
                  />
                  {showBucketDropdown && !selectedBucket && filteredBuckets.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredBuckets.map((bucket) => (
                        <button
                          key={bucket}
                          type="button"
                          onClick={() => {
                            setSelectedBucket(bucket)
                            setBucketSearch('')
                            setShowBucketDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50"
                        >
                          {bucket}
                        </button>
                      ))}
                    </div>
                  )}
                  {showBucketDropdown && !selectedBucket && bucketSearch && filteredBuckets.length === 0 && buckets.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-sm text-gray-500">
                      No buckets found matching "{bucketSearch}"
                    </div>
                  )}
                </div>
                {selectedBucket && (
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-green-600">
                      Selected: <strong>{selectedBucket}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBucket('')
                        setBucketSearch('')
                      }}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {!loadingBuckets && buckets.length === 0 && selectedS3Connection && (
                  <p className="mt-1 text-xs text-gray-500">
                    No buckets found for this connection
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Snowflake Connection
              </label>
              <select
                value={selectedSnowflakeConnection || ''}
                onChange={(e) => setSelectedSnowflakeConnection(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Snowflake connection...</option>
                {snowflakeConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 3: S3 File/Path */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              {ingestionType === 'one_time' ? 'Select File' : 'Configure S3 Path'}
            </h3>
            {ingestionType === 'one_time' ? (
              <div>
                <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                  {s3Files.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No files found</div>
                  ) : (
                    <div className="divide-y">
                      {s3Files.map((file) => (
                        <button
                          key={file.key}
                          onClick={() => setSelectedFile(file.key)}
                          className={`w-full text-left p-4 hover:bg-gray-50 ${selectedFile === file.key ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                            }`}
                        >
                          <div className="font-medium">{file.key}</div>
                          <div className="text-sm text-gray-500">
                            {(file.size / 1024).toFixed(2)} KB
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  S3 Path/Prefix
                </label>
                <input
                  type="text"
                  value={s3Prefix}
                  onChange={(e) => setS3Prefix(e.target.value)}
                  placeholder="e.g., data/raw/ or data/raw/prefix_"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Files matching this prefix will be automatically ingested
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Target Configuration */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Target Configuration</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pipeline Name
              </label>
              <input
                type="text"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="My Pipeline"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {detectedFileFormat && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Detected file format:</strong> {detectedFileFormat}
                  {detectedFileFormat === 'JSON' && ' (Table will be created with VARIANT column + metadata columns)'}
                </p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Database <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={targetDatabase}
                  onChange={(e) => {
                    setTargetDatabase(e.target.value)
                    setTargetSchema('') // Reset schema when database changes
                  }}
                  disabled={loadingDatabases || !selectedSnowflakeConnection}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">{loadingDatabases ? 'Loading...' : 'Select database'}</option>
                  {databases.map((db) => (
                    <option key={db} value={db}>
                      {db}
                    </option>
                  ))}
                </select>
                {!selectedSnowflakeConnection && (
                  <p className="mt-1 text-xs text-gray-500">
                    Select a Snowflake connection first
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schema <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={targetSchema}
                  onChange={(e) => setTargetSchema(e.target.value)}
                  disabled={loadingSchemas || !targetDatabase || !selectedSnowflakeConnection}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingSchemas ? 'Loading...' : targetDatabase ? 'Select schema' : 'Select database first'}
                  </option>
                  {schemas.map((schema) => (
                    <option key={schema} value={schema}>
                      {schema}
                    </option>
                  ))}
                </select>
                {targetDatabase && !loadingSchemas && schemas.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    No schemas found
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Table <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={targetTable}
                  onChange={(e) => setTargetTable(e.target.value)}
                  placeholder="Auto-generated from filename"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to auto-generate from filename
                </p>
              </div>
            </div>

            {/* Advanced Options Section */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="text-lg font-semibold">Advanced Options</h3>
                <svg
                  className={`w-5 h-5 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      File Type
                    </label>
                    <select
                      value={fileType || detectedFileFormat || 'CSV'}
                      onChange={(e) => {
                        setFileType(e.target.value)
                        setCopyOptions({}) // Reset options when file type changes
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CSV">CSV</option>
                      <option value="JSON">JSON</option>
                      <option value="PARQUET">Parquet</option>
                    </select>
                  </div>

                  {/* CSV Options */}
                  {(fileType || detectedFileFormat) === 'CSV' && (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-md">
                      <h4 className="font-medium text-gray-900">CSV Options</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Field Delimiter
                          </label>
                          <input
                            type="text"
                            value={copyOptions.field_delimiter || ','}
                            onChange={(e) => setCopyOptions({ ...copyOptions, field_delimiter: e.target.value })}
                            placeholder=","
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Record Delimiter
                          </label>
                          <input
                            type="text"
                            value={copyOptions.record_delimiter || '\\n'}
                            onChange={(e) => setCopyOptions({ ...copyOptions, record_delimiter: e.target.value })}
                            placeholder="\\n"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Skip Header
                          </label>
                          <select
                            value={copyOptions.skip_header !== undefined ? copyOptions.skip_header.toString() : '1'}
                            onChange={(e) => setCopyOptions({ ...copyOptions, skip_header: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="0">No</option>
                            <option value="1">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Field Optionally Enclosed By
                          </label>
                          <input
                            type="text"
                            value={copyOptions.field_optionally_enclosed_by || '"'}
                            onChange={(e) => setCopyOptions({ ...copyOptions, field_optionally_enclosed_by: e.target.value })}
                            placeholder='"'
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={copyOptions.trim_space !== false}
                              onChange={(e) => setCopyOptions({ ...copyOptions, trim_space: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Trim Space</span>
                          </label>
                        </div>
                        <div>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={copyOptions.error_on_column_count_mismatch === true}
                              onChange={(e) => setCopyOptions({ ...copyOptions, error_on_column_count_mismatch: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Error on Column Count Mismatch</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* JSON Options */}
                  {(fileType || detectedFileFormat) === 'JSON' && (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-md">
                      <h4 className="font-medium text-gray-900">JSON Options</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={copyOptions.strip_outer_array === true}
                              onChange={(e) => setCopyOptions({ ...copyOptions, strip_outer_array: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Strip Outer Array</span>
                          </label>
                          <p className="text-xs text-gray-500 mt-1">Remove outer array brackets from JSON files</p>
                        </div>
                        <div>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={copyOptions.replace_invalid_characters === true}
                              onChange={(e) => setCopyOptions({ ...copyOptions, replace_invalid_characters: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Replace Invalid Characters</span>
                          </label>
                        </div>
                        <div>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={copyOptions.ignore_utf8_errors === true}
                              onChange={(e) => setCopyOptions({ ...copyOptions, ignore_utf8_errors: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Ignore UTF-8 Errors</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parquet Options */}
                  {(fileType || detectedFileFormat) === 'PARQUET' && (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-md">
                      <h4 className="font-medium text-gray-900">Parquet Options</h4>
                      <div className="text-sm text-gray-600">
                        Parquet format options will be available in a future update.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Pipeline'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


import { useState } from 'react'
import type { Connection } from '../utils/api'

interface EnvironmentSourceConfig {
  connection_name: string
  bucket: string
}

interface EnvironmentTargetConfig {
  connection_name: string
  database: string
  schema: string
}

interface EnvironmentConfigs {
  default: {
    source: EnvironmentSourceConfig
    target: EnvironmentTargetConfig
  }
  dev?: {
    source: EnvironmentSourceConfig
    target: EnvironmentTargetConfig
  }
  uat?: {
    source: EnvironmentSourceConfig
    target: EnvironmentTargetConfig
  }
  prod?: {
    source: EnvironmentSourceConfig
    target: EnvironmentTargetConfig
  }
}

interface EnvironmentConfigEditorProps {
  sourceConnections: Connection[]
  targetConnections: Connection[]
  configs: EnvironmentConfigs
  onChange: (configs: EnvironmentConfigs) => void
}

const ENVIRONMENTS = ['default', 'dev', 'uat', 'prod'] as const

export default function EnvironmentConfigEditor({
  sourceConnections,
  targetConnections,
  configs,
  onChange,
}: EnvironmentConfigEditorProps) {
  const [activeTab, setActiveTab] = useState<string>('default')

  const updateEnvironmentConfig = (
    env: string,
    section: 'source' | 'target',
    field: string,
    value: any
  ) => {
    const updated = { ...configs }
    if (!updated[env as keyof EnvironmentConfigs]) {
      // Initialize environment config from default
      updated[env as keyof EnvironmentConfigs] = {
        source: { ...configs.default.source },
        target: { ...configs.default.target },
      }
    }
    const envConfig = updated[env as keyof EnvironmentConfigs]!
    if (section === 'source') {
      envConfig.source = { ...envConfig.source, [field]: value }
    } else {
      envConfig.target = { ...envConfig.target, [field]: value }
    }
    onChange(updated)
  }

  const copyFromEnvironment = (fromEnv: string, toEnv: string) => {
    const updated = { ...configs }
    const sourceConfig = updated[fromEnv as keyof EnvironmentConfigs]
    if (sourceConfig) {
      updated[toEnv as keyof EnvironmentConfigs] = {
        source: { ...sourceConfig.source },
        target: { ...sourceConfig.target },
      }
      onChange(updated)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Environment Configuration</h3>
      </div>

      {/* Environment Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4">
          {ENVIRONMENTS.map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => setActiveTab(env)}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === env
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {env.charAt(0).toUpperCase() + env.slice(1)}
              {env !== 'default' && !configs[env] && (
                <span className="ml-2 text-xs text-gray-400">(not configured)</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Environment Config */}
      {configs[activeTab as keyof EnvironmentConfigs] ? (
        <div className="space-y-6 pt-4">
          {/* Source Configuration */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-4">Source Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  S3 Connection
                </label>
                <select
                  value={configs[activeTab as keyof EnvironmentConfigs]!.source.connection_name}
                  onChange={(e) =>
                    updateEnvironmentConfig(activeTab, 'source', 'connection_name', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select connection...</option>
                  {sourceConnections
                    .filter((c) => c.type === 's3')
                    .map((conn) => (
                      <option key={conn.id} value={conn.name}>
                        {conn.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bucket
                </label>
                <input
                  type="text"
                  value={configs[activeTab as keyof EnvironmentConfigs]!.source.bucket}
                  onChange={(e) =>
                    updateEnvironmentConfig(activeTab, 'source', 'bucket', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Target Configuration */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-4">Target Configuration</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Snowflake Connection
                </label>
                <select
                  value={configs[activeTab as keyof EnvironmentConfigs]!.target.connection_name}
                  onChange={(e) =>
                    updateEnvironmentConfig(activeTab, 'target', 'connection_name', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select connection...</option>
                  {targetConnections
                    .filter((c) => c.type === 'snowflake')
                    .map((conn) => (
                      <option key={conn.id} value={conn.name}>
                        {conn.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Database
                </label>
                <input
                  type="text"
                  value={configs[activeTab as keyof EnvironmentConfigs]!.target.database}
                  onChange={(e) =>
                    updateEnvironmentConfig(activeTab, 'target', 'database', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schema
                </label>
                <input
                  type="text"
                  value={configs[activeTab as keyof EnvironmentConfigs]!.target.schema}
                  onChange={(e) =>
                    updateEnvironmentConfig(activeTab, 'target', 'schema', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Copy from another environment */}
          {activeTab !== 'default' && (
            <div className="flex gap-2">
              <span className="text-sm text-gray-600">Copy from:</span>
              {ENVIRONMENTS.filter((e) => e !== activeTab && configs[e]).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => copyFromEnvironment(env, activeTab)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {env}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="pt-4">
          <p className="text-gray-500 text-sm mb-4">
            This environment is not configured. It will use default values.
          </p>
          <button
            type="button"
            onClick={() => {
              const updated = { ...configs }
              updated[activeTab as keyof EnvironmentConfigs] = {
                source: { ...configs.default.source },
                target: { ...configs.default.target },
              }
              onChange(updated)
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Configure {activeTab}
          </button>
        </div>
      )}
    </div>
  )
}


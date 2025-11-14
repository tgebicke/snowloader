import { useState } from 'react'
import type { ColumnSchema } from '../utils/api'

interface SchemaEditorProps {
  schema: ColumnSchema[]
  onChange: (schema: ColumnSchema[]) => void
}

const SNOWFLAKE_TYPES = [
  'VARCHAR',
  'NUMBER',
  'INTEGER',
  'BIGINT',
  'FLOAT',
  'DOUBLE',
  'BOOLEAN',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'TIMESTAMP_NTZ',
  'TIMESTAMP_LTZ',
  'TIMESTAMP_TZ',
  'VARIANT',
  'OBJECT',
  'ARRAY',
  'BINARY',
  'VARBINARY',
]

export default function SchemaEditor({ schema, onChange }: SchemaEditorProps) {
  const [localSchema, setLocalSchema] = useState<ColumnSchema[]>(schema)

  const updateSchema = (newSchema: ColumnSchema[]) => {
    setLocalSchema(newSchema)
    onChange(newSchema)
  }

  const addColumn = () => {
    const newColumn: ColumnSchema = {
      name: '',
      type: 'VARCHAR',
      nullable: true,
    }
    updateSchema([...localSchema, newColumn])
  }

  const removeColumn = (index: number) => {
    updateSchema(localSchema.filter((_, i) => i !== index))
  }

  const updateColumn = (index: number, field: keyof ColumnSchema, value: any) => {
    const updated = [...localSchema]
    updated[index] = { ...updated[index], [field]: value }
    updateSchema(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Table Schema</h3>
        <button
          type="button"
          onClick={addColumn}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
        >
          + Add Column
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
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nullable
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {localSchema.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No columns defined. Click "Add Column" to get started.
                </td>
              </tr>
            ) : (
              localSchema.map((column, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="text"
                      value={column.name}
                      onChange={(e) => updateColumn(index, 'name', e.target.value)}
                      placeholder="column_name"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={column.type}
                      onChange={(e) => updateColumn(index, 'type', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {SNOWFLAKE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={column.nullable}
                      onChange={(e) => updateColumn(index, 'nullable', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => removeColumn(index)}
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
  )
}


export type ObjectType = 'organization' | 'project' | 'source' | 'contract' | 'pipeline'

export interface FileTreeNode {
  id: string
  name: string
  type: ObjectType
  children?: FileTreeNode[]
  parentId?: string
}

export interface Tab {
  id: string
  name: string
  type: ObjectType
  content?: React.ReactNode
  isDirty?: boolean
}


import { useAuth } from '@clerk/clerk-react'
import { useMemo } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useApi() {
  const { getToken } = useAuth()

  const apiRequest = useMemo(() => {
    return async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      const token = await getToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'An error occurred' }))
        throw new Error(error.detail || `HTTP error! status: ${response.status}`)
      }

      return response.json()
    }
  }, [getToken])

  return { apiRequest }
}


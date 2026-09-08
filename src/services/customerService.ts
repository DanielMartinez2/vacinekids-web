import { ApiClientError, apiRequest } from '../api/httpClient'
import type { PaginatedResult, PaginationMeta } from '../types/api'
import type { CustomerProfile, Dependent, DependentInput, DependentUpdate, ProfileInput } from '../types/customer'

const invalidResponse = () => new ApiClientError('A API retornou uma resposta inválida.', 'invalid-response')

function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function profileFrom(value: unknown): CustomerProfile {
  if (!value || typeof value !== 'object') throw invalidResponse()
  const profile = value as Record<string, unknown>
  if (![profile.id, profile.name, profile.phone, profile.createdAt, profile.updatedAt].every(requiredString)) throw invalidResponse()
  return {
    id: profile.id as string,
    name: profile.name as string,
    phone: profile.phone as string,
    createdAt: profile.createdAt as string,
    updatedAt: profile.updatedAt as string,
  }
}

function dependentFrom(value: unknown): Dependent {
  if (!value || typeof value !== 'object') throw invalidResponse()
  const dependent = value as Record<string, unknown>
  if (![dependent.id, dependent.name, dependent.birthDate, dependent.createdAt, dependent.updatedAt].every(requiredString)
    || !/^\d{4}-\d{2}-\d{2}$/.test(String(dependent.birthDate))) throw invalidResponse()
  return {
    id: dependent.id as string,
    name: dependent.name as string,
    birthDate: dependent.birthDate as string,
    createdAt: dependent.createdAt as string,
    updatedAt: dependent.updatedAt as string,
  }
}

function paginationFrom(value: unknown): PaginationMeta {
  if (!value || typeof value !== 'object') throw invalidResponse()
  const meta = value as Record<string, unknown>
  if (![meta.page, meta.pageSize, meta.total, meta.totalPages].every((item) => typeof item === 'number' && Number.isInteger(item) && item >= 0)
    || Number(meta.page) < 1 || Number(meta.pageSize) < 1) throw invalidResponse()
  return meta as unknown as PaginationMeta
}

const responseData = <T>(response: { data: T } | undefined) => {
  if (!response) throw invalidResponse()
  return response.data
}

export const customerService = {
  async getProfile(): Promise<CustomerProfile | null> {
    const value = responseData(await apiRequest<unknown>('/profile', { authenticated: true }))
    return value === null ? null : profileFrom(value)
  },

  async putProfile(input: ProfileInput): Promise<CustomerProfile> {
    return profileFrom(responseData(await apiRequest<unknown>('/profile', {
      method: 'PUT', authenticated: true, body: input,
    })))
  },

  async listDependents({ page = 1, pageSize = 20 } = {}): Promise<PaginatedResult<Dependent>> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    const response = await apiRequest<unknown>(`/dependents?${query}`, { authenticated: true })
    const data = responseData(response)
    if (!Array.isArray(data) || !response?.meta) throw invalidResponse()
    return { items: data.map(dependentFrom), meta: paginationFrom(response.meta) }
  },

  async createDependent(input: DependentInput): Promise<Dependent> {
    return dependentFrom(responseData(await apiRequest<unknown>('/dependents', {
      method: 'POST', authenticated: true, body: input,
    })))
  },

  async getDependent(id: string): Promise<Dependent> {
    return dependentFrom(responseData(await apiRequest<unknown>(`/dependents/${encodeURIComponent(id)}`, { authenticated: true })))
  },

  async updateDependent(id: string, input: DependentUpdate): Promise<Dependent> {
    return dependentFrom(responseData(await apiRequest<unknown>(`/dependents/${encodeURIComponent(id)}`, {
      method: 'PATCH', authenticated: true, body: input,
    })))
  },

  async deleteDependent(id: string): Promise<void> {
    const response = await apiRequest<never>(`/dependents/${encodeURIComponent(id)}`, {
      method: 'DELETE', authenticated: true,
    })
    if (response !== undefined) throw invalidResponse()
  },
}

export type CustomerService = typeof customerService

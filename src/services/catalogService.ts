import { ApiClientError, apiGet } from '../api/httpClient'
import type { PaginatedResult, PaginationMeta } from '../types/api'
import type { AgeRange, Vaccine, VaccinePackage } from '../types/catalog'

interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  ageRange?: string
}

function queryString<T extends object>(params: T) {
  const query = new URLSearchParams()
  Object.entries(params as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const result = query.toString()
  return result ? `?${result}` : ''
}

function fallbackMeta(page = 1, pageSize = 20, total = 0): PaginationMeta {
  return { page, pageSize, total, totalPages: total ? Math.ceil(total / pageSize) : 0 }
}

export const catalogService = {
  async listVaccines(params: ListParams = {}): Promise<PaginatedResult<Vaccine>> {
    const response = await apiGet<Vaccine[]>(`/vaccines${queryString(params)}`)
    return { items: response.data, meta: response.meta ?? fallbackMeta(params.page, params.pageSize, response.data.length) }
  },

  async listPackages(params: ListParams = {}): Promise<PaginatedResult<VaccinePackage>> {
    const response = await apiGet<VaccinePackage[]>(`/packages${queryString(params)}`)
    if (!response.meta) {
      throw new ApiClientError('A API retornou uma resposta paginada inválida.', 'invalid-response')
    }
    return { items: response.data, meta: response.meta }
  },

  async listAgeRanges(): Promise<AgeRange[]> {
    const response = await apiGet<AgeRange[]>('/age-ranges?pageSize=100')
    return response.data
  },

  async getVaccine(id: string): Promise<Vaccine> {
    return (await apiGet<Vaccine>(`/vaccines/${encodeURIComponent(id)}`)).data
  },

  async getPackage(id: string): Promise<VaccinePackage> {
    return (await apiGet<VaccinePackage>(`/packages/${encodeURIComponent(id)}`)).data
  },
}

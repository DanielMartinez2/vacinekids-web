export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}

export interface ApiResponse<T> {
  data: T
  meta?: PaginationMeta
  error: ApiErrorPayload | null
}

export interface PaginatedResult<T> {
  items: T[]
  meta: PaginationMeta
}

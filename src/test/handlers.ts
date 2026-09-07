import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../api/httpClient'
import { babyRange, childRange, childVaccineFixture, packageFixture, vaccineFixture } from './fixtures'

const meta = (total: number, page = 1, pageSize = 6) => ({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) })

export const handlers = [
  http.get(`${API_BASE_URL}/auth/me`, () => HttpResponse.json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } }, { status: 401 })),
  http.get(`${API_BASE_URL}/age-ranges`, () => HttpResponse.json({ data: [babyRange, childRange], meta: meta(2, 1, 100), error: null })),
  http.get(`${API_BASE_URL}/vaccines`, ({ request }) => {
    const url = new URL(request.url)
    const age = url.searchParams.get('ageRange')
    const search = url.searchParams.get('search')?.toLowerCase()
    let data = [vaccineFixture, childVaccineFixture]
    if (age) data = data.filter((item) => item.ageRanges.some((range) => range.slug === age))
    if (search) data = data.filter((item) => item.name.toLowerCase().includes(search))
    return HttpResponse.json({ data, meta: meta(data.length), error: null })
  }),
  http.get(`${API_BASE_URL}/packages`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 6)
    const search = url.searchParams.get('search')?.toLowerCase()
    let data = [packageFixture]
    if (search) data = data.filter((item) => item.name.toLowerCase().includes(search))
    return HttpResponse.json({ data, meta: meta(data.length, page, pageSize), error: null })
  }),
  http.get(`${API_BASE_URL}/vaccines/:id`, ({ params }) => params.id === vaccineFixture.id ? HttpResponse.json({ data: vaccineFixture, error: null }) : HttpResponse.json({ data: null, error: { code: 'VACCINE_NOT_FOUND', message: 'Vaccine not found' } }, { status: 404 })),
  http.get(`${API_BASE_URL}/packages/:id`, ({ params }) => params.id === packageFixture.id ? HttpResponse.json({ data: packageFixture, error: null }) : HttpResponse.json({ data: null, error: { code: 'PACKAGE_NOT_FOUND', message: 'Package not found' } }, { status: 404 })),
]

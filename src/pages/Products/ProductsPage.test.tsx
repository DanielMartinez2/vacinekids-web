import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API_BASE_URL } from '../../api/httpClient'
import { childVaccineFixture, packageFixture } from '../../test/fixtures'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { ProductsPage } from './ProductsPage'

const meta = (total: number, page = 1, pageSize = 6, totalPages = Math.ceil(total / pageSize)) => ({
  page,
  pageSize,
  total,
  totalPages,
})

describe('ProductsPage', () => {
  it('exibe o estado de carregamento e os dados retornados pela API', async () => {
    renderWithProviders(<ProductsPage />)
    expect(screen.getByText('Carregando vacinas...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Vacina Hexavalente' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pacote Primeiros Cuidados' })).toBeInTheDocument()
  })

  it('não envia ageRange para vacinas ou pacotes quando nenhuma faixa está selecionada', async () => {
    const requests: URL[] = []
    server.use(
      http.get(`${API_BASE_URL}/vaccines`, ({ request }) => {
        requests.push(new URL(request.url))
        return HttpResponse.json({ data: [], meta: meta(0), error: null })
      }),
      http.get(`${API_BASE_URL}/packages`, ({ request }) => {
        requests.push(new URL(request.url))
        return HttpResponse.json({ data: [], meta: meta(0), error: null })
      }),
    )

    renderWithProviders(<ProductsPage />)

    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests.find(({ pathname }) => pathname.endsWith('/vaccines'))?.searchParams.has('ageRange')).toBe(false)
    expect(requests.find(({ pathname }) => pathname.endsWith('/packages'))?.searchParams.has('ageRange')).toBe(false)
  })

  it('envia busca textual para o backend', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProductsPage />)
    await screen.findByRole('heading', { name: 'Vacina Hexavalente' })
    await user.type(screen.getByLabelText('Buscar por texto'), 'Infantil')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByRole('heading', { name: 'Vacina Infantil' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Vacina Hexavalente' })).not.toBeInTheDocument()
  })

  it('envia o mesmo slug ao backend e não filtra pacotes pela composição local', async () => {
    const vaccineRequests: URL[] = []
    const packageRequests: URL[] = []
    server.use(
      http.get(`${API_BASE_URL}/vaccines`, ({ request }) => {
        const url = new URL(request.url)
        vaccineRequests.push(url)
        const data = url.searchParams.get('ageRange') === 'crianca' ? [childVaccineFixture] : []
        return HttpResponse.json({ data, meta: meta(data.length), error: null })
      }),
      http.get(`${API_BASE_URL}/packages`, ({ request }) => {
        const url = new URL(request.url)
        packageRequests.push(url)
        return HttpResponse.json({ data: [packageFixture], meta: meta(1), error: null })
      }),
    )

    renderWithProviders(<ProductsPage />)
    await screen.findByRole('heading', { name: 'Pacote Primeiros Cuidados' })
    fireEvent.click(screen.getByRole('radio', { name: 'Criança' }))

    expect(await screen.findByRole('heading', { name: 'Vacina Infantil' })).toBeInTheDocument()
    await waitFor(() => {
      expect(vaccineRequests.some((url) => url.searchParams.get('ageRange') === 'crianca')).toBe(true)
      expect(packageRequests.some((url) => url.searchParams.get('ageRange') === 'crianca')).toBe(true)
    })
    expect(screen.getByRole('heading', { name: 'Pacote Primeiros Cuidados' })).toBeInTheDocument()
  })

  it('exibe exatamente a lista de pacotes devolvida pelo backend', async () => {
    const apiPackage = { ...packageFixture, id: 'package-from-api', name: 'Pacote definido pela API' }
    server.use(
      http.get(`${API_BASE_URL}/packages`, () =>
        HttpResponse.json({ data: [apiPackage], meta: meta(1), error: null }),
      ),
    )

    renderWithProviders(<ProductsPage />)

    expect(await screen.findByRole('heading', { name: 'Pacote definido pela API' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pacote Primeiros Cuidados' })).not.toBeInTheDocument()
  })

  it('usa a metadata da API para paginar e redefine packagePage ao trocar a faixa', async () => {
    const user = userEvent.setup()
    const packageRequests: URL[] = []
    server.use(
      http.get(`${API_BASE_URL}/packages`, ({ request }) => {
        const url = new URL(request.url)
        packageRequests.push(url)
        const page = Number(url.searchParams.get('page'))
        const data = [{ ...packageFixture, id: `package-page-${page}`, name: `Pacote página ${page}` }]
        return HttpResponse.json({ data, meta: meta(13, page, 6, 3), error: null })
      }),
    )

    renderWithProviders(<ProductsPage />)
    expect(await screen.findByRole('heading', { name: 'Pacote página 1' })).toBeInTheDocument()
    expect(screen.getByText('13 resultado(s)')).toBeInTheDocument()

    const pagination = screen.getByRole('navigation', { name: 'Paginação de pacotes' })
    expect(within(pagination).getByText(/Página/)).toHaveTextContent('Página 1 de 3')
    await user.click(within(pagination).getByRole('button', { name: /Próxima/ }))
    expect(await screen.findByRole('heading', { name: 'Pacote página 2' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Criança' }))
    await waitFor(() => {
      const lastRequest = packageRequests.at(-1)
      expect(lastRequest?.searchParams.get('ageRange')).toBe('crianca')
      expect(lastRequest?.searchParams.get('page')).toBe('1')
      expect(lastRequest?.searchParams.get('pageSize')).toBe('6')
      expect(lastRequest?.searchParams.has('limit')).toBe(false)
    })
  })

  it('envia ageRange e search juntos para packages', async () => {
    const user = userEvent.setup()
    const packageRequests: URL[] = []
    server.use(
      http.get(`${API_BASE_URL}/packages`, ({ request }) => {
        packageRequests.push(new URL(request.url))
        return HttpResponse.json({ data: [packageFixture], meta: meta(1), error: null })
      }),
    )

    renderWithProviders(<ProductsPage />)
    await screen.findByRole('heading', { name: 'Pacote Primeiros Cuidados' })
    await user.click(screen.getByRole('radio', { name: 'Criança' }))
    await user.type(screen.getByLabelText('Buscar por texto'), 'Infantil')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => {
      expect(packageRequests.some((url) =>
        url.searchParams.get('ageRange') === 'crianca'
        && url.searchParams.get('search') === 'Infantil'
        && url.searchParams.get('page') === '1'
        && url.searchParams.get('pageSize') === '6'
      )).toBe(true)
    })
  })

  it('mostra o estado vazio, sem erro, para ageRange e busca sem pacotes', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${API_BASE_URL}/packages`, ({ request }) => {
        const url = new URL(request.url)
        const empty = url.searchParams.get('ageRange') === 'crianca' && url.searchParams.get('search') === 'ausente'
        return HttpResponse.json({ data: empty ? [] : [packageFixture], meta: meta(empty ? 0 : 1), error: null })
      }),
    )

    renderWithProviders(<ProductsPage />)
    await screen.findByRole('heading', { name: 'Pacote Primeiros Cuidados' })
    await user.click(screen.getByRole('radio', { name: 'Criança' }))
    await user.type(screen.getByLabelText('Buscar por texto'), 'ausente')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Nenhum pacote corresponde à busca e à faixa etária escolhidas.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mantém o erro de packages e permite tentar novamente', async () => {
    const user = userEvent.setup()
    let attempts = 0
    server.use(
      http.get(`${API_BASE_URL}/packages`, () => {
        attempts += 1
        if (attempts === 1) {
          return HttpResponse.json(
            { data: null, error: { code: 'INTERNAL_ERROR', message: 'Falha temporária' } },
            { status: 500 },
          )
        }
        return HttpResponse.json({ data: [packageFixture], meta: meta(1), error: null })
      }),
    )

    renderWithProviders(<ProductsPage />)
    expect(await screen.findByText('A API encontrou um problema. Tente novamente em instantes.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Tentar novamente/ }))

    expect(await screen.findByRole('heading', { name: 'Pacote Primeiros Cuidados' })).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('mostra erro de conexão com ação de nova tentativa', async () => {
    server.use(http.get(`${API_BASE_URL}/vaccines`, () => HttpResponse.error()))
    renderWithProviders(<ProductsPage />)
    expect(await screen.findByText(/Não foi possível conectar à API/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument()
  })
})

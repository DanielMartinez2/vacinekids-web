import { HashRouter, Route, Routes } from 'react-router-dom'
import { CartProvider } from './contexts/CartContext'
import { ScrollToTop } from './components/common/ScrollToTop'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/Home/HomePage'
import { NotFoundPage } from './pages/NotFound/NotFoundPage'
import { ProductsPage } from './pages/Products/ProductsPage'
import { PackageDetailsPage } from './pages/Details/PackageDetailsPage'
import { VaccineDetailsPage } from './pages/Details/VaccineDetailsPage'
import { CartPage } from './pages/Cart/CartPage'

export default function App() {
  return (
    <HashRouter>
      <CartProvider>
        <ScrollToTop />
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="produtos" element={<ProductsPage />} />
            <Route path="vacinas/:id" element={<VaccineDetailsPage />} />
            <Route path="pacotes/:id" element={<PackageDetailsPage />} />
            <Route path="carrinho" element={<CartPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </CartProvider>
    </HashRouter>
  )
}

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
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AdminRoute } from './components/auth/AdminRoute'
import { LoginPage, RegisterPage, AdminPage } from './pages/Auth/AuthPages'
import { AccountPage } from './pages/Account/AccountPage'

export default function App() {
  return (
    <HashRouter>
      <CartProvider>
        <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="produtos" element={<ProductsPage />} />
            <Route path="vacinas/:id" element={<VaccineDetailsPage />} />
            <Route path="pacotes/:id" element={<PackageDetailsPage />} />
            <Route path="carrinho" element={<CartPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="cadastro" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="minha-conta" element={<AccountPage />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </AuthProvider>
      </CartProvider>
    </HashRouter>
  )
}

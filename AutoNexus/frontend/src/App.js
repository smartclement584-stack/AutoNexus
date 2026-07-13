import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute, { GuestOnlyRoute } from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import ProductPage from "./pages/ProductPage";
import SellerPage from "./pages/SellerPage";
import SellersListPage from "./pages/SellersListPage";
import RequestsPage from "./pages/RequestsPage";
import CreateRequestPage from "./pages/CreateRequestPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminPage from "./pages/AdminPage";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="parts/:id" element={<ProductPage />} />
            <Route path="sellers" element={<SellersListPage />} />
            <Route path="sellers/:id" element={<SellerPage />} />
            <Route path="requests" element={<RequestsPage />} />

            {/* Public regardless of auth state — someone might reasonably
                start a reset while still logged in elsewhere (e.g. they
                suspect their account is compromised), so this isn't gated
                behind GuestOnlyRoute the way /login is. */}
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />

            {/* Guest-only: an already-logged-in user is redirected away */}
            <Route element={<GuestOnlyRoute />}>
              <Route path="login" element={<LoginPage />} />
            </Route>

            {/* Any authenticated user (buyer or seller) */}
            <Route element={<ProtectedRoute requireAuth />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="requests/new" element={<CreateRequestPage />} />
            </Route>

            {/* Admin only */}
            <Route element={<ProtectedRoute requireAuth requireAdmin />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

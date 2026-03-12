import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import ProductPage from "./pages/ProductPage";
import SellerPage from "./pages/SellerPage";
import SellersListPage from "./pages/SellersListPage";
import RequestsPage from "./pages/RequestsPage";
import CreateRequestPage from "./pages/CreateRequestPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
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
            <Route path="requests/new" element={<CreateRequestPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="login" element={<LoginPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

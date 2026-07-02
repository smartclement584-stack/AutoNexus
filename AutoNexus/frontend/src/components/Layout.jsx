import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Home,
  Search,
  Store,
  MessageSquare,
  LayoutDashboard,
  LogIn,
  LogOut,
  User,
  Menu,
  X,
  Phone,
  MapPin,
  Stethoscope,
  Shield
} from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

// AutoNexus Logo URL
const LOGO_URL = "https://customer-assets.emergentagent.com/job_parts-marketplace-43/artifacts/h9glnhhs_WhatsApp%20Image%202026-03-12%20at%204.18.13%20PM.jpeg";

const Layout = () => {
  const { user, isAuthenticated, isSeller, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/search", icon: Search, label: "Search" },
    { path: "/diagnostic", icon: Stethoscope, label: "Diagnose" },
    { path: "/sellers", icon: Store, label: "Sellers" },
    { path: "/requests", icon: MessageSquare, label: "Requests" },
  ];

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
              <img 
                src={LOGO_URL} 
                alt="AutoNexus" 
                className="h-10 md:h-14 w-auto object-contain"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? "bg-[#1a5c38] text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <item.icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-[#1a5c38] text-[#1a5c38]"
                      data-testid="user-menu-btn"
                    >
                      <User size={18} />
                      <span className="hidden md:inline max-w-[100px] truncate">
                        {user?.name || user?.phone}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="text-gray-500 text-sm">
                      {user?.phone}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isSeller && (
                      <DropdownMenuItem onClick={() => navigate("/dashboard")} data-testid="dashboard-menu-item">
                        <LayoutDashboard size={16} className="mr-2" />
                        Dashboard
                      </DropdownMenuItem>
                    )}
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="admin-menu-item">
                        <Shield size={16} className="mr-2" />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleLogout} data-testid="logout-menu-item">
                      <LogOut size={16} className="mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/login" data-testid="login-btn">
                  <Button className="bg-[#1a5c38] hover:bg-[#144a2d]">
                    <LogIn size={18} className="mr-2" />
                    <span>Login</span>
                  </Button>
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-toggle"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100">
            <nav className="px-4 py-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg ${
                    isActive(item.path)
                      ? "bg-[#1a5c38] text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
              {isSeller && (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg ${
                    isActive("/dashboard")
                      ? "bg-[#1a5c38] text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <LayoutDashboard size={20} />
                  <span className="font-medium">Dashboard</span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg ${
                    isActive("/admin")
                      ? "bg-[#1a5c38] text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Shield size={20} />
                  <span className="font-medium">Admin Panel</span>
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Footer - Desktop Only */}
      <footer className="hidden md:block bg-[#0f2e1c] text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-4 gap-8">
            {/* Logo & Description */}
            <div className="col-span-2">
              <img src={LOGO_URL} alt="AutoNexus" className="h-12 w-auto mb-4 bg-white p-2 rounded-lg" />
              <p className="text-gray-300 text-sm leading-relaxed">
                AutoNexus is the leading digital marketplace for automotive spare parts in Camp Yabassi, Cameroon. 
                Connect with verified sellers and find parts for Japanese & Korean vehicles.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold mb-4 text-lg">Quick Links</h4>
              <ul className="space-y-2 text-gray-300">
                <li><Link to="/search" className="hover:text-white transition-colors">Search Parts</Link></li>
                <li><Link to="/sellers" className="hover:text-white transition-colors">Find Sellers</Link></li>
                <li><Link to="/requests" className="hover:text-white transition-colors">Part Requests</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Become a Seller</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-4 text-lg">Contact</h4>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>Camp Yabassi, Douala, Cameroon</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={16} />
                  <span>+237 6XX XXX XXX</span>
                </li>
              </ul>
              <a 
                href="https://wa.me/237677123456" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 bg-[#25D366] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#128C7E] transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp Us
              </a>
            </div>
          </div>

          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>© 2026 AutoNexus. All rights reserved. | Camp Yabassi, Douala, Cameroon</p>
          </div>
        </div>
      </footer>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 safe-area-inset-bottom">
        <div className="flex justify-around py-2">
          {navItems.filter(item => item.path !== "/requests").map((item) => (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`bottom-nav-${item.label.toLowerCase()}`}
              className={`flex flex-col items-center py-1 px-3 rounded-lg ${
                isActive(item.path)
                  ? "text-[#1a5c38]"
                  : "text-gray-500"
              }`}
            >
              <item.icon size={22} strokeWidth={isActive(item.path) ? 2.5 : 1.5} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          ))}
          {isAuthenticated && isSeller ? (
            <Link
              to="/dashboard"
              data-testid="bottom-nav-dashboard"
              className={`flex flex-col items-center py-1 px-3 rounded-lg ${
                isActive("/dashboard") ? "text-[#1a5c38]" : "text-gray-500"
              }`}
            >
              <LayoutDashboard size={22} strokeWidth={isActive("/dashboard") ? 2.5 : 1.5} />
              <span className="text-xs mt-1 font-medium">Dashboard</span>
            </Link>
          ) : (
            <Link
              to="/login"
              data-testid="bottom-nav-login"
              className={`flex flex-col items-center py-1 px-3 rounded-lg ${
                isActive("/login") ? "text-[#1a5c38]" : "text-gray-500"
              }`}
            >
              <User size={22} strokeWidth={isActive("/login") ? 2.5 : 1.5} />
              <span className="text-xs mt-1 font-medium">Account</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Layout;

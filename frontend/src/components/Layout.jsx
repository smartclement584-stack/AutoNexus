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
  X
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

const Layout = () => {
  const { user, isAuthenticated, isSeller, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/search", icon: Search, label: "Search" },
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
      <header className="sticky top-0 z-50 bg-[#1a5c38] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6 text-[#1a5c38]">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <span className="font-bold text-lg md:text-xl tracking-tight" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                AutoNexus
              </span>
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
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <item.icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 text-white hover:bg-white/10"
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
                    <DropdownMenuItem onClick={handleLogout} data-testid="logout-menu-item">
                      <LogOut size={16} className="mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/login" data-testid="login-btn">
                  <Button variant="ghost" className="text-white hover:bg-white/10">
                    <LogIn size={18} className="mr-2" />
                    <span className="hidden md:inline">Login</span>
                  </Button>
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button
                className="md:hidden p-2 hover:bg-white/10 rounded-lg"
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
          <div className="md:hidden bg-[#144a2d] border-t border-white/10">
            <nav className="px-4 py-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    isActive(item.path)
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              ))}
              {isSeller && (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    isActive("/dashboard")
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <LayoutDashboard size={20} />
                  <span>Dashboard</span>
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 safe-area-inset-bottom">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
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

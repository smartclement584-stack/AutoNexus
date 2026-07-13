import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import { Phone, Mail, Lock, User, Loader2, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup, login } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [contactType, setContactType] = useState("phone"); // "phone" | "email" — signup only
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState(""); // login: phone or email
  const [phone, setPhone] = useState("+237");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        if (contactType === "phone" && phone.length < 13) {
          toast.error("Please enter a valid Cameroon phone number (+237XXXXXXXXX)");
          setLoading(false);
          return;
        }
        if (contactType === "email" && !email.includes("@")) {
          toast.error("Please enter a valid email address");
          setLoading(false);
          return;
        }
        await signup({
          name: name || undefined,
          phone: contactType === "phone" ? phone : undefined,
          email: contactType === "email" ? email : undefined,
          password,
        });
        toast.success("Account created! Welcome to AutoNexus.");
      } else {
        if (!identifier) {
          toast.error("Enter your phone number or email");
          setLoading(false);
          return;
        }
        await login(identifier, password);
        toast.success("Login successful!");
      }
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#1a5c38] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-white">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              Welcome to AutoNexus
            </h1>
            <p className="text-gray-500 mt-2">
              {mode === "login" ? "Log in to your account" : "Create your account"}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "login" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
              data-testid="login-tab"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "signup" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
              data-testid="signup-tab"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="name">Name (optional)</Label>
                  <div className="relative mt-1">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                </div>

                {/* Phone vs Email choice */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setContactType("phone")}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      contactType === "phone" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                    }`}
                  >
                    Use Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactType("email")}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      contactType === "email" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                    }`}
                  >
                    Use Email
                  </button>
                </div>

                {contactType === "phone" ? (
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative mt-1">
                      <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+237XXXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 h-12"
                        data-testid="phone-input"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative mt-1">
                      <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12"
                        data-testid="email-input"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {mode === "login" && (
              <div>
                <Label htmlFor="identifier">Phone or Email</Label>
                <div className="relative mt-1">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="+237XXXXXXXXX or you@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-10 h-12"
                    data-testid="identifier-input"
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                  data-testid="password-input"
                />
              </div>
              {mode === "login" && (
                <Link
                  to="/forgot-password"
                  className="block text-right text-sm text-[#1a5c38] hover:underline mt-2"
                  data-testid="forgot-password-link"
                >
                  Forgot password?
                </Link>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#1a5c38] hover:bg-[#144a2d]"
              disabled={loading}
              data-testid="submit-auth-btn"
            >
              {loading ? (
                <><Loader2 size={20} className="mr-2 animate-spin" />Please wait...</>
              ) : (
                <>{mode === "login" ? "Log In" : "Create Account"} <ArrowRight size={18} className="ml-2" /></>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import { User, Lock, Loader2, ArrowRight, ArrowLeft, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";

const RESEND_COOLDOWN_SECONDS = 60;

// Lightweight, dependency-free strength heuristic — just enough to nudge
// people toward a better password, not a hard backend requirement. The
// backend's actual minimum (6 characters) is intentionally the same rule
// used at signup, so reset doesn't hold people to an inconsistent bar.
function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", color: "bg-gray-200" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: "Very weak", color: "bg-red-500" },
    { label: "Weak", color: "bg-orange-500" },
    { label: "Fair", color: "bg-yellow-500" },
    { label: "Good", color: "bg-lime-500" },
    { label: "Strong", color: "bg-green-600" },
  ];
  const idx = Math.min(score, levels.length - 1);
  return { score: idx + 1, ...levels[idx] };
}

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { forgotPassword, resetPassword } = useAuth();

  const [identifier, setIdentifier] = useState(location.state?.identifier || "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(
    location.state?.identifier ? RESEND_COOLDOWN_SECONDS : 0
  );

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const strength = getPasswordStrength(newPassword);

  const handleResend = async () => {
    if (!identifier.trim()) {
      toast.error("Enter your phone number or email first");
      return;
    }
    try {
      const data = await forgotPassword(identifier.trim());
      toast.success("A new code has been sent.");
      if (data?.dev_code) {
        toast.info(`DEV MODE — your code is ${data.dev_code}`, { duration: 15000 });
      }
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Couldn't resend the code. Please try again.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!identifier.trim()) {
      toast.error("Enter your phone number or email");
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error("Enter the 6-digit code you received");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(identifier.trim(), code.trim(), newPassword);
      setSuccess(true);
      toast.success("Password updated! Please log in with your new password.");
      setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4" data-testid="reset-password-page">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#1a5c38] rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1
              className="text-2xl md:text-3xl font-bold text-gray-900"
              style={{ fontFamily: "Barlow Condensed, sans-serif" }}
            >
              Reset your password
            </h1>
            <p className="text-gray-500 mt-2">
              Enter the code we sent you and choose a new password.
            </p>
          </div>

          {success ? (
            <div className="text-center space-y-3" data-testid="reset-password-success">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-gray-700">Password updated. Redirecting you to log in...</p>
              <Loader2 className="animate-spin text-[#1a5c38] mx-auto" size={20} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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
                    data-testid="reset-identifier-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="code">6-digit code</Label>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="text-xs font-medium text-[#1a5c38] hover:underline disabled:text-gray-400 disabled:no-underline flex items-center gap-1"
                    data-testid="resend-code-btn"
                  >
                    <RefreshCw size={12} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 h-12 text-center text-lg tracking-[0.5em]"
                  data-testid="reset-code-input"
                />
                <p className="text-xs text-gray-400 mt-1">Codes expire 10 minutes after they're sent.</p>
              </div>

              <div>
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative mt-1">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 h-12"
                    data-testid="new-password-input"
                  />
                </div>
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1 h-1.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full ${i < strength.score ? strength.color : "bg-gray-200"}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative mt-1">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-12"
                    data-testid="confirm-password-input"
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#1a5c38] hover:bg-[#144a2d]"
                disabled={loading}
                data-testid="reset-password-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    Reset password <ArrowRight size={18} className="ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          {!success && (
            <Link
              to="/login"
              className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-6"
            >
              <ArrowLeft size={14} /> Back to login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

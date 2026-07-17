import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { User, Loader2, ArrowRight, ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/errorMessage";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { forgotPassword } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error(t("auth.toast_enter_identifier"));
      return;
    }

    setLoading(true);
    try {
      const data = await forgotPassword(identifier.trim());
      setSubmitted(true);

      // Dev-mode only: the backend includes this field solely when no real
      // SMS/email provider is configured, so local testing doesn't require
      // reading server logs. It will never be present in production.
      if (data?.dev_code) {
        toast.info(t("auth.toast_dev_code", { code: data.dev_code }), { duration: 15000 });
      }

      // Carry the identifier forward so the person doesn't have to retype it.
      navigate("/reset-password", { state: { identifier: identifier.trim() } });
    } catch (error) {
      toast.error(getErrorMessage(error, "auth.toast_something_wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4" data-testid="forgot-password-page">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#1a5c38] rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <h1
              className="text-2xl md:text-3xl font-bold text-gray-900"
              style={{ fontFamily: "Barlow Condensed, sans-serif" }}
            >
              {t("auth.forgot_title")}
            </h1>
            <p className="text-gray-500 mt-2">
              {t("auth.forgot_subtitle")}
            </p>
          </div>

          {submitted ? (
            <div className="text-center space-y-4" data-testid="forgot-password-submitted">
              <p className="text-gray-700">
                {t("auth.forgot_submitted_message", { identifier })}
              </p>
              <Button
                className="w-full h-12 bg-[#1a5c38] hover:bg-[#144a2d]"
                onClick={() => navigate("/reset-password", { state: { identifier: identifier.trim() } })}
                data-testid="continue-to-reset-btn"
              >
                {t("auth.forgot_enter_code_btn")} <ArrowRight size={18} className="ml-2" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="identifier">{t("common.phone_or_email_label")}</Label>
                <div className="relative mt-1">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder={t("common.phone_or_email_placeholder")}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-10 h-12"
                    data-testid="forgot-identifier-input"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#1a5c38] hover:bg-[#144a2d]"
                disabled={loading}
                data-testid="send-code-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    {t("auth.forgot_sending")}
                  </>
                ) : (
                  <>
                    {t("auth.forgot_send_code_btn")} <ArrowRight size={18} className="ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          <Link
            to="/login"
            className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-6"
          >
            <ArrowLeft size={14} /> {t("common.back_to_login")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

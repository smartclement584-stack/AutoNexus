import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Phone, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../components/ui/input-otp";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sendOtp, verifyOtp, isAuthenticated } = useAuth();
  
  const [step, setStep] = useState(1); // 1: phone, 2: otp
  const [phone, setPhone] = useState("+237");
  const [otp, setOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (isAuthenticated) {
    const from = location.state?.from?.pathname || "/";
    navigate(from, { replace: true });
    return null;
  }

  const handleSendOtp = async (e) => {
    e.preventDefault();
    
    if (!phone || phone.length < 13) {
      toast.error("Please enter a valid Cameroon phone number (+237XXXXXXXXX)");
      return;
    }

    setLoading(true);
    try {
      const result = await sendOtp(phone);
      setDemoOtp(result.demo_otp); // For demo purposes
      setStep(2);
      toast.success("OTP sent to your phone");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(phone, otp);
      toast.success("Login successful!");
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid OTP");
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
            <h1 
              className="text-2xl md:text-3xl font-bold text-gray-900"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              Welcome to AutoNexus
            </h1>
            <p className="text-gray-500 mt-2">
              {step === 1 ? "Enter your phone number to continue" : "Enter the OTP sent to your phone"}
            </p>
          </div>

          {step === 1 ? (
            /* Step 1: Phone Number */
            <form onSubmit={handleSendOtp} className="space-y-6">
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
                <p className="text-xs text-gray-500 mt-1">
                  Enter your Cameroon phone number starting with +237
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-[#1a5c38] hover:bg-[#144a2d]"
                disabled={loading}
                data-testid="send-otp-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={18} className="ml-2" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            /* Step 2: OTP Verification */
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <Label>Enter OTP</Label>
                <div className="flex justify-center mt-3">
                  <InputOTP 
                    maxLength={6} 
                    value={otp} 
                    onChange={setOtp}
                    data-testid="otp-input"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-center text-sm text-gray-500 mt-3">
                  Code sent to {phone}
                </p>
              </div>

              {/* Demo OTP Display */}
              {demoOtp && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-yellow-800 mb-1">Demo Mode - Your OTP:</p>
                  <p className="text-xl font-mono font-bold text-yellow-900" data-testid="demo-otp">
                    {demoOtp}
                  </p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 bg-[#1a5c38] hover:bg-[#144a2d]"
                disabled={loading || otp.length !== 6}
                data-testid="verify-otp-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} className="mr-2" />
                    Verify & Login
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setDemoOtp("");
                }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Change phone number
              </button>
            </form>
          )}
        </div>

        {/* Info */}
        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

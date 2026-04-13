import { useMemo, useState } from "react";
import { ArrowLeft, Chrome, Eye, EyeOff, Github } from "lucide-react";
import { useNavigate } from "react-router-dom";

type SignInPayload = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL?.trim() ||
    `${window.location.protocol}//${window.location.hostname}:8000`).replace(/\/$/, "");

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SignInPayload>({
    email: "",
    password: "",
    rememberMe: false,
  });

  const canSubmit = useMemo(() => formData.email.trim() && formData.password.trim(), [formData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Unable to sign in.");
      }

      if (formData.rememberMe && data?.user?.email) {
        window.localStorage.setItem("smart-eye-user", data.user.email);
      }
      navigate("/panel");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const continueWithProvider = async (provider: "google" | "github") => {
    setError(null);
    setLoading(true);

    const fallbackEmail = provider === "google" ? "google.user@social.local" : "github.user@social.local";
    const fallbackName = provider === "google" ? "Google User" : "GitHub User";

    try {
      const res = await fetch(`${API_BASE}/api/auth/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          email: fallbackEmail,
          name: fallbackName,
          mode: "signin",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || `Unable to continue with ${provider}.`);
      }
      navigate("/panel");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex">
      <div className="flex-1 relative overflow-hidden hidden lg:block">
        <div className="absolute top-6 left-6 z-10">
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/30 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1800&q=80"
            alt="Smart Eye security dashboard"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="w-full max-w-md p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">
              Don&apos;t have an account?{" "}
              <button onClick={() => navigate("/signup")} className="text-blue-600 hover:text-blue-700 font-medium">
                Sign up
              </button>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Email Address"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Password"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                >
                  {showPassword ? <EyeOff className="w-5 h-5 text-gray-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span>Remember me</span>
              </label>
              <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </button>
            </div>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full bg-black text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => continueWithProvider("google")}
                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                <Chrome className="w-5 h-5 mr-2 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => continueWithProvider("github")}
                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                <Github className="w-5 h-5 mr-2 text-gray-700" />
                <span className="text-sm font-medium text-gray-700">Continue with GitHub</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

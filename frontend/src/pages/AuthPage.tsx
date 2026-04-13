import { useEffect, useMemo, useState } from "react";
import { Chrome, Eye, EyeOff, Github } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

type AuthMode = "signin" | "signup";

type SignInPayload = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type SignUpPayload = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL?.trim() ||
    `${window.location.protocol}//${window.location.hostname}:8000`).replace(/\/$/, "");

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const modeFromQuery: AuthMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const [mode, setMode] = useState<AuthMode>(modeFromQuery);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [signIn, setSignIn] = useState<SignInPayload>({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [signUp, setSignUp] = useState<SignUpPayload>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    setMode(modeFromQuery);
  }, [modeFromQuery]);

  const canSignIn = useMemo(() => signIn.email.trim() && signIn.password.trim(), [signIn]);
  const canSignUp = useMemo(
    () => signUp.name.trim() && signUp.email.trim() && signUp.password.trim() && signUp.confirmPassword.trim(),
    [signUp],
  );

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setSearchParams(next === "signup" ? { mode: "signup" } : { mode: "signin" });
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
          mode,
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

  const submitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signIn.email.trim().toLowerCase(),
          password: signIn.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Unable to sign in.");
      }

      if (signIn.rememberMe && data?.user?.email) {
        window.localStorage.setItem("smart-eye-user", data.user.email);
      }

      navigate("/panel");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signUp.password !== signUp.confirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signUp.name.trim(),
          email: signUp.email.trim().toLowerCase(),
          password: signUp.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Unable to create account.");
      }

      navigate("/panel");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#15293f_0%,#0a1222_45%,#060b16_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-cyan-400/30 bg-slate-950/85 shadow-[0_20px_80px_rgba(10,170,255,0.2)] lg:grid-cols-[1.1fr,1fr]">
        <aside className="relative hidden min-h-[620px] overflow-hidden p-8 text-cyan-50 lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(0,255,255,0.08)_1px,transparent_1px)] bg-[size:16px_16px]" />
          <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-24 left-6 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />

          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">Smart Eye Access</p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-white">Campus Safety Control</h1>
            <p className="mt-4 max-w-md text-sm text-slate-200">
              Enter the command interface for live ragging detection, camera supervision, and response workflow operations.
            </p>
          </div>

          <div className="relative z-10 mt-8 grid grid-cols-2 gap-4">
            <img
              src="https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80"
              alt="Retro game console in pixel style"
              className="h-36 w-full rounded-xl border border-cyan-300/30 object-cover shadow-lg [image-rendering:pixelated]"
            />
            <img
              src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80"
              alt="Arcade-inspired pixel lighting"
              className="h-36 w-full rounded-xl border border-cyan-300/30 object-cover shadow-lg [image-rendering:pixelated]"
            />
          </div>
        </aside>

        <div className="flex min-h-[620px] items-center justify-center bg-white px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-6 flex rounded-full border border-slate-300 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`w-1/2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === "signup" ? "bg-black text-white" : "text-slate-700"
                }`}
              >
                Create your account
              </button>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`w-1/2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === "signin" ? "bg-black text-white" : "text-slate-700"
                }`}
              >
                Already have an account
              </button>
            </div>

            <h2 className="text-3xl font-bold text-slate-900">
              {mode === "signup" ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {mode === "signup"
                ? "Use your details to set up your Smart Eye account."
                : "Sign in to continue to the live panel."}
            </p>

            <form onSubmit={mode === "signup" ? submitSignUp : submitSignIn} className="mt-6 space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={signUp.name}
                    onChange={(e) => setSignUp((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Your full name"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={mode === "signup" ? signUp.email : signIn.email}
                  onChange={(e) =>
                    mode === "signup"
                      ? setSignUp((prev) => ({ ...prev, email: e.target.value }))
                      : setSignIn((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="Email address"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={mode === "signup" ? signUp.password : signIn.password}
                    onChange={(e) =>
                      mode === "signup"
                        ? setSignUp((prev) => ({ ...prev, password: e.target.value }))
                        : setSignIn((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Password"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 outline-none transition focus:border-slate-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-slate-100"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5 text-slate-500" /> : <Eye className="h-5 w-5 text-slate-500" />}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={signUp.confirmPassword}
                      onChange={(e) => setSignUp((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm password"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 outline-none transition focus:border-slate-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-slate-100"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-slate-500" />
                      ) : (
                        <Eye className="h-5 w-5 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mode === "signin" && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={signIn.rememberMe}
                    onChange={(e) => setSignIn((prev) => ({ ...prev, rememberMe: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Remember me
                </label>
              )}

              {error && <p className="text-sm font-medium text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading || (mode === "signup" ? !canSignUp : !canSignIn)}
                className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading
                  ? mode === "signup"
                    ? "Creating Account..."
                    : "Signing In..."
                  : mode === "signup"
                    ? "Create Account"
                    : "Sign In"}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-slate-500">or</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => continueWithProvider("google")}
                  className="flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 hover:bg-slate-50"
                >
                  <Chrome className="mr-2 h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => continueWithProvider("github")}
                  className="flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 hover:bg-slate-50"
                >
                  <Github className="mr-2 h-5 w-5 text-slate-700" />
                  <span className="text-sm font-medium text-slate-700">GitHub</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plane, ArrowRight } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img
          src="https://images.pexels.com/photos/10715152/pexels-photo-10715152.jpeg"
          alt="Travel"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-900/60" />
        <div className="absolute bottom-0 p-12 text-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-md bg-indigo-600 flex items-center justify-center">
              <Plane size={20} />
            </div>
            <span className="font-heading font-bold text-xl">A Link Tours</span>
          </div>
          <h1 className="font-heading text-4xl font-bold leading-tight max-w-md">
            Run every booking from enquiry to invoice, in one place.
          </h1>
          <p className="mt-3 text-slate-300 max-w-md">
            Sales, Operations and Accounts — one connected Booking ID across the entire lifecycle.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-md bg-indigo-600 flex items-center justify-center">
              <Plane size={20} className="text-white" />
            </div>
            <span className="font-heading font-bold text-xl">A Link Tours</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1">Access your booking management workspace.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full h-11 px-3 rounded-md border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1.5 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-11 px-3 rounded-md border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium inline-flex items-center justify-center gap-1 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"} <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

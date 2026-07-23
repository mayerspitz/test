import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Landmark } from "lucide-react";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "1": "Invalid email or password.",
  unauthorized: "That Google account isn't registered for this system. Ask an administrator to add you as a user.",
  google: "Google sign-in failed. Please try again.",
  "google-not-configured": "Google sign-in isn't configured yet (missing GOOGLE_CLIENT_ID). Use email sign-in below.",
};

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?error=1");
  }
  setSessionCookie({
    userId: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`,
    role: user.role.name, exp: Date.now() + 7 * 24 * 3600 * 1000,
  });
  redirect("/");
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const error = searchParams.error ? ERRORS[searchParams.error] ?? "Sign-in failed." : null;
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Landmark size={28} />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-800">Shivtei Yisroel</h1>
            <p className="text-sm text-slate-500">Gemach Loans CRM</p>
          </div>

          <div className="card p-8 space-y-5">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-3">{error}</p>
            )}

            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-3 w-full border border-slate-300 hover:bg-slate-50 rounded-lg py-2.5 text-sm font-medium text-slate-700"
            >
              <GoogleMark /> Continue with Google
            </a>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px bg-slate-200 flex-1" /> or sign in with email <span className="h-px bg-slate-200 flex-1" />
            </div>

            <form action={login} className="space-y-4">
              <input name="email" type="email" required placeholder="Email" className="field" />
              <input name="password" type="password" required placeholder="Password" className="field" />
              <button className="btn-primary w-full py-2.5">Sign In</button>
            </form>
          </div>
        </div>
      </main>
      <footer className="text-center text-xs text-slate-400 py-6">
        ©Copyright Gemach Shivtei Yisroel {new Date().getFullYear()}
      </footer>
    </div>
  );
}

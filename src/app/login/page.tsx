import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?error=1");
  }
  setSessionCookie({
    userId: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`,
    role: user.role.name, exp: Date.now() + 7 * 24 * 3600 * 1000,
  });
  redirect("/");
}

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-20 bg-blue-600" />
      <main className="flex-1 flex items-center justify-center bg-white">
        <form action={login} className="w-[420px] card p-8 space-y-6">
          <p className="text-slate-700">Please enter your Email and Password</p>
          {searchParams.error && (
            <p className="text-sm text-red-600">Invalid email or password.</p>
          )}
          <input name="email" type="email" required placeholder="Email" className="field" />
          <input name="password" type="password" required placeholder="Password" className="field" />
          <div className="flex justify-end">
            <button className="btn-primary">Login</button>
          </div>
        </form>
      </main>
      <footer className="h-20 bg-blue-600 flex items-center justify-center text-white text-sm">
        ©Copyright Gemach Shivtei Yisroel {new Date().getFullYear()}
      </footer>
    </div>
  );
}

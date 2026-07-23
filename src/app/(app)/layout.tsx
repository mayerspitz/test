import { redirect } from "next/navigation";
import { Landmark, LogOut, Search } from "lucide-react";
import { getSession, clearSessionCookie } from "@/lib/auth";
import SideNav from "@/components/SideNav";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  clearSessionCookie();
  redirect("/login");
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect("/login");
  const initials = session.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white sticky top-0 z-20 shadow-md shadow-blue-900/10">
        <div className="flex items-center gap-4 px-4 h-16">
          <div className="flex items-center gap-3 w-52 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Landmark size={20} />
            </div>
            <div className="leading-tight">
              <p className="font-semibold tracking-wide">Shivtei Yisroel</p>
              <p className="text-[11px] text-blue-200">Loans CRM</p>
            </div>
          </div>
          <form action="/search" className="flex-1 max-w-2xl hidden md:block">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                placeholder="Search members, borrowers, co-borrowers, potentials…"
                className="w-full rounded-full pl-10 pr-4 py-2 text-sm text-slate-800 bg-white outline-none ring-2 ring-transparent focus:ring-blue-300 transition"
              />
            </div>
          </form>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-blue-500 flex items-center justify-center text-sm font-semibold">
                {initials}
              </div>
              <div className="leading-tight hidden sm:block">
                <p className="text-sm font-medium">{session.name}</p>
                <p className="text-[11px] text-blue-200">{session.role}</p>
              </div>
            </div>
            <form action={logout}>
              <button
                title="Logout"
                className="h-9 w-9 rounded-full hover:bg-white/15 flex items-center justify-center transition"
              >
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="w-60 shrink-0 bg-gradient-to-b from-blue-700 to-blue-800 text-white">
          <SideNav />
        </aside>
        <main className="flex-1 bg-slate-50 p-6 overflow-x-auto">{children}</main>
      </div>
      <footer className="bg-blue-800 text-blue-200 text-center text-xs py-3">
        ©Copyright {new Date().getFullYear()} Gemach Shivtei Yisroel
      </footer>
    </div>
  );
}

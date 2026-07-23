import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/members", label: "Members", icon: "👥" },
  { href: "/potential-members", label: "Potential Members", icon: "🤝" },
  { href: "/children", label: "Children", icon: "🧒" },
  { href: "/borrowers", label: "Borrowers", icon: "💳" },
  { href: "/co-borrowers", label: "Co-Borrowers", icon: "🤲" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

async function logout() {
  "use server";
  clearSessionCookie();
  redirect("/login");
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white flex items-center justify-between px-4 h-14 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-wide">Shivtei Yisroel</span>
          <span className="text-blue-200 text-sm hidden sm:inline">Loans CRM</span>
        </div>
        <form action="/search" className="flex-1 max-w-xl mx-6 hidden md:block">
          <input
            name="q"
            placeholder="Search members, borrowers, co-borrowers…"
            className="w-full rounded-full px-4 py-1.5 text-sm text-slate-800 outline-none"
          />
        </form>
        <div className="flex items-center gap-4 text-sm">
          <span>{session.name} · {session.role}</span>
          <form action={logout}>
            <button className="bg-blue-700 hover:bg-blue-800 rounded px-3 py-1.5">Logout</button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="w-56 bg-blue-600 text-white py-4 space-y-1 shrink-0">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-700 text-sm">
              <span>{n.icon}</span> {n.label}
            </Link>
          ))}
        </aside>
        <main className="flex-1 bg-white p-6 overflow-x-auto">{children}</main>
      </div>
      <footer className="bg-blue-600 text-white text-center text-sm py-4">
        ©Copyright {new Date().getFullYear()} Gemach Shivtei Yisroel
      </footer>
    </div>
  );
}

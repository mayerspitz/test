"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, UserPlus, Baby, Landmark, HandCoins, Settings,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/potential-members", label: "Potential Members", icon: UserPlus },
  { href: "/children", label: "Children", icon: Baby },
  { href: "/borrowers", label: "Borrowers", icon: Landmark },
  { href: "/co-borrowers", label: "Co-Borrowers", icon: HandCoins },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="py-4 px-3 space-y-1">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
        Manage
      </p>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-white/15 text-white font-medium"
                : "text-blue-100 hover:bg-white/10 hover:text-white"
            }`}
          >
            {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r bg-white" />}
            <Icon size={18} strokeWidth={active ? 2.4 : 2} className="shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

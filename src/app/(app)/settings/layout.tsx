import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6">
      <aside className="w-52 shrink-0 card p-2 h-fit">
        <p className="font-semibold px-3 py-2">Settings</p>
        <nav className="text-sm">
          <Link className="block px-3 py-2 rounded hover:bg-blue-50" href="/settings">Configuration</Link>
          <Link className="block px-3 py-2 rounded hover:bg-blue-50" href="/settings/plans">Plans</Link>
          <Link className="block px-3 py-2 rounded hover:bg-blue-50" href="/settings/users">Users</Link>
          <Link className="block px-3 py-2 rounded hover:bg-blue-50" href="/settings/roles">Roles &amp; Permissions</Link>
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}

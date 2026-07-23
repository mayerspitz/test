import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MembersPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const members = await db.member.findMany({
    where: q ? { OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { memberNo: Number.isFinite(Number(q)) ? Number(q) : undefined },
    ] } : undefined,
    include: { children: { include: { units: true } } },
    orderBy: { memberNo: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Member List</h1>
        <Link href="/members/new" className="btn-primary">Add Member</Link>
      </div>
      <form className="max-w-md">
        <input name="q" defaultValue={q} placeholder="Search…" className="field" />
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="table-head">ID</th>
              <th className="table-head">First Name</th>
              <th className="table-head">Last Name</th>
              <th className="table-head">Address</th>
              <th className="table-head">Member Since</th>
              <th className="table-head">Children</th>
              <th className="table-head">Units</th>
              <th className="table-head" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const units = m.children.reduce((n, c) => n + c.units.length, 0);
              const overdue = m.children.some((c) => c.units.some((u) => Number(u.overdue) > 0));
              return (
                <tr key={m.id} className="odd:bg-slate-50 hover:bg-blue-50">
                  <td className="table-cell">
                    <Link href={`/members/${m.id}`} className="text-blue-600 hover:underline">{m.memberNo}</Link>
                  </td>
                  <td className="table-cell">{m.firstName}</td>
                  <td className="table-cell">{m.lastName}</td>
                  <td className="table-cell">{m.address} {m.city}</td>
                  <td className="table-cell">{m.memberSince.toLocaleDateString()}</td>
                  <td className="table-cell">{m.children.length}</td>
                  <td className="table-cell">{units}</td>
                  <td className="table-cell">
                    {overdue && <span className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded">Action Needed</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

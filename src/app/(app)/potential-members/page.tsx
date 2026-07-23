import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PotentialMembersPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab === "cancelled" ? "Cancelled" : "Active";
  const list = await db.potentialMember.findMany({
    where: { status: tab },
    orderBy: { createdOn: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Potential Members List</h1>
        <Link href="/potential-members/new" className="btn-primary">Add</Link>
      </div>
      <div className="flex gap-1">
        <Link href="/potential-members" className={`px-4 py-2 text-sm rounded-t border ${tab === "Active" ? "bg-white border-slate-300 border-b-white font-medium" : "bg-slate-100 border-transparent"}`}>Active</Link>
        <Link href="/potential-members?tab=cancelled" className={`px-4 py-2 text-sm rounded-t border ${tab === "Cancelled" ? "bg-white border-slate-300 border-b-white font-medium" : "bg-slate-100 border-transparent"}`}>Cancelled</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="table-head">Caller Id Number</th><th className="table-head">Caller Id Name</th>
              <th className="table-head">Name</th><th className="table-head">Date Created</th><th className="table-head">Follow-Up Date</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="odd:bg-slate-50 hover:bg-blue-50">
                <td className="table-cell">
                  <Link href={`/potential-members/${p.id}`} className="text-blue-600 hover:underline">{p.callerIdNumber ?? "—"}</Link>
                </td>
                <td className="table-cell">{p.callerIdName ?? "—"}</td>
                <td className="table-cell">{[p.firstName, p.lastName].filter(Boolean).join(" ") || "-"}</td>
                <td className="table-cell">{p.createdOn.toLocaleDateString()}</td>
                <td className="table-cell">{p.followUpDate?.toLocaleDateString() ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

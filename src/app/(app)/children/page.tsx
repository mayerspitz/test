import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChildrenPage({ searchParams }: { searchParams: { member?: string } }) {
  const children = await db.child.findMany({
    where: searchParams.member ? { memberId: searchParams.member } : undefined,
    include: { member: true, units: true, borrower: true },
    orderBy: [{ member: { memberNo: "asc" } }, { letter: "asc" }],
    take: 200,
  });

  const sum = (fn: (u: (typeof children)[number]["units"][number]) => number) =>
    children.reduce((n, c) => n + c.units.reduce((s, u) => s + fn(u), 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Children List</h1>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="table-head">ID</th><th className="table-head">Name</th><th className="table-head">Member</th>
              <th className="table-head">Units</th><th className="table-head">Membership Amount</th>
              <th className="table-head">Paid</th><th className="table-head">Balance</th>
              <th className="table-head">Monthly</th><th className="table-head">Overdue</th>
              <th className="table-head">Status</th><th className="table-head">Borrower Id</th>
            </tr>
          </thead>
          <tbody>
            {children.map((c) => {
              const t = (fn: (u: (typeof c.units)[number]) => number) => c.units.reduce((s, u) => s + fn(u), 0);
              return (
                <tr key={c.id} className="odd:bg-slate-50 hover:bg-blue-50">
                  <td className="table-cell">{c.member.memberNo}{c.letter}</td>
                  <td className="table-cell">{c.name}</td>
                  <td className="table-cell">
                    <Link href={`/members/${c.memberId}`} className="text-blue-600 hover:underline">
                      {c.member.memberNo} - {c.member.firstName} {c.member.lastName}
                    </Link>
                  </td>
                  <td className="table-cell">{c.units.length}</td>
                  <td className="table-cell">${t((u) => Number(u.membershipAmount))}</td>
                  <td className="table-cell">${t((u) => Number(u.paid))}</td>
                  <td className="table-cell">${t((u) => Number(u.membershipAmount) - Number(u.paid))}</td>
                  <td className="table-cell">${t((u) => Number(u.monthlyMembership))}</td>
                  <td className="table-cell">${t((u) => Number(u.overdue))}</td>
                  <td className="table-cell">{c.status}</td>
                  <td className="table-cell">
                    {c.borrower && (
                      <Link href={`/borrowers/${c.borrower.id}`} className="text-blue-600 border border-blue-600 rounded px-2 py-0.5 text-xs">
                        {c.borrower.borrowerNo}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 font-semibold">
              <td className="table-cell" colSpan={3}>Total:</td>
              <td className="table-cell">{children.reduce((n, c) => n + c.units.length, 0)}</td>
              <td className="table-cell">${sum((u) => Number(u.membershipAmount))}</td>
              <td className="table-cell">${sum((u) => Number(u.paid))}</td>
              <td className="table-cell">${sum((u) => Number(u.membershipAmount) - Number(u.paid))}</td>
              <td className="table-cell">${sum((u) => Number(u.monthlyMembership))}</td>
              <td className="table-cell">${sum((u) => Number(u.overdue))}</td>
              <td className="table-cell" colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

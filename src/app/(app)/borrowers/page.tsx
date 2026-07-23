import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BorrowersPage() {
  const borrowers = await db.borrower.findMany({
    include: { loans: true, payerMember: true, child: { include: { units: true } } },
    orderBy: { borrowerNo: "asc" },
    take: 200,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Borrowers List</h1>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="table-head">ID</th><th className="table-head">First Name</th><th className="table-head">Last Name</th>
              <th className="table-head">Borrower Since</th><th className="table-head">Payer</th>
              <th className="table-head">Units</th><th className="table-head">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {borrowers.map((b) => {
              const overdue = b.loans.reduce((s, l) => s + Number(l.overdue), 0);
              return (
                <tr key={b.id} className="odd:bg-slate-50 hover:bg-blue-50">
                  <td className="table-cell">
                    <Link href={`/borrowers/${b.id}`} className="text-blue-600 hover:underline">{b.borrowerNo}</Link>
                  </td>
                  <td className="table-cell">{b.firstName}</td>
                  <td className="table-cell">{b.lastName}</td>
                  <td className="table-cell">{b.dateCreated.toLocaleDateString()}</td>
                  <td className="table-cell">
                    {b.payerType === "Member" && b.payerMember
                      ? `Member - ${b.payerMember.firstName} ${b.payerMember.lastName}`
                      : b.payerType === "Other" ? `Other - ${b.payerOtherName ?? ""}` : "Borrower"}
                  </td>
                  <td className="table-cell">{b.child?.units.length ?? 0}</td>
                  <td className="table-cell">
                    {overdue > 0 && <span className="text-red-600 font-semibold">${overdue}</span>}
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

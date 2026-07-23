import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CoBorrowersPage() {
  const list = await db.coBorrower.findMany({ include: { loans: true }, orderBy: { coNo: "asc" }, take: 200 });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Co-Borrowers List</h1>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="table-head">ID</th><th className="table-head">First Name</th><th className="table-head">Last Name</th>
              <th className="table-head">Created On</th><th className="table-head">Units</th><th className="table-head">Actively Paying</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="odd:bg-slate-50 hover:bg-blue-50">
                <td className="table-cell">
                  <Link href={`/co-borrowers/${c.id}`} className="text-blue-600 hover:underline">{c.coNo}</Link>
                </td>
                <td className="table-cell">{c.firstName}</td>
                <td className="table-cell">{c.lastName}</td>
                <td className="table-cell">{c.createdAt.toLocaleDateString()}</td>
                <td className="table-cell">{c.loans.length}</td>
                <td className="table-cell">{c.activelyPaying ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

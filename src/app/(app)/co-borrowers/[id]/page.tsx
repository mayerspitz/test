import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CoBorrowerDetail({ params }: { params: { id: string } }) {
  const c = await db.coBorrower.findUnique({
    where: { id: params.id },
    include: { contacts: true, loans: { include: { loan: { include: { borrower: true, unit: true } } } } },
  });
  if (!c) notFound();
  const notes = await db.note.findMany({ where: { ownerType: "coborrower", ownerId: c.id }, orderBy: { date: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Co-Borrower: {c.coNo} - {c.firstName} {c.lastName}</h1>
        <span className="text-sm text-slate-500">Date Created: {c.createdAt.toLocaleDateString()}</span>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="card">
          <div className="card-title">Personal</div>
          <div className="p-4 text-sm space-y-1">
            <p>Hebrew Name: <span dir="rtl">{c.hebrewName}</span></p>
            <p>Address: {c.address}, {c.aptUnit} {c.city} {c.state}, {c.zip}</p>
            <p>Business Address: {c.businessAddress}</p>
            {c.contacts.map((p) => <p key={p.id}>{p.label}: {p.value}</p>)}
            <p>Occupation: {c.occupation}</p>
            <p>Kehila: {c.kehila} · Bhm&quot;d: {c.bhmd}</p>
            <p>Fathers&apos; Name: {c.fathersName} · Father In-Law: {c.fatherInLaw}</p>
          </div>
        </section>
        <section className="card lg:col-span-2">
          <div className="card-title">Units (loans this co-borrower backs)</div>
          <table className="w-full">
            <thead className="bg-blue-50">
              <tr>
                <th className="table-head">Loan</th><th className="table-head">Borrower</th><th className="table-head">Amount</th>
                <th className="table-head">Monthly</th><th className="table-head">Balance</th><th className="table-head">Paid by Co-Borrower</th>
              </tr>
            </thead>
            <tbody>
              {c.loans.map((lc) => (
                <tr key={lc.loanId} className="odd:bg-slate-50">
                  <td className="table-cell">{lc.loan.loanNo}</td>
                  <td className="table-cell">{lc.loan.borrower.firstName} {lc.loan.borrower.lastName}</td>
                  <td className="table-cell">${Number(lc.loan.amount)}</td>
                  <td className="table-cell">${Number(lc.loan.monthlyPayment)}</td>
                  <td className="table-cell">${Number(lc.loan.amount) - Number(lc.loan.amountPaid)}</td>
                  <td className="table-cell">${Number(lc.paidByCoBorrower)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card lg:col-span-3">
          <div className="card-title">Notes</div>
          <div className="p-4 space-y-3 text-sm">
            {notes.length === 0 && <p className="text-slate-500">No notes.</p>}
            {notes.map((n) => (
              <div key={n.id} className="border border-slate-200 rounded p-3">
                <p className="text-xs text-slate-500">{n.date.toLocaleDateString()}</p><p>{n.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

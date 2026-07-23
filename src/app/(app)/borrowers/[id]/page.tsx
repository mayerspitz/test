import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BorrowerDetail({ params }: { params: { id: string } }) {
  const b = await db.borrower.findUnique({
    where: { id: params.id },
    include: {
      contacts: true, payerMember: { include: { contacts: true } },
      child: { include: { units: true, member: true } },
      loans: { include: { unit: true, coBorrowers: { include: { coBorrower: true } } } },
    },
  });
  if (!b) notFound();
  const [notes, history] = await Promise.all([
    db.note.findMany({ where: { ownerType: "borrower", ownerId: b.id }, orderBy: { date: "desc" } }),
    db.historyLog.findMany({ where: { ownerType: "borrower", ownerId: b.id }, orderBy: { date: "desc" }, take: 10 }),
  ]);
  const monthly = b.loans.reduce((s, l) => s + Number(l.monthlyPayment), 0);
  const overdue = b.loans.reduce((s, l) => s + Number(l.overdue), 0);
  const availableUnits = (b.child?.units.length ?? 0) - b.loans.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Borrower: {b.borrowerNo} - {b.firstName} {b.lastName}</h1>
        <span className="text-sm text-slate-500">Date Created: {b.dateCreated.toLocaleDateString()}</span>
      </div>
      <p className="text-sm"><span className="font-semibold">Label:</span> {b.label ?? "—"}</p>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <section className="card">
            <div className="card-title">Contact Information</div>
            <div className="p-4 text-sm space-y-2">
              <p className="font-semibold underline">Personal</p>
              <p>Hebrew Name: <span dir="rtl">{b.hebrewName}</span></p>
              <p>Address: {b.address}, {b.aptUnit} {b.city} {b.state}, {b.zip}</p>
              {b.contacts.map((c) => <p key={c.id}>{c.label}: {c.value}{c.isPrimary ? " (Primary)" : ""}</p>)}
              {b.payerMember && (
                <>
                  <p className="font-semibold underline pt-2">Payer Contact (Member)</p>
                  <p>{b.payerMember.firstName} {b.payerMember.lastName}</p>
                  {b.payerMember.contacts.map((c) => <p key={c.id}>{c.label}: {c.value}</p>)}
                </>
              )}
            </div>
          </section>
          <section className="card">
            <div className="card-title">Co-Borrowers</div>
            <div className="p-4 text-sm space-y-1">
              {b.loans.flatMap((l) => l.coBorrowers).map((cb) => (
                <p key={cb.coBorrowerId}>
                  <Link href={`/co-borrowers/${cb.coBorrowerId}`} className="text-blue-600 hover:underline">
                    {cb.coBorrower.firstName} {cb.coBorrower.lastName}
                  </Link>
                </p>
              ))}
              {b.loans.every((l) => l.coBorrowers.length === 0) && <p className="text-slate-500">None</p>}
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="card">
            <div className="card-title">Payments</div>
            <div className="p-4 text-sm grid grid-cols-2 gap-2">
              <p>Monthly Loan Payment</p><p className="text-right font-bold text-lg">${monthly}</p>
              <p>Overdue</p><p className={`text-right font-bold text-lg ${overdue > 0 ? "text-red-600" : ""}`}>${overdue}</p>
            </div>
          </section>
          <section className="card">
            <div className="card-title flex justify-between">
              <span>Units</span>
              <span className="text-sm text-slate-500">{availableUnits} Available Units</span>
            </div>
            {b.loans.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 space-y-3">
                <p>No exercised units</p>
                <button className="btn-secondary">Exercise Units</button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="table-head">Loan</th><th className="table-head">Date</th><th className="table-head">Amount</th>
                    <th className="table-head">Monthly</th><th className="table-head">Paid</th>
                    <th className="table-head">Balance</th><th className="table-head">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {b.loans.map((l) => (
                    <tr key={l.id} className="odd:bg-slate-50">
                      <td className="table-cell">{l.loanNo}</td>
                      <td className="table-cell">{l.loanDate.toLocaleDateString()}</td>
                      <td className="table-cell">${Number(l.amount)}</td>
                      <td className="table-cell">${Number(l.monthlyPayment)}</td>
                      <td className="table-cell">${Number(l.amountPaid)}</td>
                      <td className="table-cell">${Number(l.amount) - Number(l.amountPaid)}</td>
                      <td className="table-cell">${Number(l.overdue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
        <div className="space-y-6">
          <section className="card">
            <div className="card-title">Notes</div>
            <div className="p-4 space-y-3 text-sm">
              {notes.map((n) => (
                <div key={n.id} className="border border-slate-200 rounded p-3">
                  <p className="text-xs text-slate-500">{n.date.toLocaleDateString()}</p><p>{n.text}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-title">History Log</div>
            <div className="p-4 space-y-3 text-sm">
              {history.map((h) => (
                <div key={h.id} className="border-b border-slate-100 pb-2">
                  <p className="text-xs text-slate-500">{h.category} · {h.date.toLocaleString()}</p>
                  <p>{h.details}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

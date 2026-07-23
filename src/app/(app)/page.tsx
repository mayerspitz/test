import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [declined, overdueUnits, overdueLoans, followUps] = await Promise.all([
    db.transaction.findMany({ where: { status: "declined" }, take: 10, orderBy: { dateTime: "desc" } }),
    db.unit.findMany({ where: { overdue: { gt: 0 } }, take: 10, include: { child: { include: { member: true } } } }),
    db.loan.findMany({ where: { overdue: { gt: 0 } }, take: 10, include: { borrower: true } }),
    db.callLog.findMany({ where: { kind: "scheduled" }, take: 10, orderBy: { date: "asc" }, include: { potential: true } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <section className="card">
          <div className="card-title">Action Needed</div>
          <div className="p-4 space-y-4 text-sm">
            <div>
              <p className="font-semibold mb-1">Members / Units:</p>
              {overdueUnits.length === 0 && <p className="text-slate-500">Nothing needs attention.</p>}
              {overdueUnits.map((u) => (
                <div key={u.id} className="flex justify-between py-1 border-b border-slate-100">
                  <Link className="text-blue-600 hover:underline" href={`/members/${u.child.member.id}`}>
                    {u.child.member.memberNo}{u.child.letter}{u.seq} - {u.child.member.firstName} {u.child.member.lastName}
                  </Link>
                  <span className="text-red-600 font-medium">Overdue ${Number(u.overdue)}</span>
                </div>
              ))}
              {declined.map((t) => (
                <div key={t.id} className="flex justify-between py-1 border-b border-slate-100">
                  <span>Transaction ${Number(t.amount)} · {t.towards}</span>
                  <span className="text-red-600 font-medium">Payment Declined</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-semibold mb-1">Borrowers:</p>
              {overdueLoans.length === 0 && <p className="text-slate-500">Nothing needs attention.</p>}
              {overdueLoans.map((l) => (
                <div key={l.id} className="flex justify-between py-1 border-b border-slate-100">
                  <Link className="text-blue-600 hover:underline" href={`/borrowers/${l.borrowerId}`}>
                    {l.loanNo} - {l.borrower.firstName} {l.borrower.lastName}
                  </Link>
                  <span className="text-red-600 font-medium">Overdue ${Number(l.overdue)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-title">Follow Ups — Non Members</div>
          <div className="p-4 text-sm space-y-2">
            {followUps.length === 0 && <p className="text-slate-500">No follow ups scheduled.</p>}
            {followUps.map((c) => (
              <div key={c.id} className="flex justify-between py-1 border-b border-slate-100">
                <Link className="text-blue-600 hover:underline" href={`/potential-members/${c.potentialId}`}>
                  {c.potential.callerIdName ?? c.potential.firstName ?? "Unknown caller"}
                </Link>
                <span className="text-slate-500">{c.date.toLocaleDateString()} · {c.subject}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

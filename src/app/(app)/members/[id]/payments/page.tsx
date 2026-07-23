import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-slate-200 text-slate-700",
  pending: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-700",
};

export default async function MemberPayments({ params }: { params: { id: string } }) {
  const m = await db.member.findUnique({ where: { id: params.id }, include: { children: { include: { units: true } } } });
  if (!m) notFound();
  const [schedules, methods, transactions, credit] = await Promise.all([
    db.paymentSchedule.findMany({ where: { ownerType: "member", ownerId: m.id }, include: { paymentMethod: true } }),
    db.paymentMethod.findMany({ where: { ownerType: "member", ownerId: m.id } }),
    db.transaction.findMany({ where: { ownerType: "member", ownerId: m.id }, orderBy: { dateTime: "desc" }, take: 25 }),
    db.creditAccount.findUnique({ where: { ownerType_ownerId: { ownerType: "member", ownerId: m.id } } }),
  ]);
  const monthlyDue = m.children.reduce((n, c) => n + c.units.reduce((s, u) => s + Number(u.monthlyMembership), 0), 0);
  const overdue = m.children.reduce((n, c) => n + c.units.reduce((s, u) => s + Number(u.overdue), 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Member: {m.memberNo} - {m.firstName} {m.lastName} › Payments</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="card">
          <div className="card-title">Overview</div>
          <div className="p-4 text-sm space-y-1">
            <p>Due this month: <b>${monthlyDue}</b></p>
            <p>Overdue: <b className="text-red-600">${overdue}</b></p>
            <p className="pt-2 font-semibold">Credit Accounts:</p>
            <p>Toward Monthly Membership: ${Number(credit?.towardMonthly ?? 0)}</p>
            <p>Toward End of Membership: ${Number(credit?.towardEnd ?? 0)}</p>
          </div>
        </section>
        <section className="card lg:col-span-2">
          <div className="card-title">Payment Schedules</div>
          <table className="w-full">
            <thead className="bg-blue-50">
              <tr>
                <th className="table-head">Schedule</th><th className="table-head">Amount</th>
                <th className="table-head">Next Payment</th><th className="table-head">Method</th>
                <th className="table-head">Towards</th><th className="table-head" />
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="odd:bg-slate-50">
                  <td className="table-cell">
                    {s.scheduleType === "system-every-nth" ? `Every ${s.dayOfMonth}th` :
                     s.scheduleType === "biweekly" ? `Bi-Weekly - ${s.weekday}` :
                     s.scheduleType === "every-2nd-year" ? "Every 2nd Year" : "One Time"}
                    {s.isSystem && <span className="ml-2 text-xs text-blue-600">System</span>}
                    {s.isDefault && <span className="ml-2 text-xs bg-cyan-100 text-cyan-700 px-1 rounded">Default</span>}
                  </td>
                  <td className="table-cell">${Number(s.amount)}</td>
                  <td className="table-cell">{s.nextPaymentDate?.toLocaleDateString()}</td>
                  <td className="table-cell">{s.paymentMethod ? `${s.paymentMethod.nickname} - ${s.paymentMethod.last4}` : "—"}</td>
                  <td className="table-cell">{s.towards}</td>
                  <td className="table-cell">{!s.active && <span className="text-red-600 text-xs">Inactive</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <div className="card-title">Payment Methods</div>
          <table className="w-full">
            <thead className="bg-blue-50">
              <tr><th className="table-head">Nickname</th><th className="table-head">Last 4</th><th className="table-head">Exp</th><th className="table-head">Owner</th></tr>
            </thead>
            <tbody>
              {methods.map((p) => (
                <tr key={p.id} className="odd:bg-slate-50">
                  <td className="table-cell">{p.nickname}</td>
                  <td className="table-cell">{p.last4}</td>
                  <td className="table-cell">{p.exp ?? "—"}</td>
                  <td className="table-cell">{p.ownerLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card lg:col-span-2">
          <div className="card-title">Transaction History</div>
          <table className="w-full">
            <thead className="bg-blue-50">
              <tr><th className="table-head">Date &amp; Time</th><th className="table-head">Amount</th><th className="table-head">Towards</th><th className="table-head">Status</th></tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="odd:bg-slate-50">
                  <td className="table-cell">{t.dateTime.toLocaleString()}</td>
                  <td className="table-cell">${Number(t.amount)}</td>
                  <td className="table-cell">{t.towards}</td>
                  <td className="table-cell">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_STYLE[t.status] ?? "bg-slate-100"}`}>
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

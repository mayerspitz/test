import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MemberDetail({ params }: { params: { id: string } }) {
  const m = await db.member.findUnique({
    where: { id: params.id },
    include: {
      contacts: true,
      oldInfo: true,
      children: { include: { units: { include: { loan: true } } }, orderBy: { letter: "asc" } },
    },
  });
  if (!m) notFound();

  const [notes, history, docs, credit, schedules] = await Promise.all([
    db.note.findMany({ where: { ownerType: "member", ownerId: m.id }, orderBy: { date: "desc" } }),
    db.historyLog.findMany({ where: { ownerType: "member", ownerId: m.id }, orderBy: { date: "desc" }, take: 10 }),
    db.document.findMany({ where: { ownerType: "member", ownerId: m.id } }),
    db.creditAccount.findUnique({ where: { ownerType_ownerId: { ownerType: "member", ownerId: m.id } } }),
    db.paymentSchedule.findMany({ where: { ownerType: "member", ownerId: m.id, active: true } }),
  ]);

  const totalUnits = m.children.reduce((n, c) => n + c.units.length, 0);
  const monthlyDue = m.children.reduce((n, c) => n + c.units.reduce((s, u) => s + Number(u.monthlyMembership), 0), 0);
  const overdue = m.children.reduce((n, c) => n + c.units.reduce((s, u) => s + Number(u.overdue), 0), 0);
  const loans = m.children.flatMap((c) => c.units.filter((u) => u.loan).map((u) => ({ child: c, unit: u, loan: u.loan! })));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Member: {m.memberNo} - {m.firstName} {m.lastName}</h1>
        <div className="text-sm text-slate-500">Member Since: {m.memberSince.toLocaleDateString()}</div>
      </div>
      <p className="text-sm"><span className="font-semibold">Label:</span> {m.label ?? "—"}</p>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <section className="card">
            <div className="card-title">Personal & Contact</div>
            <div className="p-4 text-sm space-y-2">
              <p><span className="font-semibold">Hebrew Name:</span> <span dir="rtl">{m.hebrewName}</span></p>
              <p><span className="font-semibold">Address:</span> {m.address}, {m.aptUnit} {m.city} {m.state}, {m.zip}</p>
              {m.contacts.map((c) => (
                <p key={c.id}>
                  <span className="font-semibold">{c.label}:</span> {c.value}
                  {c.isPrimary && <span className="ml-2 text-xs text-blue-600 font-medium">Primary</span>}
                  {c.note && <span className="ml-2 text-xs text-slate-500">({c.note})</span>}
                </p>
              ))}
              <p><span className="font-semibold">Kehila:</span> {m.kehila} · <span className="font-semibold">Bhm&quot;d:</span> {m.bhmd}</p>
              <p><span className="font-semibold">Ruv/Dayan:</span> {m.ruvDayan} · <span className="font-semibold">Occupation:</span> {m.occupation}</p>
            </div>
          </section>
          <section className="card">
            <div className="card-title">Old Info</div>
            <div className="p-4 text-sm space-y-2">
              {m.oldInfo.length === 0 && <p className="text-slate-500">No changes recorded.</p>}
              {m.oldInfo.map((o) => (
                <p key={o.id}><span className="font-semibold">{o.field}:</span> {o.value}
                  <span className="text-xs text-slate-500"> (entered {o.dateEntered.toLocaleDateString()}, changed {o.dateChanged.toLocaleDateString()})</span></p>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-title">Documents</div>
            <div className="p-4 text-sm">
              {docs.length === 0 && <p className="text-slate-500">No documents.</p>}
              {docs.map((d) => <p key={d.id}>📄 {d.title} <span className="text-slate-500 text-xs">{d.dateUploaded.toLocaleDateString()}</span></p>)}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <div className="card-title flex justify-between">
              <span>Children</span>
              <Link className="text-blue-600 text-sm hover:underline" href={`/children?member=${m.id}`}>View Details ›</Link>
            </div>
            <table className="w-full">
              <thead className="bg-blue-100">
                <tr><th className="table-head">ID</th><th className="table-head">Name</th><th className="table-head">Units</th></tr>
              </thead>
              <tbody>
                {m.children.map((c) => (
                  <tr key={c.id} className="odd:bg-slate-50">
                    <td className="table-cell">{c.letter}</td>
                    <td className="table-cell">{c.name}</td>
                    <td className="table-cell">{c.units.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 text-sm font-semibold flex justify-between">
              <span>Total Children: {m.children.length}</span>
              <span>Total Units: {totalUnits}</span>
            </div>
          </section>
          <section className="card">
            <div className="card-title">Children Loans</div>
            <div className="p-4 space-y-3 text-sm">
              {loans.length === 0 && <p className="text-slate-500">No loans exercised.</p>}
              {loans.map(({ child, unit, loan }) => (
                <div key={loan.id} className="border border-slate-200 rounded p-3 flex justify-between">
                  <div>
                    <p className="font-semibold">{loan.loanNo} - {child.name}</p>
                    <p className="text-slate-500">{unit.seq} unit(s)</p>
                  </div>
                  <div className="text-right">
                    <p>Balance: ${Number(loan.amount) - Number(loan.amountPaid)}</p>
                    <p>Monthly: ${Number(loan.monthlyPayment)} · Overdue: ${Number(loan.overdue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-title flex justify-between">
              <span>Payments</span>
              <Link className="text-blue-600 text-sm hover:underline" href={`/members/${m.id}/payments`}>View Details ›</Link>
            </div>
            <div className="p-4 text-sm grid grid-cols-2 gap-2">
              <p>Monthly Membership</p><p className="text-right font-bold text-lg">${monthlyDue}</p>
              <p>Overdue</p><p className={`text-right font-bold text-lg ${overdue > 0 ? "text-red-600" : ""}`}>${overdue}</p>
              <p>Credit — toward monthly</p><p className="text-right">${Number(credit?.towardMonthly ?? 0)}</p>
              <p>Credit — toward end</p><p className="text-right">${Number(credit?.towardEnd ?? 0)}</p>
              <p>Active schedules</p><p className="text-right">{schedules.length}</p>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <div className="card-title">Notes</div>
            <div className="p-4 space-y-3 text-sm">
              {notes.map((n) => (
                <div key={n.id} className="border border-slate-200 rounded p-3">
                  <p className="text-xs text-slate-500">{n.date.toLocaleDateString()}</p>
                  <p>{n.text}</p>
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

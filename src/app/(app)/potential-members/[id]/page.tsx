import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PotentialDetail({ params }: { params: { id: string } }) {
  const p = await db.potentialMember.findUnique({
    where: { id: params.id },
    include: { contacts: true, calls: { orderBy: { date: "desc" } } },
  });
  if (!p) notFound();
  const notes = await db.note.findMany({ where: { ownerType: "potential", ownerId: p.id }, orderBy: { date: "desc" } });
  const scheduled = p.calls.filter((c) => c.kind === "scheduled");
  const history = p.calls.filter((c) => c.kind === "history");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Potential Member Information</h1>
        <span className="text-sm text-slate-500">Created On: {p.createdOn.toLocaleDateString()}</span>
      </div>
      <p className="text-sm">
        <span className="font-semibold">Caller ID:</span> {p.callerIdName} - {p.callerIdNumber}
        <span className="ml-6 font-semibold">Status:</span> {p.status}
      </p>
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="card">
          <div className="card-title">Contact Information</div>
          <div className="p-4 text-sm space-y-1">
            <p>Name: {[p.firstName, p.lastName].filter(Boolean).join(" ") || "—"}</p>
            <p>Hebrew Name: <span dir="rtl">{p.hebrewName}</span></p>
            <p>Address: {[p.address, p.aptUnit, p.city, p.state, p.zip].filter(Boolean).join(", ") || "—"}</p>
            {p.contacts.map((c) => <p key={c.id}>{c.label}: {c.value}</p>)}
            <p>Kehila: {p.kehila ?? "—"} · Bhm&quot;d: {p.bhmd ?? "—"}</p>
            <p>Occupation: {p.occupation ?? "—"} · Ruv/Dayan: {p.ruvDayan ?? "—"}</p>
          </div>
        </section>
        <section className="card">
          <div className="card-title">Calls / Follow Ups</div>
          <div className="p-4 text-sm space-y-4">
            <div>
              <p className="font-semibold border-b border-slate-200 pb-1 mb-2">Scheduled</p>
              {scheduled.length === 0 && <p className="text-slate-500">Nothing scheduled.</p>}
              {scheduled.map((c) => (
                <p key={c.id} className="py-1">
                  <span className={c.date < new Date() ? "text-red-600" : ""}>{c.date.toLocaleDateString()}</span> — {c.subject}
                </p>
              ))}
            </div>
            <div>
              <p className="font-semibold border-b border-slate-200 pb-1 mb-2">History</p>
              {history.map((c) => (
                <div key={c.id} className="py-1 border-b border-slate-100">
                  <p className="text-xs text-slate-400">{c.subject}</p>
                  <p>
                    {c.date.toLocaleDateString()} —{" "}
                    {c.outcome === "rescheduled" ? (
                      <span className="text-green-600 font-medium">RESCHEDULED{c.rescheduledTo ? ` → ${c.rescheduledTo.toLocaleDateString()}` : ""}</span>
                    ) : c.outcome === "canceled" ? (
                      <span className="text-red-600 font-medium">CANCELED</span>
                    ) : (
                      c.details ?? c.outcome
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="card">
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

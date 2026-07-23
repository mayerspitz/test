import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function createPotential(formData: FormData) {
  "use server";
  const str = (k: string) => (String(formData.get(k) ?? "").trim() || null);
  const p = await db.potentialMember.create({ data: {
    callerIdName: str("callerIdName"), callerIdNumber: str("callerIdNumber"),
    firstName: str("firstName"), lastName: str("lastName"),
    followUpDate: str("followUpDate") ? new Date(String(formData.get("followUpDate"))) : null,
    calls: str("callDetails") ? { create: [{
      date: str("callDate") ? new Date(String(formData.get("callDate"))) : new Date(),
      subject: String(formData.get("callDetails")), kind: "history", outcome: "discussed",
    }] } : undefined,
    contacts: str("phone") ? { create: [{ kind: "phone", label: "Cell 1", value: String(formData.get("phone")), isPrimary: true }] } : undefined,
  } });
  redirect(`/potential-members/${p.id}`);
}

export default function NewPotentialPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Add Potential Member</h1>
      <form action={createPotential} className="card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input name="callerIdNumber" placeholder="Caller ID Number" className="field" />
          <input name="callerIdName" placeholder="Caller ID Name" className="field" />
          <input name="firstName" placeholder="First Name" className="field" />
          <input name="lastName" placeholder="Last Name" className="field" />
          <input name="phone" placeholder="Phone Number" className="field" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm text-slate-500">Call Date
            <input name="callDate" type="date" className="field" />
          </label>
          <input name="callDetails" placeholder="Call Details" className="field self-end" />
          <label className="text-sm text-slate-500">Follow Up Date
            <input name="followUpDate" type="date" className="field" />
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <a href="/potential-members" className="btn-secondary">Cancel</a>
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}

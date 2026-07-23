import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function createMember(formData: FormData) {
  "use server";
  const last = await db.member.findFirst({ orderBy: { memberNo: "desc" } });
  const memberNo = (last?.memberNo ?? 100) + 1;
  const str = (k: string) => (String(formData.get(k) ?? "").trim() || null);
  const m = await db.member.create({ data: {
    memberNo,
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    hebrewName: str("hebrewName"), label: str("label"),
    address: str("address"), aptUnit: str("aptUnit"), city: str("city"), state: str("state"), zip: str("zip"),
    kehila: str("kehila"), bhmd: str("bhmd"), ruvDayan: str("ruvDayan"), occupation: str("occupation"),
    contacts: {
      create: [
        ...(str("phone") ? [{ kind: "phone", label: "Cell 1", value: String(formData.get("phone")), isPrimary: true, note: str("phoneNote") ?? undefined }] : []),
        ...(str("email") ? [{ kind: "email", label: "Email 1", value: String(formData.get("email")), isPrimary: true }] : []),
      ],
    },
  } });
  redirect(`/members/${m.id}`);
}

export default function NewMemberPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Create New Member</h1>
      <form action={createMember} className="grid md:grid-cols-3 gap-6">
        <section className="card p-4 space-y-3">
          <h2 className="font-semibold">Personal</h2>
          <input name="firstName" required placeholder="First Name" className="field" />
          <input name="lastName" required placeholder="Last Name" className="field" />
          <input name="hebrewName" placeholder="Hebrew Name" dir="rtl" className="field" />
          <input name="label" placeholder="Label" className="field" />
          <input name="address" placeholder="Address" className="field" />
          <input name="aptUnit" placeholder="APT/Unit" className="field" />
          <input name="city" placeholder="City" className="field" />
          <input name="state" placeholder="State" className="field" />
          <input name="zip" placeholder="Zip" className="field" />
        </section>
        <section className="card p-4 space-y-3">
          <h2 className="font-semibold">Contact</h2>
          <input name="phone" placeholder="Phone Number (Cell 1)" className="field" />
          <input name="phoneNote" placeholder="Phone note (e.g. don't call after 5pm)" className="field" />
          <input name="email" type="email" placeholder="Email" className="field" />
        </section>
        <section className="card p-4 space-y-3">
          <h2 className="font-semibold">Additional Info</h2>
          <input name="kehila" placeholder="Kehila" className="field" />
          <input name="bhmd" placeholder={'Bhm"d'} className="field" />
          <input name="occupation" placeholder="Occupation" className="field" />
          <input name="ruvDayan" placeholder="Ruv/Dayan" className="field" />
        </section>
        <div className="md:col-span-3 flex justify-end gap-3">
          <a href="/members" className="btn-secondary">Cancel</a>
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}

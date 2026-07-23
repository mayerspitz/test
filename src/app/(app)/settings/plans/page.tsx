import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function togglePlan(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const plan = await db.plan.findUnique({ where: { id } });
  if (plan) await db.plan.update({ where: { id }, data: { active: !plan.active } });
  revalidatePath("/settings/plans");
}

export default async function PlansPage() {
  const plans = await db.plan.findMany({ orderBy: { code: "asc" }, include: { units: true } });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plans</h1>
        <button className="btn-primary" disabled>Add (soon)</button>
      </div>
      <div className="space-y-4">
        {plans.map((p) => (
          <section key={p.id} className="card">
            <div className="card-title flex items-center justify-between">
              <span>{p.code} - {p.title}</span>
              <form action={togglePlan} className="flex items-center gap-3">
                <input type="hidden" name="id" value={p.id} />
                <span className={`text-sm ${p.active ? "text-blue-600" : "text-red-500"}`}>{p.active ? "Active" : "Inactive"}</span>
                <button className="btn-secondary text-xs">{p.active ? "Deactivate" : "Activate"}</button>
                {p.units.length === 0 && <span className="text-xs text-slate-400">(no units — editable/deletable)</span>}
              </form>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-8 text-sm">
              <div>
                <p className="font-semibold mb-2">Membership</p>
                <p>Total Membership Amount: <b>${Number(p.membershipTotal)}</b></p>
                <p>Months to Pay: <b>{p.membershipMonths}</b></p>
                <p>Amount per Month: <b>${Number(p.membershipPerMonth)}</b></p>
                {p.membershipLastMonth && <p>Amount for Last Month: <b>${Number(p.membershipLastMonth)}</b></p>}
              </div>
              <div>
                <p className="font-semibold mb-2">Loan</p>
                <p>Potential Loan Amount: <b>${Number(p.loanAmount)}</b></p>
                <p>Months to Pay: <b>{p.loanMonths}</b></p>
                <p>Amount per Month: <b>${Number(p.loanPerMonth)}</b></p>
                <p>Potential Credit: <b>${Number(p.potentialCredit)}</b> <span className="text-slate-500">Last {p.potentialCreditMonths} Months</span></p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

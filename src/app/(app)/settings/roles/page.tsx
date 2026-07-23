import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const PERMISSION_LABELS: Record<string, string> = {
  all: "All permissions allowed",
  addMembers: "Add Members",
  addUnits: "Add Units",
  makePayments: "Make Payments",
  cancelUnits: "Cancel Units",
  addLoan: "Add Loan",
  changeFeeSettings: "Change Fee Settings",
  addUsers: "Add Users",
  viewPaymentInfo: "View Payment Info",
  addNote: "Add Note",
};

export default async function RolesPage() {
  const roles = await db.role.findMany({ orderBy: { name: "asc" }, include: { users: true } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Roles &amp; Permissions</h1>
      <div className="space-y-4 max-w-2xl">
        {roles.map((r) => {
          const perms = r.permissions as Record<string, boolean>;
          return (
            <section key={r.id} className="card">
              <div className="card-title flex justify-between">
                <span>{r.name}</span>
                <span className="text-sm font-normal text-slate-500">{r.users.length} user(s)</span>
              </div>
              <div className="p-4 text-sm">
                {perms.all ? <p className="font-medium">All permissions allowed</p> : (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PERMISSION_LABELS).filter(([k]) => k !== "all").map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2">
                        <input type="checkbox" checked={Boolean(perms[k])} readOnly className="accent-blue-600" />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

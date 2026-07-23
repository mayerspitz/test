import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function addUser(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!email || !password || !roleId) return;
  await db.user.create({ data: {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email, phone: String(formData.get("phone") ?? "").trim() || null,
    passwordHash: await bcrypt.hash(password, 10), roleId,
  } });
  revalidatePath("/settings/users");
}

export default async function UsersPage() {
  const [users, roles] = await Promise.all([
    db.user.findMany({ include: { role: true }, orderBy: { createdAt: "asc" } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="table-head">First Name</th><th className="table-head">Last Name</th>
              <th className="table-head">Email</th><th className="table-head">Phone</th><th className="table-head">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="odd:bg-slate-50">
                <td className="table-cell">{u.firstName}</td>
                <td className="table-cell">{u.lastName}</td>
                <td className="table-cell">{u.email}</td>
                <td className="table-cell">{u.phone ?? "—"}</td>
                <td className="table-cell">{u.role.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card max-w-xl">
        <div className="card-title">Add User</div>
        <form action={addUser} className="p-4 grid grid-cols-2 gap-4">
          <input name="firstName" required placeholder="First Name" className="field" />
          <input name="lastName" required placeholder="Last Name" className="field" />
          <input name="email" type="email" required placeholder="Email" className="field" />
          <input name="phone" placeholder="Phone" className="field" />
          <input name="password" type="password" required placeholder="Password" className="field" />
          <select name="roleId" required className="field">
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="col-span-2 flex justify-end">
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}

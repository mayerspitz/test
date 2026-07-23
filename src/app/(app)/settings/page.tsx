import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getConfigGroups } from "@/lib/config";

export const dynamic = "force-dynamic";

async function saveConfig(formData: FormData) {
  "use server";
  const items = await db.configItem.findMany();
  for (const item of items) {
    const raw = formData.get(item.key);
    if (raw === null) continue;
    const text = String(raw);
    let value: unknown = text;
    if (item.type === "int") value = parseInt(text || "0", 10);
    else if (["decimal", "percent", "money"].includes(item.type)) value = parseFloat(text || "0");
    else if (item.type === "bool") value = text === "on" || text === "true";
    else if (item.type === "list") value = text.split("\n").map((s) => s.trim()).filter(Boolean);
    if (JSON.stringify(value) !== JSON.stringify(item.value)) {
      await db.configItem.update({
        where: { key: item.key },
        data: { value: value as string | number | boolean | string[] },
      });
    }
  }
  revalidatePath("/settings");
}

export default async function ConfigPage() {
  const groups = await getConfigGroups();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuration</h1>
      </div>
      <p className="text-sm text-slate-500 max-w-2xl">
        Every business variable lives here — amounts, fees, retry rules, limits and option lists.
        Changing a value takes effect immediately across the app (e.g. max units per child is used
        to validate the Add Unit flow).
      </p>
      <form action={saveConfig} className="space-y-6">
        {Array.from(groups.entries()).map(([group, items]) => (
          <section key={group} className="card">
            <div className="card-title">{group}</div>
            <div className="p-4 grid md:grid-cols-2 gap-x-8 gap-y-4">
              {items.map((item) => (
                <label key={item.key} className="text-sm block">
                  <span className="font-medium">{item.label}</span>
                  {item.description && <span className="block text-xs text-slate-500">{item.description}</span>}
                  {item.type === "list" ? (
                    <textarea
                      name={item.key}
                      defaultValue={(item.value as string[]).join("\n")}
                      rows={Math.min(6, (item.value as string[]).length + 1)}
                      className="field font-mono"
                    />
                  ) : item.type === "select" ? (
                    <select name={item.key} defaultValue={String(item.value)} className="field">
                      {(item.options as string[]).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <span className="flex items-center gap-1">
                      {item.type === "money" && <span className="text-slate-400">$</span>}
                      <input
                        name={item.key}
                        defaultValue={String(item.value)}
                        type={["int", "decimal", "percent", "money"].includes(item.type) ? "number" : "text"}
                        step={item.type === "int" ? 1 : 0.01}
                        className="field"
                      />
                      {item.type === "percent" && <span className="text-slate-400">%</span>}
                    </span>
                  )}
                  <span className="block text-[10px] text-slate-400 mt-0.5 font-mono">{item.key}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
        <div className="flex justify-end">
          <button className="btn-primary">Save Configuration</button>
        </div>
      </form>
    </div>
  );
}

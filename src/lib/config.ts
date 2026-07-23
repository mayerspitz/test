import { db } from "./db";

/** Read a config value with a fallback. All tunable business variables live in ConfigItem. */
export async function getConfig<T = unknown>(key: string, fallback: T): Promise<T> {
  const item = await db.configItem.findUnique({ where: { key } });
  return item ? (item.value as T) : fallback;
}

export async function getConfigGroups() {
  const items = await db.configItem.findMany({ orderBy: [{ group: "asc" }, { label: "asc" }] });
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    if (!groups.has(it.group)) groups.set(it.group, []);
    groups.get(it.group)!.push(it);
  }
  return groups;
}

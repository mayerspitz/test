import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  if (!q) return <p className="text-slate-500">Type a search query above.</p>;
  const insensitive = { contains: q, mode: "insensitive" as const };
  const [members, borrowers, coBorrowers, potentials] = await Promise.all([
    db.member.findMany({ where: { OR: [{ firstName: insensitive }, { lastName: insensitive }] }, take: 10, include: { children: { include: { units: true } } } }),
    db.borrower.findMany({ where: { OR: [{ firstName: insensitive }, { lastName: insensitive }, { borrowerNo: insensitive }] }, take: 10 }),
    db.coBorrower.findMany({ where: { OR: [{ firstName: insensitive }, { lastName: insensitive }, { coNo: insensitive }] }, take: 10 }),
    db.potentialMember.findMany({ where: { OR: [{ firstName: insensitive }, { lastName: insensitive }, { callerIdName: insensitive }, { callerIdNumber: insensitive }] }, take: 10 }),
  ]);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h2 className="font-bold text-sm mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold">Search Results for “{q}”</h1>
      <Section title="Members">
        {members.length === 0 && <p className="text-sm text-slate-500">No matches.</p>}
        {members.map((m) => (
          <Link key={m.id} href={`/members/${m.id}`} className="card p-3 flex justify-between text-sm hover:bg-blue-50">
            <span className="text-blue-600">{m.memberNo} - {m.firstName} {m.lastName}</span>
            <span>{m.address}</span>
            <span>Children: {m.children.length}</span>
            <span>Units: {m.children.reduce((n, c) => n + c.units.length, 0)}</span>
          </Link>
        ))}
      </Section>
      <Section title="Borrowers">
        {borrowers.length === 0 && <p className="text-sm text-slate-500">No matches.</p>}
        {borrowers.map((b) => (
          <Link key={b.id} href={`/borrowers/${b.id}`} className="card p-3 flex justify-between text-sm hover:bg-blue-50">
            <span className="text-blue-600">{b.borrowerNo} - {b.firstName} {b.lastName}</span>
            <span>{b.address}</span>
          </Link>
        ))}
      </Section>
      <Section title="Co-Borrowers">
        {coBorrowers.length === 0 && <p className="text-sm text-slate-500">No matches.</p>}
        {coBorrowers.map((c) => (
          <Link key={c.id} href={`/co-borrowers/${c.id}`} className="card p-3 flex justify-between text-sm hover:bg-blue-50">
            <span className="text-blue-600">{c.coNo} - {c.firstName} {c.lastName}</span>
            <span>{c.address}</span>
          </Link>
        ))}
      </Section>
      <Section title="Potential Members">
        {potentials.length === 0 && <p className="text-sm text-slate-500">No matches.</p>}
        {potentials.map((p) => (
          <Link key={p.id} href={`/potential-members/${p.id}`} className="card p-3 flex justify-between text-sm hover:bg-blue-50">
            <span className="text-blue-600">{p.callerIdName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`}</span>
            <span>{p.callerIdNumber}</span>
          </Link>
        ))}
      </Section>
    </div>
  );
}

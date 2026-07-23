import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ── Every value that could be "subject as a variable" lives here ──────────────
const CONFIG: Array<{
  key: string; group: string; label: string; type: string;
  value: unknown; description?: string; options?: unknown;
}> = [
  // Units & Membership
  { key: "units.maxPerChild", group: "Units & Membership", label: "Max units per child", type: "int", value: 6,
    description: "Maximum number of units a single child can hold (was 4, updated to 6)." },
  { key: "membership.feeAmount", group: "Units & Membership", label: "Membership fee amount", type: "money", value: 25,
    description: "Recurring membership fee charged per member." },
  { key: "membership.feePeriodYears", group: "Units & Membership", label: "Membership fee period (years)", type: "int", value: 2,
    description: "How often the membership fee is charged (mockup: Every 2 Years)." },
  { key: "membership.labels", group: "Lists & Labels", label: "Member labels", type: "list",
    value: ["Very Reliable", "Reliable", "Watch", "Unreliable"],
    description: "Label options selectable on members/borrowers/co-borrowers." },

  // Fees
  { key: "fees.ccProcessingPercent", group: "Fees", label: "Credit card processing fee %", type: "percent", value: 3 },
  { key: "fees.achProcessingPercent", group: "Fees", label: "ACH processing fee %", type: "percent", value: 3 },
  { key: "fees.cancelledUnit", group: "Fees", label: "Cancelled unit fee", type: "money", value: 35 },
  { key: "fees.dispute", group: "Fees", label: "Dispute fee", type: "money", value: 35 },

  // Returned payments — credit cards
  { key: "returned.cc.rechargeDays", group: "Returned Payments", label: "CC recharge period (days)", type: "int", value: 2 },
  { key: "returned.cc.rechargeTries", group: "Returned Payments", label: "CC recharge tries", type: "int", value: 3 },
  { key: "returned.cc.chargeFeeMode", group: "Returned Payments", label: "CC charge fee", type: "select",
    value: "after-last-retry", options: ["after-last-retry", "on-every-retry", "never"] },
  { key: "returned.cc.feeAmount", group: "Returned Payments", label: "CC returned payment fee", type: "money", value: 25 },
  // Returned payments — ACH
  { key: "returned.ach.rechargeDays", group: "Returned Payments", label: "ACH recharge period (days)", type: "int", value: 2 },
  { key: "returned.ach.rechargeTries", group: "Returned Payments", label: "ACH recharge tries", type: "int", value: 0,
    description: "0 = none (mockup: ACH does not auto-retry)." },
  { key: "returned.ach.chargeFeeMode", group: "Returned Payments", label: "ACH charge fee", type: "select",
    value: "on-every-retry", options: ["after-last-retry", "on-every-retry", "never"] },
  { key: "returned.ach.feeAmount", group: "Returned Payments", label: "ACH returned payment fee", type: "money", value: 25 },

  // Plan defaults (used to prefill new plans)
  { key: "plans.default.membershipTotal", group: "Plan Defaults", label: "Default total membership amount", type: "money", value: 1250 },
  { key: "plans.default.membershipMonths", group: "Plan Defaults", label: "Default months to pay (membership)", type: "int", value: 50 },
  { key: "plans.default.membershipPerMonth", group: "Plan Defaults", label: "Default amount per month (membership)", type: "money", value: 25 },
  { key: "plans.default.loanAmount", group: "Plan Defaults", label: "Default potential loan amount", type: "money", value: 10000 },
  { key: "plans.default.loanMonths", group: "Plan Defaults", label: "Default months to pay (loan)", type: "int", value: 60 },
  { key: "plans.default.loanPerMonth", group: "Plan Defaults", label: "Default amount per month (loan)", type: "money", value: 150 },
  { key: "plans.default.potentialCredit", group: "Plan Defaults", label: "Default potential credit", type: "money", value: 600 },
  { key: "plans.default.potentialCreditMonths", group: "Plan Defaults", label: "Potential credit covers last N months", type: "int", value: 4 },

  // Payments & schedules
  { key: "schedules.systemDayOfMonth", group: "Payments & Schedules", label: "System schedule day of month", type: "int", value: 5,
    description: "\"System Schedule - Every 5th\" in mockups." },
  { key: "schedules.upcomingWindowDays", group: "Payments & Schedules", label: "Upcoming payments window (days)", type: "int", value: 30 },

  // Lists & labels
  { key: "history.categories", group: "Lists & Labels", label: "History log categories", type: "list",
    value: ["Payments", "Contact", "Other"] },
  { key: "contacts.phoneLabels", group: "Lists & Labels", label: "Phone label options", type: "list",
    value: ["Cell 1", "Cell 2", "Home", "Work", "Business"] },
  { key: "dashboard.actionNeededTypes", group: "Lists & Labels", label: "Action-needed alert types", type: "list",
    value: ["Payment Declined", "Overdue", "Missing Payment Method", "System Schedule Inactive", "Overpaid"] },
];

async function main() {
  // Roles
  const [admin] = await Promise.all([
    db.role.upsert({ where: { name: "Admin" }, update: {}, create: { name: "Admin", permissions: { all: true } } }),
    db.role.upsert({ where: { name: "Office Director" }, update: {}, create: {
      name: "Office Director",
      permissions: { addMembers: true, addUnits: true, makePayments: true, cancelUnits: true, addLoan: true, changeFeeSettings: true, addUsers: true, viewPaymentInfo: true, addNote: true } } }),
    db.role.upsert({ where: { name: "Secretary" }, update: {}, create: {
      name: "Secretary",
      permissions: { addMembers: true, viewPaymentInfo: true, addNote: true } } }),
  ]);

  await db.user.upsert({
    where: { email: "admin@shivteiyisroel.org" },
    update: {},
    create: {
      firstName: "Admin", lastName: "User", email: "admin@shivteiyisroel.org",
      phone: "333-444-3333", passwordHash: await bcrypt.hash("ChangeMe!2026", 10), roleId: admin.id,
    },
  });

  // Config
  for (const c of CONFIG) {
    await db.configItem.upsert({
      where: { key: c.key },
      update: {},
      create: { key: c.key, group: c.group, label: c.label, type: c.type, value: c.value as any, options: (c.options as any) ?? undefined, description: c.description },
    });
  }

  // Plans from mockups
  const planRegular = await db.plan.upsert({
    where: { code: "1" }, update: {},
    create: { code: "1", title: "Regular", membershipTotal: 1250, membershipMonths: 50, membershipPerMonth: 25,
      loanAmount: 10000, loanMonths: 60, loanPerMonth: 150, potentialCredit: 600, potentialCreditMonths: 4, active: true },
  });
  await db.plan.upsert({
    where: { code: "F2" }, update: {},
    create: { code: "F2", title: "13 and Older, 5 Years", membershipTotal: 1250, membershipMonths: 50, membershipPerMonth: 25,
      membershipLastMonth: 30, loanAmount: 10000, loanMonths: 60, loanPerMonth: 150, potentialCredit: 600, potentialCreditMonths: 4, active: true },
  });
  await db.plan.upsert({
    where: { code: "C" }, update: {},
    create: { code: "C", title: "12 years and older", membershipTotal: 1200, membershipMonths: 50, membershipPerMonth: 20,
      loanAmount: 10000, loanMonths: 60, loanPerMonth: 150, potentialCredit: 600, potentialCreditMonths: 4, active: true },
  });

  // Demo family from mockups: Member 125 Moshe Rosen
  const existing = await db.member.findUnique({ where: { memberNo: 125 } });
  if (!existing) {
    const moshe = await db.member.create({
      data: {
        memberNo: 125, firstName: "Moshe", lastName: "Rosen", hebrewName: "משה ראזען",
        label: "Very Reliable", address: "1256 46th St", aptUnit: "2A", city: "Brooklyn", state: "NY", zip: "11219",
        kehila: "סאטמאר", bhmd: "קראלי", ruvDayan: "ר' משה כ\"ץ", occupation: "Teacher",
        memberSince: new Date("2019-02-23"),
        contacts: { create: [
          { kind: "phone", label: "Cell 1", value: "347-332-4435", isPrimary: true, note: "Please don't call after 5:00pm" },
          { kind: "phone", label: "Home", value: "333-555-3333" },
          { kind: "email", label: "Work", name: "M Rosen", value: "mrosen@gmail.com", isPrimary: true },
        ] },
        oldInfo: { create: [
          { field: "Address", value: "1256 46th St, 2A Brooklyn NY, 11219", dateEntered: new Date("2021-02-21"), dateChanged: new Date("2021-02-21") },
          { field: "Phone", value: "333-444-5555", dateEntered: new Date("2021-02-21"), dateChanged: new Date("2021-02-21") },
        ] },
      },
    });

    const children = [
      { letter: "A", name: "Chaim", units: 2 },
      { letter: "B", name: "Rachel", units: 4 },
      { letter: "C", name: "Jacob", units: 3 },
      { letter: "D", name: "Sarah", units: 1 },
    ];
    for (const c of children) {
      const child = await db.child.create({ data: {
        memberId: moshe.id, letter: c.letter, name: c.name, hebrewName: "חיים",
        dateOfBirth: new Date("2010-01-17"), status: "Paying", paidBy: "Member",
        dateSubscribed: new Date("2015-02-21"),
        scheduledPayOffDate: new Date("2020-02-21"), scheduledLoanDate: new Date("2022-05-17"),
      } });
      for (let s = 1; s <= c.units; s++) {
        await db.unit.create({ data: {
          childId: child.id, seq: s, planId: planRegular.id,
          membershipAmount: 1200, paid: 400, monthlyMembership: 35, overdue: 35,
          status: "Paying", dateSubscribed: new Date("2020-11-20"),
        } });
      }
    }

    // Borrower B125A on child A's first unit
    const childA = await db.child.findFirstOrThrow({ where: { memberId: moshe.id, letter: "A" }, include: { units: true } });
    const borrower = await db.borrower.create({ data: {
      borrowerNo: "B125A", childId: childA.id, firstName: "Chaim", lastName: "Rosen", hebrewName: "חיים ראזען",
      label: "Very Reliable", address: "1256 46th St", aptUnit: "2A", city: "Brooklyn", state: "NY", zip: "11219",
      payerType: "Member", payerMemberId: moshe.id, dateCreated: new Date("2019-02-23"),
      contacts: { create: [{ kind: "phone", label: "Cell 1", value: "347-333-4444", isPrimary: true }] },
    } });
    const loan = await db.loan.create({ data: {
      loanNo: "B125A1", unitId: childA.units[0].id, borrowerId: borrower.id,
      loanDate: new Date("2021-02-21"), amount: 10000, firstPaymentDate: new Date("2022-05-17"),
      monthlyPayment: 150, amountPaid: 1500, monthsPaid: 10, overdue: 0, potentialCredit: 600, creditEnabled: true,
    } });

    const co = await db.coBorrower.create({ data: {
      coNo: "CB12", firstName: "Chaim", lastName: "Weiss", hebrewName: "חיים ווייס",
      label: "Very Reliable", address: "1256 46th St", aptUnit: "2A", city: "Brooklyn", state: "NY", zip: "11219",
      businessAddress: "1256 46th St, 2A Brooklyn NY, 11219", occupation: "Real Estate",
      kehila: "Pupa", bhmd: "Sharei Tefila", fathersName: "Moshe", fatherInLaw: "Berl Katz", activelyPaying: true,
      contacts: { create: [{ kind: "phone", label: "Cell 1", value: "333-555-3333", isPrimary: true }] },
    } });
    await db.loanCoBorrower.create({ data: { loanId: loan.id, coBorrowerId: co.id, paidByCoBorrower: 0 } });

    // Payments demo
    const pm = await db.paymentMethod.create({ data: {
      ownerType: "member", ownerId: moshe.id, nickname: "Chase - Business", kind: "card", last4: "4467", exp: "02/22", ownerLabel: "Member",
    } });
    await db.paymentSchedule.createMany({ data: [
      { ownerType: "member", ownerId: moshe.id, category: "membership", scheduleType: "system-every-nth", dayOfMonth: 5, amount: 200, nextPaymentDate: new Date("2021-06-05"), paymentMethodId: pm.id, isSystem: true, isDefault: false, towards: "Monthly Membership" },
      { ownerType: "member", ownerId: moshe.id, category: "membership", scheduleType: "biweekly", weekday: "Tuesday", amount: 400, nextPaymentDate: new Date("2021-06-14"), paymentMethodId: pm.id, isDefault: true, towards: "Monthly Membership" },
      { ownerType: "member", ownerId: moshe.id, category: "other", scheduleType: "every-2nd-year", amount: 25, nextPaymentDate: new Date("2021-06-14"), paymentMethodId: pm.id, towards: "$25 Membership" },
      { ownerType: "member", ownerId: moshe.id, category: "credit", scheduleType: "biweekly", weekday: "Tuesday", amount: 500, nextPaymentDate: new Date("2021-06-14"), paymentMethodId: pm.id, towards: "Credit Toward End" },
    ] });
    const statuses = ["scheduled", "pending", "completed", "declined", "completed"] as const;
    for (const st of statuses) {
      await db.transaction.create({ data: {
        ownerType: "member", ownerId: moshe.id, dateTime: new Date("2021-06-05T16:45:00Z"),
        amount: 400, towards: "Monthly Membership", status: st,
      } });
    }
    await db.creditAccount.create({ data: { ownerType: "member", ownerId: moshe.id, towardMonthly: 240, towardEnd: 240 } });

    await db.note.createMany({ data: [
      { ownerType: "member", ownerId: moshe.id, date: new Date("2020-12-02"), text: "There is a lot of money in the family, his grandfather owns the building." },
      { ownerType: "borrower", ownerId: borrower.id, date: new Date("2020-12-02"), text: "There is a lot of money in the family, his grandfather owns the building." },
    ] });
    await db.historyLog.createMany({ data: [
      { ownerType: "member", ownerId: moshe.id, category: "Payments", date: new Date("2021-11-23T17:31:00Z"), details: "Payment applied of $356, $200 toward Child A, $156 toward Child B" },
      { ownerType: "member", ownerId: moshe.id, category: "Contact", date: new Date("2021-02-21T15:00:00Z"), details: "Contacted about payment, told to call back next week." },
    ] });
    await db.document.create({ data: { ownerType: "member", ownerId: moshe.id, title: "Application.pdf", dateUploaded: new Date("2020-02-21") } });

    // Potential member pipeline demo
    await db.potentialMember.create({ data: {
      callerIdName: "E B Electronics", callerIdNumber: "718-455-5555", status: "Active",
      createdOn: new Date("2020-11-22"), followUpDate: new Date("2021-11-30"),
      calls: { create: [
        { date: new Date("2021-11-30"), subject: "Review the membership plans, and discuss important points", kind: "scheduled" },
        { date: new Date("2021-11-30"), subject: "Discuss gemach's goal and plans", kind: "history", outcome: "discussed", details: "Discussed all things and decided to follow up" },
        { date: new Date("2021-11-30"), subject: "Discuss gemach's goal and plans", kind: "history", outcome: "rescheduled", rescheduledTo: new Date("2021-11-31") },
      ] },
    } });
  }

  console.log("Seed complete.");
}

main().finally(() => db.$disconnect());

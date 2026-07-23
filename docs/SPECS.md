# Shivtei Yisroel CRM — Functional Specification

Extracted from the Moqups project "Shivtei Yisroel" (50 pages: 40 active + 10 hidden drafts;
all rendered in `docs/mockups/`). Where mockups conflicted, the "- New"/"Updated" variants are
treated as current. Items marked **[Q]** have an open question in `QUESTIONS.md`.

## 1. Domain model & ID scheme

- **Member** `125` — a parent enrolled in the gemach.
- **Child** `125A` — member's child, identified by member number + letter.
- **Unit** `125A1` — one membership savings slot on a child; a child holds up to
  `units.maxPerChild` (config, **6** — was 4 in mockups).
- **Borrower** `B125A` — a child who exercised units and borrows (typically at marriage);
  created via "Use Child as Borrower" or standalone **[Q]**.
- **Loan** `B125A1` — one exercised unit turned into a loan.
- **Co-Borrower** `CB12` — guarantor/partner who may pay on borrowers' loans.
- **Potential Member** — pre-membership lead identified by Caller ID.

## 2. Global chrome

- Blue top bar: hamburger, global search, profile menu. Blue left sidebar:
  Dashboard, Members, Potential Members, Children, Borrowers, Co-Borrowers, Settings, Profile.
- Footer: "©Copyright <year> Gemach Shivtei Yisroel".
- Global search returns grouped results: Members / Borrowers / Co-Borrowers / Potential Members;
  each row shows name, address, member-since, children count, units count and an
  action-needed indicator.

## 3. Login

Simple email + password form ("Please enter your Username and Password", Login button).
The older hidden draft had Remember Me + Forgot Password **[Q]**.

## 4. Dashboard ("Dashboard - New")

Two panels:
1. **Action Needed** (toggle "Show Snoozed") grouped by Members / Borrowers / Co-Borrowers.
   Row = entity link + alert type: `Payment Declined`, `Overdue $X`, `Missing Payment Method`,
   `System Schedule Inactive`, `Overpaid $X`. Row menu: snooze/resolve **[Q]**.
2. **Follow Ups — Non Members**: Today / Tomorrow / This Week groups from the potential-member
   call scheduler; empty states per group.

## 5. Members

### 5.1 Member List ("Member List - New")
Search box; Add Member; table: ID, First Name, Last Name, Address, Member Since, Children,
Units + red info icon on rows needing action. Pagination "Rows per page 40 · 1-40 of 100".

### 5.2 Create New Member
Three columns:
- **Personal**: First, Last, Hebrew Name, Label, Address, APT/Unit, City, State, Zip.
- **Contact**: repeating Phone rows (label, number, default radio, note) + Add;
  repeating Email rows (label, name, email, default radio, note) + Add.
- **Additional Info**: Kehila, Bhm"d, Occupation, Ruv/Dayan. **Old Info** panel (empty on create).
Cancel / Save.

### 5.3 Member Details ("Member Details - New")
Header: `Member: 125 - Moshe Rosen`, Label dropdown, "Member Since" date.
Cards (heights adjust to content — BA note):
- **Contact Information** (pencil → edit Personal Info page): ID, Name, Hebrew Name, Address,
  Cell/Home phones (with ⓘ note tooltip), Emails; More Info →.
- **Children**: table ID(letter)/Name/Units + totals (children count, units count);
  View Details → Children List.
- **Payments** mini: Monthly Membership $, Overdue $ (red); Upcoming payments list
  (date, amount, schedule); View Details → Payments page.
- **Children Loans**: per borrower-unit card `B125A - Moshe · 2 Units`, Balance, Monthly
  Payment, Overdue.
- **Notes**: dated free-text notes, add/edit/delete.
- **History Log**: categorized (Payments/Contact/Other), timestamped, author; See All →
  History Log page.
- **View Documents** link → Documents page (list: title, date uploaded, view/download/menu; add).

### 5.4 Member Personal Info (+ Edit)
Read-only card mirroring create-form; Edit button → same layout editable. **Old Info** card:
prior Address/Phone values with Date Entered / Date Changed (auto-tracked on edit).

## 6. Children

### 6.1 Children List ("Children List - New", scoped to a member)
Breadcrumb `Member: 125 - Moshe Rosen › Children List`. Add Child. Table: ID, Name, Units,
Membership Amount, Paid, Balance, Monthly Membership, Overdue, Status, Date Subscribed,
Pay-Off Date, Borrower Id chip (→ borrower). Child rows expand per-unit sub-rows.
Totals row. The hidden older draft was a global children list with S.No/Completion Date **[Q]**.

### 6.2 Child Details ("Child Details Updated")
Child selector dropdown; link chip to Borrower Id.
- **Personal**: ID, Name, Hebrew Name, DOB (pencil edit).
- **Membership**: Paid by (Member), Status (Paying), Date Subscribed, Scheduled Pay-Off Date,
  Scheduled Loan Date. BA note: **handle "no schedule, no payment method"** states.
- **Units** table: ID, Plan, Membership Amount, Paid, Balance, Monthly Membership, Overdue,
  Date Subscribed, Loan Id chip; totals; + Add Unit (validate max = `units.maxPerChild`).
- **Notes**, **History Log** cards.

### 6.3 Unit Details (+ "Unit Details - Loan")
Breadcrumb Child › Unit selector. Unit Id / Loan Id cross-links.
- **Unit Details**: Date Subscribed, Amount Paid, Remaining Balance, Scheduled Pay-Off Date,
  Scheduled Loan Date; kebab menu **[Q]** (cancel unit?).
- **Payment**: Monthly Payment, Overdue (red).
- **Plan Information**: plan code/title, total, months, per-month.
- Loan variant adds: Loan Date (Edit), Loan Amount, **First Payment Date (editable only before
  payments applied — BA note)**, Amount Paid, Remaining Balance, Months Paid, Remaining Months,
  Potential Credit + Enabled toggle, Co-Borrowers list links, Plan info (loan side).

## 7. Borrowers

### 7.1 Borrowers List
Search; Add Borrower; table: ID, First, Last, Borrower Since, **Payer** ("Member - Moshe Rosen" /
"Borrower" / "Other - Chaim Katz"), Units, info icon.

### 7.2 Create New Borrower ("New Borrower - B125A")
- **Borrower Information**: checkbox **Use Child as Borrower** → shows Child Id/Name/Hebrew
  (Edit Child Info link) else free entry; Label, Address, APT, City, State, Zip;
  phones/emails repeaters.
- **Additional Info**: Occupation, Spouse Name, Spouse Occupation.
- **Payer Information**: radio Member / Borrower / Other; if Member → shows member contact
  summary + "Edit Member Contact Information"; if Other → free contact entry **[Q]**.

### 7.3 Borrower Details
Header `Borrower: B125A - Chaim Rosen`, Label, Date Created.
- **Contact Information**: personal + **Payer Contact (Member)** block (only when payer ≠
  borrower — BA note), More Info →.
- **Payments** mini: Monthly Loan Payment, Overdue, Next Payments list; View Details →.
- **Units** table: Id, Loan Date, Amount, First Payment, Monthly Payment, Months Paid,
  Remaining Balance, Overdue, Months Remaining, Pay-Off Date; totals; "N Available Units";
  empty state: "No exercised units" + **Exercise Units** button ("Borrower Details - No Units").
- **Co-Borrowers** card: name + units.
- **Notes**, **History Log**; View Documents.
- **Edit Borrower Information** page mirrors create-form with values.

### 7.4 Borrower › Co-Borrower Details
Breadcrumb from borrower to a co-borrower: personal card + Units table grouped by borrower
(`B125A - Moshe Rosen`, `B143D - Chaim Katz`) with **Paid By Co-Borrower** column +
Payment Schedules card.

## 8. Co-Borrowers

- **List**: ID, First, Last, Created On, Units, **Actively Paying** (Yes/No); Add Co-Borrower.
- **Details**: personal incl. Business Address/Phone, Occupation, Kehila, Bhm"d, Fathers' Name,
  Father In-Law; Units table (grouped by borrower, Paid By Co-Borrower); Payment Schedules
  (`B125A - Moshe Rosen $240 Monthly`); Notes; History Log.
- **Create**: Personal (+ Business Address toggle), Contact repeaters, Additional Info
  (Occupation, Kehila, Bhm"d, Fathers' Name, Father In-Laws' Name, Approved By, Status).

## 9. Potential Members (leads)

- **List**: tabs Active/Cancelled; Caller Id Number, Caller Id Name, Name, Date Created,
  Follow-Up Date; Add.
- **Create** ("Create Potential Member" / "Add Potential"): Caller ID pair, personal, contact
  repeaters, additional info, **Call Details & Follow Up** (call date+details, follow-up
  date+details).
- **Details**: Caller ID header, Status dropdown (Active/…), Created On;
  **Calls/Follow Ups** card: Scheduled list (overdue dates red) + History (subject, outcome:
  discussed / RESCHEDULED → new date / CANCELED) with row menus; Notes card.
- Conversion path Potential → Member **[Q]**.

## 10. Payments

### 10.1 Payments — Member
- **Overview**: Due this month, Overdue (red), Total Due; Membership Information (Total
  Membership Amount, Amount Paid, Current Monthly Membership, Remaining Balance);
  **Credit Accounts**: Credit Towards Monthly Membership $X (Transfer link), Credit Towards
  End of Membership $X (Transfer link).
- **Payment Schedules**: Membership Schedules table (Schedule, Amount ⓘ, Next Payment ⓘ,
  Payment Method, Default chip, System Schedule tag, kebab) + Other Schedules (Towards column:
  "$25 Membership", "Credit Toward End"). Header shows Returned Payment Auto Retry defaults
  (CC: 3 times/2 days; ACH: off) with Change link.
  - ⓘ (BA notes): schedule amount = "Monthly membership − scheduled payments";
    next payment shows remaining balance for the month given other schedules.
- **Children** mini table: Name, Due, Overdue, Paid By.
- **Payment Methods**: Nickname, Last 4 Digits, Exp, Owner; add.
- **Upcoming Payments (Next 30 days)**: date, amount, schedule name; actions
  Cancel/Reschedule; cancelled one-time rows greyed with **Reactivate**.
- **Notes**; **Transaction History**: Date & Time, Amount, Towards, Status chips
  (SCHEDULED / PENDING / COMPLETED / DECLINED), retry icon on declined, search + filter.

### 10.2 Payments — Borrower
Same layout, loan-flavored: Loan Information (Total Loan Amount, Amount Paid, Current Monthly
Payment, Remaining Balance, **Amount Paid by Borrower** vs Remaining), Credit Accounts
(toward monthly / toward end of loan), **Payers** card (member paying, units "1,3.5", overdue,
paid-by), **Co-Borrowers** card (Paid $, Credited $, Amount Due ⓘ), Loan Payment schedules +
Credit schedules + Co-Borrowers schedules.

## 11. History Log page

Per entity: Category, Date, Time, Details (truncated, expandable), edit/delete per row,
Add entry, Filter by Category (Payment / Contact / Other), pagination.

## 12. Settings

- **Payments & Fees**: Membership Fee (Payment Period "Every 2 Years", Amount $25);
  Processing Fees (CC 3%, ACH 3%); Other Fees (Cancelled Units $35, Dispute Fee $35,
  add custom fee rows); **Returned Payments settings** per CC/ACH: Recharge Period (days),
  Recharge Tries, Charge Fee (After Last Retry / On Every Retry), Fee Amount.
- **Plans**: cards `1 - Regular`, `F2 - 13 and Older, 5 Years` … each Membership block
  (Total, Months to Pay, Amount per Month, [Amount for Last Month]) + Loan block (Potential
  Loan Amount, Months to Pay, Amount per Month, Potential Credit "Last 4 Months");
  Active/Inactive toggle; **edit/delete only when no units attached** (BA comment); Add.
- **Roles & Permissions**: Admin (all), Office Director, Secretary; expandable permission
  checklists: Add Members, Add Units, Make Payments, Cancel Units, Add Loan, Change Fee
  Settings, Add Users, View Payment Info, Add Note, …; Add role.
- **Users**: table First, Last, Email, Phone, Permissions/Role, edit/delete; Add User
  (name, email, phone, password + confirm); Edit User (role dropdown, Change Password).
- **Edit Profile** (self): name, email, phone, role; password change (hidden until
  "Change Password" clicked — BA note).

## 13. Cross-cutting behaviors

- **Notes** and **History Log** appear on Member, Child, Borrower, Co-Borrower, Potential,
  Unit/Loan pages; history entries stamp user + timestamp; some created automatically
  (payments applied, contact changes) **[Q]**.
- **Documents** on Member and Borrower ("Application.pdf").
- **Old Info** auto-audit of address/phone changes with dates.
- **Labels** ("Very Reliable") on member/borrower/co-borrower — list is config.
- Money displayed in whole dollars in mockups; store cents-accurate decimals.
- Hebrew fields render RTL.

## 14. Derived math (as shown in mockups)

- Child totals: units count, Σ membership amount, Σ paid, balance = amount − paid,
  Σ monthly, Σ overdue.
- Loan: balance = amount − paid; months remaining = loanMonths − monthsPaid;
  pay-off date = loan date + loanMonths.
- Potential credit: $600 covering the **last 4 months** of a loan when enabled
  (earned by good standing **[Q]** — exact accrual rule to confirm).
- Payment schedule amount vs monthly obligation: system schedule tops up whatever other
  schedules don't cover for the month (per ⓘ notes).
- Processing fee: % of charge by method; returned payment retries/fees per config.

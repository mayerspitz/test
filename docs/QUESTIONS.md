# Clarification Questions (for review together — kept for later, per Mayer)

Organized by area. Mockup references are pages in `docs/mockups/`.
"Old vs New" duplicates already resolved in favor of the "- New"/"Updated" pages unless noted.

## A. Business / domain fundamentals

1. **Units math today (2026):** mockups (2021) show unit membership $1,200–$1,250 over 50
   months at $25–$35/mo, loan $10,000 over 60 months at $150/mo. What are the current real
   numbers? (All are config now — need the right starting values.)
2. **Max units:** confirmed 6 per child (was 4). Is there also a max per member/family?
3. **Potential Credit ($600, last 4 months):** what exactly earns it — on-time payment for the
   full loan term? Is it forgiveness of the last 4 loan payments ($150×4)? When is
   "Enabled" toggled off?
4. **Scheduled Loan Date vs Pay-Off Date on a unit:** how are they computed — from plan
   months, from subscription date, or manually set? Mockups show both, sometimes with
   inconsistent demo dates.
5. **Child → Borrower timing:** is a borrower always created from a child (at marriage), or
   can an outside borrower exist with no child/units ("Use Child as Borrower" is a checkbox,
   implying it can be unchecked)? Where do a standalone borrower's units come from?
6. **"Exercise Units"** (Borrower Details - No Units): what happens exactly — pick which
   units, loan amount per unit fixed by plan, partial exercise allowed?
7. **Co-borrower obligations:** is a co-borrower a guarantor (pays only on default) or an
   active co-payer by design? What does "Actively Paying: Yes/No" drive?
8. **Membership fee ($25 every 2 years):** charged per member, per child, or per unit?
   Auto-scheduled ("Every 2nd Year" schedule row in mockups) or manual?

## B. Payments engine

9. **Payment processor:** which gateway do you want (Stripe, Authorize.net, a frum-market
   processor, manual ACH…)? Mockups imply stored cards + ACH with auto-retry — that dictates
   integration scope and PCI approach.
10. **System Schedule ("Every 5th"):** confirm the intended logic — an automatic catch-up
    schedule that charges whatever the month's obligation minus other schedules leaves?
    Can users change the day per member?
11. **Credit accounts:** "Credit Towards Monthly" vs "Towards End" — exact application order
    vs. regular schedules, and what "Transfer" does (move between the two buckets?).
12. **Applying a payment across children/units:** history shows "Payment applied of $356,
    $200 toward Child A, $156 toward…". Is allocation manual per payment, or automatic
    (oldest overdue first)? Need the allocation algorithm.
13. **Overdue definition:** after how many days past the schedule date does an amount become
    "overdue"? Any grace period? Any late fee (separate from returned-payment fee)?
14. **Overpaid (dashboard alert):** what causes it and what's the expected resolution flow —
    auto-credit to a credit account?
15. **Returned payments:** confirm current retry rules (CC: 3 tries / 2 days apart, fee $25
    after last retry; ACH: no retries, fee on every return) and whether fees hit the member's
    balance or a separate fee ledger.

## C. Entities & screens

16. **Member Details layout:** "Member Details - New" (compact cards) vs hidden
    "Member Details" (wide layout with inline contacts edit) — confirm New wins everywhere?
17. **Users:** Settings → Users vs the standalone Users/Add User/Edit User pages — one place
    or both? Add User in mockups has password+confirm but no role picker; Edit User has a
    role dropdown — assume role picker belongs on Add too?
18. **Login extras:** need Forgot Password / Remember Me / 2FA? Hidden draft had the first two.
19. **Potential → Member conversion:** is there a "convert" action carrying data over
    (mockups don't show one)? What happens to the call history on conversion?
20. **Documents:** what storage (S3-compatible?), which file types, size limits, and are
    documents needed on children/co-borrowers too or only member + borrower?
21. **History log:** which events are auto-logged (payments, edits, schedule changes?) vs
    manual entries only? Mockups show an "Add" button implying manual entries exist.
22. **Labels:** free text or fixed list? Who can edit the list (config page currently)?
23. **Search:** exact-match on IDs plus fuzzy on names? Should phone/address be searchable?
24. **Hebrew/Yiddish:** UI stays English with RTL data fields only, or do you want a full
    bilingual UI?

## D. Access & roles

25. Confirm the three roles (Admin, Office Director, Secretary) and the exact permission
    list; the mockup checklist ends with "ועוד..." — what else?
26. Should permissions be per-role only (current build) or per-user overrides too?

## E. Reports / extras (not in mockups — advice / proposals)

27. **Suggested:** monthly reconciliation report (expected vs collected), aging report
    (overdue buckets), upcoming loans forecast (scheduled loan dates), gemach-wide cash
    position. Wanted for v1?
28. **Suggested:** automated receipts/statements to members (email/print), payment reminders
    (email/SMS/robocall?) before scheduled charges — mockup phone notes suggest call
    etiquette matters. Wanted?
29. **Suggested:** audit trail on config changes (who changed max units, fees, when).
    Cheap to add now.
30. **Data migration:** is there an existing system/spreadsheet whose data must be imported
    (member numbers like 125 suggest yes)? Format?

## F. Things that look wrong in the mockups (flagging, not fixed)

- Demo dates are inconsistent (e.g. Scheduled Pay-Off 02/21/2020 **before** loan date
  05/17/2022; follow-up date "11/23/2323"). Treated as lorem-ipsum noise.
- "Creditted" (sic) status spelling — assume "Credited".
- Children List - New shows child rows with letter IDs but per-unit sub-rows unlabeled —
  assumed: child row aggregates its units; sub-rows are the units.
- Borrowers List shows same ID `B125A` for all rows (demo noise) — IDs are unique per child
  in the real system (one borrower per child?) **confirm**.
- Payments pages show "Next Payments: Tue, 03/14/2021" where 03/14/2021 was a Sunday —
  cosmetic demo noise.

# Increment 1 — Test Cases (Money Core, Security, Integrity)

Test against `localhost:3000` or the pushed Netlify build. Check off each row; anything that fails, note the exact behavior and paste back for a fix.

## TC1 — Split math sums exactly to the bill total (P0-1)

| # | Steps | Expected |
|---|---|---|
| 1.1 | Create a property, add 3 tenants (same move-in date, 1 occupant each, no move-out), create a $100 bill for a 30-day period | Each tenant's owed amount, summed, equals exactly $100.00 (not $99.99 or $100.01) |
| 1.2 | Add a tenant with 2 occupants alongside a 1-occupant tenant, same bill period | The 2-occupant tenant's amount is roughly double the 1-occupant tenant's, and both still sum exactly to the bill total |

## TC2 — Bills are immutable once a payment is confirmed (P0-2)

| # | Steps | Expected |
|---|---|---|
| 2.1 | Create a bill with 2 tenants, mark tenant A's split as "paid" | Status badge shows "paid" for tenant A |
| 2.2 | On that same bill, click the circular-arrow **Recalculate** icon | Icon is disabled/greyed out; hovering shows "A tenant has already paid this bill — recalculating is blocked" |
| 2.3 | Add a **new** tenant to the property, then reopen that bill | The already-issued bill's splits are unchanged — the new tenant is NOT automatically added to it |
| 2.4 | Create a **new** bill after adding the tenant from 2.3 | The new bill includes the new tenant in its split |
| 2.5 | On a bill where nothing is paid yet, click **Recalculate** after adding a tenant | Splits update to include the new tenant; sums still exact (re-check TC1) |

## TC3 — Move-out & tenant archival (P0-3)

| # | Steps | Expected |
|---|---|---|
| 3.1 | Edit a tenant, set a move-out date before today | Saves without error; tenant card shows "Moves out: [date]" |
| 3.2 | Set a move-out date **earlier** than the move-in date | Form blocks submit with "Move-out date must be on or after the move-in date" |
| 3.3 | Delete a tenant who has **never** been on any bill | Confirm dialog says "Delete [name]? This cannot be undone." — confirming removes them entirely |
| 3.4 | Delete a tenant who **has** bill history | Confirm dialog instead says they'll be archived — confirming moves them to a "Former tenants" section (not deleted) |
| 3.5 | In "Former tenants", click the archive icon to reactivate | Tenant moves back into the active tenants list |
| 3.6 | Create a bill for a property where a former tenant exists | Former tenant is excluded from the split — only active tenants are billed |

## TC4 — Bills belong to their property directly (P1-2)

| # | Steps | Expected |
|---|---|---|
| 4.1 | Create a bill with zero tenants selected (should be impossible — try creating a bill on a property with no active tenants) | "Add Bill" button is disabled when there are no active tenants |
| 4.2 | Create two properties, each with their own bills | Each property's page shows only its own bills — no bleed-through |

## TC5 — Bill attachments are private, not publicly guessable (P0-6)

| # | Steps | Expected |
|---|---|---|
| 5.1 | Upload a PDF or image to a bill as the landlord | Shows "View attachment" with the filename |
| 5.2 | Click "View attachment" as the landlord | Opens in a new tab (may take a moment — it's fetching a signed URL) |
| 5.3 | Copy that opened URL and try it in a fresh incognito window a few seconds later | Should still work within the URL's validity window, but the URL itself is long/random — not a guessable path |
| 5.4 | Open the tenant's `/bill/:token` link and click "View original bill" | Opens successfully via the same signed-URL mechanism, no login required |
| 5.5 | Remove the attachment (X button) as landlord, then re-check the tenant link | Attachment link no longer appears on the tenant page |

## TC6 — Landlord previewing a link doesn't fake the "viewed" signal (P1-1)

| # | Steps | Expected |
|---|---|---|
| 6.1 | While logged in as the landlord (same browser), open a fresh tenant bill link that's currently "pending" | Status stays "pending" — does NOT flip to "viewed" |
| 6.2 | Open the same link in an incognito window (no landlord session) | Status flips from "pending" to "viewed" |

## TC7 — Tenant tokens expire and can be revoked (P1-4)

| # | Steps | Expected |
|---|---|---|
| 7.1 | Click the new shield-off **Revoke** icon next to a tenant's link | Confirm dialog appears; confirming rotates the token |
| 7.2 | Try the **old** copied link after revoking | Shows "This bill link is invalid or has expired" |
| 7.3 | Copy the **new** link (via the copy icon) and open it | Works normally |

## TC8 — Email sending works end-to-end (CORS fix + escaping)

| # | Steps | Expected |
|---|---|---|
| 8.1 | Add a tenant with a real email you can check, create a bill, click **Send** | No "Failed to send a request to the Edge Function" error; button changes to "Sent" |
| 8.2 | Check the inbox | Email arrives with the correct amount, breakdown summary, and a working link back to `/bill/:token` |
| 8.3 | Give a tenant a name containing `<` or `&` (e.g. `Tom & Jerry`) and send them an email | Email renders the name correctly, doesn't break the HTML layout |

## TC9 — Regression: existing flows still work

| # | Steps | Expected |
|---|---|---|
| 9.1 | Edit a tenant's name/room/occupants (no move dates changed) | Saves correctly, tenant card updates |
| 9.2 | Delete a bill | Confirm dialog appears; confirming removes the bill and its splits (and its attachment, if any) |
| 9.3 | Sign out and back in | Properties/tenants/bills all still load correctly |

---

**Sign-off:** Per the PRD, nothing in Increment 2 (rent rates, seed script, entitlements/pricing, operator plane) starts until every row above is green.

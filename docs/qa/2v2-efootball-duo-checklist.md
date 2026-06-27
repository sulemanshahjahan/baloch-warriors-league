# Manual QA — BWL 2v2 eFootball Duo Flow

Use this checklist to verify the full 2v2 eFootball "duo" feature end to end, on
both the **admin** and **public** sides, before shipping further changes.

A 2v2 duo is stored as a `Team` with `isDuo = true` and exactly two roster
players. The tournament uses `participantType = TEAM`, so duos flow through the
existing team match / standings / knockout engines. These hidden duo teams must
**never** appear in the global/public team directories.

> Legend: `[ ]` to do · ✅ pass · ❌ fail (note the bug)

**Test environment**
- [ ] Run against a non-production DB if possible (this flow creates/deletes Teams).
- [ ] Have at least **5 active players** available, with varied `skillLevel`
      values (e.g. 95, 88, 74, 60, 50) and **one player with no skill rating**.
- [ ] Logged in as an **ADMIN** or **SUPER_ADMIN** (duo actions require ADMIN).

---

## A. Tournament setup

1. **Create / edit eFootball tournament**
   - [ ] Admin → Tournaments → New (or edit an existing eFootball tournament).
   - [ ] Set Game = **eFootball**, Format = **Group + Knockout**.
2. **Select 2v2 mode**
   - [ ] In *eFootball Options*, set Match Mode = **2v2 (Co-op)**.
3. **Participant type locks to TEAM**
   - [ ] The *Participants* selector switches to **Team** and becomes **disabled**.
   - [ ] Helper text reads: *"2v2 competitors are duos (2 players each). Pair players on the tournament page."*
   - [ ] Save. Reopen the tournament edit form → mode is still **2v2**, participants still **Team**.
4. **Tournament dashboard shows the Duos section**
   - [ ] Open the tournament detail page.
   - [ ] A single **"Duos"** section is shown (not the Teams + Players grid).
   - [ ] For `GROUP_KNOCKOUT`, the **Groups** section is also present.

---

## B. Duo pairing

5. **Manually create a duo**
   - [ ] In **Duos** → **Pair Duo**, pick Player 1 and Player 2 (selecting a player in one dropdown removes them from the other).
   - [ ] Leave the name blank → Create → duo is named **"Player1 & Player2"** automatically.
   - [ ] Create a second duo, this time typing a custom name → it is saved verbatim.
   - [ ] Each duo row shows both member avatars, both names, and a combined skill value.
6. **Auto-pair by skill**
   - [ ] Remove the manual duos first (so players are free), or use fresh players.
   - [ ] **Auto-pair** → select an **even** set of players (e.g. 95, 88, 74, 60) → Pair.
   - [ ] Result: strongest+weakest pairing → **95+60** and **88+74** (balanced), 2 duos created.
   - [ ] Success notice reports the number of duos created.
7. **Handle odd player count**
   - [ ] **Auto-pair** → select an **odd** set (e.g. 5 players).
   - [ ] Dialog shows an amber warning: *"N selected — 1 will be left unpaired"*.
   - [ ] After pairing, the result message includes: *"⚠ <name> is unpaired (odd number of players)."*
   - [ ] The unpaired player is the **median-skill** player and is **not** silently dropped (still selectable for a new duo).
8. **Rename a duo**
   - [ ] Click the ✏️ on a duo → edit name → ✔ → name updates in the list and persists after refresh.
9. **Delete a duo before fixtures**
   - [ ] With **no fixtures generated yet**, delete a duo → it is removed and its two players become available again.
10. **Block delete after fixtures**
    - [ ] Generate group fixtures (section C) → return to **Duos** → delete a duo that has a match.
    - [ ] Expect error: *"Cannot delete a duo that already has matches. Delete its matches first."*

---

## C. Group stage

11. **Generate group fixtures**
    - [ ] Create groups (Groups section) and draw/assign duos into them.
    - [ ] Generate the schedule (Group + Knockout / round-robin within groups).
12. **Fixtures are Duo vs Duo**
    - [ ] Each generated match shows **Duo A vs Duo B** (duo names), not single player names.
13. **Enter a group result**
    - [ ] Open a group match → enter a score → mark **Completed**.
14. **Standings update per duo**
    - [ ] Standings header reads **"Duo"**.
    - [ ] The played duos show correct P / W / D / L / GF / GA / GD / Pts.
    - [ ] Edit the same match's score → standings recompute correctly (no double counting).

---

## D. Knockout stage

15. **Knockout blocked until group stage complete**
    - [ ] With at least one group match still unplayed, click **Generate Knockout**.
    - [ ] Expect error: *"Group stage is not complete — N group match(es) still unplayed."*
16. **Generate knockout after completion**
    - [ ] Complete **all** group matches → **Generate Knockout** → bracket is created from group standings.
    - [ ] Bracket fixtures are **Duo vs Duo** using qualified duos.
17. **Enter a knockout result**
    - [ ] Open a knockout match → enter a score → Completed.
18. **Winner advances**
    - [ ] The winning duo appears in the next-round match in the correct slot.
    - [ ] (If applicable) repeat to a Final and produce a single winning duo.

---

## E. Champion & public display

19. **Assign champion**
    - [ ] Awards → assign **Tournament Winner** to the champion duo (team).
20. **Public champion shows duo name + both players**
    - [ ] Open the public page `/tournaments/<slug>` → Awards section.
    - [ ] The winner shows the **duo name**, with a sub-line **"Players: Haroon, Suleman"** listing both members.
    - [ ] Confirm a **normal** team/player award shows **no** extra "Players:" line (only duos do).
    - [ ] Public standings and match listings show **duo names** throughout.

---

## F. Deletion & cleanup

21. **Delete a single tournament → hidden duos cleaned**
    - [ ] Note the duo team names of a 2v2 tournament.
    - [ ] Delete that tournament.
    - [ ] In Prisma Studio (`Team` where `isDuo = true`) those duo teams are **gone**, along with their `TeamPlayer` rows.
22. **Bulk delete → safe cleanup**
    - [ ] Select multiple tournaments (mix of 2v2 and normal) → Bulk Delete.
    - [ ] Only the deleted 2v2 tournaments' duo teams are removed.
23. **Normal/global teams are NOT deleted**
    - [ ] Confirm regular (non-duo) teams still exist after both delete operations.
    - [ ] (Defensive) A duo enrolled in two tournaments is **not** deleted when only one is removed.
24. **No pollution from hidden duo teams**
    - [ ] Public **Teams** page (`/teams`) does **not** list any duo team.
    - [ ] Admin **Teams** list does **not** list any duo team.
    - [ ] Global search does **not** return duo teams.
    - [ ] Admin dashboard **Teams count** excludes duo teams.
    - [ ] Team-enrollment dropdown (non-2v2 tournament) does **not** offer duo teams.

---

## G. Edge cases

- [ ] **Same player in two duos** — try to add a player already in a duo:
      manual dialog doesn't list them; if forced, action errors with
      *"A selected player is already in another duo in this tournament"*.
- [ ] **Duplicate duo name (explicit)** — rename/create a duo to an existing
      name → error *"A duo named \"…\" already exists in this tournament"*.
- [ ] **Duplicate duo name (auto-generated)** — two duos that would auto-name to
      the same string → second becomes **"… (2)"** (no error).
- [ ] **Blank duo name** — leave name empty on create → defaults to **"P1 & P2"**.
- [ ] **Missing skill rating** — a player with no `skillLevel` is treated as **50**
      for auto-pairing and shows `(50)` in the picker; pairing still balances.
- [ ] **Odd number of players** — covered in step 7; warning surfaced, none dropped.
- [ ] **Editing a match result** — re-entering a different score recomputes
      standings (group) and re-evaluates knockout advancement correctly.
- [ ] **Deleting a tournament after matches exist** — completed matches, standings,
      and bracket are removed; exclusive duo teams cleaned; normal teams untouched.

---

## Regression sanity (non-2v2 unaffected)

- [ ] A **1v1 eFootball** (Individual) tournament still creates player-vs-player
      fixtures and individual standings.
- [ ] A normal **Team** (Football / Pro Clubs) tournament enrollment, fixtures,
      standings, and knockout still work unchanged.
- [ ] Public Teams / Players / Standings pages render normally.

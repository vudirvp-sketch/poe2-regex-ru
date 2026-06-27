iter 143 (user feedback round) — documentation-only update
============================================================

User feedback received on 6 questions from docs/ITER142_PROPOSALS.md section 5.
2 new bugs documented (KI#32, KI#33). No code changes — all 5 KI ready for
iter 144 implementation.

Changed files (5):
- STATUS.md                              (5 active KI + iter 144 priorities)
- AGENT_NAVIGATION.md                    (header iteration bump + iter 144 priorities)
- worklog.md                             (iter 143 status check -> brief, iter 143 feedback entry added)
- docs/UI_REFACTOR_PLAN.md               (section 13.7 -> iter 143 reference)
- docs/ITER142_PROPOSALS.md              (NEW section 0 user answers + NEW variant d for KI#31 + NEW sections 8/9 for KI#32/33)

User answers summary:
- Q1 KI#23 partial fix OK? -> Yes, variant (b)
- Q2 Fallback on (a)? -> Just do (b) properly
- Q3 Silent reset old favorites? -> Don't care
- Q4 Realtime multi-tab sync? -> If stable and not complex
- Q5 Storage format? -> Simple ID array (extended to Array<{id, range?}> for KI#31)
- Q6 Star button 2 functions? -> Toggle only, NO scroll-to-mod!
  -> NEW variant (d) for KI#31: quick-select panel with range inputs

New bugs reported by user:
- KI#32 (cascade expand): expanding "skill-levels" in "normal" also expands
  all "skill-levels" in corrupted/desecrated/breach. Root cause: sub-group
  key ${categoryId}:${affix}:${sg.key} where sg.key does not include origin.
  Fix: add origin to sg.key in affix-functional mode classifier.
- KI#33 (VendorPage favorites gap): favorites not implemented on VendorPage
  (custom FilterChip without star pin slot). Known since iter 136, now
  explicitly in KI.

iter 144 implementation order (per dependencies):
1. KI#32 cascade fix (~30-50 lines, blocking UX) — FIRST
2. KI#30 per-category localStorage + realtime sync (~40 lines)
3. KI#31 variant d quick-select panel with range inputs (~150-200 lines NEW component)
4. KI#33 VendorPage favorites (~40-50 lines)
5. KI#23 scroll jitter variant b (~20 lines, independent)

Baseline confirmed: tsc 0 / eslint 0 / vitest 2190/2190.

How to apply:
1. Extract this archive at the repo root (overwrites 5 files):
   tar -xzf poe2-regex-ru-iter143-feedback.tar.gz -C /path/to/poe2-regex-ru
2. Or apply the convenience patch:
   git apply iter143-feedback.patch
3. Verify baseline:
   npx tsc -b && npx eslint . && npx vitest run
4. Then commit + push (see git commands below).

Git commands:
  git add STATUS.md AGENT_NAVIGATION.md worklog.md docs/UI_REFACTOR_PLAN.md docs/ITER142_PROPOSALS.md
  git commit -m "iter 143 (user feedback): 5 KI ready for iter 144 — KI#32 cascade expand + KI#33 VendorPage favorites + KI#31 variant d (quick-select с диапазонами)"
  git push origin main

Stop point: iter 143 (user feedback round, no code changes).
Next iter 144: implement 5 KI in dependency order (KI#32 -> KI#30 -> KI#31 -> KI#33 -> KI#23).

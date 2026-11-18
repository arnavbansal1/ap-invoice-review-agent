# AP invoice review agent

**AI reads the email and documents. Code compares them with the trip record. A person decides.**

**[▶ Open the live demo](https://arnavbansal1.github.io/ap-invoice-review-agent/)** (runs in any browser, no login; it replays a recorded live AI run)

A working prototype for an accounts-payable clerk at a trucking company. The company sometimes hands shipments to other carriers, who then email their invoices to a shared inbox. The clerk opens each one, finds the trip, compares the invoice with what was agreed, and records one decision: pay, hold, pay less, or escalate. This prototype does the reading and comparing, and proposes the decision with its evidence. The clerk approves, overrides or escalates.

![The review screen: inbox, documents, trip record, comparison, proposed decision](docs/img/overview.png)

> Development evidence on synthetic data. Every company, person, trip and document here is fictional, and the documents are text, not real PDFs or photos. Nothing is sent or paid; "approve" only records an entry on the page.

The first working screen was built in about ten minutes during a live product case. The recorded AI runs, the blind test set and the fixes it led to were added the same afternoon.

## Contents
- [How it works](#how-it-works)
- [A 90-second tour](#a-90-second-tour)
- [Who does what](#who-does-what)
- [Evals: what ran, why, and results](#evals-what-ran-why-and-results)
- [The most useful failure](#the-most-useful-failure)
- [What is real, mocked and not built](#what-is-real-mocked-and-not-built)
- [Path to production](#path-to-production)
- [Repo map and how to run](#repo-map-and-how-to-run)

## How it works

![How it works: inbox, classify, read, check, lookup, compare, approve](docs/img/how_it_works.png)

```mermaid
flowchart LR
  I[Shared inbox<br/>email, PDFs, photos] --> G{Code rule on the raw email:<br/>bank-detail change?}
  G -- yes --> V[Vendor verification queue<br/>never enters payment]
  G -- no --> C[AI: classify]
  C -- not an invoice --> Q[Filed outside the payment flow]
  C -- carrier invoice --> R[AI: read facts,<br/>each with an exact quote]
  R --> K[Code: every quote found word for word,<br/>amounts on the quoted line]
  K -- fails --> H[Clerk reviews by hand]
  K -- passes --> T[Code: look up the trip record]
  T --> D[Code: compare and propose<br/>PAY / HOLD / PAY LESS / ESCALATE]
  D --> P[Clerk: approve, override with a reason, or escalate]
  P --> L[Payment log, written only after her click]
```

Four rules shape the design:

1. **The model reads; code decides.** The model returns facts with quotes. It never sees the trip record and never proposes a payment.
2. **No quote, no fact.** Every value must be found word for word in the document it cites, and every amount must be on the quoted line. A read that fails goes to the clerk.
3. **Money-moving safety does not depend on the model.** A bank-detail change is blocked by a code rule on the raw email. The proposed payment can never exceed the agreed price plus approved extras.
4. **Text inside a document is content, never an instruction.** It is flagged and ignored.

## A 90-second tour

Open the [live demo](https://arnavbansal1.github.io/ap-invoice-review-agent/) and click **▶ Start demo**, or click these inbox items:

| Item | What you see |
|---|---|
| **A** Clean invoice | Three attachments, all checks green. Proposal: PAY $2,000. Click any quote to see it highlighted in the document. |
| **C** Extra not approved | A $175 redelivery charge is not an approved extra on the trip. Proposal: PAY LESS $2,220, with an AI-drafted note that is not sent. |
| **D** Price conflict | The invoice and an attached rate confirmation say $2,400; the trip record says $2,150. It escalates with both pieces of evidence. |
| **H** Hidden instruction | The invoice tells "the automated AP system" to release $4,900. Flagged, ignored, same decision as without it. |
| **F** Bank-detail change | Blocked from the payment flow by a code rule. There are no payment buttons. |

![A hidden instruction in an invoice is flagged and ignored](docs/img/hidden_instruction.png)

## Who does what

| | Does | Does not |
|---|---|---|
| **AI** | Classifies the email; reads documents and photos; copies out facts with quotes; drafts the note to the carrier or manager | See the trip record, compute a payment, send anything |
| **Code** | Checks every quote; looks up the trip; compares trip number, carrier, delivery status, base price, each extra and the total; proposes the decision; blocks bank changes; checks every AI draft (amounts, one trip, no promises) | Guess when evidence is missing or sources conflict: it holds or escalates |
| **Clerk** | Makes every final decision in the pilot | Have to re-key or re-read what is already matched |

Decision rules, in priority order: **ESCALATE** when sources conflict (a different carrier, a different base price, a signed receipt but the trip not marked delivered); **HOLD** when evidence is missing (no delivery proof, unknown trip number, an approved extra with no receipt, lines that do not add up); **PAY LESS** when an extra is not approved or is billed above its approved amount; otherwise **PAY**.

## Evals: what ran, why, and results

![Evidence: frozen cases, blind cases, injected mistakes](docs/img/evidence.png)

| Eval | Why this one | Result |
|---|---|---|
| **8 build cases with a frozen answer key** | The key was written and checksummed before any code, and is never shown to the model, so the build cannot be tuned to its own answers | Live AI, 3 runs: 8 of 8 each, all three agree, 0 wrong payment proposals |
| **12 blind cases, generated separately** | Cases I write share my blind spots. A separate agent wrote these from a written brief, without access to the code, prompts or rules (this is not independent QA) | First scored run: 11 of 12, 0 wrong payments, 12 of 12 classified. It exposed four gaps (below) |
| **12 injected model mistakes (offline)** | Live runs only show what the model happened to do. These feed the code a wrong read on purpose: obeying the hidden note, calling the bank email an invoice, skipping an extra, misreading a total | 12 of 12 end somewhere safe (hold, escalate, clerk review, or blocked) |
| **Hidden instruction, with and without** | Tests that the decision is unchanged when the instruction is removed | Unchanged; flagged |
| **Citations** | Every finding must point at evidence | Every cited quote found word for word in its source |
| **AI-drafted notes** | Free text is the one place a model writes to a human | Shown only if they pass code checks; otherwise a template is shown |

**Limits, stated plainly.** Everything is synthetic text. The live runs are a handful of runs on one model. The blind set stopped being blind once I fixed against it. Nothing here measures a real inbox.

**Planned, not run, and why:** real inbox items with real PDFs and photos (needs real data); a sample of the clerk's past decisions as the answer key (needs the payment system's history); duplicate-invoice and wrong-payee checks (out of scope); latency and cost at 400 items a day (needs the real connector).

## The most useful failure

The first blind run scored 11 of 12 with no wrong payment, which looks fine. The detail was more useful than the score:

- **The bank-change code rule missed both new phrasings** (a factoring "notice of assignment", and "wire the funds to our parent company rather than to us"). The model classified both correctly, so the outcome was right, but the safeguard that is supposed to hold *even when the model is wrong* had not fired. That is the gap that matters.
- **A clean invoice was escalated** because the carrier printed "LLC" and the trip record did not.
- **The hidden-instruction flag missed two new wordings.** The decisions were still correct.
- **One correct AI draft was blocked** by a check that did not allow a computed line total.

All four are fixed, covered by regression tests (`tests/test_blind.js`), and the same AI reads were replayed. A wrong read can no longer carry either bank-change item into payment. The first run stays recorded as it was scored.

![A bank-detail change is blocked from the payment flow](docs/img/bank_change_blocked.png)

## What is real, mocked and not built

| Piece | Status |
|---|---|
| Classification, document read, drafted notes | Real model calls. The public demo replays a recorded live run; the original page can also call the model live |
| Quote checks, comparison, proposed decision, bank-change block, instruction flag, draft checks | Real, deterministic code (`src/engine.js`) |
| Inbox and attachments | Mocked: synthetic items as text |
| Trip record | Mocked: records in the page |
| Payment log | Mocked: a session list, written only on the clerk's click |
| Duplicate invoices, payee and tax checks, handling of bank changes | Not built |

Prototype defaults to confirm with the business: any base-price difference escalates (no tolerance); an approved extra needs its own receipt; the trip record's status decides "delivered".

## Path to production

| Stage | What happens | Evidence today |
|---|---|---|
| Requirements and design | Rules confirmed with the clerk and her manager; architecture review of the mailbox, trip-system and payment connections | Case-defined, not user-validated |
| Build and unit tests | Engine, checks and prompts versioned; tests on every change | Done for the prototype |
| QA in a test environment | Frozen sets, fresh blind sets, injected mistakes, real document formats, retries, duplicates | Partial: synthetic text only |
| User acceptance | The clerk and manager judge real items against their own decisions | Not run |
| Shadow | Runs beside the clerk on the live inbox; writes nothing | Not run |
| Controlled release | Change approval, monitoring, an off switch, rollback; the clerk approves every item | Not deployed |
| Widening | One decision type at a time (clean PAY first), each its own decision on shadow evidence | Future gate |

Pilot metrics: the share of the queue with a correct proposal and evidence that the clerk approves without rework (primary); wrong recommendation rate from a manager's sample; escalation rate; reviewer minutes per item; cost per accepted output.

## Repo map and how to run

| Path | What |
|---|---|
| `index.html` | The built demo page (generated; open it directly) |
| `src/engine.js` | Data, guards, validation, decision rules, prompts, draft checks, scoring |
| `src/ui.js`, `src/page.html` | The screen |
| `expected.json`, `FROZEN.sha256` | Answer key for the 8 build cases, frozen before any code |
| `blind/` | The 12 separately generated cases, their key, the brief the writer was given, and a note on the result |
| `runs/` | The recorded live AI reads and drafts |
| `tests/` | Engine tests, blind replay tests, browser tests |

```bash
python3 build.py            # rebuild index.html (build.py --check confirms it is current)
node tests/test_engine.js   # 91 engine checks
node tests/test_blind.js    # 76 blind replay checks
python3 tests/test_ui.py    # 33 browser checks (needs Playwright)
```

Company and system names in this repo are fictional.

# LunaClair — UX & Product Architecture Review

*(An independent assessment based solely on hands-on exploration of the running application. No code, files, or internal structure were inspected.)*

---

## 1. Product Mental Model

**What it is:** A personal, offline-first learning workspace where a student organizes study notes by academic course and term, annotates those notes while reading, and builds and takes practice quizzes to prepare for exams.

**Who it is for:** A single student (most likely tertiary level, given "Prelim / Midterm / Finals" terminology) who wants all of their course material, self-made quizzes, and study progress in one place. There is no sign-in, sharing, collaboration, or multi-user concept anywhere in the UI — this is a private study tool.

**Primary purposes:**
1. **Organize** study content — courses (subjects), their documents (materials), and academic terms (Prelim/Midterm/Finals).
2. **Read & annotate** — render markdown study notes with table-of-contents navigation, text highlighting, and freehand drawing.
3. **Author assessments** — create questions of five types and bundle them into quizzes with pass thresholds.
4. **Test knowledge** — take quizzes with instant feedback, get scored results, review and retake.

**Major capabilities observed:** Library & organization; document reading with annotation; question authoring; quiz cataloging; quiz taking & scoring; global term administration.

The product concept is coherent: it feels like a "study command center" for a single course load. Content is everywhere marked **BUNDLED** (a badge on every material), suggesting content ships pre-packaged with the app — the student works from seed data.

---

## 2. Natural Capability Map

These are the top-level capabilities as the product presents itself, grouped by what belongs together — not by navigation.

### A. Library & Organization *(the home surface)*
- **Purpose:** Own and organize everything the student studies.
- **Entities:** Subjects (courses), Materials (study documents), the implicit "Uncategorized" bucket, subject-to-material assignment.
- **Workflows observed:** Create subject (dialog with title/description); create material (instant placeholder); edit subject/material metadata; assign a material to a subject; reorder subjects via drag-and-drop (Save Order/Cancel); delete with confirmation; per-subject drill-down.
- **Screens:** Library home; subject workspace (Materials tab); material editing dialogs.

### B. Document Reader & Annotation *(consumption)*
- **Purpose:** Read study notes and make them personal.
- **Entities:** Materials (as documents), text highlights, freehand drawing strokes.
- **Workflows observed:** Open material → Read tab; scroll long markdown; jump via "On this page" TOC; select text → highlight in 4 colors; draw with pen (6 colors, 4 widths), erase strokes, undo; clear all highlights; annotation toolbar opens from a dock.
- **Screens:** Material workspace (Read tab). Reached from Library, subject, or anywhere a material card appears.

### C. Assessment Authoring *(creation)*
- **Purpose:** Build the raw question inventory and bundle it into quizzes.
- **Entities:** Questions (5 types, difficulty, points, tags, explanations, correct answers, status: published/draft/archived), Quizzes (title, description, pass %, ordered question list with version pinning).
- **Workflows observed:** New question via typed editor (multiple choice, multiple select, true/false, identification, fill-in-the-blank); search + filter question bank; edit/archive questions; create quiz with live question picker and reorder; edit/archive quizzes; version pinning at quiz creation.
- **Screens:** Material workspace (Manage tab → Question Bank / Quiz Catalog).

### D. Quiz Taking & Results *(consumption)*
- **Purpose:** Test knowledge and see progress.
- **Entities:** Quiz sessions (practice mode), answers, scores, results.
- **Workflows observed:** Start from intro ("Knowledge Check"); answer MC/true-false with instant right/wrong feedback and explanation; progress bar + answered counter; submit; results screen with percentage, points, correct/incorrect tally, per-question review, retake.
- **Screens:** Quiz session view; results view. Reached from material cards, subject Quiz tab, and material Quiz tab.

### E. Academic Terms *(organizational fabric)*
- **Purpose:** Slice materials by academic period across all courses.
- **Entities:** Terms (global), subject–term assignments, material–term assignments.
- **Workflows observed:** Create/rename/delete global terms; assign existing term to a subject; "create & assign" atomically; reorder terms within a subject (drag or up/down); unlink from a subject; filter subject materials by term; set a material's term in its edit dialog.
- **Screens:** Manage Terms (global); subject workspace (Terms tab); material edit dialog (Term field).

---

## 3. Relationships Between Capabilities

- **Library is the root and feeder.** Every other capability is reached from a material or subject owned by the Library. Subjects → materials → reader/quizzes/management is a strict containment hierarchy.
- **Terms support Library, not stand alone.** Terms only make sense attached to subjects/materials. They are an organizing dimension of the Library, not an independent product area — even though they get a top-level nav item.
- **Authoring feeds consumption (C → D).** Question Bank produces questions; Quiz Catalog bundles them; Quiz Taking consumes the bundle. The dependency chain is explicit in the UI: quizzes show "USED IN 1 QUIZ" and "2 Questions in Bank", and quiz creation pins question versions.
- **Reader is adjacent but parallel.** It shares the "material" entity but has no workflow dependency on assessment — a student can annotate without ever authoring a quiz. The two are sibling views of the same material.
- **Administration vs usage:** Terms management and (partly) subject/material editing are administrative; reading, highlighting, and taking quizzes are usage. Administration is lightly surfaced: quick actions like Start Quiz and Manage sit directly on content cards, but create flows are modest dialogs rather than full admin consoles.

**Sub-capabilities:** Terms feels like a supporting sub-capability of Library (a "dimension" rather than a destination). The reader's annotation tools are a sub-capability of Reading. "Quiz Overview" is little more than a link back to the intro screen — it does not feel like a real capability.

---

## 4. Navigation Assessment

- **Top-level nav is very sparse:** only **Library** and **Manage Terms**. Everything else is reached contextually (breadcrumbs, tabs, card actions, docks). This keeps the top level clean but puts a lot of weight on discoverability.
- **Disconnected feeling:** "Manage Terms" sits beside "Library" as a peer, yet it is a small registry of three names. Elevating it to top-level while subject–term workflows live inside each subject creates a split-brain around terms (see Friction).
- **The dock evolves by context.** The bottom navigation gains items as you descend (home, tags, then a quiz icon, then a reader icon). This is an effective "you are here" device, but it means the app's navigation surface is not stable — a user cannot rely on a fixed map.
- **Three different "Quiz" destinations:** a material card's "Start Quiz", the subject's Quiz tab (a composer), and the material's Quiz tab (a single knowledge check) all use the word Quiz with different semantics. The subject-level Quiz tab is actually an *assessment builder*, which a first-time user may not expect under a "Quiz" label.
- **"Manage" is overloaded:** the Manage tab inside a material (question bank), the "Manage" button on cards, and "Manage Terms" in the nav are three different scopes sharing one verb.
- **Too small to stand alone:** Manage Terms (three rows) is the clearest candidate; it could be a Library sub-view.

---

## 5. Information Architecture

- **Feels like separate products:**
  - *The assessment suite* (Question Bank, Quiz Catalog, quiz session/results) is deep, terminology-heavy, and author-focused — it reads like a mini assessment platform bolted onto a notes app.
  - *The reader/annotator* behaves like a separate lightweight document tool (highlight palette, drawing canvas) that happens to live inside material screens.
- **Different views of the same capability:**
  - Library home, subject workspace, and material workspace are three depths of one Library/Organization capability.
  - Question Bank and Quiz Catalog are two tabs of one Assessment Authoring capability.
- **Supporting entities, not sections:**
  - Terms are a supporting entity (a dimension applied to subjects and materials) yet occupy a top-level section — the clearest mismatch between IA and UI.
  - Quizzes-within-the-subject and quizzes-within-a-material are the same entity rendered at two scopes.

---

## 6. Suggested Product Capability Map

Based purely on how the product behaves, a more natural organization:

1. **Library** — subjects, materials, uncategorized bucket, reordering, assignment, and **terms as a filter dimension inside it** (global term registry as a Library sub-view rather than a peer destination).
2. **Reader** — material reading, TOC, highlights, drawing.
3. **Assessment Studio** — Question Bank + Quiz Catalog + question editors, published/draft/archived lifecycle (reached per material, with the subject Quiz tab as a cross-material composer).
4. **Quiz Session** — taking, scoring, review, retake (a mode, not a permanent section).

Under this map, the top-level nav could stay as **Library** and **Assessment** (or even a single "Library" with prominent per-subject entry points), with Quiz Taking existing only as a session. Terms disappear from the top level entirely.

---

## 7. Friction Points

1. **"New Material" creates a placeholder instantly** (`Study Material 8`, then `Study Material 9` from "Add Material") with no name prompt — while "New Subject" opens a proper dialog. The user must discover an Edit step to name it. Inconsistent and surprising; creation should either prompt or clearly say "creating unnamed draft."
2. **Terminology overload:** "Quiz" (compose vs take), "Manage" (material questions vs global terms), and "Terms" (global registry vs subject assignment vs material field) all carry multiple meanings.
3. **Split-brain terms:** terms are managed globally (nav), assigned per subject (Terms tab), and set per material (Edit dialog), with a filter on the Materials tab — four places to think about one concept.
4. **Discoverability of annotation tools:** highlighting/drawing are hidden behind an "Open Annotations" affordance at the bottom of a long document; nothing in the header hints that annotation exists. The selection popover only appears after enabling "Select & Highlight".
5. **Draft status is invisible in authoring:** the filter offers Published/Draft/Archived, but the New Question dialog shows no draft/publish control — it is unclear how an item ever becomes a Draft.
6. **"Quiz Overview" is a dead end** — it returns to the intro screen rather than an overview of quizzes/results, which is confusing naming.
7. **No empty states or onboarding:** nothing explains what subjects/materials/quizzes are for; a first run with no content would likely be a blank page with no guidance.
8. **No settings or data management surface exists at all** — nothing for export, reset, or app configuration (unclear whether these are intended to exist).
9. **Term filter only exists on the subject's Materials tab**, not in the global Library view, so a Prelim-focused student can't filter their whole library by term in one place.
10. **"BUNDLED" badge is unexplained** — every material carries it with no tooltip or definition; it reads as internal jargon leaking into the UI.

---

**Bottom line:** This is a well-executed, coherent single-user study environment with a genuinely pleasant reading/annotation experience and a surprisingly deep assessment engine. The main product-architecture tension is that the *assessment authoring* surface (with its editor vocabulary, statuses, and version pinning) is considerably more sophisticated than the sparse two-item navigation that hosts it, while *terms* — a humble supporting dimension — are promoted to top-level status. The most natural evolution is a library-centered shell with terms demoted into it, and the assessment suite promoted into a clearly-labeled authoring space.

---
version: 1
slug: "src-app-app-page-tsx"
primary_target: "src/app/(app)/page.tsx"
related_targets: ["src/app/(app)/layout.tsx","src/app/(auth)/login/page.tsx","src/app/(app)/b/[boardId]/page.tsx"]
---

# Surface brief: My Work (index) + app shell

Scope: the signed-in app shell (spine + thumb tabs) and its landing route, My Work.
Phase-1 siblings inherit this world: sign-in, set password, workspace home, workspace settings, board.
Mode: Operate.

Audience/job: up to five people who keep Bird-Watcher pinned all day, in light and dark, moving
between personal errands, team work, side projects and research. On landing they need to see every
task assigned to them across all workspaces, most urgent first, and jump into its board.
Must not feel like a generic SaaS template, and must not feel sparse: density is welcome.

## Direction contract

THESIS: Bird-Watcher is one all-weather field book. Each workspace is a thumb-indexed section; every
task is a numbered entry on ruled columns. It refuses the category default of floating rounded cards
on grey canvas, pill badges and an avatar-heavy sidebar.

OWN-WORLD: Cool white waterproof page (#FAFBF8) ruled in survey green (#8DB59A minor, #5F8F6E header
double rule) at one device pixel; ink #1B2420, pencil #69736E. Cover yellow (#E2CC2A) owns the full-height
spine; chestnut (#8A4A22) is the only attention ink (overdue, blocking). Night page: bottle green
(#102722 ground, #15302A page, #2D5146 rules), yellow spine kept. Barlow body, Barlow Condensed caps for
stamped headers and labels, Overpass Mono for keys, dates and numerals. Radius 0–2px; no pills. States are
printed marks: done is a struck key, focus a bracket/outline, overdue changes ink not geometry. Story points
render as a fixed magnitude-dot ramp (1·2·3·5·8·13). Each epic owns one line ink: a 3px edge stripe on its entries.

STORY: You open the book at its index. You see what is overdue and due today before anything else, know which
workspace and board each entry lives in, and click an entry to go to its board. Switching sections is a tab pull.

FIRST VIEWPORT: Left, a ~248px cover-yellow spine, full height: munia-head mark from logo.jpg plus "Bird-Watcher"
stamped; "My Work" index link; workspaces as thumb tabs (active tab is page-coloured and flush with the page,
its boards listed beneath); account at the foot. Right, the page: a field-book header strip (INDEX · MY WORK at
left; mono date and tallies at right: open, overdue, sprint points). Below, a ruled table under a double header
rule: KEY | ENTRY | WHERE | STATUS | SPRINT | PTS | DUE, grouped by section rules OVERDUE · TODAY · NEXT 7 DAYS ·
LATER · UNDATED with counts. Rows ~40px. The first overdue entry is the primary action.

SIGNATURE: thumb-tab pull. Selecting a workspace slides its tab flush into the page (≈160ms) and reveals its
boards; done entries draw their strike across the key. Keyboard: 1–5 jumps to tabs.

FORM: Field Book (all-weather survey field book), position 7 of 7 on the ordered list; seed key 79b86c7f.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Recorded adaptations
- Night spine yellow is dimmed (#CDB824) to cut glare on the night page; still the cover, still full height.
- DONE THIS WEEK closes the index: it is where "done entries draw their strike across the key" is seen.
- Epic line ink renders as a 3×16px tick in the ruled margin, not a full-height edge stripe (craft floor refuses coloured side stripes).
- Phone widths: the spine becomes a cover band with horizontal thumb tabs plus an account link; account, theme,
  new workspace and sign-out live on /account. My Work rows keep key, status, where and due; type, points and sprint drop.
- Header strips carry no caption above or before the title; boards and settings use a linked workspace breadcrumb.
- Page ruling continues below the last entry to the foot of every page.

- Board views (Phases 2–3) extend the same world:
  - View tabs (Board · Backlog · Epics · Reports · Settings) are the thumb-tab grammar turned horizontal, standing on the header's double rule.
  - USER-DIRECTED (overrides the earlier "no scrim" choice): the entry drawer dims the board with a scrim that closes
    it on click, carries a 2px ink left edge and a page-sunk header band. Still no shadow.
  - A dragged entry or column lifts as a slip tilted -1deg with a 1px ink border instead of a shadow.
  - Labels share the six fountain-pen inks with epics; shape separates them: an epic is a 3x16 vertical tick in the margin, a label an 8px square swatch or a bordered printed tag. The epic progress meter fills in its epic's ink.
  - Charts add two series inks validated with the dataviz validator: --chart-plan (slate #206e9e / #438fc4) and --chart-done (survey green #2f8a4a / #3d9d5c). Gridlines are rule-minor hairlines; text never takes series colour.
  - Sprint names are user-written, so they set in Barlow sentence case; only pre-printed captions (BACKLOG, column captions) are stamped caps.

- USER-DIRECTED (overrides ruled ledger columns on the board): columns are tinted lanes (ground, tinted by the board
  colour at --lane-tint: 10% day / 4% night) holding separate Jira-style tiles: page-coloured, 1px rule-mid border,
  2px radius, 8px gaps, no shadow. Tile anatomy: title; milestone/experiment stamps, epic tag, label swatches, counts;
  footer of type glyph, key, priority chevron, then points, due date and assignee that edit in place (invisible native
  controls over the printed marks). "Ruled To The Foot" no longer applies inside lanes.
- Phases 4–5 surfaces inherit the world: Inbox (ruled groups, unread square), Activity (ruled day sections, viewer time
  zone), ⌘K palette and "?" sheet (scrim + 2px ink frame + double rule), Table (sortable ledger; phone meta line),
  Calendar (month grid with two-line chips; ruled agenda below md), Welcome (ruled tick rows, collapses to one line),
  drawn checkboxes (.check), experiment block, files list, comment composer with @mention list.

## Unresolved
- Relative times ("3h ago") in Inbox and comments versus mono dates elsewhere; kept for scanability.

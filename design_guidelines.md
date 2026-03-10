# Academium Engine Design Guidelines

## Design Approach

**Selected Framework:** Design System Approach (Fluent Design + Linear inspiration)
**Rationale:** Educational productivity tool requiring data clarity, professional credibility, and consistent interaction patterns across student and professor experiences.

**Core Principles:**
1. **Information Hierarchy First:** Clear visual separation between simulation narrative, metrics, and feedback
2. **Professional Credibility:** Business school aesthetic - serious, trustworthy, sophisticated
3. **Cognitive Load Management:** Dense information presented through structured layouts and clear typography
4. **Responsive Data Visualization:** Real-time updates feel intentional, not chaotic

---

## Typography System

**Font Families (Google Fonts):**
- **Primary (UI/Body):** Inter (400, 500, 600)
- **Display (Headers):** Inter (700)
- **Monospace (Data/Metrics):** JetBrains Mono (500)

**Type Scale:**
- **Hero/Page Titles:** text-4xl font-bold (36px)
- **Section Headers:** text-2xl font-semibold (24px)
- **Panel Titles:** text-lg font-semibold (18px)
- **Body Text:** text-base (16px)
- **Labels/Meta:** text-sm font-medium (14px)
- **KPI Numbers:** text-3xl font-mono (30px)
- **Chat Messages:** text-base leading-relaxed (16px, increased line-height)

**Hierarchy Rules:**
- Simulation narrative uses comfortable leading (leading-7)
- KPI labels use uppercase tracking (uppercase tracking-wide text-xs)
- Feedback cards use medium weight for emphasis
- NPC dialogue uses italic treatment to differentiate

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- **Micro spacing:** gap-2, p-2 (buttons, chips)
- **Component spacing:** gap-4, p-4 (cards, panels)
- **Section spacing:** gap-6, p-6 (panel interiors)
- **Major spacing:** gap-8, p-8 (between major sections)
- **Panel separation:** gap-12 (between left/center/right panels)

**Grid System:**
- **Student Cockpit:** 3-column grid (lg:grid-cols-[320px_1fr_360px])
  - Left Panel: 320px fixed (KPIs/context)
  - Center Panel: Flexible (narrative feed)
  - Right Panel: 360px fixed (feedback/assessment)
- **Professor Studio:** Single column max-w-6xl centered for focused authoring

**Container Strategy:**
- Full viewport height for simulation interface (h-screen)
- Interior panels use flex-col with overflow handling
- Chat feed: flex-1 overflow-y-auto
- Fixed input console at bottom

---

## Component Architecture

### A. Simulation Interface Components

**Left Panel (Context Dashboard):**
- Sticky header with scenario title (text-xl font-semibold p-6 border-b)
- KPI cards in vertical stack (space-y-4)
- Each KPI card: rounded-lg border p-4
  - Label: uppercase text-xs tracking-wide
  - Value: text-3xl font-mono
  - Delta indicator: text-sm with ↑↓ symbols

**Center Panel (Narrative Feed):**
- Message bubbles with role-based styling:
  - System (Narrator): border-l-4 pl-4 py-3 (no background)
  - NPC Dialogue: rounded-lg p-4 border (with NPC name header)
  - Student Action: rounded-lg p-3 ml-auto max-w-2xl
- Typing indicator: animated dots in flex gap-1
- Timestamp metadata: text-xs mt-2

**Right Panel (Feedback):**
- Competency radar chart: mb-8
- Micro-feedback card: rounded-lg border p-6
  - Score badge at top
  - Message paragraph
  - Optional hint in italic

**Input Console (Bottom Center):**
- Fixed container with border-t
- Textarea: min-h-24 max-h-48 resize-none
- Button row: flex justify-between items-center
  - Submit: primary button
  - Secondary actions: outlined buttons

### B. Professor Authoring Studio

**Wizard Layout:**
- Progress indicator: flex justify-between mb-8 with numbered steps
- Step container: max-w-4xl mx-auto
- Upload area: border-dashed border-2 rounded-lg p-12 text-center
- Blueprint visualization: full-width with side inspector panel

**Scenario Editor:**
- Two-column split (lg:grid-cols-[1fr_400px])
- Main editor: prose max-w-none
- Inspector sidebar: sticky top-0 with settings

### C. Shared Components

**Navigation:**
- Top bar: h-16 border-b flex items-center justify-between px-6
- Logo/title: text-xl font-bold
- User menu: flex items-center gap-4

**Cards:**
- Standard: rounded-lg border p-6 space-y-4
- Hover state: subtle border emphasis (no shadow)

**Buttons:**
- Primary: px-4 py-2 rounded-md font-medium
- Secondary: border px-4 py-2 rounded-md
- Icon buttons: p-2 rounded-md

**Forms:**
- Label: block text-sm font-medium mb-1
- Input: w-full px-3 py-2 rounded-md border
- Help text: text-sm mt-1

---

## Data Visualization

**KPI Dashboard:**
- Use simple bar/line charts (Recharts)
- Minimal decoration, focus on data
- Grid lines: subtle, thin
- Axis labels: text-xs
- Tooltips: rounded-lg border p-2 text-sm

**Competency Radar:**
- 4-axis spider chart
- Clean geometric shape
- Axis labels positioned outside
- No fill, stroke-only

---

## Interaction Patterns

**Loading States:**
- Agent thinking: Sequential text reveals ("Analyzing intent..." → "Consulting experts..." → "Generating outcome...")
- No generic spinners, use contextual status messages
- Progress bar for file uploads

**Real-time Updates:**
- KPI number counting animation (not instant snap)
- Delta arrows fade in with slight bounce
- New message bubbles slide up with fade-in

**Error States:**
- Inline validation below inputs
- Banner alerts at top of panels (not blocking modals)
- "Reconnecting..." status for connection issues

---

## Responsive Strategy

**Desktop (lg:):** Full three-panel cockpit
**Tablet (md:):** Collapsible side panels, center feed primary
**Mobile (base):** Single column stack, tabs for panel switching

**Breakpoint Adjustments:**
- Text scales down one step on mobile (text-4xl → text-3xl)
- Padding reduces by half (p-8 → p-4)
- KPI cards stack vertically on mobile

---

## Accessibility

- All interactive elements have min-height of h-10 (40px)
- Form inputs maintain consistent height (h-10)
- Adequate spacing between clickable elements (gap-2 minimum)
- Text maintains minimum 16px base size
- Sufficient contrast ratios (rely on border/structure, not just color)

---

## Assets

**Icons:** Heroicons (via CDN)
- Outline style for navigation/actions
- Solid style for status indicators
- Size: w-5 h-5 standard, w-6 h-6 for emphasis

**No Images Required:** This is a text-based simulation platform. All visual interest comes from typography, data visualization, and structured layout.
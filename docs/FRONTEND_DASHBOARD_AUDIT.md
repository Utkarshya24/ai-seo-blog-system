# Frontend Dashboard Audit And Upgrade Plan

## Objective
Upgrade admin frontend to match a professional SaaS dashboard standard: high information density, clear hierarchy, stronger navigation, polished visuals, and faster task execution.

## Gaps Found (Before Changes)
1. Layout hierarchy was weak: top bar and workspace controls were cluttered and visually flat.
2. Sidebar navigation lacked sectioning and contextual guidance for primary vs secondary actions.
3. Dashboard overview had only basic counts; no derived ratios, workload clarity, or workflow state.
4. Quick actions were generic and did not prioritize operational next steps.
5. Visual system looked template-like: low depth, low contrast rhythm, minimal differentiation of cards.
6. Workspace context (tenant/website/token state) was functional but not productized as a clear control panel.
7. No concise “what to do next” panel for operators.
8. Mobile nav existed but was bare and not aligned with desktop hierarchy.

## Professional SaaS Improvements To Implement
1. Rebuild `AdminShell` with:
- Sticky, structured sidebar with grouped navigation and utility links.
- Better brand and workspace status framing.
- Dedicated workspace control block in header.
- Stronger visual depth (surfaces, gradients, panel borders).

2. Upgrade overview dashboard with:
- KPI strip using labeled metrics and trend context.
- Publishing funnel and content health sections.
- Operational action center (high-value shortcuts).
- Recent content activity snapshot.
- Weekly execution checklist.

3. Improve global dashboard look-and-feel:
- Intentional gradient layers and subtle surface patterns.
- Better spacing rhythm and card emphasis.

## Implementation Status
- [x] Audit documented
- [x] Shared `AdminShell` upgraded
- [x] `/admin` overview upgraded
- [x] Styling polish added in global styles
- [x] Module-level snapshot/KPI strips added (`keywords`, `posts`, `websites`, `team`, `social`, `tech-news`)
- [x] Visibility provider breakdown section added
- [x] Shared card surface upgraded for consistent premium SaaS look
- [x] `metrics` upgraded with severity chips, opportunity pulse widgets, and denser experiment actions
- [x] `outreach` upgraded with follow-up intelligence widgets, status badges, and denser pipeline controls
- [x] Reusable UI primitives added: `KpiCard` and `StatusBadge`
- [x] Shared primitives adopted across key admin modules for consistency and faster future scaling
- [x] Centralized status-to-tone config added in `lib/ui/status-maps.ts` and wired into admin modules
- [x] `KpiCard` variants added (`default`, `compact`, `progress`) with optional trend indicators
- [x] `KpiCard` variants rolled out to `metrics`, `outreach`, and `social` KPI strips
- [x] `KpiCard` variants rolled out to all major admin modules (`keywords`, `posts`, `team`, `websites`, `tech-news`)
- [x] Mobile table overflow hardening applied to `keywords`, `posts`, `metrics`, and `outreach`

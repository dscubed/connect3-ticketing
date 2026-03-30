# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Connect3 Ticketing** is a Next.js 16 + React 19 + TypeScript ticketing platform for university clubs and organizations. It provides event creation, ticket management, and attendee tracking with role-based features for organizations vs. individual users.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint

# Run ESLint with fix
npm run lint -- --fix
```

## Tech Stack

- **Framework**: Next.js 16.1.6 with App Router
- **UI/State**: React 19 + Zustand (client-side state)
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Auth)
- **Special Libraries**:
  - `@dnd-kit/*` — drag-and-drop sorting
  - `leaflet` + `react-leaflet` — maps for event locations
  - `date-fns` — date/time handling
  - `react-easy-crop` — image cropping
  - `sonner` — toast notifications
  - `nanoid` — unique IDs

## Project Structure

### `/app` — Next.js App Router Pages

- **`/app/auth`** — Authentication flows and SSO
- **`/app/api`** — API routes (events, clubs, invites, profiles, media)
- **`/app/dashboard`** — User and org dashboards (club, events, manage)
- **`/app/events`** — Event creation and detail pages
- **`/app/layout.tsx`** — Root layout with providers (Auth, NotFound, Tooltip, Toaster)
- **`/app/page.tsx`** — Landing/home (redirects to dashboards when authenticated)

### `/components` — React Components

- **`/ui`** — shadcn/ui components (button, card, dialog, input, select, tabs, etc.)
  - **Custom responsive components** (heavily used in event pages):
    - `ResponsiveModal` — Dialog on desktop, bottom sheet (DismissableSheet) on mobile
    - `ResponsivePopover` — Popover on desktop, dismissable sheet on mobile
    - `DropdownMenu` — Full-featured dropdown with items, checkboxes, radio groups (Radix UI)
- **`/auth`** — Auth UI (LoginButton, auth flows)
- **`/dashboard`** — Dashboard components (OrgDashboard, UserDashboard)
- **`/events`** — Event-related components (EventsList, EventCard, EventEditor, etc.)
  - Uses `DropdownMenu` for field options, `ResponsivePopover` for ticket field configs
- **`/layout`** — Navbar, navigation (NavbarWrapper)
- **`/providers`** — React Context providers (AuthProvider, NotFoundProvider)
- **`/shared`** — Reusable components across the app
- **`/media`** — Image upload, cropping, processing components
- **`/logo`** — Logo components

### `/lib` — Shared Utilities & Hooks

- **`/lib/supabase`**
  - `client.ts` — Browser client for Supabase
  - `server.ts` — Server-side Supabase client (cookies-based auth)
  - `admin.ts` — Admin client for RLS bypasses
  - `middleware.ts` — Session refresh in Next.js middleware
- **`/lib/auth`**
  - `sso.ts` — SSO logic
  - `clubAdmin.ts` — Club admin authorization checks
- **`/lib/hooks`** — Custom React hooks (useAuthStore, useAutoSave, useEventRealtime, useIsMobile, etc.)
- **`/lib/types`** — TypeScript interfaces (EventCardDetails, AvatarProfile, etc.)
- **`/lib/api`** — Helper functions for API calls (createEvent, updateEvent, patchEvent, fetchEvent, etc.)
- **`/lib/utils`** — Utilities (cropImage, uploadEventImage, timezone, ticketPricing, etc.)

### `/stores` — Zustand State Management

- **`authStore.ts`** — Global auth state (user, profile, loading, isOrganisation())

## Core Architecture Patterns

### Authentication & Authorization

1. **Server-side**: Middleware (`middleware.ts`) refreshes auth session on every request
2. **Client-side**: `AuthProvider` (React Context) syncs Supabase auth with `useAuthStore` (Zustand)
3. **Role-based UI**: Pages check `isOrganisation()` to render org vs. user views
4. **RLS Policies**: Supabase Row Level Security enforces data access at the DB level

### Server vs. Client Components

- **Server Components** (default): Async pages, API routes, data fetching
- **Client Components** (`"use client"`): Interactive UI, hooks, state
- **Pattern**: Fetch data in server components, pass to client components as props

### Event Management Flow

1. User navigates to `/events/create` (server component)
2. Page creates a draft event in Supabase and redirects to editor
3. Editor is a client component with auto-save via `useAutoSave` hook
4. Real-time updates via `useEventRealtime` hook (Supabase Realtime)
5. API routes in `/app/api/events` handle mutations (create, update, patch)

### EventEditorContext (Ambient Editor State)

`EventEditorContext` (`components/events/shared/EventEditorContext.tsx`) provides ambient editor state to all components inside the event editor without prop drilling. It is **provided** by `EventForm` and (conditionally) by `CheckoutForm`.

**What goes in context (ambient state):**
- Theme: `theme`, `colors`, `isDark` — visual appearance shared by all components
- Auto-save: `markDirty()`, `flush()`, `isAutoSaving`, `lastSavedAt`
- Editor state: `mode`, `viewMode`, `previewMode`, `toolbarCollapsed`
- Actions: `handlePublish`, `handleBack`, `enableTicketing`, etc.
- Collaboration: `collaborators`, `getFieldLock()`, `handleFieldFocus()`

**What stays as props (per-instance data):**
- `value` / `onChange` — controlled component pattern for form fields
- `mode` ("edit" | "preview") — can vary per field instance
- `locked` / `lockedBy` — per-field collaboration locks
- `onFocusChange` — per-field focus callbacks

**Hooks:**
- `useEventEditor()` — throws if no provider (for components that require the editor context)
- `useEditorTheme()` — returns `null` outside a provider (safe for components used in both editor and visitor pages)

**Pattern for shared components (SectionWrapper, TicketingButton, etc.):**
```tsx
const ctx = useEditorTheme(); // null-safe
const isDark = isDarkProp ?? ctx?.isDark;
const layout = layoutProp ?? ctx?.theme.layout ?? "card";
```
Props are still accepted for visitor pages (no provider), but when inside the editor the context is used automatically.

### Editor Hooks (Logic Extraction)

EventForm and CheckoutForm logic is split into reusable hooks in `/lib/hooks/`:

| Hook | Purpose | Used by |
|---|---|---|
| `useEventFormState` | Core form data, images, sections, hosts, theme, derived colors | EventForm |
| `useEventAutoSave` | Throttled auto-save (create draft → patch), beforeunload guard | EventForm |
| `useEventCollaboration` | Realtime presence, remote change reconciliation, field locks | EventForm |
| `useEventPublish` | Publish / unpublish actions | EventForm |
| `useEventTicketing` | Enable / disable ticketing | **Both** EventForm and CheckoutForm |
| `useEventSections` | Section CRUD + drag-and-drop reordering | EventForm |
| `useCheckoutFields` | Custom ticket field CRUD, auto-save, DnD | CheckoutForm |

**Navigation pattern**: Switching between event editor and checkout editor uses `router.replace` (not `router.push`) to avoid flooding the browser history stack. The Back button takes users out of the editor entirely.

### Date & Location Editing Pattern

In the event editor (`EventForm`), date and location are **not** inline editors. Instead:
- Both fields always display as read-only (`DateDisplay` / `LocationDisplay`) — same look as preview mode
- In edit mode, each row is a clickable button with a hover pencil icon
- Clicking either row opens a `ResponsiveModal` containing `DateLocationSection` (the combined date + location editor)
- The `DateLocationSection` lives in `components/events/create/DateLocationSection.tsx` and handles timezone, single/recurring events, and venue management

This means `EventDateField` and `EventLocationField` always render in `mode="preview"` inside `EventForm` — the edit interaction is the modal, not inline inputs.

### Venue Model (Multi-Location)

Events support **multiple venues** via the `Venue` type in `shared/types.ts`:
- `EventFormData.venues: Venue[]` — each venue has an `id`, `type` (physical/custom/online/tba), `location` (LocationData), and optional `onlineLink`
- `OccurrenceFormData.venueIds?: string[]` — each occurrence can reference one or more venues
- **Backward compat**: The legacy `location`, `locationType`, `onlineLink` fields on `EventFormData` are kept in sync by `DateLocationSection.syncPrimaryLocation()` from the first physical/online venue
- The `DateLocationSection` renders a venue manager: list of venue cards with add/edit/remove, each venue configurable with the same location picker flow (search, custom, online, TBA)

### Occurrence Editor (Recurring Events)

`OccurrenceEditor` (`components/events/create/OccurrenceEditor.tsx`) provides a Humanitix-style UI:
- **Left panel**: Full-width monthly grid calendar with occurrence chips shown on date cells. Click a date to add, click a chip to edit
- **Right panel (idle)**: Lists all existing occurrences sorted by date — clicking one opens it for editing and navigates the calendar to that month
- **Right panel (add/edit)**: Start/end date+time inputs, frequency selector (once/daily/weekly/monthly), and venue picker (multi-select checkboxes from the event's venues)
- Occurrence changes are local until "Save changes" is clicked

### Image Handling

- Images stored in Supabase Storage
- `uploadEventImage()` handles compression and upload
- `cropImage()` prepares images for cropping UI
- Next.js Image Optimization for remote images from Supabase

### Form Patterns

- Client-side state with React hooks (useState, useCallback)
- Optional auto-save via `useAutoSave` hook
- Validation before API calls
- Toast notifications via Sonner for feedback

## Key Files to Know

- **`middleware.ts`** — Runs on every request to refresh auth sessions
- **`next.config.ts`** — Allows images from Supabase and Instagram CDNs
- **`stores/authStore.ts`** — Single source of truth for auth state
- **`components/providers/AuthProvider.tsx`** — Syncs Supabase auth to Zustand
- **`lib/supabase/server.ts`** — Server-side DB client with RLS enforced
- **`app/page.tsx`** — Route logic: unauthenticated → landing, org → OrgDashboard, user → UserDashboard

## Database & Realtime

- **Tables**: events, users (profiles), clubs, invites, tickets, etc.
- **RLS**: All tables have RLS policies to enforce user/org data isolation
- **Realtime**: Subscribe to changes via Supabase Realtime (used in `useEventRealtime`)
- **Admin Access**: `lib/supabase/admin.ts` bypasses RLS for server operations

## Component Styling & Responsive UI

- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for pre-built components (Dialog, Select, Card, Tabs, etc.)
- **Dark mode**: `next-themes` + Tailwind's dark mode support
- **Responsive**: Use Tailwind breakpoints (sm, md, lg) and shadcn responsive primitives

### Custom Responsive Components (Used Extensively in Event Pages)

**ResponsiveModal** (`components/ui/responsive-modal.tsx`)

- Desktop: Renders as a centered Dialog
- Mobile: Renders as a bottom-sheet (DismissableSheet with drag handle)
- Props: `open`, `onOpenChange`, `title?`, `description?`, `children`, `className?`, `showCloseButton?`
- **Usage**: Event editor modals, checkout flows, confirmation dialogs

**ResponsivePopover** (`components/ui/responsive-popover.tsx`)

- Desktop: Renders as a floating Popover anchored to trigger
- Mobile: Renders as a dismissable sheet
- Props: `open`, `onOpenChange`, `trigger`, `children`, `contentClassName?`, `align?`, `sideOffset?`
- **Usage**: Event page ticket field configs, settings menus, filter options

## Common Patterns

### Creating a New Page

1. Create file in `/app/[section]/page.tsx`
2. Use async for server-side fetching, `"use client"` for interactivity
3. Fetch data from Supabase via `lib/supabase/server.ts` in server components
4. Use custom hooks (useAuthStore, useAutoSave) in client components

### Adding a Component

1. Place in `/components/[category]/ComponentName.tsx`
2. Use shadcn/ui for common elements (button, dialog, input, etc.)
3. Export from component file; import where needed
4. Use CSS modules or Tailwind for styling

### Calling an API

1. Create route handler in `/app/api/[endpoint]/route.ts`
2. Use `lib/supabase/server.ts` for DB access
3. Validate auth, check RLS context
4. Return JSON response
5. Call from client with `fetch()` or custom hook

### Managing State

- **Auth**: `useAuthStore()` from Zustand
- **UI**: React `useState`, `useCallback`
- **Data**: Fetch on demand from Supabase
- **Sync**: `useAutoSave` for background persistence

### Using Responsive Components in Event Pages

1. **ResponsiveModal** for dialogs that work on all screen sizes:
   ```tsx
   const [open, setOpen] = useState(false);
   return (
     <ResponsiveModal open={open} onOpenChange={setOpen} title="Edit Ticket">
       {/* Content */}
     </ResponsiveModal>
   );
   ```
2. **ResponsivePopover** for anchored menus/options:
   ```tsx
   const [open, setOpen] = useState(false);
   return (
     <ResponsivePopover
       open={open}
       onOpenChange={setOpen}
       trigger={<Button>Settings</Button>}
     >
       {/* Content */}
     </ResponsivePopover>
   );
   ```

## Date & Location Editing Pattern

The event form uses a **preview-then-edit** pattern for date and location fields:

- **Edit mode**: Date and location display as read-only preview rows. Clicking either opens a `ResponsiveModal` containing the full `DateLocationSection` editor (date/time, timezone, recurring occurrences, and multi-venue management).
- **Preview mode**: Clicking date or location opens an `EventDetailModal` (`components/events/preview/EventDetailModal.tsx`) that shows full event details — venue maps, online links, and occurrences as expandable `Accordion` items.
- Both date and location are **auto-dirtied together** (`markDirty("event", "location")`) to prevent concurrent edit conflicts.

## Venue Model (Multi-Location)

Events support **multiple venues** via the `Venue[]` array in `EventFormData`:

- **Venue types**: `physical` (geocoded), `custom` (manual name/address), `online` (meeting link), `tba` (placeholder).
- **TBA auto-management**: A TBA venue is the default when no venues exist. When a real venue is added, all TBA venues are automatically removed. The TBA tab is hidden in `AddVenuePanel` when real venues exist. TBA venues are filtered out of the occurrence `VenuePicker`.
- **Backward compatibility**: `syncPrimaryLocation()` in `DateLocationSection` keeps the legacy single `location`/`locationType`/`onlineLink` fields in sync with the first relevant venue.
- **Occurrence → venue mapping**: Each `OccurrenceFormData` has an optional `venueIds[]` to assign venues per occurrence.

## Occurrence Model (No Single/Recurring Split)

Every event uses **occurrences** — there is no separate "single event" vs "recurring event" toggle. A single-date event simply has one occurrence. The legacy `isRecurring`, `startDate`, `startTime`, `endDate`, `endTime` fields on `EventFormData` are **auto-derived** from occurrences for backward compatibility:

- `isRecurring` = `occurrences.length > 1`
- `startDate`/`startTime`/`endDate`/`endTime` = copied from the chronologically first occurrence
- `DateLocationSection` no longer accepts or renders single-event date inputs — it only shows the timezone picker and the occurrence editor trigger
- `fetchEvent` synthesizes a legacy occurrence from `startDate`/`endDate` when the DB has no occurrences (old events)
- The delete button in `OccurrenceEditor` is hidden when only one occurrence remains

### Occurrence Editor

`OccurrenceEditor` (`components/events/create/OccurrenceEditor.tsx`) provides a Humanitix-style full-width monthly calendar grid:

- **Left panel**: `MonthGrid` with date cells showing occurrence chips (time labels). Day cells use `div[role="button"]` (not `<button>`) to avoid nested-button hydration errors with chip click handlers inside.
- **Right panel**: Idle state shows `OccurrenceList` (all occurrences, clickable to edit); active state shows add/edit form with start/end date+time, frequency (once/daily/weekly/monthly), repeat-until, and venue picker.
- **Repeat-until shortcut**: When the repeat-until input is focused, clicking a calendar date fills that field instead of adding an occurrence.
- **Start date required**, start time optional, end date/time optional. Missing times display as "All day".

## Important Gotchas

1. **Auth in Server Components**: Use `createClient()` from `lib/supabase/server.ts`, not the browser client
2. **RLS Context**: Row-level security is enforced; manually fetching as admin requires `supabaseAdmin`
3. **Image URLs**: Must be whitelisted in `next.config.ts` for Next.js Image optimization
4. **Zustand Subscriptions**: Use `useShallow()` when subscribing to nested state to avoid re-renders
5. **Middleware Scope**: Runs on all routes except static assets; be mindful of performance
6. **Org vs. User Logic**: Check `isOrganisation()` before rendering org-only features

## Testing & Debugging

- **Browser DevTools**: React DevTools to inspect components and Zustand state
- **Supabase Studio**: Access at https://app.supabase.com to inspect data, RLS policies, and logs
- **Next.js DevTools**: Check build errors and fast refresh issues
- **API Routes**: Test with curl or Postman against `/api/*` endpoints
- **Network Tab**: Inspect Supabase calls and auth tokens

## Deployment

- **Vercel**: Primary deployment (connected to GitHub)
- **Environment Variables**: Set `NEXT_PUBLIC_*` vars for browser-safe secrets
- **Build**: `npm run build` outputs to `.next/`
- **Preview Deployments**: Vercel creates a preview URL for each PR

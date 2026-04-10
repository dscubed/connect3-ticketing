/* ── Ticketing types ── */

export interface TicketingConfig {
  id: string;
  event_id: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Admin only. Shape of a ticket field when creating an event 
 */
export interface TicketingField {
  id: string;
  event_id: string;
  label: string;
  input_type: TicketingFieldType;
  placeholder: string | null;
  required: boolean;
  options: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TicketingFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "number"
  | "date"
  | "slider";

/** Client-side field shape (used in the editor before persisting). */
export interface TicketingFieldDraft {
  /** Temporary client ID (crypto.randomUUID) or DB id after save */
  id: string;
  label: string;
  input_type: TicketingFieldType;
  placeholder: string;
  required: boolean;
  /** For select / multiselect */
  options: string[];
  sort_order: number;
}

/** Available field type metadata for the "Add Field" picker. */
export const FIELD_TYPE_META: {
  type: TicketingFieldType;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    type: "text",
    label: "Short Text",
    icon: "Type",
    description: "Single-line text input",
  },
  {
    type: "textarea",
    label: "Long Text",
    icon: "AlignLeft",
    description: "Multi-line text area",
  },
  {
    type: "select",
    label: "Dropdown",
    icon: "ChevronDown",
    description: "Select one option from a list",
  },
  {
    type: "multiselect",
    label: "Multi-Select",
    icon: "ListChecks",
    description: "Select multiple options from a list",
  },
  {
    type: "number",
    label: "Number",
    icon: "Hash",
    description: "Numeric input",
  },
  {
    type: "date",
    label: "Date",
    icon: "Calendar",
    description: "Date picker",
  },
  {
    type: "slider",
    label: "Slider",
    icon: "SlidersHorizontal",
    description: "Range slider (1–10)",
  },
];

/** Create a blank field draft. */
export function createBlankField(
  type: TicketingFieldType,
  sortOrder: number,
): TicketingFieldDraft {
  return {
    id: crypto.randomUUID(),
    label: "",
    input_type: type,
    placeholder: "",
    required: false,
    options: type === "select" || type === "multiselect" ? ["Option 1"] : [],
    sort_order: sortOrder,
  };
}

/** The preset checkout fields (not editable — always shown). */
export const CHECKOUT_PRESET_FIELDS = [
  { key: "first_name", label: "First Name", type: "text", required: true },
  { key: "last_name", label: "Last Name", type: "text", required: true },
  { key: "email", label: "Email Address", type: "email", required: true },
  { key: "mobile", label: "Mobile Number", type: "tel", required: true },
] as const;

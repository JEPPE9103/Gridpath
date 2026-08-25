import {
  REQUIREMENT_CATEGORY_VALUES,
  REQUIREMENT_STATUS_VALUES,
  checklistStatusToDb,
  isChecklistStatus,
  requirementCategoryToDb,
} from "@/lib/domain/catalog-labels";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type RequirementFormInput = {
  label: string;
  category: string;
  required: boolean;
  status: string;
  dueDate: string;
};

export type RequirementFieldErrors = Partial<
  Record<"label" | "category" | "status" | "dueDate", string>
>;

export type ParsedRequirement = {
  label: string;
  category: (typeof REQUIREMENT_CATEGORY_VALUES)[number];
  required: boolean;
  status: (typeof REQUIREMENT_STATUS_VALUES)[number];
  dueDate: string | null;
};

export function parseRequirementForm(formData: FormData): {
  values: RequirementFormInput;
  parsed: ParsedRequirement | null;
  fieldErrors: RequirementFieldErrors;
} {
  const label = String(formData.get("label") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const required = String(formData.get("required") ?? "") === "on" ||
    String(formData.get("required") ?? "") === "true" ||
    String(formData.get("required") ?? "") === "1";

  const values: RequirementFormInput = {
    label,
    category: categoryRaw,
    required,
    status: statusRaw,
    dueDate,
  };

  const fieldErrors: RequirementFieldErrors = {};

  if (!label) {
    fieldErrors.label = "Enter a requirement title.";
  } else if (label.length > 200) {
    fieldErrors.label = "Title is too long.";
  }

  const category =
    requirementCategoryToDb(categoryRaw) ??
    (REQUIREMENT_CATEGORY_VALUES.includes(
      categoryRaw as (typeof REQUIREMENT_CATEGORY_VALUES)[number],
    )
      ? (categoryRaw as (typeof REQUIREMENT_CATEGORY_VALUES)[number])
      : null);
  if (!category) {
    fieldErrors.category = "Select a category.";
  }

  let status: (typeof REQUIREMENT_STATUS_VALUES)[number] | null = null;
  if (REQUIREMENT_STATUS_VALUES.includes(statusRaw as (typeof REQUIREMENT_STATUS_VALUES)[number])) {
    status = statusRaw as (typeof REQUIREMENT_STATUS_VALUES)[number];
  } else if (isChecklistStatus(statusRaw)) {
    status = checklistStatusToDb(statusRaw) as (typeof REQUIREMENT_STATUS_VALUES)[number];
  }
  if (!status) {
    fieldErrors.status = "Select a status.";
  }

  if (dueDate && !DATE_PATTERN.test(dueDate)) {
    fieldErrors.dueDate = "Use a valid date.";
  }

  if (Object.keys(fieldErrors).length > 0 || !category || !status) {
    return { values, parsed: null, fieldErrors };
  }

  return {
    values,
    parsed: {
      label,
      category,
      required,
      status,
      dueDate: dueDate || null,
    },
    fieldErrors,
  };
}

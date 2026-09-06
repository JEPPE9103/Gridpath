import { IMPORT_TEMPLATE_EXAMPLE_ROW, IMPORT_TEMPLATE_HEADERS } from "@/lib/import/mapping";
import { getCurrentOrganization } from "@/lib/data/organization";
import { canImportProjects } from "@/lib/projects/authorization";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export async function GET() {
  const organization = await getCurrentOrganization();
  if (!organization || !canImportProjects(organization.role)) {
    return new NextResponse("Not allowed", { status: 403 });
  }

  const body = [IMPORT_TEMPLATE_HEADERS, IMPORT_TEMPLATE_EXAMPLE_ROW]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  return new NextResponse(`\uFEFF${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="noxheim-portfolio-import-template.csv"',
    },
  });
}

"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  REQUIRED_IMPORT_FIELDS,
  suggestColumnMapping,
  type ColumnMapping,
} from "@/lib/import/mapping";
import {
  commitPortfolioImport,
  parsePortfolioImportFile,
  previewPortfolioImport,
  type ImportCommitResult,
} from "@/lib/import/actions";
import {
  summariseImportRows,
  type DuplicateDecision,
  type ValidatedImportRow,
} from "@/lib/import/validate";
import { formatMWTotal } from "@/lib/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Step = "upload" | "mapping" | "preview" | "done";

export function PortfolioImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [validated, setValidated] = useState<ValidatedImportRow[]>([]);
  const [decisions, setDecisions] = useState<Record<number, DuplicateDecision>>({});
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [pending, startTransition] = useTransition();

  const summary = useMemo(
    () => summariseImportRows(validated, decisions),
    [validated, decisions],
  );
  const duplicateRows = validated.filter((row) => row.duplicateOf && !row.issues.includes("Blank row."));
  const attentionRows = validated.filter(
    (row) => row.issues.filter((issue) => !issue.startsWith("Duplicate of row") && issue !== "Blank row.").length > 0,
  );

  function onUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const parsed = await parsePortfolioImportFile(formData);
      if (parsed.error || !parsed.headers || !parsed.rows) {
        setError(parsed.error ?? "Could not read the spreadsheet.");
        return;
      }
      setFilename(parsed.filename ?? "import");
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(suggestColumnMapping(parsed.headers));
      setStep("mapping");
    });
  }

  function onPreview() {
    setError(null);
    startTransition(async () => {
      const preview = await previewPortfolioImport(headers, rows, mapping);
      if (preview.error || !preview.validated) {
        setError(preview.error ?? "Could not validate the spreadsheet.");
        return;
      }
      const nextDecisions: Record<number, DuplicateDecision> = {};
      for (const row of preview.validated) {
        if (row.duplicateOf) {
          nextDecisions[row.rowNumber] = "skip";
        }
      }
      setValidated(preview.validated);
      setDecisions(nextDecisions);
      setStep("preview");
    });
  }

  function onImport() {
    setError(null);
    startTransition(async () => {
      const commit = await commitPortfolioImport({
        filename,
        rows: validated,
        duplicateDecisions: decisions,
      });
      if (!commit.ok) {
        setError(commit.error ?? "Could not import the projects.");
        return;
      }
      setResult(commit);
      setStep("done");
      router.refresh();
    });
  }

  return (
    <div className="max-w-4xl space-y-5">
      {error ? (
        <p className="rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
          {error}
        </p>
      ) : null}

      {step === "upload" ? (
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">1. Upload spreadsheet</h2>
          <p className="mt-2 text-sm text-muted">
            CSV and XLSX are supported. Start from the Noxheim template, or map your own columns in
            the next step.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/portfolio/import/template" className={buttonClassName("secondary")}>
              Download template
            </a>
          </div>
          <form action={onUpload} className="mt-5 space-y-4">
            <input
              name="file"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-canvas file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Reading…" : "Continue"}
            </Button>
          </form>
        </section>
      ) : null}

      {step === "mapping" ? (
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">2. Column mapping</h2>
          <p className="mt-2 text-sm text-muted">
            {rows.length} rows detected in {filename}. Project name, latitude and longitude are
            required. Optional fields can stay unmapped.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {IMPORT_FIELDS.map((field) => (
              <label key={field} className="block text-sm">
                <span className="text-muted">
                  {IMPORT_FIELD_LABELS[field]}
                  {REQUIRED_IMPORT_FIELDS.includes(field) ? " *" : ""}
                </span>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink"
                  value={mapping[field] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMapping((current) => {
                      const next = { ...current };
                      if (value === "") {
                        delete next[field];
                      } else {
                        next[field] = Number(value);
                      }
                      return next;
                    });
                  }}
                >
                  <option value="">Not mapped</option>
                  {headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>
                      {header || `Column ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" disabled={pending || mapping.name == null || mapping.latitude == null || mapping.longitude == null} onClick={onPreview}>
              {pending ? "Validating…" : "Validate rows"}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setStep("upload")}>
              Back
            </Button>
          </div>
        </section>
      ) : null}

      {step === "preview" ? (
        <section className="space-y-4">
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">3. Validation</h2>
            <p className="mt-2 text-sm text-ink">
              {summary.detected} rows detected · {summary.ready} ready to import · {summary.attention}{" "}
              require attention
              {summary.duplicates > 0 ? ` · ${summary.duplicates} possible duplicates` : ""}
            </p>
          </div>

          {attentionRows.length > 0 ? (
            <div className="rounded-md border border-warning/30 bg-warning-bg/50 p-5">
              <h3 className="text-sm font-semibold">Rows that require attention</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {attentionRows.slice(0, 20).map((row) => (
                  <li key={row.rowNumber}>
                    <span className="font-medium">Row {row.rowNumber}</span>
                    {row.name ? ` · ${row.name}` : ""}:{" "}
                    {row.issues.filter((issue) => !issue.startsWith("Duplicate of row")).join(" ")}
                  </li>
                ))}
              </ul>
              {attentionRows.length > 20 ? (
                <p className="mt-2 text-xs text-muted">{attentionRows.length - 20} more rows omitted.</p>
              ) : null}
              <p className="mt-3 text-sm text-muted">
                Fix the spreadsheet and re-upload, or remap columns.
              </p>
            </div>
          ) : null}

          {duplicateRows.length > 0 ? (
            <div className="rounded-md border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold">4. Existing projects</h3>
              <p className="mt-2 text-sm text-muted">
                These rows match an existing project by name or coordinates. Skip is the default.
                Import anyway creates a second project. There is no automatic merge.
              </p>
              <ul className="mt-3 space-y-3">
                {duplicateRows.map((row) => (
                  <li key={row.rowNumber} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      Row {row.rowNumber} · {row.name} matches {row.duplicateOf?.name}
                    </span>
                    <label className="flex items-center gap-2 text-muted">
                      <select
                        className="h-8 rounded-md border border-line bg-canvas px-2 text-ink"
                        value={decisions[row.rowNumber] ?? "skip"}
                        onChange={(event) =>
                          setDecisions((current) => ({
                            ...current,
                            [row.rowNumber]: event.target.value as DuplicateDecision,
                          }))
                        }
                      >
                        <option value="skip">Skip</option>
                        <option value="import">Import anyway</option>
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending || summary.ready === 0} onClick={onImport}>
              {pending ? "Importing…" : `Import ${summary.ready} projects`}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setStep("mapping")}>
              Back to mapping
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setStep("upload");
                setValidated([]);
              }}
            >
              Re-upload
            </Button>
          </div>
        </section>
      ) : null}

      {step === "done" && result ? (
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Import complete</h2>
          <p className="mt-2 text-sm text-ink">
            {result.successCount ?? 0} projects imported
            {(result.addedMw ?? 0) > 0 ? ` · ${formatAddedCapacity(result.addedMw ?? 0)} added to portfolio` : ""}
            {result.officialMatchCount != null
              ? ` · ${result.officialMatchCount} locations matched to official grid context`
              : ""}
            {(result.skippedCount ?? 0) > 0 ? ` · ${result.skippedCount} duplicates skipped` : ""}
            {(result.failedCount ?? 0) > 0 ? ` · ${result.failedCount} rows failed during write` : ""}
          </p>
          {(result.failures?.length ?? 0) > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-critical">
              {result.failures?.map((failure) => (
                <li key={`${failure.index}-${failure.name}`}>
                  {failure.name || `Row ${failure.index + 1}`}: {failure.error}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            Imported projects are standard Noxheim projects. Grid Intelligence uses the same official
            matching as manually created sites. A match means official geography covers the
            coordinate; it does not imply available capacity.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/portfolio" className={buttonClassName()}>
              Open portfolio
            </Link>
            <Link href="/overview" className={buttonClassName("secondary")}>
              Open overview
            </Link>
          </div>
        </section>
      ) : null}

      {step === "upload" ? (
        <EmptyState
          title="Bulk import creates real projects"
          description="Each row becomes a normal project with a PostGIS primary site in this organisation. Viewers cannot import."
        />
      ) : null}
    </div>
  );
}

function formatAddedCapacity(mw: number): string {
  if (mw >= 1000) {
    return `${(mw / 1000).toLocaleString("en-GB", { maximumFractionDigits: 2 })} GW`;
  }
  return formatMWTotal(mw);
}

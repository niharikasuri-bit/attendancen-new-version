import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOverlayLoader } from "@/components/loader";
import { ChevronLeft, Lock } from "lucide-react";
import { AppShell, Breadcrumb, FlowFooter } from "@/components/app-shell";
import { COLUMN_TONES, SheetTable } from "@/components/upload-instructions";
import { backButtonClass, primaryButtonClass } from "@/components/flow-controls";

const LEGEND = ["fixed", "auto", "required", "optional"];

/**
 * Review step before generating a template: a preview of the template with its columns
 * colour-coded as auto-filled, required or optional.
 *
 * `templateName`: e.g. "Attendance Register Template".
 * `prefilled`: column labels the template fills in from the user's selections.
 */
export function TemplateReview({ crumb, templateName, workbook, guide, groups, backTo, generateTo, prefilled = [], locked = [] }) {
  const navigate = useNavigate();
  const withLoader = useOverlayLoader();
  const sheets = workbook.sheets.filter((s) => !s.guide);
  const [active, setActive] = useState(0);
  const sheet = sheets[active];

  // Tag each column with what the user may do with it; reference sheets (lookup data) are all non-editable.
  const toneFor = (column) => {
    if (!sheet) return null;
    if (sheet.reference) return { tone: "fixed", help: "Reference data from your boundaries." };
    const group = groups.find((g) => g.pattern.test(column.label));
    const label = group ? group.label : column.label;
    const info = group ?? guide[label] ?? {};
    const required = group?.requiredColumns ? group.requiredColumns.includes(column.label) : !!info.required;
    const tone = locked.includes(label) ? "fixed" : prefilled.includes(label) ? "auto" : required ? "required" : "optional";
    const format = column.label === "Register ID" ? "BILL XXXXXXXX" : undefined;
    return { tone, format, help: tone === "auto" || tone === "fixed" ? "Filled in from your selections." : info.help };
  };

  // The legend lists only the kinds of column on the sheet being shown.
  const shown = new Set((sheet?.columns ?? []).filter((c) => !c.hidden).map((c) => toneFor(c)?.tone).filter(Boolean));

  return (
    <AppShell>
      <main className="min-w-0 flex-1 bg-muted/40 px-6 pb-28 pt-4">
        <Breadcrumb
          items={[
            { label: "Home", to: "/" },
            { label: "Attendance Setup & Management", to: "/attendance" },
            { label: crumb, to: backTo },
            { label: "Template Preview" },
          ]}
        />
        <h1 className="mt-3 font-condensed text-3xl font-bold text-heading">Preview Your {templateName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is a preview of your template. It includes columns we've filled in for you, columns you need to complete, and columns that are optional.
        </p>

        <div className="mt-5 flex flex-wrap items-stretch justify-between gap-3">
          {shown.size > 0 ? (
            <ul
              className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-md border border-border bg-card px-3 py-2"
              aria-label="What you can do with each column"
            >
              {LEGEND.filter((tone) => shown.has(tone)).map((tone) => (
                <li key={tone} className="flex items-center gap-2 text-sm font-medium text-heading">
                  <span className={`size-4 shrink-0 rounded-sm border border-black/15 ${COLUMN_TONES[tone].band}`} aria-hidden="true" />
                  {COLUMN_TONES[tone].label}
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5 rounded-md bg-chip px-3 py-2" role="note">
            <Lock className="size-4 shrink-0 text-heading" aria-hidden="true" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-heading">Read-only preview</p>
              <p className="text-xs text-muted-foreground">You can edit the file in Excel after you generate and download it.</p>
            </div>
          </div>
        </div>

        {/* The preview itself, styled like the Excel file. */}
        <section aria-label="Template preview" className="mt-3 overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <div className="max-h-[420px] overflow-auto bg-card">{sheet && <SheetTable sheet={sheet} toneFor={toneFor} minRows={8} />}</div>
          {sheets.length > 1 && (
            <div role="tablist" aria-label="Sheets" className="flex flex-wrap gap-1 border-t border-border bg-muted px-3 py-2">
              {sheets.map((s, i) => (
                <button
                  key={s.name}
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    i === active ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:bg-card hover:text-foreground"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </section>
        <p className="mt-2 text-xs text-muted-foreground">Hover a column header to see what goes in it.</p>
      </main>

      <FlowFooter>
        <Link to={backTo} className={backButtonClass}>
          <ChevronLeft className="size-4" /> Back
        </Link>
        <button onClick={() => void withLoader(`Generating your ${templateName.toLowerCase()}…`, null, 1800).then(() => navigate(generateTo))} className={primaryButtonClass}>
          Generate Template
        </button>
      </FlowFooter>
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell, Breadcrumb } from "@/components/app-shell";
import { attendanceActions, getRegisters, mappedUsers, unmappedUsers, useAttendanceStore } from "@/lib/attendance-store";
import { Filters, isNewlyAdded, NotMappedUsers, RegisterUsers, ReviewMapDialog, UserTabs, useUserFilters } from "@/components/register-users";
import { usePageLoading } from "@/components/loader";
import { UserCheck, UserPlus } from "lucide-react";

// Material icon paths used by this (Figma-matched) screen.
const PATHS = {
  checkCircle:
    "M16.59 7.58L10 14.17L6.41 10.59L5 12L10 17L18 9L16.59 7.58ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20Z",
};

function MIcon({ path, fill = "#0B0C0C", className = "" }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`block shrink-0 ${className}`}>
      <path d={path} fill={fill} />
    </svg>
  );
}

const ORIGINS = {
  manage: { label: "Manage Registers", to: "/attendance/registers" },
  "audit-log": { label: "Audit Log", to: "/attendance/audit-log" },
};

export default function ViewRegister() {
  const { registerId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const origin = ORIGINS[params.get("from")] ?? ORIGINS.manage;
  const store = useAttendanceStore();
  const register = useMemo(() => getRegisters(store).find((r) => r.id === registerId), [store, registerId]);
  const waiting = useMemo(() => (register ? unmappedUsers(register, store.users, store.skippedUsers) : []), [register, store.users, store.skippedUsers]);
  const mapped = useMemo(() => (register ? mappedUsers(register, store.users) : []), [register, store.users]);
  const [infoClosed, setInfoClosed] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const userFilters = useUserFilters();
  // Opened from the "Unmapped users" column (#unmapped) -> start on Mapping Pending.
  const [tab, setTab] = useState(() => (window.location.hash === "#unmapped" ? "pending" : "registered"));
  const filters = useMemo(() => ({ query: userFilters.query, types: userFilters.types }), [userFilters.query, userFilters.types]);
  // Map the picked users with the regular mapping flow, starting at its enrollment date step.
  const startMapping = (users) => {
    attendanceActions.setMappingRegisters([registerId]);
    attendanceActions.setMappingUsers(users);
    navigate("/attendance/map-template?step=1");
  };
  const mapPicked = () => startMapping(chosen);
  const [reviewOpen, setReviewOpen] = useState(false);
  const chosen = waiting.filter((u) => picked.has(u.workerId));
  const newCount = waiting.filter(isNewlyAdded).length;
  const location = useLocation();

  const loading = usePageLoading();
  const [highlight, setHighlight] = useState(false);
  const scrollToUnmapped = () => {
    setTab("pending");
    document.getElementById("unmapped")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("tab-pending")?.focus({ preventScroll: true });
    setHighlight(true);
    setTimeout(() => setHighlight(false), 1600);
  };
  // Opened from the "Unmapped users" column: jump straight to the list.
  useEffect(() => {
    if (!loading && location.hash === "#unmapped") requestAnimationFrame(scrollToUnmapped);
  }, [loading, location.hash]);

  return (
    <AppShell>
      <main className="min-w-0 flex-1 bg-muted/40 px-6 pb-12 pt-6">
        <div className="flex w-full flex-col gap-4">
          <Breadcrumb
            items={[
              { label: "Home", to: "/" },
              { label: "Attendance Setup & Management", to: "/attendance" },
              { label: origin.label, to: origin.to },
              { label: "View Register" },
            ]}
          />
          <div>
            <h1 className="font-condensed text-[40px] font-bold leading-[1.14] text-heading">View Register</h1>
            {register && (
              <div className="mt-3 flex flex-wrap gap-2">
                {[register.name, register.boundaryName || register.boundary].filter(Boolean).map((t) => (
                  <span key={t} className="rounded-md border border-border bg-[#FAFAFA] px-2.5 py-1 text-sm font-medium text-heading">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {waiting.length > 0 && !infoClosed && (
            <div role="status" className="relative flex flex-col items-start gap-3 border border-l-[6px] border-[#0057BD] bg-[#DEEFFF] py-4 pl-6 pr-14">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setInfoClosed(true)}
                className="absolute right-3 top-3 grid size-8 place-items-center rounded text-[#0057BD] hover:bg-[#0057BD]/10"
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                  <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor" />
                </svg>
              </button>
              <p className="flex items-center gap-2 text-base font-bold leading-[1.14] text-[#0057BD]">
                <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="#0057BD" />
                  <path d="M11 10h2v7h-2zM11 6.5h2v2h-2z" fill="white" />
                </svg>
                {newCount ? `${newCount} New ${newCount === 1 ? "User" : "Users"} Added` : `${waiting.length} ${waiting.length === 1 ? "User" : "Users"} Not Mapped Yet`}
              </p>
              <p className="text-base leading-[1.37] text-foreground">
                {newCount && newCount < waiting.length
                  ? `${newCount} new and ${waiting.length - newCount} earlier ${waiting.length - newCount === 1 ? "user" : "users"} are not mapped to this register.`
                  : `${waiting.length} ${newCount ? "new " : ""}${waiting.length === 1 ? "user is" : "users are"} not mapped to this register.`}{" "}
                Their attendance cannot be marked until they are mapped.
              </p>
              <button
                onClick={() => setReviewOpen(true)}
                className="flex h-9 items-center justify-center rounded bg-[#0057BD] px-5 text-base font-bold text-white transition-colors hover:brightness-110"
              >
                Review and Map
              </button>
            </div>
          )}

          {/* Register metrics */}

          {/* Page metrics (more can be added): equal-height cards; unmapped users' two kinds on the card's right. */}
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col justify-center rounded-lg border border-border bg-card px-5 py-3">
              <dd className="order-1 text-2xl font-bold leading-[1.14] tabular-nums text-heading">{mapped.filter((u) => u.status === "Active").length}</dd>
              <dt className="order-2 mt-1 text-sm text-foreground">Active Users</dt>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-5 py-3">
              <div className="flex flex-col">
                <dd className="order-1 text-2xl font-bold leading-[1.14] tabular-nums text-heading">{waiting.length}</dd>
                <dt className="order-2 mt-1 text-sm text-foreground">Not Mapped Yet</dt>
              </div>
              {waiting.length > 0 && (
                <dd className="flex flex-wrap gap-2">
                  {[
                    { label: "Newly Added", value: newCount },
                    { label: "Added Earlier", value: waiting.length - newCount },
                  ].map((m) => (
                    <span key={m.label} className="rounded-md border border-border bg-[#FAFAFA] px-2.5 py-1 text-sm text-heading">
                      <span className="font-bold tabular-nums">{m.value}</span> {m.label}
                    </span>
                  ))}
                </dd>
              )}
            </div>
          </dl>

          {/* Register users in two tabs, with one set of filters for both. */}
          {!loading && register && (
            <section id="unmapped" aria-label="Register users" className="mt-4 scroll-mt-6">
              <UserTabs
                active={waiting.length ? tab : "registered"}
                onChange={setTab}
                tabs={[
                  { key: "registered", label: "Mapped to This Register", count: mapped.length },
                  ...(waiting.length ? [{ key: "pending", label: "Not Mapped Yet", count: waiting.length }] : []),
                ]}
              />
              <div
                className={`overflow-hidden rounded-b-xl rounded-tr-xl ${waiting.length && tab === "pending" ? "rounded-tl-xl" : ""} border border-border bg-card transition-shadow duration-500 ${highlight ? "ring-2 ring-[#0057BD]" : "ring-0"}`}
              >
              <div id="register-users-panel" role="tabpanel" aria-labelledby={`tab-${waiting.length ? tab : "registered"}`}>
                {/* What this tab shows, as a heading and one line (no extra box). */}
                {(() => {
                  const pending = waiting.length > 0 && tab === "pending";
                  const Icon = pending ? UserPlus : UserCheck;
                  return (
                    <div className="border-b border-[#d6d5d4] px-6 pb-5 pt-6">
                      <h2 className="flex items-center gap-2 text-xl font-bold leading-[1.14] text-heading">
                        <Icon className="size-6 shrink-0 text-primary" aria-hidden="true" />
                        {pending ? "Not Mapped Yet" : "Mapped to This Register"}
                      </h2>
                      <p className="mt-2 text-base leading-[1.37] text-muted-foreground">
                        {pending
                          ? `Users added to ${register.boundaryName || "this register's boundary"} who are not on this register yet. Select users and map them so their attendance can be marked.`
                          : "Users on this register. Their attendance can be marked from their enrollment date."}
                      </p>
                    </div>
                  );
                })()}
                {waiting.length > 0 && tab === "pending" ? (
                  <NotMappedUsers
                    filters={filters}
                    filterBar={<Filters idPrefix="users" {...userFilters} />}
                    list={waiting}
                    picked={picked}
                    setPicked={setPicked}
                    actions={
                      <div className="flex flex-wrap gap-3">
                        
                        <button disabled={!chosen.length} onClick={mapPicked} className="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:bg-border disabled:text-muted-foreground">
                          Map Users
                        </button>
                      </div>
                    }
                  />
                ) : (
                  <RegisterUsers
                    filters={filters}
                    filterBar={<Filters idPrefix="users" {...userFilters} />}
                    list={mapped}
                    actions={
                      waiting.length === 0 && (
                        <button onClick={() => navigate(`/attendance/map-template?register=${registerId}`)} className="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:bg-border disabled:text-muted-foreground">
                          Map Users
                        </button>
                      )
                    }
                  />
                )}
              </div>
              </div>
            </section>
          )}
        </div>
      </main>


      {reviewOpen && register && (
        <ReviewMapDialog register={register} list={waiting} onClose={() => setReviewOpen(false)} onContinue={startMapping} />
      )}
    </AppShell>
  );
}

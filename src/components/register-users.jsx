import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/flow-controls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { USER_TYPE_NAMES } from "@/lib/attendance-store";

const formatDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const fieldClass =
  "h-10 w-full rounded-md border border-[#505a5f] bg-white text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

/** Search box + user type multi-select; one set on the page filters both lists. */
export function Filters({ idPrefix, query, setQuery, types, setTypes, compact = false }) {
  const label = types.length === 0 || types.length === USER_TYPE_NAMES.length ? "All user types" : types.join(", ");
  const toggleType = (t) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className={compact ? "w-64" : "w-72"}>
        <label htmlFor={`${idPrefix}-search`} className={compact ? "sr-only" : "block text-sm font-bold leading-[1.14] text-foreground"}>
          Search
        </label>
        <div className={compact ? "relative" : "relative mt-1"}>
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input
            id={`${idPrefix}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or username"
            className={`${fieldClass} pl-9 pr-3`}
          />
        </div>
      </div>
      <div className={compact ? "w-56" : "w-72"}>
        <span id={`${idPrefix}-type-label`} className={compact ? "sr-only" : "block text-sm font-bold leading-[1.14] text-foreground"}>
          User type
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-labelledby={`${idPrefix}-type-label`}
            className={`${fieldClass} ${compact ? "" : "mt-1"} flex items-center justify-between gap-2 px-3 text-left data-[state=open]:border-primary`}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 bg-white p-1">
            {USER_TYPE_NAMES.map((t) => (
              <DropdownMenuItem
                key={t}
                role="menuitemcheckbox"
                aria-checked={types.includes(t)}
                onSelect={(e) => {
                  e.preventDefault();
                  toggleType(t);
                }}
                className="cursor-pointer gap-3 px-3 py-2.5 text-base text-foreground focus:bg-[#FBEEE8] focus:text-foreground"
              >
                <Checkbox checked={types.includes(t)} />
                {t}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(query || types.length > 0) && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setTypes([]);
          }}
          className="h-10 text-base font-medium text-primary hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/** Page-level filter state for both user lists. */
export function useUserFilters() {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState([]);
  return { query, setQuery, types, setTypes };
}

const applyFilters = (list, { query, types }) => {
  const q = query.trim().toLowerCase();
  return list.filter((u) => (!q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) && (types.length === 0 || types.includes(u.type)));
};

const th = "px-4 py-3 text-base font-bold text-heading";
const td = "px-4 py-3 text-base text-foreground";

/** Users added to the boundary within this many days get the "Newly Added" tag. */
const NEW_WITHIN_DAYS = 7;
export const isNewlyAdded = (u) => !!u.addedOn && (Date.now() - new Date(`${u.addedOn}T00:00:00`).getTime()) / 86400000 <= NEW_WITHIN_DAYS;

function NewTag() {
  return <span className="rounded-xs bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-800">Newly Added</span>;
}

/**
 * Users at this register's boundary who are not on the register yet (newly added or not).
 * Every row can be selected; the Map Users button in the table toolbar maps the selection.
 */
export function NotMappedUsers({ list, filters, filterBar, picked, setPicked, actions }) {
  const matched = useMemo(() => applyFilters(list, filters), [list, filters]);
  const f = { rows: matched };
  // Ticks only cover users the filters let through.
  useEffect(() => {
    const shown = new Set(matched.map((u) => u.workerId));
    setPicked((p) => ([...p].every((id) => shown.has(id)) ? p : new Set([...p].filter((id) => shown.has(id)))));
  }, [matched, setPicked]);
  const shownPicked = f.rows.filter((u) => picked.has(u.workerId)).length;
  const allShown = f.rows.length > 0 && shownPicked === f.rows.length;
  const toggle = (id) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleShown = () =>
    setPicked((p) => {
      const next = new Set(p);
      f.rows.forEach((u) => (allShown ? next.delete(u.workerId) : next.add(u.workerId)));
      return next;
    });
  return (
      <div>
        {/* Filters on the left, Map Users on the right; the selection line sits below the search. */}
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 pt-6">
          {filterBar}
          <div className="ml-auto">{actions}</div>
        </div>
        <div className="flex min-h-6 items-center gap-3 px-6 pb-4 pt-3 text-base" aria-live="polite">
          {picked.size > 0 ? (
            <>
              <span className="font-semibold text-heading">{plural(picked.size, "user")} selected</span>
              <button type="button" onClick={() => setPicked(new Set())} className="font-medium text-primary hover:underline">
                Clear selection
              </button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              {matched.length === list.length ? plural(list.length, "user") : `Showing ${matched.length} of ${plural(list.length, "user")}`}
            </span>
          )}
        </div>

        <div className="mx-6 mb-6 overflow-x-auto rounded-xl border border-[#c5c5c5]">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#d6d5d4] bg-[#eee]">
                <th className="w-14 px-4 py-3">
                  <button
                    role="checkbox"
                    aria-checked={allShown ? "true" : shownPicked > 0 ? "mixed" : "false"}
                    aria-label="Select all users shown"
                    disabled={!f.rows.length}
                    onClick={toggleShown}
                    className="align-middle disabled:opacity-30"
                  >
                    <Checkbox checked={allShown} indeterminate={shownPicked > 0 && !allShown} size="size-5" />
                  </button>
                </th>
                <th className={th}>User Name</th>
                <th className={th}>User Type</th>
                <th className={th}>Username</th>
                <th className={th}>Added On</th>
              </tr>
            </thead>
            <tbody>
              {f.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-base text-muted-foreground">
                    No users match your filters.
                  </td>
                </tr>
              )}
              {f.rows.map((u) => {
                const on = picked.has(u.workerId);
                return (
                  <tr
                    key={u.workerId}
                    onClick={() => toggle(u.workerId)}
                    className={`cursor-pointer border-b border-[#d6d5d4] last:border-0 ${on ? "bg-selected-bg" : "hover:bg-muted/40"}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`Select ${u.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(u.workerId);
                        }}
                        className="align-middle"
                      >
                        <Checkbox checked={on} size="size-5" />
                      </button>
                    </td>
                    <td className={td}>
                      <span className="flex flex-wrap items-center gap-2">
                        {u.name}
                        {isNewlyAdded(u) && <NewTag />}
                      </span>
                    </td>
                    <td className={td}>{u.type}</td>
                    <td className={`${td} text-muted-foreground`}>{u.username}</td>
                    <td className={td}>{formatDate(u.addedOn)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
  );
}

/** Users already on the register. View only. */
export function RegisterUsers({ list, filters, filterBar, actions }) {
  const f = { rows: useMemo(() => applyFilters(list, filters), [list, filters]) };
  return (
    <div>
      {(filterBar || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 pb-4 pt-6">
          {list.length > 0 ? filterBar : <span />}
          {actions && <div className="ml-auto">{actions}</div>}
        </div>
      )}
      {list.length === 0 ? (
        <p className="mx-6 mb-6 rounded-xl border border-[#c5c5c5] px-6 py-10 text-center text-base text-muted-foreground">No users are mapped to this register yet.</p>
      ) : (
        <>
          <div className="mx-6 mb-6 overflow-x-auto rounded-xl border border-[#c5c5c5]">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#d6d5d4] bg-[#eee]">
                  <th className={th}>User Name</th>
                  <th className={th}>User Type</th>
                  <th className={th}>Username</th>
                  <th className={th}>Enrollment Date</th>
                  <th className={th}>Team Code</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {f.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-base text-muted-foreground">
                      No users match your filters.
                    </td>
                  </tr>
                )}
                {f.rows.map((u) => (
                  <tr key={u.id} className="border-b border-[#d6d5d4] last:border-0">
                    <td className={td}>{u.name}</td>
                    <td className={td}>{u.type}</td>
                    <td className={`${td} text-muted-foreground`}>{u.username}</td>
                    <td className={td}>{formatDate(u.enrollmentDate)}</td>
                    <td className={td}>{u.teamCode || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-3 py-1 text-sm ${u.status === "Active" ? "bg-[#f1fff8] text-[#00703c]" : "bg-[#fff5f4] text-[#b91900]"}`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** Tabs above the white card: active one white, outlined in orange with a bar beneath; others plain grey text. */
export function UserTabs({ tabs, active, onChange }) {
  return (
    <div role="tablist" aria-label="Register users" className="relative z-10 flex items-end [&>*+*]:-ml-px">
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            role="tab"
            aria-selected={on}
            aria-controls="register-users-panel"
            onClick={() => onChange(t.key)}
            className={`relative -mb-px flex items-center justify-center gap-2 rounded-t-lg border px-6 text-lg transition-colors ${
              on
                ? "z-10 h-[52px] border-primary border-b-white bg-white font-bold text-primary after:absolute after:-inset-x-px after:bottom-0 after:h-[3px] after:bg-primary"
                : "h-12 border-border bg-[#F7F7F7] font-medium text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="text-base font-normal tabular-nums">({t.count})</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Review and Map" from the Info banner: the users not mapped yet, all ticked to start.
 * Map N Users continues in the regular mapping flow (enrollment date step).
 */
export function ReviewMapDialog({ register, list: waiting, onClose, onContinue }) {
  // Only the newly added users; if none are new, every user not mapped yet.
  const fresh = waiting.filter(isNewlyAdded);
  const list = fresh.length ? fresh : waiting;
  const [picked, setPicked] = useState(() => new Set(list.map((u) => u.workerId)));
  const all = picked.size === list.length;
  const toggle = (id) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 bg-white p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-2xl font-bold text-heading">
            {fresh.length ? "Map New Users" : "Map Users"}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {fresh.length ? "These users were recently added" : "These users are"} to {register.boundaryName || "this register's boundary"}, which {register.name} covers. Review the users who will be mapped to this register.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="overflow-x-auto rounded-xl border border-[#c5c5c5]">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#d6d5d4] bg-[#eee]">
                  <th className="w-14 px-4 py-3">
                    <button
                      role="checkbox"
                      aria-checked={all ? "true" : picked.size ? "mixed" : "false"}
                      aria-label="Select all users"
                      onClick={() => setPicked(all ? new Set() : new Set(list.map((u) => u.workerId)))}
                      className="align-middle"
                    >
                      <Checkbox checked={all} indeterminate={picked.size > 0 && !all} size="size-5" />
                    </button>
                  </th>
                  <th className={th}>User Name</th>
                  <th className={th}>User Type</th>
                  <th className={th}>Added On</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => {
                  const on = picked.has(u.workerId);
                  return (
                    <tr
                      key={u.workerId}
                      onClick={() => toggle(u.workerId)}
                      className={`cursor-pointer border-b border-[#d6d5d4] last:border-0 ${on ? "bg-selected-bg" : "hover:bg-muted/40"}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`Select ${u.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(u.workerId);
                          }}
                          className="align-middle"
                        >
                          <Checkbox checked={on} size="size-5" />
                        </button>
                      </td>
                      <td className={td}>
                        <span className="flex flex-wrap items-center gap-2">
                          {u.name}
                          {isNewlyAdded(u) && <NewTag />}
                        </span>
                      </td>
                      <td className={td}>{u.type}</td>
                      <td className={td}>{formatDate(u.addedOn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-6 py-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 items-center justify-center rounded-md border border-primary bg-white px-6 text-base font-medium text-primary hover:bg-primary/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!picked.size}
              onClick={() => onContinue(list.filter((u) => picked.has(u.workerId)))}
              className="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:bg-border disabled:text-muted-foreground"
            >
              Map Users
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

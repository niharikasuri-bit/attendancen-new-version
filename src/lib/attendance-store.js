// Prototype data store, persisted to localStorage so the flow survives reloads.
import { useSyncExternalStore } from "react";

// No sample registers: this copy starts empty.
export const SEED_REGISTERS = [];

/** Users available to this campaign; anyone not yet on a register is still left to be mapped. */
export const TOTAL_CAMPAIGN_USERS = 120;

const CURRENT_USER ={ name: "Aisha Bello", role: "Campaign Supervisor" };
// Own key, so this copy never shares saved data with the original attendance site on the same domain.
const STORAGE_KEY = "attendanceNewVersionData";

const EMPTY = {
  uploadedRegisters: [],
  deletedIds: [],
  users: [],
  latestIds: [],
  mappingIds: [],
  mappingOptions: null,
  mappingUsers: [],
  templateLevels: [],
  templateFrequency: null,
  auditLog: [],
  skippedUsers: [],
};

let state = EMPTY;
let hydrated = false;
const listeners = new Set();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state = backfillCreatedAt({ ...EMPTY, ...JSON.parse(saved) });
  } catch {
    // ignore corrupt storage
  }
}

/**
 * Registers uploaded before creation dates were recorded get one from their
 * "Register Generated" audit entry (or now), and it is saved so it stays stable.
 */
function backfillCreatedAt(s) {
  if (s.uploadedRegisters.every((r) => r.createdAt)) return s;
  const now = new Date().toISOString();
  const generatedAt = (name) => s.auditLog.findLast?.((e) => e.action === "Register Generated" && e.register === name)?.at;
  const next = { ...s, uploadedRegisters: s.uploadedRegisters.map((r) => (r.createdAt ? r : { ...r, createdAt: generatedAt(r.name) ?? now })) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

function setState(patch) {
  hydrate();
  state = { ...state, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  hydrate();
  return state;
}

export function useAttendanceStore() {
  return useSyncExternalStore(subscribe, getState, () => EMPTY);
}

/** All live registers (uploaded + seed, minus deleted), with mapped and active user counts added. */
export function getRegisters(s) {
  const deleted = new Set(s.deletedIds);
  return [...s.uploadedRegisters, ...SEED_REGISTERS]
    .filter((r) => !deleted.has(r.id))
    .map((r) => {
      const mapped = s.users.filter((u) => u.registerId === r.id);
      return {
        ...r,
        users: r.users + mapped.length,
        active: (r.active ?? r.users) + mapped.filter((u) => u.status === "Active").length,
      };
    });
}

/* ---------- Users added to a register's boundary after it was created ---------- */

// Users are assigned to a boundary code elsewhere; a register linked to that boundary code
// then has users who belong there but are not mapped to the register yet. Sample data.
const NEW_USER_NAMES = ["Amina Yusuf", "Chinedu Okafor", "Fatima Abubakar", "Emeka Nwosu", "Halima Sani", "Ibrahim Musa", "Ngozi Eze", "Tunde Bakare"];
const USER_TYPES = [
  { type: "Frontline Worker", role: "DISTRIBUTOR" },
  { type: "Frontline Worker", role: "FIELD_SUPPORT" },
  { type: "Attendance Marker", role: "TEAM_SUPERVISOR" },
  { type: "Frontline Worker", role: "DISTRIBUTOR" },
  { type: "Attendance Approver", role: "CAMPAIGN_SUPERVISOR" },
];

/** yyyy-mm-dd in the viewer's own time zone (toISOString would use UTC and can show tomorrow). */
export const localIsoDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const USER_TYPE_NAMES = ["Frontline Worker", "Attendance Marker", "Attendance Approver"];

/** User type from a mapped user's role codes (the mapping template's tab decides it). */
export function userTypeOf(user) {
  if (user.type) return user.type;
  const role = user.role ?? "";
  if (/CAMPAIGN_SUPERVISOR|APPROVER/.test(role)) return "Attendance Approver";
  if (/TEAM_SUPERVISOR|WAREHOUSE_MANAGER|MARKER/.test(role)) return "Attendance Marker";
  return "Frontline Worker";
}

/** Users mapped to a register, with type and username filled in for display. */
export function mappedUsers(register, users) {
  return users
    .filter((u) => u.registerId === register.id)
    .map((u) => ({ ...u, type: userTypeOf(u), username: u.username || u.workerId }));
}

function hashText(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Users at this register's boundary who are not mapped to the register yet (0–4 per register). */
export function unmappedUsers(register, users, skipped = getState().skippedUsers ?? []) {
  const h = hashText(register.id + register.name);
  const count = h % 5;
  const mapped = new Set([
    ...users.filter((u) => u.registerId === register.id).map((u) => u.workerId),
    ...skipped.filter((x) => x.registerId === register.id).map((x) => x.workerId),
  ]);
  return Array.from({ length: count }, (_, i) => {
    const name = NEW_USER_NAMES[(h + i * 3) % NEW_USER_NAMES.length];
    const kind = USER_TYPES[(h + i) % USER_TYPES.length];
    const added = new Date(Date.now() - (i % 2 === 1 ? 20 + ((h >>> i) % 25) : (h >>> (i + 2)) % 6) * 86400000);
    return {
      workerId: `NEW-${register.id}-${i + 1}`,
      name,
      username: `${name.split(" ")[0].toLowerCase()}${(h % 90) + 10 + i}`,
      type: kind.type,
      role: kind.role,
      addedOn: localIsoDate(added),
    };
  }).filter((u) => !mapped.has(u.workerId));
}

let auditSeq = 0;

export const attendanceActions = {
  log(entries) {
    if (!entries.length) return;
    const at = new Date().toISOString();
    const rows = entries.map((e) => ({
      id: `al-${Date.now().toString(36)}-${auditSeq++}`,
      action: e.action,
      register: e.register ?? "",
      details: e.details,
      user: CURRENT_USER.name,
      role: CURRENT_USER.role,
      at,
    }));
    setState({ auditLog: [...rows, ...getState().auditLog] });
  },

  /** Boundary levels and attendance frequency chosen for the register template. */
  setRegisterTemplateOptions({ levels, frequency }) {
    setState({ templateLevels: levels, templateFrequency: frequency });
  },

  /** Upserts registers by name. Returns [{ id, created }] in input order. */
  addRegisters(incoming) {
    const s = getState();
    const existing = getRegisters(s);
    const uploaded = [...s.uploadedRegisters];
    const created = [];
    const resultIds = [];
    const createdIds = new Set();
    let nextId = Math.max(0, ...[...uploaded, ...SEED_REGISTERS].map((r) => Number(r.id.slice(2)) || 0)) + 1;

    for (const reg of incoming) {
      const dup = created.find((r) => r.name === reg.name);
      if (dup) {
        Object.assign(dup, reg);
        continue;
      }
      const match = existing.find((r) => r.name === reg.name);
      if (match && uploaded.some((r) => r.id === match.id)) {
        const i = uploaded.findIndex((r) => r.id === match.id);
        uploaded[i] = { ...uploaded[i], ...reg };
        resultIds.push(match.id);
      } else if (match) {
        resultIds.push(match.id);
      } else {
        const id = `r-${nextId++}`;
        created.push({ ...reg, id, users: 0, createdAt: new Date().toISOString() });
        resultIds.push(id);
        createdIds.add(id);
      }
    }

    setState({ uploadedRegisters: [...created, ...uploaded], latestIds: resultIds });
    return resultIds.map((id) => ({ id, created: createdIds.has(id) }));
  },

  deleteRegisters(ids) {
    const s = getState();
    const idSet = new Set(ids);
    const removed = getRegisters(s).filter((r) => idSet.has(r.id));
    const seedIds = new Set(SEED_REGISTERS.map((r) => r.id));
    setState({
      uploadedRegisters: s.uploadedRegisters.filter((r) => !idSet.has(r.id)),
      deletedIds: [...s.deletedIds, ...ids.filter((id) => seedIds.has(id))],
      users: s.users.filter((u) => !idSet.has(u.registerId)),
    });
    attendanceActions.log(
      removed.map((r) => ({
        action: "Register Deleted",
        register: r.name,
        details: `Register deleted from Manage Registers${r.users ? ` with ${r.users} mapped ${r.users === 1 ? "user" : "users"}` : ""}`,
      })),
    );
  },

  setMappingRegisters(ids) {
    setState({ mappingIds: ids });
  },

  /** Unmapped users picked on View Register; the mapping template is pre-filled with them. */
  setMappingUsers(users) {
    setState({ mappingUsers: users });
  },

  /** Enrollment date choice from the user mapping template stepper. */
  setMappingOptions(options) {
    setState({ mappingOptions: options });
  },

  /**
   * Maps users waiting at a register's boundary to that register. Each entry carries its
   * enrollment date and optional de-enrollment date and team code.
   */
  mapUnmappedUsers(register, entries) {
    attendanceActions.addUsers(
      entries.map((u) => ({
        registerId: register.id,
        name: u.name,
        workerId: u.workerId,
        username: u.username,
        type: u.type,
        role: u.role,
        boundary: register.boundaryName || register.boundary,
        teamCode: u.teamCode || "",
        status: "Active",
        enrollmentDate: u.enrollmentDate,
        deenrollmentDate: u.deenrollmentDate || "",
      })),
    );
    const dates = [...new Set(entries.map((e) => e.enrollmentDate))];
    attendanceActions.log([
      {
        action: "Users Mapped",
        register: register.name,
        details: `${entries.length} unmapped ${entries.length === 1 ? "user" : "users"} mapped from View Register · enrollment ${dates.length === 1 ? `date ${dates[0]}` : "dates set per user"}`,
      },
    ]);
  },

  /** Leaves a new user off a register ("Don't Map"), with the reason in the audit log. */
  skipUnmappedUser(register, user, reason) {
    const s = getState();
    setState({ skippedUsers: [...(s.skippedUsers ?? []), { registerId: register.id, workerId: user.workerId, reason }] });
    attendanceActions.log([{ action: "User Not Mapped", register: register.name, details: `${user.name} not mapped to this register · ${reason}` }]);
  },

  /** Adds users, replacing any existing user with the same register + worker ID. */
  addUsers(incoming) {
    const s = getState();
    const key = (u) => `${u.registerId}|${u.workerId}`;
    const incomingKeys = new Set(incoming.map(key));
    const kept = s.users.filter((u) => !incomingKeys.has(key(u)));
    const added = incoming.map((u, i) => ({ ...u, id: `u-${Date.now().toString(36)}-${i}` }));
    setState({ users: [...kept, ...added] });
  },
};

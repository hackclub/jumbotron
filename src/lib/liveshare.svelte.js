import { resolve } from "$app/paths";
import { API, TAB_ID } from "$lib/api.js";
import { legacyAnnouncement } from "$lib/announcements.js";

export const internal = $state({
    initComplete: false,
    code: null,
    slack: null,
    name: null,
    password: null,
    screenKey: null,   // set only on a paired big screen, which has no password
    cityName: "",
    importedSync: false
});

// Kept for older components that may still read these flags.
export const sync = $state({
    announcements: false,
    slides: false
});

export const liveshareData = $state({
    timestamp: Date.now()
});

// Real sync status, driven by the result of each request to the backend.
// state: "idle" | "syncing" | "ok" | "error"
export const syncStatus = $state({
    state: "idle",
    lastSynced: null,
    message: ""
});

// Last item taken down, so the organizer can undo it.
export const undoState = $state({
    key: null,
    value: null,
    label: ""
});

export const LIVE_KEYS = ["announcements", "event", "file", "youtube", "website"];

export function liveItems() {
    return LIVE_KEYS.filter((key) => liveshareData[key]);
}

// Keys published from this tab that the server hasn't confirmed yet. A retry resends them, and
// changes pushed from other organizers don't overwrite them meanwhile.
const pendingKeys = new Set();
export const isPending = (key) => pendingKeys.has(key);

// Called with the server's merged packet after each publish (set by the console's drafts, which
// know how to fold other organizers' changes in without losing what's being typed).
export const hooks = { remotePacket: null };

// Publishes `keys` (or, for a retry, whatever didn't go through). The server only replaces
// those keys, so organizers publishing different things at once don't undo each other.
export async function updateAPI(keys) {
    if (!internal.initComplete) return false;

    for (const key of Array.isArray(keys) ? keys : []) pendingKeys.add(key);
    const sending = pendingKeys.size ? [...pendingKeys] : [...LIVE_KEYS];
    // `announcement` (singular) is the newest one, for attendee tabs opened before the list.
    const changed = sending.includes("announcements") ? [...sending, "announcement"] : sending;

    liveshareData.timestamp = Date.now();
    syncStatus.state = "syncing";
    syncStatus.message = "";

    const packet = { ...$state.snapshot(liveshareData), announcement: legacyAnnouncement(liveshareData.announcements) };

    try {
        const response = await fetch(`${API}/sendPacket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code: internal.code,
                password: internal.password,
                packet: JSON.stringify(packet),
                changed,
                tab: TAB_ID
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            if (data.error == "Banned user") {
                window.location.replace(resolve("/"));
                return false;
            }

            syncStatus.state = "error";
            syncStatus.message = data.error || "Couldn't reach attendees. Your change is saved here; try publishing again.";
            return false;
        }

        syncStatus.state = "ok";
        syncStatus.lastSynced = Date.now();
        // Only what this request carried is confirmed; anything published since stays pending.
        for (const key of sending) {
            if (JSON.stringify(packet[key] ?? null) === JSON.stringify($state.snapshot(liveshareData[key]) ?? null)) pendingKeys.delete(key);
        }
        if (data.packet) hooks.remotePacket?.(data.packet);
        return true;
    } catch {
        syncStatus.state = "error";
        syncStatus.message = "You're offline or the server is unreachable. Try publishing again.";
        return false;
    }
}

export async function publish(key, value) {
    liveshareData[key] = value;

    if (undoState.key === key) clearUndo();
    return updateAPI([key]);
}

export async function takeDown(key, label) {
    if (!liveshareData[key]) return;

    undoState.key = key;
    undoState.value = $state.snapshot(liveshareData[key]);
    undoState.label = label;

    liveshareData[key] = null;
    return updateAPI([key]);
}

// Removes one posted announcement. Undo puts the whole list back as it was.
export async function removeAnnouncement(id) {
    const list = liveshareData.announcements || [];
    if (!list.some((a) => a.id === id)) return;
    undoState.key = "announcements";
    undoState.value = $state.snapshot(list);
    undoState.label = "Announcement";
    const rest = list.filter((a) => a.id !== id);
    liveshareData.announcements = rest.length ? rest : null;
    return updateAPI(["announcements"]);
}

export async function undoTakeDown() {
    if (!undoState.key) return;

    const { key, value } = undoState;

    clearUndo();

    return publish(key, value);
}

export function clearUndo() {
    undoState.key = null;
    undoState.value = null;
    undoState.label = "";
}

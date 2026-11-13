// Draft content for each console row. Drafts live outside the row components so a row can be
// collapsed without losing edits, and so the "Live now" strip and row badges can read them.

import { liveshareData, publish, hooks, isPending, LIVE_KEYS, STORED_KEYS } from "$lib/liveshare.svelte.js";
import { ANNOUNCEMENTS_MAX, newAnnouncementId, announcementsOf } from "$lib/announcements.js";
import { parseClock, toAt, formatClock, prefersHour12 } from "$lib/time.js";
import { drivePreviewLink, youtubeId, youtubeWatchUrl, normalizeUrl } from "$lib/links.js";

// `color` is the leaf color for that kind of content, shared by the console and attendee views.
export const CONTENT = [
    { key: "announcements", label: "Announcements", icon: "campaign", color: "var(--c-announcement)", hint: "Short messages at the top of every attendee's screen. The newest few are also on the big screen." },
    { key: "event", label: "Up next", icon: "schedule", color: "var(--c-event)", hint: "The next thing on the schedule, with a live countdown." },
    { key: "file", label: "Slides or document", icon: "description", color: "var(--c-file)", hint: "A Google Drive file attendees can read at their own pace." },
    { key: "youtube", label: "YouTube video", icon: "smart_display", color: "var(--c-youtube)", hint: "A video attendees can open on their phone." },
    { key: "website", label: "Link", icon: "language", color: "var(--c-website)", hint: "A sign-up form, the schedule, a submission page." }
];

export const colorFor = (key) => CONTENT.find((c) => c.key === key)?.color ?? "var(--c-announcement)";

export const labelFor = (key) => CONTENT.find((c) => c.key === key)?.label ?? key;

export const drafts = $state({
    // `editing` is the id of a posted announcement being changed, or null for a new one.
    announcements: { title: "", message: "", editing: null },
    event: { title: "", at: "", hour12: prefersHour12() },
    file: "",
    youtube: "",
    website: ""
});

// Fills one row's draft from what's live (or empties it when nothing is). The announcement
// draft is a compose box for the next one, so it's left alone.
function hydrateKey(key) {
    const live = liveshareData[key];
    switch (key) {
        case "event":
            drafts.event.title = live?.title || "";
            drafts.event.at = live ? live.at || toAt(parseClock(live.time)) : "";
            if (typeof live?.hour12 === "boolean") drafts.event.hour12 = live.hour12;
            else if (/am|pm/i.test(live?.time || "")) drafts.event.hour12 = true;
            break;
        case "file":
            drafts.file = live || "";
            break;
        case "youtube":
            drafts.youtube = live ? (typeof live === "object" ? live.url : live) : "";
            break;
        case "website":
            drafts.website = live || "";
            break;
    }
}

export function hydrateDrafts() {
    for (const key of LIVE_KEYS) {
        if (liveshareData[key]) hydrateKey(key);
    }
}

// Empties every draft: used when the console switches to a different event's content.
export function resetDrafts() {
    drafts.announcements.title = "";
    drafts.announcements.message = "";
    drafts.announcements.editing = null;
    drafts.event.title = "";
    drafts.event.at = "";
    drafts.file = "";
    drafts.youtube = "";
    drafts.website = "";
}

// Folds in content another organizer published (or the server's merged answer to our own
// publish). Rows this console is still sending are left alone, and so are drafts someone is
// typing: only rows whose draft matched what was live follow along.
export function applyRemotePacket(raw) {
    let data;
    try {
        data = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
        return;
    }
    if (!data || typeof data !== "object") return;
    const list = announcementsOf(data);
    const next = { ...data, announcements: list.length ? list : null };
    for (const key of STORED_KEYS) {
        const value = next[key] || null;
        if (isPending(key)) continue;
        if (JSON.stringify(value) === JSON.stringify($state.snapshot(liveshareData[key]) ?? null)) continue;
        const following = LIVE_KEYS.includes(key) && (rowStatus(key) === "live" || rowStatus(key) === "");
        liveshareData[key] = value;
        if (following) hydrateKey(key);
    }
}

hooks.remotePacket = applyRemotePacket;

// The value that would be published for this row, or null if the draft can't be published.
export function buildValue(key) {
    switch (key) {
        case "announcements": {
            // The whole list as it would be after posting the draft.
            const title = drafts.announcements.title.trim();
            const message = drafts.announcements.message.trim();
            if (!title && !message) return null;
            // Posting while announcements are switched off brings the put-away ones back too.
            const list = liveshareData.announcements || liveshareData.announcementsHidden || [];
            const editing = drafts.announcements.editing;
            if (editing && list.some((a) => a.id === editing)) {
                return list.map((a) => (a.id === editing ? { ...a, title, message, updatedAt: Date.now() } : a));
            }
            return [{ id: newAnnouncementId(), title, message, at: Date.now() }, ...list].slice(0, ANNOUNCEMENTS_MAX);
        }
        case "event": {
            const title = drafts.event.title.trim();
            if (!title || !parseClock(drafts.event.at)) return null;
            return { title, time: formatClock(drafts.event.at, drafts.event.hour12), at: drafts.event.at, hour12: drafts.event.hour12 };
        }
        case "file":
            return drivePreviewLink(drafts.file);
        case "youtube": {
            const id = youtubeId(drafts.youtube);
            return id ? { url: youtubeWatchUrl(id), embedUrl: `https://www.youtube.com/embed/${id}` } : null;
        }
        case "website":
            return normalizeUrl(drafts.website);
    }
    return null;
}

// Inline validation message, only once the organizer has typed something that doesn't work.
export function draftError(key) {
    switch (key) {
        case "event":
            return drafts.event.title.trim() && !parseClock(drafts.event.at) ? "Add a start time." : "";
        case "file":
            return drafts.file.trim() && !buildValue("file") ? "That doesn't look like a Google Drive or Docs link. Use Share, then Copy link." : "";
        case "youtube":
            return drafts.youtube.trim() && !buildValue("youtube") ? "That doesn't look like a YouTube video link." : "";
        case "website":
            return drafts.website.trim() && !buildValue("website") ? "That doesn't look like a web address." : "";
    }
    return "";
}

function comparable(key, value) {
    if (!value) return null;
    if (key === "event") return { title: value.title, time: value.time };
    if (key === "youtube") return typeof value === "object" ? value.url : value;
    return value;
}

// True when something is live and the draft differs from it. For announcements: an unposted
// draft (new or edit) while others are showing.
export function isDirty(key) {
    if (!liveshareData[key]) return false;
    if (key === "announcements") return hasDraft(key);
    return JSON.stringify(comparable(key, buildValue(key))) !== JSON.stringify(comparable(key, liveshareData[key]));
}

export function hasDraft(key) {
    return buildValue(key) !== null;
}

// Status shown on each row: "live" | "edited" | "draft" | ""
export function rowStatus(key) {
    if (liveshareData[key]) return isDirty(key) ? "edited" : "live";
    return hasDraft(key) ? "draft" : "";
}

// One-line summary of a live item, for the "Live now" strip.
export function liveSummary(key) {
    const value = liveshareData[key];
    if (!value) return "";
    switch (key) {
        case "announcements": {
            const latest = value[0];
            const text = latest ? latest.title || latest.message : "";
            return value.length > 1 ? `${text} (+${value.length - 1} earlier)` : text;
        }
        case "event": return `${value.title} · ${value.time}`;
        case "file": return "Google Drive file";
        case "youtube": return typeof value === "object" ? value.url : value;
        case "website": return value.replace(/^https?:\/\//, "");
    }
    return "";
}

export function clearAnnouncementDraft() {
    drafts.announcements.title = "";
    drafts.announcements.message = "";
    drafts.announcements.editing = null;
}

export function editAnnouncement(item) {
    drafts.announcements.title = item.title || "";
    drafts.announcements.message = item.message || "";
    drafts.announcements.editing = item.id;
}

// Publishes this row's draft. A posted announcement draft is cleared for the next one.
export async function publishDraft(key) {
    const value = buildValue(key);
    if (!value) return false;
    const ok = await publish(key, value);
    if (ok && key === "announcements") clearAnnouncementDraft();
    return ok;
}

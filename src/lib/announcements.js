// Announcements are a list, newest first: [{ id, title, message, at, updatedAt? }], where `at`
// and `updatedAt` are epoch milliseconds. Packets published before the list existed carry a
// single `announcement: { title, message }`; this reads either shape.

export const ANNOUNCEMENTS_MAX = 20;

export function announcementsOf(data) {
    if (!data) return [];
    if (Array.isArray(data.announcements)) {
        return data.announcements.filter((a) => a && (a.title || a.message));
    }
    const legacy = data.announcement;
    if (legacy && (legacy.title || legacy.message)) {
        return [{ id: "legacy", title: legacy.title || "", message: legacy.message || "", at: null }];
    }
    return [];
}

// The packet field older attendee tabs still read: the newest announcement, or null.
export function legacyAnnouncement(list) {
    const latest = list && list[0];
    return latest ? { title: latest.title, message: latest.message } : null;
}

export function newAnnouncementId() {
    return Math.random().toString(36).slice(2, 10);
}

// "Posted 1:06 AM" / "Updated 1:10 AM"; empty for legacy items with no time.
export function stampOf(item, hour12) {
    const ms = item.updatedAt || item.at;
    if (!ms) return null;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return null;
    return {
        verb: item.updatedAt ? "Updated" : "Posted",
        iso: date.toISOString(),
        text: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", ...(hour12 == null ? {} : { hour12 }) })
    };
}

import { internal } from "$lib/liveshare.svelte";

import { API, TAB_ID } from "$lib/api.js";
export { API };

// `state` mirrors the server's mergeState(), the organizers of this event:
// { code, role: "root" (owner) | "bridged" (organizer of `root`), root, members, invitesSent, invites }
export const org = $state({
    connected: false,
    state: null,
    lastReason: null,
    notice: "",
    error: ""        // set when merge state can't be loaded, so the panel never spins forever
});

// The big screen and demo time (participant screenshare), mirrored from the server's demoState():
// `board` shows announcements on the big screen; presenter is { id, name, live } or null, and
// `live` is false until they've picked a window.
export const demo = $state({
    enabled: false,
    board: true,
    screenCode: null,
    screenOpen: false,
    paired: false,   // a venue computer has been paired (or a pairing code made) for this event
    presenter: null,
    mirror: false,   // the presenter's screen also goes to attendees' devices (as snapshots)
    queue: []        // [{ id, name, slack, connected }] waiting for an organizer to approve them
});

export function applyDemo(next) {
    if (next) Object.assign(demo, next);
}

// Harpa (hackclub/harpa, embedded on the big screen), mirrored from the server's harpaState().
// `loaded` is false until the first state arrives.
export const harpa = $state({
    loaded: false,
    enabled: false
});

export function applyHarpa(next) {
    if (!next) return;
    harpa.enabled = !!next.enabled;
    harpa.loaded = true;
}

export async function setHarpa(enabled) {
    const data = await post("/harpaSet", { enabled });
    applyHarpa(data.harpa);
}

const nameOf = (e) => (e && e.name) || "Another organizer";
// `|| []` rather than default params: callers pass `prev && prev.x`, which is null (not
// undefined) before the first state arrives, and defaults only apply to undefined.
const newIn = (now, before) => (now || []).find(x => !(before || []).some(y => y.code === x.code));
const goneFrom = (now, before) => (before || []).find(x => !(now || []).some(y => y.code === x.code));

const inviteeName = (i) => (i && (i.name || i.slack)) || "Someone";
const goneInvite = (now, before) => (before || []).find(x => !(now || []).some(y => y.slack === x.slack));

// Turns a pushed organizers event into a sentence for this organizer, or "" when the change
// was caused by this organizer's own click (the panel already reflects it).
export function describeMergeEvent(reason, state, prev) {
    const wasBridged = prev && prev.role === "bridged";
    switch (reason) {
        case "merged":
            if (state.role === "bridged" && !wasBridged) {
                return `You're now an organizer of ${nameOf(state.root)}'s event. Everything here is shared with them.`;
            }
            return `${nameOf(newIn(state.members, prev && prev.members))} joined as an organizer.`;
        case "member_left": {
            const gone = goneFrom(state.members, prev && prev.members);
            return gone ? `${nameOf(gone)} is no longer an organizer.` : "";
        }
        case "member_removed":
            if (wasBridged && state.role === "root") return `${nameOf(prev.root)} removed you as an organizer. You're back on your own event.`;
            return wasBridged ? "" : `${nameOf(goneFrom(state.members, prev && prev.members))} was removed as an organizer.`;
        case "host_removed":
            return "The event you helped organize was removed by an administrator. You're back on your own event.";
        case "invite_sent": {
            const added = (state.invitesSent || []).find(x => !((prev && prev.invitesSent) || []).some(y => y.slack === x.slack));
            return added ? `${inviteeName(added)} was invited by another organizer.` : "";
        }
        case "invite_received":
            return `${nameOf(newIn(state.invites, prev && prev.invites))} invited you to organize their event.`;
        case "invite_cancelled": {
            const gone = goneFrom(state.invites, prev && prev.invites);
            return gone ? `${nameOf(gone)} withdrew their invite.` : "";
        }
        case "invite_declined": {
            const gone = goneInvite(state.invitesSent, prev && prev.invitesSent);
            return gone ? `${inviteeName(gone)} declined the invite.` : "";
        }
        case "invite_unavailable":
            return "An invite was removed because it can no longer be accepted.";
        default:
            return "";
    }
}

let noticeTimer = null;
// Also used by panels for outcomes the user should still see after the panel itself goes away.
export function showNotice(text) {
    if (!text) return;
    org.notice = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { org.notice = ""; }, 8000);
}

// Nothing may leave the UI waiting forever: every request gives up after REQUEST_TIMEOUT, a
// stream that hasn't opened by then is retried, and RESYNC_INTERVAL re-reads the state over
// plain HTTP in case the stream silently died (sleep, network change) or a proxy holds it back.
const REQUEST_TIMEOUT = 15000;
const RESYNC_INTERVAL = 20000;

let stream = null;
let retryTimer = null;
let openTimer = null;
let resyncTimer = null;
// onPacket: content another organizer (or another tab) published. onReconnect: the stream came
// back after a drop, so pushes may have been missed.
let handlers = { onSignOut: () => {}, onEvent: () => {}, onPacket: () => {}, onReconnect: () => {} };
let everOpened = false;          // per session: the first open isn't a reconnect

let attempt = 0;                 // bumped per stream (re)connect so stale async attempts bail out
let session = 0;                 // bumped on connect/disconnect only: outlives stream reconnects

// POSTs the credentials (never in the URL) plus `body`. Resolves with { res, data } for any
// HTTP answer; rejects with a sentence for the user when there is no answer in time.
export async function request(path, body = {}) {
    let res;
    try {
        res = await fetch(`${API}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // A paired big screen has a screen key instead of a password.
            body: JSON.stringify({ code: internal.code, password: internal.password, screenKey: internal.screenKey ?? undefined, ...body }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT)
        });
    } catch (e) {
        throw new Error(e && e.name === "TimeoutError"
            ? "The server took too long to respond. Please try again."
            : "Couldn't reach the server. Check your connection and try again.");
    }
    let data = {};
    try {
        data = await res.json();
    } catch (e) {}
    return { res, data };
}

// Single entry point for new merge state. `reason` is the stream's reason; null for state we
// fetched ourselves (POST answers, resyncs), which is never announced.
function applyState(next, reason) {
    const previous = $state.snapshot(org.state);
    org.state = next;
    org.lastReason = reason;
    org.error = "";
    internal.sources = next.members.map(m => m.slack);
    // Identical state means our own POST already applied this change: nothing to announce.
    const changed = JSON.stringify(previous) !== JSON.stringify(next);
    if (reason && reason !== "connected" && changed) {
        showNotice(describeMergeEvent(reason, next, previous));
        handlers.onEvent(reason, next, previous);
    }
}

function signOutNow() {
    disconnectOrgStream();
    handlers.onSignOut();
}

function scheduleReconnect(delay = 5000) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(openStream, delay);
}

function closeStream() {
    clearTimeout(openTimer);
    if (stream) stream.close();
    stream = null;
    org.connected = false;
}

// EventSource can't send a body or headers, so the password never goes in its URL: each
// connection first trades the credentials (POST body) for a single-use ticket that expires in
// seconds. That POST doubles as the credential check: 401 means signed out for good.
// A used ticket can't be replayed, so the browser's built-in auto-reconnect is useless here;
// every drop is handled by closing and reconnecting with a fresh ticket.
async function openStream() {
    closeStream();
    const mine = ++attempt;
    let ticket;
    try {
        const { res, data } = await request("/streamTicket");
        if (mine !== attempt) return;
        if (res.status === 401) return signOutNow();
        if (!res.ok || !data.ticket) throw new Error(data.error || `HTTP ${res.status}`);
        ticket = data.ticket;
    } catch (e) {
        if (mine === attempt) scheduleReconnect();
        return;
    }
    if (mine !== attempt) return;
    const es = new EventSource(`${API}/orgStream?ticket=${encodeURIComponent(ticket)}`);
    stream = es;

    // A connection that neither opens nor fails (held by a proxy) would otherwise sit forever.
    openTimer = setTimeout(() => {
        if (mine === attempt && !org.connected) {
            closeStream();
            scheduleReconnect(1000);
        }
    }, REQUEST_TIMEOUT);

    // Events from a stream we've already replaced are ignored: some EventSource implementations
    // still fire onerror after close(), which would otherwise reschedule the live reconnect.
    es.onopen = () => {
        if (es !== stream) return;
        clearTimeout(openTimer);
        org.connected = true;
        if (everOpened) handlers.onReconnect();
        everOpened = true;
    };

    es.onmessage = (event) => {
        if (es !== stream) return;
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            return;
        }

        if (msg.type === "state") {
            applyState(msg.state, msg.reason);
        } else if (msg.type === "demo") {
            applyDemo(msg.demo);
        } else if (msg.type === "harpa") {
            applyHarpa(msg.harpa);
        } else if (msg.type === "packet") {
            // Our own publish is already applied (from its POST answer).
            if (msg.tab !== TAB_ID) handlers.onPacket(msg.data);
        } else if (msg.type === "revoked") {
            signOutNow();
        } else if (msg.type === "reset") {
            // Admin replaced the events database; our code may no longer exist. The ticket
            // request on reconnect tells us (401 -> sign out).
            closeStream();
            scheduleReconnect(1000);
        }
    };

    es.onerror = () => {
        if (es !== stream) return;
        closeStream();
        scheduleReconnect();
    };
}

// Reads the state over plain HTTP. Loads the panel without waiting for the stream, and
// periodically checks the stream hasn't missed anything; if it has, the stream is replaced.
async function resync() {
    const mine = session;
    try {
        const { res, data } = await request("/mergeState");
        if (mine !== session) return;
        if (res.status === 401) return signOutNow();
        if (!res.ok || !data.role) throw new Error(data.error || "Couldn't load merge status.");
        const missed = org.state !== null &&
            JSON.stringify($state.snapshot(org.state)) !== JSON.stringify(data);
        applyState(data, null);
        if (missed && org.connected) openStream();
    } catch (e) {
        if (mine === session && !org.state) org.error = e.message;
    }
}

export function connectOrgStream(options = {}) {
    handlers = { ...handlers, ...options };
    if (!internal.code || !internal.password) return;
    session++;
    everOpened = false;
    openStream();
    resync();
    clearInterval(resyncTimer);
    resyncTimer = setInterval(resync, RESYNC_INTERVAL);
}

export function disconnectOrgStream() {
    attempt++;
    session++;
    clearTimeout(retryTimer);
    clearInterval(resyncTimer);
    closeStream();
}

async function post(path, body = {}) {
    const { res, data } = await request(path, body);
    if (!res.ok) {
        throw new Error(data.error || "Request failed");
    }
    // Every merge endpoint answers with the caller's fresh state; apply it immediately so the
    // UI doesn't wait for the stream echo.
    if (data && data.role) applyState(data, null);
    return data;
}

export const removeMember = (target) => post("/unmerge", { target });
export const leaveMerge = () => post("/unmerge");
export const sendInvite = (slack) => post("/mergeInvite", { slack });
export const cancelInvite = (slack) => post("/cancelMergeInvite", { slack });
export const respondInvite = (host, accept) => post("/respondMergeInvite", { host, accept });

// Big screen pairing for venue computers that shouldn't hold an organizer sign-in.
export const createPairCode = () => post("/screenPairCode");
export const unpairScreens = () => post("/screenUnpair");

async function demoPost(path, body) {
    const data = await post(path, body);
    applyDemo(data.demo);
    return data;
}

export const setDemos = (enabled) => demoPost("/demoSet", { enabled });
export const setBoard = (board) => demoPost("/demoSet", { board });
export const setMirror = (mirror) => demoPost("/demoSet", { mirror });
export const stopPresenter = () => demoPost("/demoStop");
export const approveQueued = (id) => demoPost("/demoApprove", { id });
export const removeQueued = (id) => demoPost("/demoRemove", { id });

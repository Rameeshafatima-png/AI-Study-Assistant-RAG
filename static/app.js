/* AI Study Assistant — frontend
   Talks to: /api/upload, /api/index, /api/query, /api/stats */

const $ = id => document.getElementById(id);

const el = {
    rail: $("rail"), scrim: $("scrim"), openRail: $("openRail"), closeRail: $("closeRail"),
    pdfInput: $("pdfInput"), dropzone: $("dropzone"), dropCount: $("dropCount"),
    fileList: $("fileList"), uploadBtn: $("uploadBtn"), indexBtn: $("indexBtn"),
    stepUpload: $("stepUpload"), stepIndex: $("stepIndex"), stepAsk: $("stepAsk"), askNote: $("askNote"),
    stages: $("stages"),
    chunkCount: $("chunkCount"), collectionName: $("collectionName"),
    statusChip: $("statusChip"), statusText: $("statusText"),
    thread: $("thread"), welcome: $("welcome"), starters: $("starters"),
    composer: $("composer"), question: $("question"), askBtn: $("askBtn"), queryHint: $("queryHint"),
    clearChat: $("clearChat"), themeToggle: $("themeToggle"), toast: $("toast"),
};

const REQUIRED_FILES = 5;
const STAGES = ["extract", "chunk", "embed", "store"];
const stageLabels = {
    extract: $("extractStatus"), chunk: $("chunkStatus"),
    embed: $("embedStatus"), store: $("dbStatus"),
};

const state = {
    files: [],
    uploaded: false,
    ready: false,
    indexing: false,
    asking: false,
};

/* ───────── Helpers ───────── */

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[c]));

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

let toastTimer;
function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 3600);
}

async function api(path, options) {
    const response = await fetch(path, options);
    let data = {};
    try { data = await response.json(); } catch { /* non-JSON error body */ }
    if (!response.ok) {
        const detail = Array.isArray(data.detail)
            ? data.detail.map(d => d.msg).join(", ")
            : data.detail;
        throw new Error(detail || `Request failed (${response.status}).`);
    }
    return data;
}

/* ───────── Theme ───────── */

el.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* storage unavailable */ }
});

/* ───────── Sidebar drawer (mobile) ───────── */

function toggleRail(open) {
    el.rail.classList.toggle("open", open);
    el.scrim.hidden = !open;
}
el.openRail.addEventListener("click", () => toggleRail(true));
el.closeRail.addEventListener("click", () => toggleRail(false));
el.scrim.addEventListener("click", () => toggleRail(false));
document.addEventListener("keydown", e => { if (e.key === "Escape") toggleRail(false); });

/* ───────── UI state ───────── */

function setStatus(mode, text) {
    el.statusChip.dataset.state = mode;
    el.statusText.textContent = text;
}

function refreshUI() {
    const { uploaded, ready, indexing, asking } = state;

    el.stepUpload.dataset.state = (uploaded || ready) ? "done" : "active";
    el.stepIndex.dataset.state = ready ? "done" : (uploaded ? "active" : "locked");
    el.stepAsk.dataset.state = ready ? "active" : "locked";

    el.indexBtn.disabled = !uploaded || indexing || ready;
    el.question.disabled = !ready;
    el.askBtn.disabled = !ready || asking || el.question.value.trim().length < 3;

    el.askNote.textContent = ready
        ? "Type below, or pick a starter question."
        : "Unlocks once the knowledge base is built.";

    el.question.placeholder = ready
        ? "Ask anything about your chapters…"
        : "Build the knowledge base first";

    if (indexing) setStatus("busy", "Building…");
    else if (ready) setStatus("ready", "Ready to answer");
    else setStatus("idle", "Not ready");
}

/* ───────── Step 1: choose + upload ───────── */

const fileIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
const closeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function renderFiles() {
    el.fileList.innerHTML = "";

    state.files.forEach((file, index) => {
        const li = document.createElement("li");
        li.className = "file";
        li.innerHTML = `
            ${fileIcon}
            <span class="name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            <span class="size">${formatSize(file.size)}</span>
            <button type="button" aria-label="Remove ${escapeHtml(file.name)}">${closeIcon}</button>
        `;
        li.querySelector("button").addEventListener("click", () => {
            state.files.splice(index, 1);
            resetUploadState();
            renderFiles();
        });
        el.fileList.appendChild(li);
    });

    const count = state.files.length;
    el.dropCount.textContent = `${count} of ${REQUIRED_FILES} selected`;
    el.uploadBtn.disabled = count !== REQUIRED_FILES || state.uploaded;
    el.uploadBtn.textContent = state.uploaded
        ? "Uploaded"
        : count === REQUIRED_FILES
            ? "Upload 5 PDFs"
            : `Select ${REQUIRED_FILES - count} more`;
}

function resetUploadState() {
    // Changing the selection after an upload means the server copy is out of date.
    if (state.uploaded && !state.ready) state.uploaded = false;
    refreshUI();
}

function addFiles(incoming) {
    const pdfs = Array.from(incoming).filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length !== incoming.length) showToast("Only PDF files were added.");

    for (const file of pdfs) {
        const duplicate = state.files.some(f => f.name === file.name && f.size === file.size);
        if (duplicate) continue;
        if (state.files.length >= REQUIRED_FILES) {
            showToast("You can use five PDFs. Remove one to add another.");
            break;
        }
        state.files.push(file);
    }

    if (state.ready) {            // starting over with new chapters
        state.ready = false;
        resetStages();
        el.indexBtn.textContent = "Build knowledge base";
    }
    state.uploaded = false;
    renderFiles();
    refreshUI();
}

el.pdfInput.addEventListener("change", e => {
    addFiles(e.target.files);
    e.target.value = "";          // allow re-selecting the same file
});

["dragenter", "dragover"].forEach(type =>
    el.dropzone.addEventListener(type, e => { e.preventDefault(); el.dropzone.classList.add("dragover"); }));
["dragleave", "drop"].forEach(type =>
    el.dropzone.addEventListener(type, e => { e.preventDefault(); el.dropzone.classList.remove("dragover"); }));
el.dropzone.addEventListener("drop", e => addFiles(e.dataTransfer.files));

el.uploadBtn.addEventListener("click", async () => {
    const formData = new FormData();
    state.files.forEach(file => formData.append("files", file));

    el.uploadBtn.disabled = true;
    el.uploadBtn.textContent = "Uploading…";
    el.uploadBtn.classList.add("is-busy");

    try {
        const data = await api("/api/upload", { method: "POST", body: formData });
        state.uploaded = true;
        showToast(data.message || "PDFs uploaded.");
    } catch (error) {
        showToast(error.message);
    } finally {
        el.uploadBtn.classList.remove("is-busy");
        renderFiles();
        refreshUI();
    }
});

/* ───────── Step 2: build the knowledge base ───────── */

function setStage(name, status, label) {
    const li = el.stages.querySelector(`[data-stage="${name}"]`);
    li.dataset.s = status;
    stageLabels[name].textContent = label;
}

function resetStages() {
    STAGES.forEach(name => setStage(name, "", "Waiting"));
}

el.indexBtn.addEventListener("click", async () => {
    state.indexing = true;
    el.indexBtn.textContent = "Building…";
    el.indexBtn.classList.add("is-busy");
    refreshUI();

    // The server does all four stages in one request, so the checklist advances
    // on a timer to show progress; the real results replace it when the call returns.
    let active = 0;
    STAGES.forEach(name => setStage(name, "", "Waiting"));
    setStage(STAGES[0], "work", "Working…");
    const ticker = setInterval(() => {
        if (active >= STAGES.length - 1) return;
        setStage(STAGES[active], "work", "Working…");
        active += 1;
        setStage(STAGES[active], "work", "Working…");
    }, 1400);

    try {
        const data = await api("/api/index", { method: "POST" });
        clearInterval(ticker);

        setStage("extract", "done", `${data.pages} pages`);
        setStage("chunk", "done", `${data.chunks} passages`);
        setStage("embed", "done", "Created");
        setStage("store", "done", "Saved locally");

        state.ready = true;
        el.chunkCount.textContent = data.chunks;
        if (data.stats && data.stats.collection) el.collectionName.textContent = data.stats.collection;

        el.indexBtn.textContent = "Knowledge base ready";
        showToast("Knowledge base built. Ask your first question.");
        toggleRail(false);
        setTimeout(() => el.question.focus(), 150);
    } catch (error) {
        clearInterval(ticker);
        STAGES.forEach(name => setStage(name, "error", "Failed"));
        el.indexBtn.textContent = "Try again";
        showToast(error.message);
    } finally {
        state.indexing = false;
        el.indexBtn.classList.remove("is-busy");
        refreshUI();
    }
});

/* ───────── Markdown → safe HTML ───────── */

function inline(text) {
    return escapeHtml(text)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
}

function renderText(text) {
    const lines = text.split("\n");
    let html = "";
    let list = null;          // "ul" | "ol"
    let para = [];

    const flushPara = () => { if (para.length) { html += `<p>${inline(para.join(" "))}</p>`; para = []; } };
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };

    for (const raw of lines) {
        const line = raw.trimEnd();
        let m;

        if (!line.trim()) { flushPara(); closeList(); continue; }

        if ((m = line.match(/^#{1,2}\s+(.*)/))) { flushPara(); closeList(); html += `<h3>${inline(m[1])}</h3>`; continue; }
        if ((m = line.match(/^#{3,6}\s+(.*)/))) { flushPara(); closeList(); html += `<h4>${inline(m[1])}</h4>`; continue; }

        if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
            flushPara();
            if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; }
            html += `<li>${inline(m[1])}</li>`;
            continue;
        }
        if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
            flushPara();
            if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; }
            html += `<li>${inline(m[1])}</li>`;
            continue;
        }

        closeList();
        para.push(line.trim());
    }
    flushPara();
    closeList();
    return html;
}

function renderMarkdown(source) {
    // Odd-numbered segments of a split on ``` are code blocks.
    return source.split(/```/).map((part, i) => {
        if (i % 2 === 0) return renderText(part);
        const newline = part.indexOf("\n");
        const lang = newline > -1 ? part.slice(0, newline).trim() : "";
        const code = newline > -1 ? part.slice(newline + 1) : part;
        return `
            <div class="code">
                <div class="code-top"><span>${escapeHtml(lang || "code")}</span><button type="button" class="copy">Copy</button></div>
                <pre><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>
            </div>`;
    }).join("");
}

/* ───────── Step 3: conversation ───────── */

const botMark = `
<svg class="avatar" viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" rx="11" fill="currentColor"/>
    <path d="M12 11h11a5 5 0 0 1 0 10H17" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M28 29H17a5 5 0 0 1 0-10h6" fill="none" stroke="#FFD43B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function scrollToEnd() {
    el.thread.scrollTo({ top: el.thread.scrollHeight });
}

function addUserMessage(text) {
    const div = document.createElement("article");
    div.className = "msg user";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    div.appendChild(bubble);
    el.thread.appendChild(div);
    scrollToEnd();
}

function addBotPlaceholder() {
    const div = document.createElement("article");
    div.className = "msg bot";
    div.innerHTML = `
        ${botMark}
        <div class="reply">
            <div class="typing" aria-label="Searching your chapters">
                <span class="dots"><i></i><i></i><i></i></span>
                <span>Searching your chapters…</span>
            </div>
        </div>`;
    el.thread.appendChild(div);
    scrollToEnd();
    return div;
}

function relevance(distance) {
    // The collection uses cosine distance, so similarity = 1 - distance.
    const d = Number(distance);
    if (Number.isNaN(d)) return 0;
    return Math.max(4, Math.min(100, Math.round((1 - d) * 100)));
}

function sourceCards(list) {
    // Merge repeated hits from the same page so the footer stays short.
    const merged = new Map();
    list.forEach(s => {
        const key = `${s.source}::${s.page}`;
        const best = merged.get(key);
        if (!best || Number(s.distance) < Number(best.distance)) merged.set(key, s);
    });

    return Array.from(merged.values()).map((s, i) => `
        <div class="src" style="animation-delay:${i * 60}ms" title="Distance ${escapeHtml(s.distance)}">
            <b>${escapeHtml(String(s.source).replace(/\.pdf$/i, "").replace(/_/g, " "))}</b>
            <span><span>Page ${escapeHtml(s.page)}</span><span>${relevance(s.distance)}% match</span></span>
            <div class="meter"><i style="width:0" data-w="${relevance(s.distance)}%"></i></div>
        </div>`).join("");
}

function fillBotMessage(node, data) {
    const hasSources = Array.isArray(data.sources) && data.sources.length > 0;
    node.querySelector(".reply").innerHTML = `
        <div class="answer">${renderMarkdown(data.answer || "")}</div>
        ${hasSources ? `
        <div class="sources">
            <h2>Taken from</h2>
            <div class="src-list">${sourceCards(data.sources)}</div>
        </div>` : ""}
        <div class="tools">
            <button type="button" class="tool" data-act="copy">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
                Copy answer
            </button>
        </div>`;
    node.dataset.raw = data.answer || "";

    // Animate the match meters in after layout.
    requestAnimationFrame(() => node.querySelectorAll(".meter i").forEach(i => { i.style.width = i.dataset.w; }));
}

function fillBotError(node, message) {
    node.classList.add("error");
    node.querySelector(".reply").innerHTML =
        `<div class="answer"><strong>Couldn't get an answer.</strong> ${escapeHtml(message)}</div>`;
}

async function copyText(text, button, doneLabel) {
    try {
        await navigator.clipboard.writeText(text);
        const original = button.innerHTML;
        button.textContent = doneLabel;
        setTimeout(() => { button.innerHTML = original; }, 1500);
    } catch {
        showToast("Copy isn't available in this browser.");
    }
}

// One delegated handler for every copy button in the thread.
el.thread.addEventListener("click", e => {
    const codeBtn = e.target.closest(".copy");
    if (codeBtn) {
        copyText(codeBtn.closest(".code").querySelector("code").textContent, codeBtn, "Copied");
        return;
    }
    const tool = e.target.closest('[data-act="copy"]');
    if (tool) copyText(tool.closest(".msg").dataset.raw || "", tool, "Copied");
});

function growTextarea() {
    el.question.style.height = "auto";
    el.question.style.height = `${Math.min(el.question.scrollHeight, 180)}px`;
}

async function askQuestion() {
    const text = el.question.value.trim();

    if (!state.ready) { showToast("Build the knowledge base first."); return; }
    if (text.length < 3 || state.asking) return;

    state.asking = true;
    el.welcome.hidden = true;
    el.clearChat.hidden = false;

    addUserMessage(text);
    el.question.value = "";
    growTextarea();
    const node = addBotPlaceholder();
    refreshUI();

    try {
        const data = await api("/api/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text, top_k: 5 }),
        });
        fillBotMessage(node, data);
    } catch (error) {
        fillBotError(node, error.message);
    } finally {
        state.asking = false;
        refreshUI();
        scrollToEnd();
        el.question.focus();
    }
}

el.composer.addEventListener("submit", e => { e.preventDefault(); askQuestion(); });

el.question.addEventListener("input", () => { growTextarea(); refreshUI(); });
el.question.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        askQuestion();
    }
});

el.starters.addEventListener("click", e => {
    const button = e.target.closest("button");
    if (!button) return;
    el.question.value = button.textContent.trim();
    growTextarea();
    refreshUI();

    if (state.ready) {
        askQuestion();
    } else {
        showToast("Add your chapters and build the knowledge base first.");
        toggleRail(true);
    }
});

el.clearChat.addEventListener("click", () => {
    el.thread.querySelectorAll(".msg").forEach(m => m.remove());
    el.welcome.hidden = false;
    el.clearChat.hidden = true;
});

/* ───────── Boot: reuse an existing index if there is one ───────── */

async function loadStats() {
    try {
        const data = await api("/api/stats");
        el.chunkCount.textContent = data.chunks ?? 0;
        el.collectionName.textContent = data.collection || "–";

        if (data.chunks > 0) {
            state.ready = true;
            state.uploaded = true;
            setStage("extract", "done", "Indexed");
            setStage("chunk", "done", `${data.chunks} passages`);
            setStage("embed", "done", "Created");
            setStage("store", "done", "Saved locally");
            el.indexBtn.textContent = "Knowledge base ready";
        }
    } catch {
        // The page still works without stats.
    }
    refreshUI();
}

renderFiles();
refreshUI();
loadStats();

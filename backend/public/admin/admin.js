/*
 * หน้า Admin — JS ธรรมดา ไม่มี build step
 * - ข้อมูลจากผู้ใช้แสดงด้วย textContent เท่านั้น (กัน XSS)
 * - token เก็บใน sessionStorage (ปิดแท็บแล้วหาย)
 */
"use strict";

const TOKEN_KEY = "ai-cv-admin-token";
const STATUS_REFRESH_MS = 15_000;
const PAGE_SIZE = 20;

const state = {
  token: null,
  me: null,
  tab: "overview",
  users: { page: 1, search: "" },
  analyses: { page: 1, status: "ALL" },
  audit: { page: 1 },
  trendDays: 7,
  trendSeries: null,
  statusTimer: null,
};

/* ---------- utils ---------- */

const $ = (id) => document.getElementById(id);

/*
 * ไอคอน Lucide (ISC) — ชุดเดียวกับแอปหลัก
 * วาดด้วย DOM (ไม่ใช้ innerHTML) → ผ่าน CSP
 */
const ICONS = {
  dashboard: [["rect", { x: 3, y: 3, width: 7, height: 9, rx: 1 }], ["rect", { x: 14, y: 3, width: 7, height: 5, rx: 1 }], ["rect", { x: 14, y: 12, width: 7, height: 9, rx: 1 }], ["rect", { x: 3, y: 16, width: 7, height: 5, rx: 1 }]],
  activity: [["path", { d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" }]],
  users: [["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }], ["circle", { cx: 9, cy: 7, r: 4 }], ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }], ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }]],
  file: [["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }], ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }], ["path", { d: "M16 13H8" }], ["path", { d: "M16 17H8" }], ["path", { d: "M10 9H8" }]],
  shield: [["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }], ["path", { d: "m9 12 2 2 4-4" }]],
  logout: [["path", { d: "m16 17 5-5-5-5" }], ["path", { d: "M21 12H9" }], ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }]],
  sun: [["circle", { cx: 12, cy: 12, r: 4 }], ["path", { d: "M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" }]],
  moon: [["path", { d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" }]],
  monitor: [["rect", { x: 2, y: 3, width: 20, height: 14, rx: 2 }], ["path", { d: "M8 21h8M12 17v4" }]],
  refresh: [["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }], ["path", { d: "M21 3v5h-5" }], ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }], ["path", { d: "M8 16H3v5" }]],
  search: [["circle", { cx: 11, cy: 11, r: 8 }], ["path", { d: "m21 21-4.3-4.3" }]],
  sparkles: [["path", { d: "M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" }]],
  check: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "m9 12 2 2 4-4" }]],
  timer: [["path", { d: "M10 2h4" }], ["path", { d: "M12 14l3-3" }], ["circle", { cx: 12, cy: 14, r: 8 }]],
  alert: [["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }], ["path", { d: "M12 9v4M12 17h.01" }]],
  database: [["ellipse", { cx: 12, cy: 5, rx: 9, ry: 3 }], ["path", { d: "M3 5v14a9 3 0 0 0 18 0V5" }], ["path", { d: "M3 12a9 3 0 0 0 18 0" }]],
  zap: [["path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" }]],
  layers: [["path", { d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" }], ["path", { d: "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" }], ["path", { d: "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" }]],
  bot: [["path", { d: "M12 8V4H8" }], ["rect", { x: 4, y: 8, width: 16, height: 12, rx: 2 }], ["path", { d: "M2 14h2M20 14h2M15 13v2M9 13v2" }]],
  clock: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 6v6l4 2" }]],
  play: [["polygon", { points: "6 3 20 12 6 21 6 3" }]],
  inbox: [["path", { d: "M22 12h-6l-2 3h-4l-2-3H2" }], ["path", { d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" }]],
  unlock: [["rect", { x: 3, y: 11, width: 18, height: 11, rx: 2 }], ["path", { d: "M7 11V7a5 5 0 0 1 9.9-1" }]],
  retry: [["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }], ["path", { d: "M3 3v5h5" }]],
  x: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "m15 9-6 6M9 9l6 6" }]],
  chart: [["path", { d: "M3 3v16a2 2 0 0 0 2 2h16" }], ["path", { d: "M18 17V9M13 17V5M8 17v-3" }]],
};

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");

  for (const [tag, attrs] of ICONS[name] ?? []) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    svg.append(node);
  }

  return svg;
}

// เติมไอคอนให้ <span data-icon="..."> ใน HTML
function hydrateIcons(root = document) {
  for (const holder of root.querySelectorAll("[data-icon]")) {
    if (!holder.firstChild) holder.append(icon(holder.dataset.icon));
  }
}

function initials(first, last, email) {
  const value = `${(first ?? "").trim().charAt(0)}${(last ?? "").trim().charAt(0)}`;
  return (value || (email ?? "?").charAt(0)).toUpperCase();
}

/*
 * ธีม: light / dark / system (ค่าเริ่มต้น) — จำไว้ในเบราว์เซอร์นี้
 */
const THEME_KEY = "ai-cv-admin-theme";

function getTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);

  for (const button of document.querySelectorAll("[data-theme-option]")) {
    button.setAttribute("aria-pressed", String(button.dataset.themeOption === theme));
  }

  // กราฟใช้สีจาก CSS → วาดใหม่ไม่จำเป็น แต่ tooltip/สีพื้นอัปเดตเองผ่าน token
}

function setTheme(theme) {
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ใช้ได้เฉพาะหน้านี้ */
  }

  applyTheme(theme);
}

applyTheme(getTheme());

/*
 * สร้าง element: el("td", { className: "num" }, "123")
 */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === "className") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

const dayOnlyFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
});

function formatDateOnly(value) {
  return value ? dayOnlyFormatter.format(new Date(value)) : "—";
}

function formatNumber(value) {
  return value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("th-TH").format(value);
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds} วิ`;

  const minutes = Math.floor(seconds / 60);
  return `${minutes} นาที ${seconds % 60} วิ`;
}

let toastTimer = null;

function toast(message, isError = false) {
  const node = $("toast");

  node.replaceChildren(icon(isError ? "alert" : "check"), el("span", {}, message));
  node.className = isError ? "toast toast--error" : "toast";
  node.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, 4000);
}

/* ---------- API ---------- */

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(path, options = {}) {
  const headers = { Accept: "application/json" };

  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 401 && state.token) {
    logout("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    throw new ApiError("unauthorized", 401);
  }

  if (!response.ok) {
    throw new ApiError(body.message ?? `HTTP ${response.status}`, response.status);
  }

  return body.data;
}

/* ---------- auth ---------- */

function showLogin(message) {
  $("app-view").hidden = true;
  $("login-view").hidden = false;

  const error = $("login-error");
  error.hidden = !message;
  error.textContent = message ?? "";

  $("login-email").focus();
}

function showApp() {
  $("login-view").hidden = true;
  $("app-view").hidden = false;
  $("admin-email").textContent = state.me.email;
  $("admin-name").textContent = `${state.me.firstName ?? ""} ${state.me.lastName ?? ""}`.trim() || "Admin";
  $("admin-avatar").textContent = initials(state.me.firstName, state.me.lastName, state.me.email);

  route();
}

function logout(message) {
  state.token = null;
  state.me = null;
  stopStatusTimer();

  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage ถูกปิด */
  }

  showLogin(message);
}

async function handleLogin(event) {
  event.preventDefault();

  const submit = $("login-submit");
  setBusy(submit, true);
  $("login-error").hidden = true;

  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: {
        email: $("login-email").value.trim(),
        password: $("login-password").value,
      },
    });

    if (data.user?.role !== "ADMIN") {
      showLogin("บัญชีนี้ไม่มีสิทธิ์ ADMIN");
      return;
    }

    state.token = data.token ?? data.accessToken;
    state.me = data.user;
    $("login-password").value = "";

    try {
      sessionStorage.setItem(TOKEN_KEY, state.token);
    } catch {
      /* ใช้ได้เฉพาะหน้านี้ */
    }

    showApp();
  } catch (error) {
    showLogin(error.message);
  } finally {
    setBusy(submit, false);
  }
}

async function restoreSession() {
  try {
    state.token = sessionStorage.getItem(TOKEN_KEY);
  } catch {
    state.token = null;
  }

  if (!state.token) {
    showLogin();
    return;
  }

  try {
    const data = await api("/auth/me");

    if (data.user?.role !== "ADMIN") {
      logout("บัญชีนี้ไม่มีสิทธิ์ ADMIN");
      return;
    }

    state.me = data.user;
    showApp();
  } catch (error) {
    if (error.status !== 401) logout(error.message);
  }
}

/* ---------- routing (#tab) ---------- */

const TABS = ["overview", "status", "users", "analyses", "audit"];

function route() {
  if (!state.me) return;

  const hash = location.hash.slice(1);
  state.tab = TABS.includes(hash) ? hash : "overview";

  for (const tab of TABS) {
    $(`tab-${tab}`).hidden = tab !== state.tab;
  }

  for (const link of document.querySelectorAll(".nav a[data-tab]")) {
    if (link.dataset.tab === state.tab) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  stopStatusTimer();
  showSkeleton(state.tab);
  loadTab(state.tab);

  if (state.tab === "status") {
    state.statusTimer = setInterval(() => loadTab("status"), STATUS_REFRESH_MS);
  }
}

/*
 * Skeleton ตอนเปิดแท็บครั้งแรก (container ยังว่าง)
 * เปิดซ้ำ = เห็นข้อมูลเดิมระหว่างโหลดใหม่ ไม่กระพริบ
 */
function skeletonBar(size = "") {
  return el("span", { className: `skeleton${size ? ` skeleton--${size}` : ""}`, "aria-hidden": "true" });
}

function skeletonCards(count, compact = false) {
  return Array.from({ length: count }, () =>
    el(
      "article",
      { className: compact ? "card card--compact card--skeleton" : "card card--skeleton", "aria-hidden": "true" },
      compact ? null : skeletonBar("icon"),
      skeletonBar("sm"),
      skeletonBar("lg"),
    ),
  );
}

function skeletonRows(columns, rows = 6) {
  return Array.from({ length: rows }, () =>
    el(
      "tr",
      { className: "row--skeleton", "aria-hidden": "true" },
      Array.from({ length: columns }, (_, index) => el("td", {}, skeletonBar(index === 0 ? "wide" : ""))),
    ),
  );
}

const SKELETONS = {
  overview: () => [
    ["overview-cards", skeletonCards(6)],
    ["overview-status", [skeletonBar("chip"), skeletonBar("chip"), skeletonBar("chip")]],
    ["chart-volume", [skeletonBar("chart")]],
    ["chart-success", [skeletonBar("chart")]],
    ["chart-duration", [skeletonBar("chart")]],
    ["trends-table", skeletonRows(6, 5)],
  ],
  status: () => [
    ["status-services", skeletonCards(4)],
    ["status-queue", skeletonCards(5, true)],
  ],
  users: () => [["users-body", skeletonRows(6)]],
  analyses: () => [["analyses-body", skeletonRows(7)]],
  audit: () => [["audit-body", skeletonRows(6)]],
};

function showSkeleton(tab) {
  for (const [id, nodes] of SKELETONS[tab]()) {
    const container = $(id);
    if (container.childElementCount === 0) container.replaceChildren(...nodes);
  }
}

function stopStatusTimer() {
  clearInterval(state.statusTimer);
  state.statusTimer = null;
}

async function loadTab(tab) {
  try {
    if (tab === "overview") await loadOverview();
    if (tab === "status") await loadStatus();
    if (tab === "users") await loadUsers();
    if (tab === "analyses") await loadAnalyses();
    if (tab === "audit") await loadAudit();
  } catch (error) {
    if (error.status !== 401) toast(error.message, true);
  }
}

/* ---------- ภาพรวม ---------- */

/*
 * การ์ดตัวเลข
 * options.icon  : ชื่อไอคอน (ไม่ใส่ = การ์ดเล็กไม่มีไอคอน)
 * options.tone  : "" (peach) | "blue" | "ok" | "warn" | "danger"
 */
function statCard(label, value, hint, options = {}) {
  const { icon: iconName, tone = "" } = options;

  return el(
    "article",
    { className: iconName ? "card" : "card card--compact" },
    iconName
      ? el("div", { className: "card__top" }, el("span", { className: `card__icon${tone ? ` card__icon--${tone}` : ""}` }, icon(iconName)))
      : null,
    el("span", { className: "card__label" }, label),
    el("strong", { className: "card__value" }, value),
    hint ? el("span", { className: "card__hint" }, hint) : null,
  );
}

const STATUS_LABEL = {
  PENDING: ["รอสร้างงาน", "neutral"],
  QUEUED: ["รอคิว", "warn"],
  PROCESSING: ["กำลังวิเคราะห์", "warn"],
  COMPLETED: ["สำเร็จ", "ok"],
  FAILED: ["ล้มเหลว", "danger"],
};

function statusBadge(status, count) {
  const [label, tone] = STATUS_LABEL[status] ?? [status, "neutral"];
  return el("span", { className: `badge badge--${tone}` }, label, count === undefined ? null : el("b", {}, count));
}

async function loadOverview() {
  const data = await api("/admin/overview");
  const { users, resumes, analyses } = data;

  $("overview-cards").replaceChildren(
    statCard("ผู้ใช้ทั้งหมด", formatNumber(users.total), `ใหม่ 7 วัน: ${formatNumber(users.new7d)}`, { icon: "users" }),
    statCard("Resume", formatNumber(resumes.total), "ไฟล์ที่อัปโหลดทั้งหมด", { icon: "file", tone: "blue" }),
    statCard("Analysis วันนี้", formatNumber(analyses.today), `ทั้งหมด ${formatNumber(analyses.total)}`, { icon: "sparkles" }),
    statCard(
      "อัตราสำเร็จ",
      analyses.successRate === null ? "—" : `${analyses.successRate}%`,
      "สำเร็จ ÷ (สำเร็จ + ล้มเหลว)",
      { icon: "check", tone: "blue" },
    ),
    statCard("เวลาเฉลี่ยต่อ Analysis", formatDuration(analyses.avgDurationSeconds), "งานที่เสร็จใน 7 วัน", { icon: "timer", tone: "blue" }),
    stuckCard(analyses.stuck, analyses.stuckMinutes),
  );

  $("stuck-option").textContent = `ค้างเกิน ${analyses.stuckMinutes} นาที`;

  const statuses = Object.keys(STATUS_LABEL);

  $("overview-status").replaceChildren(
    ...statuses.map((status) => statusBadge(status, formatNumber(analyses.byStatus[status] ?? 0))),
  );

  await loadTrends();
}

/*
 * งานค้าง — มี > 0 → การ์ดเตือน + ลิงก์ไปดูรายการ
 */
function stuckCard(count, minutes) {
  const card = statCard(
    "งานค้าง",
    formatNumber(count),
    `รอคิว/กำลังทำนานเกิน ${minutes} นาที`,
    { icon: count > 0 ? "alert" : "check", tone: count > 0 ? "warn" : "ok" },
  );

  if (count > 0) {
    card.classList.add("card--alert");
    card.append(
      el(
        "a",
        {
          href: "#analyses",
          className: "card__link",
          onclick: () => {
            state.analyses.status = "STUCK";
            state.analyses.page = 1;
            $("analyses-status").value = "STUCK";
          },
        },
        "ดูและยกเลิกงานค้าง →",
      ),
    );
  }

  return card;
}

/* ---------- แนวโน้ม (กราฟ SVG) ---------- */

const SVG_NS = "http://www.w3.org/2000/svg";
const CHART_HEIGHT = 200;
const CHART_MARGIN = { top: 14, right: 44, bottom: 24, left: 40 };

function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }

  if (text !== undefined) node.textContent = text;

  return node;
}

const dayFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatDay(isoDate) {
  return dayFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

/*
 * ค่าสูงสุดของแกน y = 4 ช่อง × ขั้นที่กลม (1 / 2 / 2.5 / 5 × 10^n) ที่เล็กที่สุดที่คลุมข้อมูล
 * integer: ขั้นอย่างน้อย 1 (จำนวนงานไม่มี 0.25)
 */
function niceMax(value, { integer = false } = {}) {
  if (!(value > 0)) return 4;

  const rawStep = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const multipliers = integer ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = multipliers.map((s) => s * magnitude).find((s) => s >= rawStep);

  if (integer) step = Math.max(1, Math.ceil(step));

  return step * 4;
}

function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes === 0) return "0";

  return `${minutes < 10 ? Number(minutes.toFixed(1)) : Math.round(minutes)} นาที`;
}

/*
 * โครงกราฟ: กรอบ SVG + เส้น grid + แกน y + ป้ายวันที่บางวัน
 */
function chartFrame(container, series, yMax, formatY) {
  const width = Math.max(280, container.clientWidth);
  const plotW = width - CHART_MARGIN.left - CHART_MARGIN.right;
  const plotH = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const band = plotW / series.length;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${CHART_HEIGHT}`,
    role: "img",
  });

  const x = (index) => CHART_MARGIN.left + band * index + band / 2;
  const y = (value) => CHART_MARGIN.top + plotH - (value / yMax) * plotH;

  for (let i = 0; i <= 4; i++) {
    const value = (yMax / 4) * i;

    svg.append(
      svgEl("line", {
        class: "grid-line",
        x1: CHART_MARGIN.left,
        x2: width - CHART_MARGIN.right,
        y1: y(value),
        y2: y(value),
      }),
      svgEl("text", { class: "axis-text", x: CHART_MARGIN.left - 6, y: y(value) + 4, "text-anchor": "end" }, formatY(value)),
    );
  }

  // ป้ายวันที่: ไม่ให้ชนกัน (~56px ต่อป้าย) และไม่เกิน 7 ป้าย
  const maxLabels = Math.max(2, Math.min(7, Math.floor((width - CHART_MARGIN.left - CHART_MARGIN.right) / 56)));
  const every = Math.ceil(series.length / maxLabels);

  series.forEach((point, index) => {
    if ((series.length - 1 - index) % every !== 0) return;

    svg.append(
      svgEl("text", { class: "axis-text", x: x(index), y: CHART_HEIGHT - 6, "text-anchor": "middle" }, formatDay(point.date)),
    );
  });

  container.replaceChildren(svg);

  return { svg, width, band, plotH, x, y };
}

/*
 * Tooltip + แถบไฮไลต์ต่อวัน (พื้นที่ชี้ทั้งคอลัมน์ ใหญ่กว่าตัว mark)
 */
function attachHover(container, frame, series, renderTip, onActive) {
  const tooltip = el("div", { className: "chart-tooltip", hidden: true });
  container.append(tooltip);

  series.forEach((point, index) => {
    const bandRect = svgEl("rect", {
      class: "hover-band",
      x: frame.x(index) - frame.band / 2,
      y: CHART_MARGIN.top,
      width: frame.band,
      height: frame.plotH,
    });

    const show = () => {
      for (const node of frame.svg.querySelectorAll(".hover-band.is-active")) node.classList.remove("is-active");
      bandRect.classList.add("is-active");
      onActive?.(index);

      tooltip.replaceChildren(el("strong", {}, formatDay(point.date)), ...renderTip(point));
      tooltip.hidden = false;

      // เลื่อน tooltip ไม่ให้ล้นขอบการ์ด
      const scale = container.clientWidth / frame.width;
      const left = frame.x(index) * scale + 12;
      const maxLeft = container.clientWidth - tooltip.offsetWidth - 4;

      tooltip.style.left = `${Math.max(4, left > maxLeft ? frame.x(index) * scale - tooltip.offsetWidth - 12 : left)}px`;
      tooltip.style.top = `${CHART_MARGIN.top}px`;
    };

    bandRect.addEventListener("mouseenter", show);
    bandRect.addEventListener("focus", show);

    // band อยู่ใต้ mark → ไฮไลต์อยู่หลังแท่ง/เส้น
    frame.svg.insertBefore(bandRect, frame.svg.firstChild);
  });

  frame.svg.addEventListener("mouseleave", () => {
    tooltip.hidden = true;
    onActive?.(null);
    for (const node of frame.svg.querySelectorAll(".hover-band.is-active")) node.classList.remove("is-active");
  });
}

function tipRow(label, value, swatchClass) {
  return el(
    "div",
    {},
    el("span", {}, swatchClass ? el("i", { className: `swatch ${swatchClass}` }) : null, label),
    el("b", {}, value),
  );
}

/*
 * แท่งซ้อน: สำเร็จ (ล่าง) + ล้มเหลว (บน)
 * มุมมนเฉพาะปลายบนสุด, เว้น 2px ระหว่างส่วน
 */
function roundedTopPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height);

  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

function renderVolumeChart(container, series) {
  const yMax = niceMax(Math.max(...series.map((point) => point.completed + point.failed)), { integer: true });
  const frame = chartFrame(container, series, yMax, (value) => formatNumber(value));
  const barW = Math.min(24, frame.band * 0.6);
  const GAP = 2;

  frame.svg.setAttribute(
    "aria-label",
    `Analysis ต่อวัน ${series.length} วัน รวมสำเร็จ ${series.reduce((s, p) => s + p.completed, 0)} ล้มเหลว ${series.reduce((s, p) => s + p.failed, 0)}`,
  );

  series.forEach((point, index) => {
    const left = frame.x(index) - barW / 2;
    const segments = [
      { value: point.completed, cls: "bar--completed" },
      { value: point.failed, cls: "bar--failed" },
    ].filter((segment) => segment.value > 0);

    let base = 0;

    segments.forEach((segment, i) => {
      const isTop = i === segments.length - 1;
      const yTop = frame.y(base + segment.value);
      // เว้นช่องสีพื้นหลังระหว่างส่วน
      const yBottom = frame.y(base) - (i > 0 ? GAP : 0);
      const height = Math.max(1, yBottom - yTop);

      frame.svg.append(
        isTop
          ? svgEl("path", { class: segment.cls, d: roundedTopPath(left, yTop, barW, height, 4) })
          : svgEl("rect", { class: segment.cls, x: left, y: yTop, width: barW, height }),
      );

      base += segment.value;
    });
  });

  attachHover(container, frame, series, (point) => [
    tipRow("สำเร็จ", formatNumber(point.completed), "swatch--completed"),
    tipRow("ล้มเหลว", formatNumber(point.failed), "swatch--failed"),
    tipRow("ทั้งหมด (รวมกำลังทำ)", formatNumber(point.total)),
  ]);
}

/*
 * กราฟเส้น 1 ชุด — ขาดช่วงวันที่ไม่มีค่า (null) ไม่ลากผ่าน
 */
function renderLineChart(container, series, { valueOf, yMax, formatY, formatValue, label }) {
  const values = series.map(valueOf);

  if (values.every((value) => value === null)) {
    container.replaceChildren(el("div", { className: "chart-empty" }, icon("chart"), "ยังไม่มีข้อมูลในช่วงนี้"));
    return;
  }

  const frame = chartFrame(container, series, yMax(values), formatY);
  frame.svg.setAttribute("aria-label", label);

  // แยกเป็นช่วงต่อเนื่อง
  const runs = [];
  let current = [];

  values.forEach((value, index) => {
    if (value === null) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push(index);
    }
  });

  if (current.length) runs.push(current);

  for (const run of runs) {
    const points = run.map((index) => `${frame.x(index)},${frame.y(values[index])}`);
    const baseline = frame.y(0);

    if (run.length > 1) {
      frame.svg.append(
        svgEl("path", {
          class: "area",
          d: `M${frame.x(run[0])},${baseline} L${points.join(" L")} L${frame.x(run.at(-1))},${baseline} Z`,
        }),
        svgEl("path", { class: "line", d: `M${points.join(" L")}` }),
      );
    }
  }

  // จุดเฉพาะวันที่มีค่า (ช่วงที่มีจุดเดียวยังมองเห็น)
  values.forEach((value, index) => {
    if (value !== null) {
      frame.svg.append(svgEl("circle", { class: "dot", cx: frame.x(index), cy: frame.y(value), r: 4 }));
    }
  });

  // ป้ายค่าเฉพาะจุดล่าสุด
  const lastIndex = values.findLastIndex((value) => value !== null);

  frame.svg.append(
    svgEl(
      "text",
      { class: "end-label", x: frame.x(lastIndex) + 8, y: frame.y(values[lastIndex]) + 4 },
      formatValue(values[lastIndex]),
    ),
  );

  const crosshair = svgEl("line", { class: "crosshair", y1: CHART_MARGIN.top, y2: CHART_MARGIN.top + frame.plotH });
  crosshair.style.display = "none";
  frame.svg.append(crosshair);

  attachHover(
    container,
    frame,
    series,
    (point) => [tipRow(label, formatValue(valueOf(point)))],
    (index) => {
      if (index === null) {
        crosshair.style.display = "none";
        return;
      }

      crosshair.setAttribute("x1", frame.x(index));
      crosshair.setAttribute("x2", frame.x(index));
      crosshair.style.display = "";
    },
  );
}

function renderTrends() {
  const series = state.trendSeries;

  if (!series) return;

  renderVolumeChart($("chart-volume"), series);

  renderLineChart($("chart-success"), series, {
    valueOf: (point) => point.successRate,
    yMax: () => 100,
    formatY: (value) => `${value}%`,
    formatValue: (value) => (value === null ? "—" : `${value}%`),
    label: "อัตราสำเร็จ",
  });

  // แกนเป็นนาที (ตัวเลขกลมกว่าวินาที) — tooltip ยังบอกละเอียดเป็นนาที+วินาที
  renderLineChart($("chart-duration"), series, {
    valueOf: (point) => (point.avgDurationSeconds === null ? null : point.avgDurationSeconds / 60),
    yMax: (values) => niceMax(Math.max(...values.filter((value) => value !== null))),
    formatY: (value) => formatMinutes(value),
    formatValue: (value) => (value === null ? "—" : formatDuration(Math.round(value * 60))),
    label: "เวลาเฉลี่ย",
  });

  $("trends-table").replaceChildren(
    ...[...series].reverse().map((point) =>
      el(
        "tr",
        {},
        el("td", {}, formatDay(point.date)),
        el("td", { className: "num" }, formatNumber(point.total)),
        el("td", { className: "num" }, formatNumber(point.completed)),
        el("td", { className: "num" }, formatNumber(point.failed)),
        el("td", { className: "num" }, point.successRate === null ? "—" : `${point.successRate}%`),
        el("td", { className: "num" }, formatDuration(point.avgDurationSeconds)),
      ),
    ),
  );
}

async function loadTrends() {
  const data = await api(`/admin/trends?days=${state.trendDays}`);

  state.trendSeries = data.series;
  renderTrends();
}

/* ---------- บริการ ---------- */

const QUEUE_LABEL = {
  waiting: "รอคิว",
  active: "กำลังทำ",
  delayed: "รอ retry",
  failed: "ล้มเหลว (คิว)",
  completed: "เสร็จ (เก็บไว้)",
};

const SERVICE_ICON = {
  MySQL: "database",
  Redis: "zap",
  Qdrant: "layers",
  Ollama: "bot",
};

async function loadStatus() {
  const data = await api("/admin/status");

  $("status-services").replaceChildren(
    ...data.services.map((service) =>
      el(
        "article",
        { className: service.ok ? "card" : "card card--down" },
        el(
          "div",
          { className: "card__top" },
          el(
            "span",
            { className: `card__icon ${service.ok ? "card__icon--blue" : "card__icon--danger"}` },
            icon(SERVICE_ICON[service.name] ?? "activity"),
          ),
          el(
            "span",
            { className: `service-state service-state--${service.ok ? "ok" : "down"}` },
            el("span", { className: service.ok ? "dot dot--live" : "dot" }),
            service.ok ? "ปกติ" : "ใช้งานไม่ได้",
          ),
        ),
        el("span", { className: "card__label" }, service.name),
        el(
          "strong",
          { className: "card__value" },
          service.latencyMs === null ? "—" : String(service.latencyMs),
          service.latencyMs === null ? null : el("small", {}, " ms"),
        ),
        el("span", { className: "card__hint" }, service.detail),
      ),
    ),
  );

  $("status-queue").replaceChildren(
    ...(data.queue
      ? Object.entries(QUEUE_LABEL).map(([key, label]) => statCard(label, formatNumber(data.queue[key] ?? 0)))
      : [statCard("คิว", "—", "อ่านคิวไม่ได้ (Redis?)")]),
  );

  $("status-checked").textContent = `ตรวจล่าสุด ${formatDate(data.checkedAt)}`;
}

/* ---------- ผู้ใช้ ---------- */

function pager(container, { page, pageSize, total }, onChange) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  container.replaceChildren(
    el("span", {}, `ทั้งหมด ${formatNumber(total)} รายการ · หน้า ${page}/${pages}`),
    el("button", { type: "button", className: "button button--small", disabled: page <= 1, onclick: () => onChange(page - 1) }, "ก่อนหน้า"),
    el("button", { type: "button", className: "button button--small", disabled: page >= pages, onclick: () => onChange(page + 1) }, "ถัดไป"),
  );
}

function emptyRow(columns, text) {
  return el(
    "tr",
    {},
    el("td", { colspan: columns, className: "empty" }, el("div", { className: "empty__inner" }, el("div", {}, icon("inbox")), text)),
  );
}

// ปุ่มเล็ก + ไอคอน
function smallButton(iconName, label, props = {}) {
  return el(
    "button",
    { type: "button", ...props, className: `button button--small${props.className ? ` ${props.className}` : ""}` },
    icon(iconName),
    label,
  );
}

// ปุ่มกำลังทำงาน: ไอคอนกลายเป็นวงหมุน (CSS .is-busy)
function setBusy(button, busy) {
  button.disabled = busy;
  button.classList.toggle("is-busy", busy);

  if (busy) button.setAttribute("aria-busy", "true");
  else button.removeAttribute("aria-busy");
}

async function runAction(button, action, successMessage) {
  setBusy(button, true);

  try {
    await action();
    toast(successMessage);
    await loadTab(state.tab);
  } catch (error) {
    if (error.status !== 401) toast(error.message, true);
    setBusy(button, false);
  }
}

function userActions(user) {
  const isSelf = user.id === state.me.id;
  const nextRole = user.role === "ADMIN" ? "USER" : "ADMIN";

  // ไอคอนอย่างเดียว (ประหยัดที่) — ชื่อปุ่มอยู่ใน aria-label/title
  const unlock = smallButton("unlock", null, {
    className: "button--icon",
    "aria-label": `ปลดล็อกการเข้าสู่ระบบของ ${user.email}`,
    title: "ปลดล็อกการเข้าสู่ระบบ (ล้างตัวนับล็อกอินผิด)",
    onclick: () =>
      runAction(unlock, () => api(`/admin/users/${user.id}/unlock-login`, { method: "POST" }), `ปลดล็อก ${user.email} แล้ว`),
  });

  const role = smallButton(
    "shield",
    nextRole === "ADMIN" ? "ตั้งเป็น Admin" : "ถอด Admin",
    {
      className: nextRole === "USER" ? "button--danger" : "",
      disabled: isSelf,
      title: isSelf ? "เปลี่ยน role ของตัวเองไม่ได้" : undefined,
      onclick: () => {
        if (!confirm(`เปลี่ยน ${user.email} เป็น ${nextRole}?`)) return;

        runAction(
          role,
          () => api(`/admin/users/${user.id}/role`, { method: "PATCH", body: { role: nextRole } }),
          `${user.email} เป็น ${nextRole} แล้ว`,
        );
      },
    },
  );

  return el("div", { className: "actions" }, unlock, role);
}

async function loadUsers() {
  const params = new URLSearchParams({
    search: state.users.search,
    page: String(state.users.page),
    pageSize: String(PAGE_SIZE),
  });

  const data = await api(`/admin/users?${params}`);

  $("users-body").replaceChildren(
    ...(data.users.length === 0
      ? [emptyRow(6, "ไม่พบผู้ใช้")]
      : data.users.map((user) =>
          el(
            "tr",
            {},
            el(
              "td",
              {},
              el(
                "div",
                { className: "person" },
                el(
                  "span",
                  { className: user.role === "ADMIN" ? "avatar avatar--admin" : "avatar", "aria-hidden": "true" },
                  initials(user.firstName, user.lastName, user.email),
                ),
                el(
                  "div",
                  { className: "person__text" },
                  el("div", { className: "cell-main" }, `${user.firstName} ${user.lastName}`),
                  el("div", { className: "cell-sub" }, user.email),
                ),
              ),
            ),
            el(
              "td",
              {},
              el("span", { className: user.role === "ADMIN" ? "badge badge--admin" : "badge badge--neutral" }, user.role),
            ),
            el("td", { className: "nowrap" }, formatDateOnly(user.createdAt)),
            el("td", { className: "nowrap" }, formatDate(user.lastLoginAt)),
            el("td", { className: "num nowrap" }, `${formatNumber(user.resumeCount)} / ${formatNumber(user.analysisCount)}`),
            el("td", {}, userActions(user)),
          ),
        )),
  );

  pager($("users-pager"), data, (page) => {
    state.users.page = page;
    loadTab("users");
  });
}

/* ---------- Analysis ---------- */

const TYPE_LABEL = {
  BASE: "Resume",
  JOB_MATCH: "Job Match",
  COMBINED: "Combined",
};

async function loadAnalyses() {
  const params = new URLSearchParams({
    status: state.analyses.status,
    page: String(state.analyses.page),
    pageSize: String(PAGE_SIZE),
  });

  const data = await api(`/admin/analyses?${params}`);

  $("analyses-body").replaceChildren(
    ...(data.analyses.length === 0
      ? [emptyRow(8, "ไม่มีรายการ")]
      : data.analyses.map((run) => {
          let action = null;

          if (run.status === "FAILED") {
            action = smallButton("retry", "ลองใหม่", {
              onclick: () =>
                runAction(action, () => api(`/admin/analyses/${run.id}/retry`, { method: "POST" }), `สร้างงานวิเคราะห์ใหม่ให้ #${run.id} แล้ว`),
            });
          } else if (run.isStuck) {
            action = smallButton("x", "ยกเลิกงานค้าง", {
              className: "button--danger",
              title: "เปลี่ยนเป็นล้มเหลว แล้วกดลองใหม่ได้",
              onclick: () => {
                if (!confirm(`ยกเลิกงาน #${run.id} ที่ค้างอยู่?`)) return;

                runAction(action, () => api(`/admin/analyses/${run.id}/cancel`, { method: "POST" }), `ยกเลิกงาน #${run.id} แล้ว`);
              },
            });
          }

          return el(
            "tr",
            {},
            el("td", { className: "num" }, run.id),
            el(
              "td",
              {},
              el("div", { className: "cell-main" }, run.user.email),
              el("div", { className: "cell-sub" }, run.resumeName ?? "(ลบ Resume แล้ว)"),
              run.jobTitle ? el("div", { className: "cell-sub" }, `งาน: ${run.jobTitle}`) : null,
            ),
            el("td", {}, el("span", { className: "badge badge--info badge--plain" }, TYPE_LABEL[run.analysisType] ?? run.analysisType)),
            el(
              "td",
              {},
              statusBadge(run.status),
              run.isStuck
                ? el("div", { className: "cell-warn" }, `ค้างตั้งแต่ ${formatDate(run.lastProgressAt)}`)
                : null,
              run.attemptCount > 1 ? el("div", { className: "cell-sub" }, `พยายาม ${run.attemptCount} ครั้ง`) : null,
              run.errorCode || run.errorMessage
                ? el("div", { className: "cell-error" }, [run.errorCode, run.errorMessage].filter(Boolean).join(" — "))
                : null,
            ),
            el("td", { className: "num" }, run.score === null || run.score === undefined ? el("span", { className: "muted" }, "—") : el("span", { className: "score" }, run.score)),
            el("td", { className: "num nowrap" }, formatDuration(run.durationSeconds)),
            el("td", { className: "nowrap" }, formatDate(run.createdAt)),
            el("td", {}, action ?? el("span", { className: "muted" }, "—")),
          );
        })),
  );

  pager($("analyses-pager"), data, (page) => {
    state.analyses.page = page;
    loadTab("analyses");
  });
}

/* ---------- Audit log ---------- */

const ACTION_LABEL = {
  RETRY_ANALYSIS: "ลองวิเคราะห์ใหม่",
  CANCEL_STUCK_ANALYSIS: "ยกเลิกงานค้าง",
  UNLOCK_LOGIN: "ปลดล็อกล็อกอิน",
  PROMOTE_ADMIN_BY_EMAIL: "ตั้ง Admin ด้วยอีเมล",
  CHANGE_ROLE: "เปลี่ยน role",
};

const TARGET_LABEL = {
  user: "ผู้ใช้",
  analysis: "Analysis",
};

function detailsList(details) {
  const entries = Object.entries(details ?? {});

  if (entries.length === 0) return el("span", { className: "muted" }, "—");

  return el(
    "ul",
    { className: "details-list" },
    ...entries.map(([key, value]) => el("li", {}, `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)),
  );
}

async function loadAudit() {
  const params = new URLSearchParams({
    page: String(state.audit.page),
    pageSize: String(PAGE_SIZE),
  });

  const data = await api(`/admin/audit-logs?${params}`);

  $("audit-body").replaceChildren(
    ...(data.logs.length === 0
      ? [emptyRow(6, "ยังไม่มีการกระทำของ Admin")]
      : data.logs.map((log) =>
          el(
            "tr",
            {},
            el("td", { className: "nowrap" }, formatDate(log.createdAt)),
            el("td", {}, log.adminEmail),
            el("td", {}, el("span", { className: "badge badge--info" }, ACTION_LABEL[log.action] ?? log.action)),
            el("td", {}, log.targetType ? `${TARGET_LABEL[log.targetType] ?? log.targetType} #${log.targetId}` : "—"),
            el("td", {}, detailsList(log.details)),
            el("td", { className: "mono" }, log.ipAddress ?? "—"),
          ),
        )),
  );

  pager($("audit-pager"), data, (page) => {
    state.audit.page = page;
    loadTab("audit");
  });
}

/* ---------- init ---------- */

for (const button of document.querySelectorAll("[data-days]")) {
  button.addEventListener("click", async () => {
    state.trendDays = Number(button.dataset.days);

    for (const other of document.querySelectorAll("[data-days]")) {
      other.setAttribute("aria-pressed", String(other === button));
    }

    try {
      await loadTrends();
    } catch (error) {
      if (error.status !== 401) toast(error.message, true);
    }
  });
}

// ความกว้างเปลี่ยน → วาดกราฟใหม่จากข้อมูลเดิม (ไม่ยิง API)
window.addEventListener(
  "resize",
  debounceResize(() => {
    if (state.tab === "overview") renderTrends();
  }),
);

function debounceResize(fn) {
  let frame = null;
  return () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fn);
  };
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

hydrateIcons();
applyTheme(getTheme());

for (const button of document.querySelectorAll("[data-theme-option]")) {
  button.addEventListener("click", () => setTheme(button.dataset.themeOption));
}

// ธีม "ตามระบบ" → ติดตามเมื่อ OS เปลี่ยน
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getTheme() === "system") applyTheme("system");
});

$("login-form").addEventListener("submit", handleLogin);
$("logout-button").addEventListener("click", () => logout());
window.addEventListener("hashchange", route);

$("users-search").addEventListener(
  "input",
  debounce((event) => {
    state.users.search = event.target.value.trim();
    state.users.page = 1;
    loadTab("users");
  }, 300),
);

$("promote-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = $("promote-email");
  const email = input.value.trim();

  if (!email || !input.checkValidity()) {
    toast("กรุณาใส่อีเมลให้ถูกต้อง", true);
    input.focus();
    return;
  }

  if (!confirm(`ตั้ง ${email} เป็น Admin?`)) return;

  const submit = $("promote-submit");
  setBusy(submit, true);

  try {
    const result = await api("/admin/admins", { method: "POST", body: { email } });

    toast(result.alreadyAdmin ? `${result.email} เป็น Admin อยู่แล้ว` : `ตั้ง ${result.email} เป็น Admin แล้ว`);
    input.value = "";
    await loadTab("users");
  } catch (error) {
    if (error.status !== 401) toast(error.message, true);
  } finally {
    setBusy(submit, false);
  }
});

$("analyses-status").addEventListener("change", (event) => {
  state.analyses.status = event.target.value;
  state.analyses.page = 1;
  loadTab("analyses");
});

for (const button of document.querySelectorAll("[data-refresh]")) {
  button.addEventListener("click", async () => {
    setBusy(button, true);

    try {
      await loadTab(button.dataset.refresh);
    } finally {
      setBusy(button, false);
    }
  });
}

// แท็บถูกซ่อน → หยุดรีเฟรชสถานะ
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopStatusTimer();
  else if (state.me) route();
});

restoreSession();

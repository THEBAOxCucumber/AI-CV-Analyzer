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

  node.textContent = message;
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
  submit.disabled = true;
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
    submit.disabled = false;
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

  for (const link of document.querySelectorAll(".tabs a")) {
    if (link.dataset.tab === state.tab) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  stopStatusTimer();
  loadTab(state.tab);

  if (state.tab === "status") {
    state.statusTimer = setInterval(() => loadTab("status"), STATUS_REFRESH_MS);
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

function statCard(label, value, hint) {
  return el(
    "article",
    { className: "card" },
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

function statusBadge(status, suffix) {
  const [label, tone] = STATUS_LABEL[status] ?? [status, "neutral"];
  return el("span", { className: `badge badge--${tone}` }, suffix ? `${label} ${suffix}` : label);
}

async function loadOverview() {
  const data = await api("/admin/overview");
  const { users, resumes, analyses } = data;

  $("overview-cards").replaceChildren(
    statCard("ผู้ใช้ทั้งหมด", formatNumber(users.total), `ใหม่ 7 วัน: ${formatNumber(users.new7d)}`),
    statCard("Resume", formatNumber(resumes.total)),
    statCard("Analysis วันนี้", formatNumber(analyses.today), `ทั้งหมด ${formatNumber(analyses.total)}`),
    statCard(
      "อัตราสำเร็จ",
      analyses.successRate === null ? "—" : `${analyses.successRate}%`,
      "สำเร็จ ÷ (สำเร็จ + ล้มเหลว)",
    ),
    statCard("เวลาเฉลี่ยต่อ Analysis", formatDuration(analyses.avgDurationSeconds), "งานที่เสร็จใน 7 วัน"),
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

  // ป้ายวันที่ไม่เกิน ~7 ป้าย
  const every = Math.ceil(series.length / 7);

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
    container.replaceChildren(el("div", { className: "chart-empty" }, "ยังไม่มีข้อมูลในช่วงนี้"));
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

async function loadStatus() {
  const data = await api("/admin/status");

  $("status-services").replaceChildren(
    ...data.services.map((service) =>
      el(
        "article",
        { className: service.ok ? "card" : "card card--down" },
        el(
          "span",
          { className: "card__label" },
          service.name,
          el("span", { className: `badge badge--${service.ok ? "ok" : "danger"}` }, service.ok ? "ปกติ" : "ใช้งานไม่ได้"),
        ),
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
  return el("tr", {}, el("td", { colspan: columns, className: "empty" }, text));
}

async function runAction(button, action, successMessage) {
  button.disabled = true;

  try {
    await action();
    toast(successMessage);
    await loadTab(state.tab);
  } catch (error) {
    if (error.status !== 401) toast(error.message, true);
    button.disabled = false;
  }
}

function userActions(user) {
  const isSelf = user.id === state.me.id;
  const nextRole = user.role === "ADMIN" ? "USER" : "ADMIN";

  const unlock = el(
    "button",
    {
      type: "button",
      className: "button button--small",
      title: "ล้างตัวนับล็อกอินผิด (rate limit) ของอีเมลนี้",
      onclick: () =>
        runAction(unlock, () => api(`/admin/users/${user.id}/unlock-login`, { method: "POST" }), `ปลดล็อก ${user.email} แล้ว`),
    },
    "ปลดล็อกล็อกอิน",
  );

  const role = el(
    "button",
    {
      type: "button",
      className: nextRole === "USER" ? "button button--small button--danger" : "button button--small",
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
    nextRole === "ADMIN" ? "ตั้งเป็น Admin" : "ถอด Admin",
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
      ? [emptyRow(7, "ไม่พบผู้ใช้")]
      : data.users.map((user) =>
          el(
            "tr",
            {},
            el(
              "td",
              {},
              el("div", { className: "cell-main" }, `${user.firstName} ${user.lastName}`),
              el("div", { className: "cell-sub" }, user.email),
            ),
            el(
              "td",
              {},
              el("span", { className: user.role === "ADMIN" ? "badge badge--admin" : "badge badge--neutral" }, user.role),
            ),
            el("td", {}, formatDate(user.createdAt)),
            el("td", {}, formatDate(user.lastLoginAt)),
            el("td", { className: "num" }, formatNumber(user.resumeCount)),
            el("td", { className: "num" }, formatNumber(user.analysisCount)),
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
            action = el(
              "button",
              {
                type: "button",
                className: "button button--small",
                onclick: () =>
                  runAction(action, () => api(`/admin/analyses/${run.id}/retry`, { method: "POST" }), `สร้างงานวิเคราะห์ใหม่ให้ #${run.id} แล้ว`),
              },
              "ลองใหม่",
            );
          } else if (run.isStuck) {
            action = el(
              "button",
              {
                type: "button",
                className: "button button--small button--danger",
                title: "เปลี่ยนเป็นล้มเหลว แล้วกดลองใหม่ได้",
                onclick: () => {
                  if (!confirm(`ยกเลิกงาน #${run.id} ที่ค้างอยู่?`)) return;

                  runAction(action, () => api(`/admin/analyses/${run.id}/cancel`, { method: "POST" }), `ยกเลิกงาน #${run.id} แล้ว`);
                },
              },
              "ยกเลิกงานค้าง",
            );
          }

          const retry = action;

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
            el("td", {}, TYPE_LABEL[run.analysisType] ?? run.analysisType),
            el(
              "td",
              {},
              statusBadge(run.status),
              run.isStuck
                ? el("div", { className: "cell-error" }, `ค้างตั้งแต่ ${formatDate(run.lastProgressAt)}`)
                : null,
              run.attemptCount > 1 ? el("div", { className: "cell-sub" }, `พยายาม ${run.attemptCount} ครั้ง`) : null,
              run.errorCode || run.errorMessage
                ? el("div", { className: "cell-error" }, [run.errorCode, run.errorMessage].filter(Boolean).join(" — "))
                : null,
            ),
            el("td", { className: "num" }, run.score ?? "—"),
            el("td", { className: "num" }, formatDuration(run.durationSeconds)),
            el("td", {}, formatDate(run.createdAt)),
            el("td", {}, retry ?? el("span", { className: "muted" }, "—")),
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
            el("td", {}, formatDate(log.createdAt)),
            el("td", {}, log.adminEmail),
            el("td", {}, el("span", { className: "badge badge--neutral" }, ACTION_LABEL[log.action] ?? log.action)),
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
  submit.disabled = true;

  try {
    const result = await api("/admin/admins", { method: "POST", body: { email } });

    toast(result.alreadyAdmin ? `${result.email} เป็น Admin อยู่แล้ว` : `ตั้ง ${result.email} เป็น Admin แล้ว`);
    input.value = "";
    await loadTab("users");
  } catch (error) {
    if (error.status !== 401) toast(error.message, true);
  } finally {
    submit.disabled = false;
  }
});

$("analyses-status").addEventListener("change", (event) => {
  state.analyses.status = event.target.value;
  state.analyses.page = 1;
  loadTab("analyses");
});

for (const button of document.querySelectorAll("[data-refresh]")) {
  button.addEventListener("click", () => loadTab(button.dataset.refresh));
}

// แท็บถูกซ่อน → หยุดรีเฟรชสถานะ
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopStatusTimer();
  else if (state.me) route();
});

restoreSession();

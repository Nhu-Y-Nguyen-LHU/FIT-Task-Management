const STORAGE_KEY = "task-board-v1";
const SETTINGS_KEY = "task-board-settings-v1";
const DEMO_KEY = "task-board-demo-loaded-v1";
const GOOGLE_CLIENT_ID = "1004464823457-iip5aecmm9ku0qaculf2f1o98hvsnnc6.apps.googleusercontent.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
let driveToken = "";
let driveTokenClient = null;
let driveTokenResolver = null;
const state = {
  tasks: [],
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  view: "month",
  ganttPeriod: "month",
  draggedTaskId: null
};
const $ = (selector) => document.querySelector(selector);
const pad = (n) => String(n).padStart(2, "0");
const toDate = (value) => new Date(`${value}T00:00:00`);
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const formatDate = (value) => toDate(value).toLocaleDateString("vi-VN");
const formatCompletedAt = (value) => value ? new Date(value).toLocaleString("vi-VN") : "";
const monthLabel = (date) => {
  const label = date.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  return label.replace(/^tháng/, "Tháng").replace(" năm ", " Năm ");
};
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000) + 1;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
const priorityLabels = { urgent: "Khẩn cấp", high: "Cao", medium: "Trung bình", low: "Thấp" };
const priorityColors = { urgent: "#b94f60", high: "#e1b441", medium: "#28509e", low: "#4da47c" };
const recurrenceLabels = { weekly: "Hàng tuần", monthly: "Hàng tháng" };
const isInMonth = (task, date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return task.endDate >= iso(firstDay) && task.startDate <= iso(lastDay);
};

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  $("#lastSaved").textContent = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.tasks = stored.flatMap((task) => {
      if (!task.subtask) return [{ ...task, parentId: task.parentId || "", completed: Boolean(task.completed), priority: task.priority || "medium", recurrence: task.recurrence || "", recurrenceEnd: task.recurrenceEnd || "" }];
      const parent = { ...task, subtask: "", parentId: "", completed: Boolean(task.completed), priority: task.priority || "medium", recurrence: task.recurrence || "", recurrenceEnd: task.recurrenceEnd || "" };
      const child = { ...task, id: crypto.randomUUID(), name: task.subtask, subtask: "", parentId: task.id, completed: false, priority: "medium", recurrence: "", recurrenceEnd: "" };
      return [parent, child];
    });
    if (state.tasks.some((task) => task.parentId)) save();
    if (!state.tasks.length && !localStorage.getItem(DEMO_KEY)) {
      state.tasks = demoTasks();
      localStorage.setItem(DEMO_KEY, "yes");
      save();
      showNotice("Đã nạp dữ liệu mẫu 30 ngày để bạn thử lịch và Gantt.", "success");
    }
  } catch (error) { console.error("Không thể đọc dữ liệu đã lưu", error); state.tasks = []; }
}
function demoTasks() {
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  const date = (day) => iso(new Date(year, month, day));
  const make = (name, parentId, start, end, hours, color, type, priority, id = crypto.randomUUID()) => ({
    id, name, parentId, startDate: date(start), endDate: date(end),
    estimatedHours: hours, color, type, priority
  });
  const website = crypto.randomUUID();
  const campaign = crypto.randomUUID();
  const operations = crypto.randomUUID();
  return [
    make("Ra mắt website", "", 1, 14, 48, "#1f5f8b", "Dự án", "high", website),
    make("Phân tích yêu cầu", website, 1, 5, 12, "#39846a", "Phân tích", "medium"),
    make("Thiết kế giao diện", website, 4, 10, 20, "#7d2735", "Thiết kế", "urgent"),
    make("Kiểm thử nghiệm thu", website, 9, 14, 16, "#8b5e1f", "Kiểm thử", "high"),
    make("Chiến dịch tháng", "", 8, 24, 56, "#5d478f", "Marketing", "medium", campaign),
    make("Chuẩn bị nội dung", campaign, 8, 14, 18, "#2f6d73", "Nội dung", "low"),
    make("Thiết lập quảng cáo", campaign, 12, 19, 20, "#39846a", "Quảng cáo", "high"),
    make("Theo dõi kết quả", campaign, 20, 24, 18, "#7d2735", "Báo cáo", "medium"),
    make("Vận hành định kỳ", "", 18, 30, 40, "#8b5e1f", "Vận hành", "low", operations),
    make("Đối soát dữ liệu", operations, 18, 22, 14, "#1f5f8b", "Dữ liệu", "high"),
    make("Báo cáo cuối tháng", operations, 23, 30, 26, "#5d478f", "Báo cáo", "urgent")
  ];
}
function showNotice(message, tone = "warning") {
  const notice = $("#notice");
  notice.textContent = message;
  notice.style.borderLeftColor = tone === "success" ? "#39846a" : "var(--gold)";
  notice.hidden = false;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => { notice.hidden = true; }, 7000);
}
function driveFolderId(value) {
  const match = String(value).match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : String(value).trim();
}
function readSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return settings && typeof settings === "object" ? settings : {};
  } catch (error) {
    console.error("Không thể đọc cài đặt lưu trữ", error);
    return {};
  }
}
function saveSettings() {
  const driveFolder = $("#driveFolder").value.trim();
  if (driveFolder) {
    try {
      const url = new URL(driveFolder);
      if (url.protocol !== "https:" || !url.hostname.endsWith("google.com")) throw new Error();
    } catch (error) {
      showNotice("Link thư mục Google Drive không hợp lệ.");
      return false;
    }
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ driveFolder }));
  return true;
}
function requestDriveToken() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services chưa tải xong."));
      return;
    }
    if (!driveTokenClient) {
      driveTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (response.error) {
            if (driveTokenResolver) driveTokenResolver.reject(new Error(response.error));
            driveTokenResolver = null;
            return;
          }
          driveToken = response.access_token;
          if (driveTokenResolver) driveTokenResolver.resolve(driveToken);
          driveTokenResolver = null;
        }
      });
    }
    driveTokenResolver = { resolve, reject };
    driveTokenClient.requestAccessToken({ prompt: driveToken ? "" : "consent" });
  });
}
function driveRequest(url, options = {}) {
  const request = async (retry = true) => {
    const headers = { ...(options.headers || {}), Authorization: "Bearer " + driveToken };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 && retry) {
      driveToken = "";
      await requestDriveToken();
      return request(false);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google Drive lỗi ${response.status}: ${body.slice(0, 240)}`);
    }
    if (response.status === 204) return null;
    return response.json();
  };
  return request();
}
function taskRows(tasks) {
  return tasks.map((task) => {
    const parent = task.parentId ? tasks.find((item) => item.id === task.parentId) : null;
    return { Task: task.name, "Task cha": parent?.name || "", "Ngày bắt đầu": task.startDate, "Ngày kết thúc": task.endDate, "Thời gian làm dự kiến (giờ)": task.estimatedHours, "Loại công việc": task.type, "Mức độ ưu tiên": priorityLabels[task.priority || "medium"], "Lặp lại": recurrenceLabels[task.recurrence] || "", "Kết thúc lặp": task.recurrenceEnd || "", "Đã xong": task.completed ? "Có" : "Chưa", "Thời gian hoàn thành": task.completed ? formatCompletedAt(task.completedAt) : "" };
  });
}
function workbookBlob(tasks = state.tasks) {
  const rows = taskRows(tasks);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Tasks");
  return new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
async function uploadMonthToDrive() {
  if (!window.XLSX) throw new Error("Thư viện Excel chưa tải xong.");
  const settings = readSettings();
  const parentId = driveFolderId(settings.driveFolder);
  if (!parentId) throw new Error("Hãy lưu link thư mục Drive trước.");
  await requestDriveToken();
  const folderName = monthKey(state.month);
  const query = `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const found = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`);
  let monthFolder = found.files[0];
  if (!monthFolder) {
    monthFolder = await driveRequest("https://www.googleapis.com/drive/v3/files?fields=id,name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [parentId] })
    });
  }
  const fileName = `task-board-${folderName}.xlsx`;
  const existingFile = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${monthFolder.id}' in parents and name = '${fileName}' and trashed = false`)}&fields=files(id,name)&pageSize=1`);
  const fileId = existingFile.files[0]?.id;
  const metadata = { name: fileName, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  if (!fileId) metadata.parents = [monthFolder.id];
  const boundary = `task-board-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    workbookBlob(),
    `\r\n--${boundary}--`
  ]);
  const uploadUrl = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,webViewLink`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";
  await driveRequest(uploadUrl, {
    method: fileId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body
  });
}
function tasksForMonth() { return state.tasks.filter((task) => isInMonth(task, state.month)); }
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => (priorityOrder[a.priority || "medium"] - priorityOrder[b.priority || "medium"]) || a.startDate.localeCompare(b.startDate));
}
function calendarTasksOnDate(date) {
  const dateValue = iso(date);
  return sortTasks(state.tasks.filter((task) => !task.recurrence && task.startDate <= dateValue && task.endDate >= dateValue));
}
function hasDeadlineOnDate(date) {
  const dateValue = iso(date);
  return state.tasks.some((task) => !task.recurrence && task.endDate === dateValue);
}
function setSingleTaskCompletion(taskId, completed) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return [];
  task.completed = completed;
  task.completedAt = completed ? new Date().toISOString() : "";
  return [];
}
function setTaskTreeCompletion(taskId, completed) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return [];
  setSingleTaskCompletion(taskId, completed);
  const descendants = state.tasks.filter((item) => item.parentId === taskId);
  return descendants.reduce((updated, child) => updated.concat(setTaskTreeCompletion(child.id, completed)), descendants);
}
function renderSummary() {
  const monthTasks = tasksForMonth();
  $("#totalTasks").textContent = state.tasks.length;
  $("#monthTasks").textContent = monthTasks.length;
  $("#activeTasks").textContent = state.tasks.filter((task) => task.startDate <= iso(new Date()) && task.endDate >= iso(new Date())).length;
  $("#monthLabel").textContent = monthLabel(state.month);
}
function taskStyle(task) { return `background:${priorityColors[task.priority || "medium"] || "#1f5f8b"};`; }
function taskMarkup(task, dateValue = "") {
  const parent = task.parentId ? state.tasks.find((item) => item.id === task.parentId) : null;
  const label = parent
    ? `<span class="task-title">${escapeHtml(parent.name)}</span><span class="subtask-title">${escapeHtml(task.name)}</span>`
    : `<span class="task-title">${escapeHtml(task.name)}</span>`;
  const plainLabel = parent ? `${parent.name} / ${task.name}` : task.name;
  const isDeadline = dateValue === task.endDate;
  const details = task.notes ? ` | ${task.notes}` : "";
  return `<div class="day-task ${task.completed ? "completed" : ""} ${isDeadline ? "deadline-task" : ""}" draggable="true" data-task-id="${task.id}" style="${taskStyle(task)}" title="${escapeHtml(plainLabel)} | ${formatDate(task.startDate)} - ${formatDate(task.endDate)}${isDeadline ? " · DEADLINE" : ""}${escapeHtml(details)}"><label class="task-check"><input type="checkbox" data-complete-id="${task.id}" data-complete-scope="single" ${task.completed ? "checked" : ""}><span></span></label>${label}<span>${task.estimatedHours} giờ · ${priorityLabels[task.priority || "medium"]}${isDeadline ? " · DEADLINE" : ""}</span></div>`;
}
function renderMonth() {
  const first = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start); date.setDate(start.getDate() + i);
    const tasks = calendarTasksOnDate(date);
    cells.push(`<div class="day-cell ${date.getMonth() !== state.month.getMonth() ? "outside" : ""} ${iso(date) === iso(new Date()) ? "today" : ""}" data-date="${iso(date)}"><div class="day-number">${date.getDate()}</div>${tasks.map((task) => taskMarkup(task, iso(date))).join("")}</div>`);
  }
  $("#calendarPanel").innerHTML = `<div class="calendar-header">${["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => `<div>${day}</div>`).join("")}</div><div class="calendar-grid">${cells.join("")}</div>`;
}
function renderAgenda() {
  const isDay = state.view === "day";
  const start = isDay ? new Date() : new Date(state.month.getFullYear(), state.month.getMonth(), 1);
  const count = isDay ? 1 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  let html = `<div class="${isDay ? "day-view" : "week-view"}"><h3>${isDay ? "Lịch hôm nay" : "Lịch tháng"}</h3>`;
  for (let i = 0; i < count; i += 1) {
    const date = new Date(start); date.setDate(start.getDate() + i);
    const tasks = calendarTasksOnDate(date);
    html += `<div class="agenda-row"><div class="agenda-date">${date.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}</div><div class="agenda-content">${tasks.length ? tasks.map((task) => taskMarkup(task, iso(date))).join("") : '<span class="muted">Không có task</span>'}</div></div>`;
  }
  $("#calendarPanel").innerHTML = `${html}</div>`;
}
function ganttRange() {
  const anchor = new Date(state.month);
  if (state.ganttPeriod === "day") {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return { start: date, end: date, labels: [date.getDate()] };
  }
  if (state.ganttPeriod === "week") {
    const start = new Date(anchor);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end, labels: Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date.getDate(); }) };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start, end, labels: Array.from({ length: end.getDate() }, (_, index) => index + 1) };
}
function tasksForGantt(range) {
  const start = iso(range.start);
  const end = iso(range.end);
  const visible = state.tasks.filter((task) => task.endDate >= start && task.startDate <= end);
  const parentIds = new Set(visible.map((task) => task.parentId).filter(Boolean));
  return sortTasks(state.tasks.filter((task) => visible.includes(task) || parentIds.has(task.id)));
}
function renderGantt() {
  const range = ganttRange();
  const tasks = tasksForGantt(range);
  const days = range.labels.length;
  const rangeStart = iso(range.start);
  const rangeEnd = iso(range.end);
  const heading = range.labels.map((label) => `<span>${label}</span>`).join("");
  const bar = (task, extraClass = "") => {
    const visibleStart = task.startDate < rangeStart ? rangeStart : task.startDate;
    const visibleEnd = task.endDate > rangeEnd ? rangeEnd : task.endDate;
    const start = Math.max(1, daysBetween(rangeStart, visibleStart));
    const end = Math.min(days, daysBetween(rangeStart, visibleEnd));
    const width = ((end - start + 1) / days) * 100;
    return `<div class="gantt-bar ${extraClass} ${task.completed ? "completed" : ""}" draggable="true" data-task-id="${task.id}" style="${taskStyle(task)};left:${((start - 1) / days) * 100}%;width:${width}%;" title="${escapeHtml(task.name)} | ${formatDate(task.startDate)} - ${formatDate(task.endDate)}">${escapeHtml(task.name)}</div>`;
  };
  const roots = tasks.filter((task) => !task.parentId);
  const rows = roots.map((root) => {
    const children = tasks.filter((task) => task.parentId === root.id);
    const groupTasks = [root, ...children];
    const groupStart = groupTasks.reduce((min, task) => task.startDate < min ? task.startDate : min, groupTasks[0].startDate);
    const groupEnd = groupTasks.reduce((max, task) => task.endDate > max ? task.endDate : max, groupTasks[0].endDate);
    const group = { ...root, startDate: groupStart, endDate: groupEnd };
    const timelineStyle = `style="grid-template-columns:repeat(${days},minmax(24px,1fr))"`;
    const parentRow = `<div class="gantt-group-row"><div class="gantt-label group-label"><label class="task-check"><input type="checkbox" data-complete-id="${root.id}" data-complete-scope="tree" ${root.completed ? "checked" : ""}><span></span></label><strong class="${root.completed ? "completed-text" : ""}">${escapeHtml(root.name)}</strong><small>${children.length} subtask · ${formatDate(groupStart)} - ${formatDate(groupEnd)}</small></div><div class="timeline" ${timelineStyle} data-date="${root.startDate}" data-task-id="${root.id}">${bar(group, "group-bar")}</div></div>`;
    const childRows = children.map((task) => `<div class="gantt-row"><div class="gantt-label child"><label class="task-check"><input type="checkbox" data-complete-id="${task.id}" data-complete-scope="single" ${task.completed ? "checked" : ""}><span></span></label><span class="tree-branch">└</span><strong class="${task.completed ? "completed-text" : ""}">${escapeHtml(task.name)}</strong><small class="muted">${formatDate(task.startDate)} - ${formatDate(task.endDate)} · ${task.estimatedHours} giờ</small></div><div class="timeline" ${timelineStyle} data-date="${task.startDate}" data-task-id="${task.id}">${bar(task, "child-bar")}</div></div>`).join("");
    return `<div class="gantt-group">${parentRow}${childRows}</div>`;
  }).join("");
  const periodButtons = ["day", "week", "month"].map((period) => `<button class="gantt-period ${state.ganttPeriod === period ? "active" : ""}" data-gantt-period="${period}">${period === "day" ? "Ngày" : period === "week" ? "Tuần" : "Tháng"}</button>`).join("");
  $("#calendarPanel").innerHTML = `<div class="gantt-wrap"><div class="gantt-toolbar"><strong>Gantt chart</strong><div class="gantt-periods">${periodButtons}</div></div><div class="gantt-head"><div>Task</div><div class="timeline" style="grid-template-columns:repeat(${days},minmax(24px,1fr))">${heading}</div></div>${rows || '<div class="empty">Chưa có task trong khoảng thời gian này.</div>'}</div>`;
  document.querySelectorAll("[data-gantt-period]").forEach((button) => button.addEventListener("click", () => { state.ganttPeriod = button.dataset.ganttPeriod; render(); }));
}
function render() {
  renderSummary();
  if (state.view === "month") renderMonth();
  else if (state.view === "gantt") renderGantt();
  else renderAgenda();
  bindDragEvents();
}
function openTaskDialog(task) {
  $("#taskForm").reset(); $("#formError").hidden = true; $("#taskId").value = task?.id || "";
  $("#dialogTitle").textContent = task ? "Chỉnh sửa task" : "Thêm task mới";
  const parentOptions = state.tasks.filter((item) => !item.parentId && item.id !== task?.id).map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  $("#parentId").innerHTML = `<option value="">Task gốc</option>${parentOptions}`;
  if (task) ["taskName", "startDate", "endDate", "estimatedHours", "taskType", "priority", "recurrence", "recurrenceEnd"].forEach((id) => { $(`#${id}`).value = ({ taskName: task.name, startDate: task.startDate, endDate: task.endDate, estimatedHours: task.estimatedHours, taskType: task.type, priority: task.priority || "medium", recurrence: task.recurrence || "", recurrenceEnd: task.recurrenceEnd || "" })[id] || ""; });
  if (task) $("#parentId").value = task.parentId || "";
  else { const today = iso(new Date()); $("#startDate").value = today; $("#endDate").value = today; $("#estimatedHours").value = 1; $("#priority").value = "medium"; $("#recurrence").value = ""; }
  $("#taskDialog").showModal();
}
function nextColor(index = state.tasks.length) { return ["#1f5f8b", "#7d2735", "#39846a", "#8b5e1f", "#5d478f", "#2f6d73"][index % 6]; }
function expandImportedRecurrence(task) {
  if (!task.recurrence) return [task];
  const firstDay = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
  const lastDay = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0);
  const recurrenceEnd = task.recurrenceEnd ? toDate(task.recurrenceEnd) : lastDay;
  const duration = daysBetween(task.startDate, task.endDate);
  const result = [];
  let occurrence = toDate(task.startDate);
  while (occurrence <= recurrenceEnd) {
    const occurrenceEnd = new Date(occurrence);
    occurrenceEnd.setDate(occurrenceEnd.getDate() + duration - 1);
    if (occurrence <= lastDay && occurrenceEnd >= firstDay) {
      const end = new Date(occurrence);
      end.setDate(end.getDate() + duration - 1);
      result.push({
        ...task,
        id: crypto.randomUUID(),
        startDate: iso(occurrence),
        endDate: iso(end),
        recurrence: "",
        recurrenceEnd: ""
      });
    }
    if (task.recurrence === "weekly") {
      occurrence.setDate(occurrence.getDate() + 7);
    } else {
      const originalDay = toDate(task.startDate).getDate();
      occurrence = new Date(occurrence.getFullYear(), occurrence.getMonth() + 1, 1);
      const lastOccurrenceDay = new Date(occurrence.getFullYear(), occurrence.getMonth() + 1, 0).getDate();
      occurrence.setDate(Math.min(originalDay, lastOccurrenceDay));
    }
  }
  return result;
}
function saveTask(event) {
  event.preventDefault();
  const values = { id: $("#taskId").value || crypto.randomUUID(), name: $("#taskName").value.trim(), parentId: $("#parentId").value, startDate: $("#startDate").value, endDate: $("#endDate").value, estimatedHours: Number($("#estimatedHours").value), type: $("#taskType").value.trim(), priority: $("#priority").value, recurrence: $("#recurrence").value, recurrenceEnd: $("#recurrenceEnd").value };
  if (!values.name || !values.startDate || !values.endDate || values.endDate < values.startDate) { $("#formError").textContent = "Vui lòng nhập đủ thông tin và bảo đảm ngày kết thúc không trước ngày bắt đầu."; $("#formError").hidden = false; return; }
  const index = state.tasks.findIndex((task) => task.id === values.id);
  if (index >= 0) state.tasks[index] = values; else state.tasks.push(values);
  save(); $("#taskDialog").close(); render(); showNotice(index >= 0 ? "Đã cập nhật task." : "Đã thêm task mới.", "success");
}
function showDeadlineModal(task) {
  const today = iso(new Date());
  const daysRemaining = Math.round((toDate(task.endDate) - toDate(today)) / 86400000);
  $("#deadlineTitle").textContent = daysRemaining < 0 ? "Task đã quá deadline" : "Cảnh báo deadline";
  $("#deadlineMessage").textContent = daysRemaining < 0
    ? `Task "${task.name}" đã quá deadline ${Math.abs(daysRemaining)} ngày (deadline: ${formatDate(task.endDate)}).`
    : daysRemaining === 0
      ? `Task "${task.name}" đến deadline hôm nay (${formatDate(task.endDate)}).`
      : `Task "${task.name}" còn ${daysRemaining} ngày đến deadline (${formatDate(task.endDate)}).`;
  $("#deadlineDialog").showModal();
}
function moveTask(id, targetDate) {
  const task = state.tasks.find((item) => item.id === id); if (!task) return;
  if (targetDate > task.endDate) {
    showNotice(`Không thể dồn task "${task.name}" sau deadline ${formatDate(task.endDate)}.`, "warning");
    return;
  }
  if (targetDate === task.startDate) return;
  task.startDate = targetDate;
  save(); render();
  showNotice(`Đã dồn task "${task.name}" và giữ nguyên deadline.`, "success");
  showDeadlineModal(task);
}
function deleteTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const descendants = [];
  const collectDescendants = (parentId) => {
    state.tasks.filter((item) => item.parentId === parentId).forEach((child) => {
      descendants.push(child);
      collectDescendants(child.id);
    });
  };
  collectDescendants(taskId);
  const suffix = descendants.length ? ` và ${descendants.length} task con` : "";
  if (!window.confirm(`Bạn có chắc muốn xóa task "${task.name}"${suffix} không?`)) return;
  const idsToDelete = new Set([taskId, ...descendants.map((item) => item.id)]);
  state.tasks = state.tasks.filter((item) => !idsToDelete.has(item.id));
  save();
  render();
  showNotice(`Đã xóa task "${task.name}"${suffix}.`, "success");
}
function bindDragEvents() {
  document.querySelectorAll("[data-task-id][draggable='true']").forEach((element) => {
    element.addEventListener("dragstart", () => { state.draggedTaskId = element.dataset.taskId; });
    element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      deleteTask(element.dataset.taskId);
    });
  });
  document.querySelectorAll("[data-complete-id]").forEach((element) => element.addEventListener("change", () => {
    const task = state.tasks.find((item) => item.id === element.dataset.completeId);
    if (!task) return;
    const isGanttParent = state.view === "gantt" && element.dataset.completeScope === "tree";
    const updated = isGanttParent ? setTaskTreeCompletion(task.id, element.checked) : setSingleTaskCompletion(task.id, element.checked);
    save();
    render();
    const suffix = updated.length ? ` và ${updated.length} task con` : "";
    showNotice(task.completed ? `Đã đánh dấu hoàn thành task "${task.name}"${suffix}.` : `Đã hoàn tác task "${task.name}"${suffix}.`, "success");
  }));
  document.querySelectorAll(".task-check").forEach((element) => element.addEventListener("click", (event) => event.stopPropagation()));
  document.querySelectorAll(".day-cell, .timeline[data-date]").forEach((element) => element.addEventListener("dragover", (event) => event.preventDefault()));
  document.querySelectorAll(".day-cell").forEach((element) => element.addEventListener("drop", () => moveTask(state.draggedTaskId, element.dataset.date)));
  document.querySelectorAll(".timeline[data-date]").forEach((element) => element.addEventListener("drop", () => moveTask(state.draggedTaskId, element.dataset.date)));
}
function exportExcel(filename = `task-board-${monthKey(state.month)}.xlsx`) {
  if (!window.XLSX) { showNotice("Thư viện Excel chưa tải xong. Hãy thử lại sau ít giây."); return; }
  const rows = taskRows(state.tasks);
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Tasks"); XLSX.writeFile(workbook, filename);
}
function importExcel(file) {
  if (!window.XLSX) { showNotice("Thư viện Excel chưa tải xong. Hãy thử lại sau ít giây."); return; }
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const workbook = XLSX.read(event.target.result, { type: "array", cellDates: true });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const imported = rows.map((row, index) => {
        const get = (...keys) => { const key = keys.find((candidate) => Object.prototype.hasOwnProperty.call(row, candidate)); return key ? row[key] : ""; };
        const dateValue = (value) => value instanceof Date ? iso(value) : String(value).slice(0, 10);
        const startDate = dateValue(get("Ngày bắt đầu", "Start Date", "startDate")); const endDate = dateValue(get("Ngày kết thúc", "End Date", "endDate"));
        const importedPriority = String(get("Mức độ ưu tiên", "Priority", "priority")).toLowerCase();
        const priority = importedPriority.includes("khẩn") || importedPriority === "urgent" ? "urgent" : importedPriority.includes("cao") || importedPriority === "high" ? "high" : importedPriority.includes("thấp") || importedPriority === "low" ? "low" : "medium";
        const completed = ["có", "yes", "true", "1"].includes(String(get("Đã xong", "Completed", "completed")).toLowerCase());
        const recurrenceValue = String(get("Lặp lại", "Recurrence", "recurrence")).toLowerCase();
        const recurrence = recurrenceValue.includes("tuần") || recurrenceValue === "weekly" ? "weekly" : recurrenceValue.includes("tháng") || recurrenceValue === "monthly" ? "monthly" : "";
        return { id: crypto.randomUUID(), name: String(get("Task", "task", "Tên task")).trim(), parentName: String(get("Task cha", "Parent Task", "parentName")).trim(), legacySubtask: String(get("Subtask", "subtask", "Sub-task")).trim(), startDate, endDate, estimatedHours: Number(get("Thời gian làm dự kiến (giờ)", "Thời gian làm dự kiến", "Estimated Hours")) || 0, type: String(get("Loại công việc", "Type", "type")).trim(), priority, completed, completedAt: completed ? String(get("Thời gian hoàn thành", "Completed At", "completedAt")).trim() : "", recurrence, recurrenceEnd: dateValue(get("Kết thúc lặp", "Recurrence End", "recurrenceEnd")) };
      }).filter((task) => task.name && /^\d{4}-\d{2}-\d{2}$/.test(task.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(task.endDate));
      const parsed = imported.flatMap(expandImportedRecurrence);
      if (!parsed.length) throw new Error("Không tìm thấy dòng dữ liệu hợp lệ.");
      const byName = new Map(parsed.map((task) => [task.name, task.id]));
      parsed.forEach((task) => {
        task.parentId = byName.get(task.parentName) || "";
        delete task.parentName;
        if (task.legacySubtask) {
          parsed.push({ id: crypto.randomUUID(), name: task.legacySubtask, parentId: task.id, startDate: task.startDate, endDate: task.endDate, estimatedHours: 0, type: task.type, priority: "medium", completed: false });
        }
        delete task.legacySubtask;
        delete task.recurrence;
        delete task.recurrenceEnd;
      });
      const replace = window.confirm("Chọn OK để thay toàn bộ dữ liệu tháng hiện tại, hoặc Cancel để bổ sung task vào dữ liệu đang có.");
      state.tasks = replace ? parsed : state.tasks.concat(parsed); save(); render(); showNotice(`Đã import ${parsed.length} task.`, "success");
    } catch (error) { showNotice(`Import thất bại: ${error.message}`); }
  };
  reader.readAsArrayBuffer(file);
}
function maybeAutoExport() {
  const today = new Date(); const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  if (today.getDate() === last.getDate() && localStorage.getItem(`task-board-exported-${monthKey(today)}`) !== "yes") { exportExcel(); localStorage.setItem(`task-board-exported-${monthKey(today)}`, "yes"); showNotice("Đã tự động tạo file Excel tổng hợp cuối tháng.", "success"); }
}
$("#addTaskBtn").addEventListener("click", () => openTaskDialog());
$("#taskForm").addEventListener("submit", saveTask);
$("#cancelTaskBtn").addEventListener("click", () => $("#taskDialog").close());
$("#closeTaskDialog").addEventListener("click", () => $("#taskDialog").close());
$("#previousMonth").addEventListener("click", () => { state.month.setMonth(state.month.getMonth() - 1); render(); });
$("#nextMonth").addEventListener("click", () => { state.month.setMonth(state.month.getMonth() + 1); render(); });
$("#todayBtn").addEventListener("click", () => { state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); render(); });
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => { state.view = tab.dataset.view; document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab)); render(); }));
$("#exportBtn").addEventListener("click", () => exportExcel());
$("#templateBtn").addEventListener("click", () => {
  if (!window.XLSX) { showNotice("Thư viện Excel chưa tải xong. Hãy thử lại sau ít giây."); return; }
  const rows = taskRows(demoTasks());
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Tasks");
  XLSX.writeFile(workbook, "task-board-template.xlsx");
  showNotice("Đã tải file mẫu gồm các trường và dữ liệu minh họa.", "success");
});
$("#importInput").addEventListener("change", (event) => { if (event.target.files[0]) importExcel(event.target.files[0]); event.target.value = ""; });
$("#settingsBtn").addEventListener("click", () => {
  $("#driveFolder").value = readSettings().driveFolder || "";
  $("#driveStatus").textContent = driveToken ? "Đã kết nối Google Drive trong phiên này." : "Chưa kết nối Google Drive.";
  $("#settingsDialog").showModal();
});
$("#closeSettingsDialog").addEventListener("click", () => $("#settingsDialog").close());
$("#closeDeadlineDialog").addEventListener("click", () => $("#deadlineDialog").close());
$("#ackDeadlineBtn").addEventListener("click", () => $("#deadlineDialog").close());
$("#settingsForm").addEventListener("submit", (event) => { event.preventDefault(); if (!saveSettings()) return; $("#settingsDialog").close(); showNotice("Đã lưu cài đặt trên trình duyệt.", "success"); });
$("#openDriveBtn").addEventListener("click", () => { const link = $("#driveFolder").value.trim(); if (link) window.open(link, "_blank", "noopener"); else showNotice("Hãy nhập link thư mục Google Drive trước."); });
$("#connectDriveBtn").addEventListener("click", async () => {
  try {
    await requestDriveToken();
    $("#driveStatus").textContent = "Đã kết nối Google Drive trong phiên này.";
    showNotice("Đã kết nối Google Drive.", "success");
  } catch (error) {
    showNotice(`Kết nối Google Drive thất bại: ${error.message}`);
  }
});
$("#uploadDriveBtn").addEventListener("click", async () => {
  try {
    if (!saveSettings()) return;
    await uploadMonthToDrive();
    $("#settingsDialog").close();
    showNotice(`Đã lưu file Excel tháng ${monthKey(state.month)} vào Google Drive.`, "success");
  } catch (error) {
    showNotice(`Lưu Google Drive thất bại: ${error.message}`);
  }
});
$("#clearDataBtn").addEventListener("click", () => {
  if (!window.confirm("Bạn có chắc muốn xóa toàn bộ task và dữ liệu đã lưu không?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(DEMO_KEY, "yes");
  state.tasks = [];
  $("#settingsDialog").close();
  render();
  showNotice("Đã xóa sạch toàn bộ dữ liệu task. File mẫu mặc định vẫn có thể tải lại.", "success");
});
load(); render(); maybeAutoExport();

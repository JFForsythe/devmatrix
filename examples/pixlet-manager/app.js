// SPDX-License-Identifier: GPL-3.0-or-later

const csrf = document.querySelector('meta[name="devmatrix-csrf"]').content;
const elements = Object.fromEntries(
  [
    "app-editor",
    "app-search",
    "catalog-count",
    "catalog-results",
    "clear-editor",
    "code-field",
    "compatibility-badge",
    "compatibility-note",
    "config-mode",
    "config-path",
    "console-link",
    "device-status",
    "duration",
    "empty-editor",
    "pair-address",
    "pair-code",
    "pair-copy",
    "pair-finish",
    "pair-start",
    "pair-steps",
    "preview-app",
    "preview-image",
    "preview-placeholder",
    "push-app",
    "refresh",
    "rotation-count",
    "rotation-list",
    "save-app",
    "selected-name",
    "selected-summary",
    "settings-fields",
    "settings-form",
    "toast",
  ].map(id => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]),
);

let state = null;
let selectedApp = null;
let selectedSchema = null;
let editingIndex = null;
let previewUrl = "";
let searchTimer = null;
let toastTimer = null;

async function api(route, { body, blob = false, method = "GET" } = {}) {
  const headers = { "X-Devmatrix-CSRF": csrf };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(route, {
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    headers,
    method,
  });
  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status}).`;
    try {
      const result = await response.json();
      if (result.error) message = result.error;
      if (result.details?.attemptsLeft !== undefined) message += ` ${result.details.attemptsLeft} attempts left.`;
    } catch {
      // The status is enough when a non-JSON response is returned.
    }
    throw new Error(message);
  }
  return blob ? response.blob() : response.json();
}

function node(tag, options = {}, children = []) {
  const item = document.createElement(tag);
  if (options.className) item.className = options.className;
  if (options.text !== undefined) item.textContent = String(options.text);
  if (options.type) item.type = options.type;
  for (const [name, value] of Object.entries(options.attributes || {})) {
    if (value !== undefined && value !== null) item.setAttribute(name, String(value));
  }
  for (const child of children) item.append(child);
  return item;
}

function toast(message, error = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", error);
  elements.toast.classList.remove("hidden");
  toastTimer = setTimeout(() => elements.toast.classList.add("hidden"), error ? 6500 : 3800);
}

async function busy(button, pendingLabel, operation) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = pendingLabel;
  try {
    return await operation();
  } catch (error) {
    toast(error.message, true);
    return null;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function updateState(next) {
  state = next;
  elements.deviceStatus.textContent = `${state.device.url} · ${state.tokenConfigured ? "paired locally" : "not paired"}`;
  elements.deviceStatus.style.color = state.tokenConfigured ? "var(--accent)" : "var(--warning)";
  elements.pairCopy.textContent = state.tokenConfigured
    ? "Paired. The hidden LAN token is stored only on this computer."
    : "Pair with the six-digit panel code. The LAN token never enters this page.";
  elements.pairStart.textContent = state.tokenConfigured ? "Pair again" : "Show pair code";
  elements.pairAddress.textContent = state.device.url;
  elements.consoleLink.href = state.device.url;
  elements.pairSteps.classList.toggle("hidden", state.tokenConfigured);
  elements.rotationCount.textContent = String(state.rotation.length);
  elements.configPath.textContent = state.configPath;
  elements.configMode.textContent = `private mode ${state.configMode}`;
  renderRotation();
}

async function loadState() {
  updateState(await api("/api/state"));
}

function renderRotation() {
  elements.rotationList.replaceChildren();
  state.rotation.forEach((slot, index) => {
    const position = node("span", { className: "rotation-index", text: String(index + 1).padStart(2, "0") });
    const name = node("strong", { text: slot.app });
    const detail = node("span", { text: `${slot.duration_s}s on · ${slot.render_interval_s}s refresh · ${slot.settingCount} settings` });
    const info = node("div", { className: "rotation-info" }, [name, detail]);
    const actions = node("div", { className: "rotation-actions" });
    const edit = node("button", { className: "icon-button", text: "✎", type: "button", attributes: { "aria-label": `Edit ${slot.app}`, title: "Edit" } });
    const up = node("button", { className: "icon-button", text: "↑", type: "button", attributes: { "aria-label": `Move ${slot.app} up`, title: "Move up" } });
    const down = node("button", { className: "icon-button", text: "↓", type: "button", attributes: { "aria-label": `Move ${slot.app} down`, title: "Move down" } });
    const remove = node("button", { className: "icon-button danger", text: "×", type: "button", attributes: { "aria-label": `Remove ${slot.app}`, title: "Remove" } });
    up.disabled = index === 0;
    down.disabled = index === state.rotation.length - 1;
    remove.disabled = state.rotation.length === 1;
    edit.addEventListener("click", () => editRotation(index));
    up.addEventListener("click", () => moveRotation(index, index - 1, up));
    down.addEventListener("click", () => moveRotation(index, index + 1, down));
    remove.addEventListener("click", () => removeRotation(index, remove));
    actions.append(edit, up, down, remove);
    const row = node("div", { className: "rotation-item" }, [position, info, actions]);
    if (!slot.catalogKnown) row.title = "This app is not present in the current catalog checkout.";
    elements.rotationList.append(row);
  });
}

async function searchCatalog(query = "") {
  elements.catalogResults.setAttribute("aria-busy", "true");
  try {
    const result = await api(`/api/catalog?q=${encodeURIComponent(query)}`);
    elements.catalogCount.textContent = result.total > result.apps.length ? `${result.apps.length}/${result.total}` : String(result.total);
    elements.catalogResults.replaceChildren();
    if (result.apps.length === 0) {
      elements.catalogResults.append(node("p", { className: "notice", text: "No community apps matched that search." }));
      return;
    }
    for (const app of result.apps) {
      const button = node("button", { className: `app-result${selectedApp?.app === app.app ? " active" : ""}`, type: "button" });
      const title = node("strong", { text: app.name });
      const summary = node("span", { text: app.summary });
      const meta = node("span", { className: "app-meta", text: `${app.category} · ${app.author}` });
      button.append(title, summary, meta);
      button.addEventListener("click", () => selectApp(app, null));
      elements.catalogResults.append(button);
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    elements.catalogResults.removeAttribute("aria-busy");
  }
}

async function metadataFor(appKey) {
  const result = await api(`/api/catalog?q=${encodeURIComponent(appKey)}`);
  return result.apps.find(app => app.app === appKey) || {
    app: appKey,
    category: "community",
    name: appKey,
    summary: "Community Pixlet app",
  };
}

async function editRotation(index) {
  const slot = state.rotation[index];
  if (!slot.catalogKnown) {
    toast(`${slot.app} is missing from this catalog checkout.`, true);
    return;
  }
  try {
    await selectApp(await metadataFor(slot.app), index);
  } catch (error) {
    toast(error.message, true);
  }
}

async function selectApp(app, index) {
  selectedApp = app;
  selectedSchema = null;
  editingIndex = index;
  elements.emptyEditor.classList.add("hidden");
  elements.appEditor.classList.remove("hidden");
  elements.selectedName.textContent = app.name;
  elements.selectedSummary.textContent = app.summary;
  elements.compatibilityBadge.textContent = "Reading schema…";
  elements.compatibilityBadge.className = "compatibility";
  elements.compatibilityNote.classList.add("hidden");
  elements.settingsFields.replaceChildren(node("p", { className: "notice", text: "Reading this app’s Pixlet settings…" }));
  if (index === null) {
    elements.duration.value = "15";
    elements.refresh.value = String(Math.max(0, Number(app.recommendedInterval || 5) * 60));
    elements.saveApp.textContent = "Add to rotation";
  } else {
    const slot = state.rotation[index];
    elements.duration.value = String(slot.duration_s);
    elements.refresh.value = String(slot.render_interval_s);
    elements.saveApp.textContent = "Update rotation";
  }
  resetPreview();
  await searchCatalog(elements.appSearch.value);
  try {
    selectedSchema = await api("/api/schema", { body: { app: app.app, index }, method: "POST" });
    renderSchema(selectedSchema);
  } catch (error) {
    elements.settingsFields.replaceChildren(node("p", { className: "notice", text: error.message }));
    elements.compatibilityBadge.textContent = "Schema failed";
    elements.compatibilityBadge.className = "compatibility partial";
    toast(error.message, true);
  }
}

function renderSchema(schema) {
  const compatibility = schema.compatibility;
  elements.compatibilityBadge.textContent = compatibility.status === "ready" ? "Ready in Easy Mode" : "Partial support";
  elements.compatibilityBadge.className = `compatibility ${compatibility.status}`;
  const notices = [];
  if (compatibility.status !== "ready") notices.push(compatibility.summary);
  if (schema.preservedUnknownFields.length) {
    notices.push(`${schema.preservedUnknownFields.length} existing custom setting${schema.preservedUnknownFields.length === 1 ? " is" : "s are"} hidden and will be preserved.`);
  }
  elements.compatibilityNote.textContent = notices.join(" ");
  elements.compatibilityNote.classList.toggle("hidden", notices.length === 0);
  elements.settingsFields.replaceChildren();
  const editableFields = schema.fields.filter(field => field.id || field.type === "generated");
  if (editableFields.length === 0) {
    elements.settingsFields.append(node("p", { className: "notice", text: "No settings required. Preview it or add it to your rotation." }));
    return;
  }
  editableFields.forEach(field => elements.settingsFields.append(renderField(field)));
}

function fieldShell(field, control, full = false) {
  const labelText = node("span", { text: field.name });
  const type = node("span", { className: "eyebrow", text: field.secret ? "SECRET" : field.type.toUpperCase() });
  const label = node("div", { className: "field-label" }, [labelText, type]);
  const description = node("small", { text: field.description || " " });
  return node("label", { className: `field${full ? " full" : ""}` }, [label, control, description]);
}

function renderField(field) {
  if (!["color", "datetime", "dropdown", "location", "onoff", "text"].includes(field.type)) {
    const block = node("div", { className: "unsupported-field" }, [
      node("strong", { text: `${field.name} · ${field.type}` }),
      node("p", { text: "Needs the upstream Pixlet dynamic, OAuth, or upload interface. Any existing value is preserved." }),
    ]);
    return node("div", { className: "field full" }, [block]);
  }

  const common = { "data-field-id": field.id, "data-field-type": field.type };
  if (field.type === "onoff") {
    const input = node("input", { type: "checkbox", attributes: { ...common, class: "config-control" } });
    input.className = "config-control";
    input.checked = field.value === true || field.value === "true";
    return fieldShell(field, node("div", { className: "toggle-control" }, [input, node("span", { text: "Enabled" })]));
  }
  if (field.type === "dropdown") {
    const select = node("select", { attributes: { ...common } });
    select.className = "config-control";
    for (const option of field.options || []) {
      const item = node("option", { text: option.label, attributes: { value: option.value } });
      if (String(option.value) === String(field.value ?? "")) item.selected = true;
      select.append(item);
    }
    if (!field.options?.length) select.append(node("option", { text: "No options supplied", attributes: { value: "" } }));
    return fieldShell(field, select);
  }
  if (field.type === "location") {
    let value = {};
    try {
      value = typeof field.value === "string" ? JSON.parse(field.value) : field.value || {};
    } catch {
      value = {};
    }
    const timezone = value.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const location = node("div", { className: "location-grid location-control", attributes: common });
    const part = (name, placeholder, partValue, className = "") => {
      const input = node("input", { attributes: { "data-location-part": name, placeholder, value: partValue ?? "" } });
      if (className) input.className = className;
      return input;
    };
    location.append(
      part("description", "City or label", value.description || value.locality, "wide"),
      part("lat", "Latitude", value.lat),
      part("lng", "Longitude", value.lng),
      part("timezone", "Timezone, e.g. America/Chicago", timezone, "wide"),
    );
    return fieldShell(field, location, true);
  }

  const type = field.secret ? "password" : field.type === "datetime" ? "datetime-local" : field.type === "color" ? "color" : "text";
  const input = node("input", {
    type,
    attributes: {
      ...common,
      autocomplete: field.secret ? "off" : undefined,
      class: "config-control",
      placeholder: field.secret && field.configured ? "Stored — leave blank to keep" : "",
      value: field.secret ? "" : normalizeInputValue(field),
    },
  });
  input.className = "config-control";
  if (field.secret) input.dataset.secret = "true";
  const shell = fieldShell(field, input, field.type === "text");
  if (field.secret && field.configured) shell.querySelector("small").classList.add("secret-note");
  return shell;
}

function normalizeInputValue(field) {
  const value = String(field.value ?? "");
  if (field.type !== "color") return value;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) return `#${[...value.slice(1)].map(character => character.repeat(2)).join("")}`;
  return "#ffffff";
}

function collectConfig() {
  const config = {};
  for (const control of elements.settingsFields.querySelectorAll(".config-control")) {
    const id = control.dataset.fieldId;
    if (!id) continue;
    if (control.dataset.secret === "true" && control.value === "") continue;
    config[id] = control.type === "checkbox" ? control.checked : control.value;
  }
  for (const control of elements.settingsFields.querySelectorAll(".location-control")) {
    const parts = {};
    for (const input of control.querySelectorAll("[data-location-part]")) parts[input.dataset.locationPart] = input.value.trim();
    const hasCoordinates = parts.lat !== "" || parts.lng !== "";
    // An empty submission clears the stored location on the server.
    config[control.dataset.fieldId] = hasCoordinates ? parts : "";
  }
  return config;
}

function currentRequest() {
  if (!selectedApp || !selectedSchema) throw new Error("Wait for this app’s settings to finish loading.");
  return {
    app: selectedApp.app,
    config: collectConfig(),
    duration_s: Number(elements.duration.value),
    index: editingIndex,
    render_interval_s: Number(elements.refresh.value),
  };
}

function resetPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = "";
  elements.previewImage.removeAttribute("src");
  elements.previewImage.classList.add("hidden");
  elements.previewPlaceholder.classList.remove("hidden");
}

async function preview() {
  await busy(elements.previewApp, "Rendering…", async () => {
    const image = await api("/api/render", { blob: true, body: currentRequest(), method: "POST" });
    resetPreview();
    previewUrl = URL.createObjectURL(image);
    elements.previewImage.src = previewUrl;
    elements.previewImage.classList.remove("hidden");
    elements.previewPlaceholder.classList.add("hidden");
    toast("Preview rendered at the panel’s exact 64 × 32 resolution.");
  });
}

async function pushOnce() {
  await busy(elements.pushApp, "Sending…", async () => {
    await api("/api/push-once", { body: currentRequest(), method: "POST" });
    toast(`${selectedApp.name} was rendered and shown on the panel once.`);
  });
}

async function saveRotation(event) {
  event.preventDefault();
  await busy(elements.saveApp, "Saving…", async () => {
    const request = currentRequest();
    const next = await api("/api/rotation/upsert", {
      body: {
        index: editingIndex,
        revision: state.revision,
        slot: {
          app: request.app,
          config: request.config,
          duration_s: request.duration_s,
          render_interval_s: request.render_interval_s,
        },
      },
      method: "POST",
    });
    const wasNew = editingIndex === null;
    updateState(next);
    if (wasNew) editingIndex = next.rotation.length - 1;
    elements.saveApp.textContent = "Update rotation";
    toast(wasNew ? `${selectedApp.name} was added to the rotation.` : `${selectedApp.name} was updated.`);
  });
}

async function moveRotation(from, to, button) {
  await busy(button, "…", async () => {
    const next = await api("/api/rotation/move", { body: { from, revision: state.revision, to }, method: "POST" });
    if (editingIndex === from) editingIndex = to;
    else if (editingIndex === to) editingIndex = from;
    updateState(next);
  });
}

async function removeRotation(index, button) {
  await busy(button, "…", async () => {
    const removed = state.rotation[index];
    const next = await api("/api/rotation/remove", { body: { index, revision: state.revision }, method: "POST" });
    if (editingIndex === index) clearEditor();
    else if (editingIndex !== null && editingIndex > index) editingIndex -= 1;
    updateState(next);
    toast(`${removed.app} was removed from the rotation.`);
  });
}

function clearEditor() {
  selectedApp = null;
  selectedSchema = null;
  editingIndex = null;
  resetPreview();
  elements.appEditor.classList.add("hidden");
  elements.emptyEditor.classList.remove("hidden");
  searchCatalog(elements.appSearch.value);
}

async function pairStart() {
  await busy(elements.pairStart, "Starting…", async () => {
    const result = await api("/api/pair/start", { body: {}, method: "POST" });
    elements.codeField.classList.remove("hidden");
    elements.pairFinish.classList.remove("hidden");
    elements.pairCode.focus();
    elements.pairCopy.textContent = `Enter the code now showing on the panel. It expires in about ${result.expires_s} seconds.`;
  });
}

async function pairFinish() {
  await busy(elements.pairFinish, "Pairing…", async () => {
    const result = await api("/api/pair/finish", { body: { code: elements.pairCode.value }, method: "POST" });
    elements.pairCode.value = "";
    elements.codeField.classList.add("hidden");
    elements.pairFinish.classList.add("hidden");
    await loadState();
    toast(`Paired with ${result.device}${result.fingerprint ? ` · ${result.fingerprint}` : ""}. Token hidden.`);
  });
}

elements.appSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchCatalog(elements.appSearch.value), 160);
});
elements.clearEditor.addEventListener("click", clearEditor);
elements.pairStart.addEventListener("click", pairStart);
elements.pairFinish.addEventListener("click", pairFinish);
elements.pairCode.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    pairFinish();
  }
});
elements.previewApp.addEventListener("click", preview);
elements.pushApp.addEventListener("click", pushOnce);
elements.settingsForm.addEventListener("submit", saveRotation);
window.addEventListener("beforeunload", resetPreview);

Promise.all([loadState(), searchCatalog()]).catch(error => toast(error.message, true));

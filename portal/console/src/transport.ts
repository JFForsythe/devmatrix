// SPDX-License-Identifier: GPL-3.0-or-later
import { FRAME_BYTES } from "./frame";
import { makeNonce, verifyIdentity, type DeviceIdentity } from "./identity";
import { createMockState, MOCK_ADDRESS, MOCK_FLEET, MOCK_TOKEN, type MockState } from "./mock";
import type {
  ActionResult,
  AppsSettings,
  ConsoleMode,
  CustomLayout,
  DeviceInfo,
  DeviceSettings,
  FleetDevice,
  FlightsSettings,
  Health,
  MessagesSettings,
  MqttSettings,
} from "./types";

const TOKEN_KEY = "dmx_token";
const DEVICE_KEY = "dmx_device_address";
const PUBKEY_KEY = "dmx_device_pubkey";
const FINGERPRINT_KEY = "dmx_device_fp";
const SERIAL_KEY = "dmx_device_serial";

type PairingListener = () => void;
type ReachabilityListener = (online: boolean) => void;

/** What ConsoleTransport.connectDevice learned about the box at `address`. */
export interface ConnectResult {
  health: Health;
  identity: DeviceIdentity | null;
  /**
   * "verified"      — nonce signature valid, key pinned (or matched the pin)
   * "legacy"        — firmware predates /api/v1/identity (< 0.9.0)
   * "mismatch"      — signature valid but the key differs from the pin
   * "bad-signature" — the identity endpoint answered but the proof failed
   */
  identityStatus: "verified" | "legacy" | "mismatch" | "bad-signature";
}

function storageGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A privacy-restricted browser can still use the token for this page load.
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing else to clear.
  }
}

function normalizeAddress(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: abort.signal });
    if (!response.ok) throw new Error(`The device answered HTTP ${response.status}.`);
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name !== "AbortError" && error.message.startsWith("The device")) throw error;
    throw new Error(
      "Could not reach the panel from this page. Check that this computer is on the same " +
        "Wi-Fi network, and allow the browser's local-network permission if it asks. " +
        "On Safari, open the panel's address directly instead — it serves this same Console itself.",
    );
  } finally {
    window.clearTimeout(timer);
  }
}

function errorText(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export class ConsoleTransport {
  readonly mode: ConsoleMode;
  readonly baseUrl: string;
  /** True on the hosted bundle when no device is stored: show the welcome flow. */
  readonly needsWelcome: boolean;
  private token: string;
  private online = true;
  private readonly mock: MockState;
  private pairingListener: PairingListener | undefined;
  private reachabilityListener: ReachabilityListener | undefined;
  private pairingPromise: Promise<void> | undefined;
  private resolvePairing: (() => void) | undefined;
  private rejectPairing: ((reason: Error) => void) | undefined;

  constructor() {
    const params = new URLSearchParams(window.location.search);
    const requestedAddress = normalizeAddress(params.get("device") ?? "");
    if (requestedAddress) storageSet(DEVICE_KEY, requestedAddress);

    const storedAddress = normalizeAddress(storageGet(DEVICE_KEY));
    const deviceBuild = import.meta.env.MODE === "device";
    const handoffToken = deviceBuild && window.location.hash.startsWith("#t=")
      ? window.location.hash.slice(3)
      : "";
    if (handoffToken) {
      storageSet(TOKEN_KEY, handoffToken);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    this.mode = deviceBuild || requestedAddress || storedAddress ? "live" : "mock";
    this.baseUrl = deviceBuild ? "" : requestedAddress || storedAddress;
    this.needsWelcome = this.mode === "mock";
    this.token = this.mode === "mock" ? MOCK_TOKEN : handoffToken || storageGet(TOKEN_KEY);
    this.mock = createMockState();
  }

  get isMock(): boolean {
    return this.mode === "mock";
  }

  get address(): string {
    return this.isMock ? MOCK_ADDRESS : this.baseUrl || window.location.origin;
  }

  get host(): string {
    return this.address.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  getToken(): string {
    return this.token;
  }

  setPairingListener(listener: PairingListener): void {
    this.pairingListener = listener;
  }

  setReachabilityListener(listener: ReachabilityListener): void {
    this.reachabilityListener = listener;
  }

  get isOnline(): boolean {
    return this.online;
  }

  get pinnedFingerprint(): string {
    return storageGet(FINGERPRINT_KEY);
  }

  private noteReachability(online: boolean): void {
    if (this.online !== online) {
      this.online = online;
      this.reachabilityListener?.(online);
    }
  }

  /**
   * Reach the box at `address`, prove it is the box (signed nonce), and pin
   * its identity key. On success the address is stored and the page reloads
   * into live mode — pairing follows on the first authenticated call.
   * On "mismatch" nothing is stored; the caller must warn loudly.
   */
  async connectDevice(address: string, allowLegacy = false): Promise<ConnectResult> {
    const base = normalizeAddress(address);
    if (!base) throw new Error("Enter the address shown on the panel, like dmx-4e71.local.");

    const health = await fetchJson<Health>(`${base}/api/v1/health`, {}, 8000);
    let identity: DeviceIdentity | null = null;
    let identityStatus: ConnectResult["identityStatus"] = "legacy";

    const nonce = makeNonce();
    let verifyResponse: Response | null = null;
    try {
      verifyResponse = await fetch(`${base}/api/v1/identity/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce }),
      });
    } catch {
      verifyResponse = null; // treated as legacy firmware below
    }
    if (verifyResponse?.ok) {
      identity = (await verifyResponse.json()) as DeviceIdentity;
      if (!(await verifyIdentity(identity, nonce))) {
        return { health, identity, identityStatus: "bad-signature" };
      }
      const pinned = storageGet(PUBKEY_KEY);
      const sameDevice = storageGet(SERIAL_KEY) === identity.device;
      if (pinned && sameDevice && pinned !== identity.pubkey) {
        return { health, identity, identityStatus: "mismatch" };
      }
      identityStatus = "verified";
    }

    if (identityStatus === "legacy" && !allowLegacy) {
      return { health, identity, identityStatus };
    }

    // A token from a previously connected box will not open this one.
    if (storageGet(SERIAL_KEY) && storageGet(SERIAL_KEY) !== health.device) {
      storageRemove(TOKEN_KEY);
    }
    storageSet(DEVICE_KEY, base);
    storageSet(SERIAL_KEY, health.device);
    if (identity && identityStatus === "verified") {
      storageSet(PUBKEY_KEY, identity.pubkey);
      storageSet(FINGERPRINT_KEY, identity.fingerprint);
    }
    return { health, identity, identityStatus };
  }

  /** The caller confirmed a key change (reflash/factory reset): re-pin. */
  trustNewIdentity(identity: DeviceIdentity): void {
    storageSet(PUBKEY_KEY, identity.pubkey);
    storageSet(FINGERPRINT_KEY, identity.fingerprint);
    storageRemove(TOKEN_KEY);
  }

  /** Forget this browser's device: address, token, and pinned key. */
  forgetDevice(): void {
    storageRemove(DEVICE_KEY);
    storageRemove(TOKEN_KEY);
    storageRemove(PUBKEY_KEY);
    storageRemove(FINGERPRINT_KEY);
    storageRemove(SERIAL_KEY);
  }

  /**
   * Re-run the signed-nonce proof against the connected device. Returns the
   * fresh identity plus whether the signature and the pin both held.
   */
  async verifyNow(): Promise<{ identity: DeviceIdentity; verified: boolean; pinMatch: boolean }> {
    if (this.isMock) {
      const identity = { device: this.mock.info.device, alg: "ed25519", pubkey: "(demo)", fingerprint: "DEMO-MODE" };
      return { identity, verified: true, pinMatch: true };
    }
    const nonce = makeNonce();
    const identity = await this.request<DeviceIdentity>(
      "/api/v1/identity/verify",
      { method: "POST", body: JSON.stringify({ nonce }) },
      true,
    );
    const verified = await verifyIdentity(identity, nonce);
    const pinned = storageGet(PUBKEY_KEY);
    const pinMatch = !pinned || pinned === identity.pubkey;
    if (verified && !pinned) {
      storageSet(PUBKEY_KEY, identity.pubkey);
      storageSet(FINGERPRINT_KEY, identity.fingerprint);
      storageSet(SERIAL_KEY, identity.device);
    }
    return { identity, verified, pinMatch };
  }

  private waitForPairing(): Promise<void> {
    if (!this.pairingPromise) {
      this.pairingPromise = new Promise<void>((resolve, reject) => {
        this.resolvePairing = resolve;
        this.rejectPairing = reject;
      });
    }
    this.pairingListener?.();
    return this.pairingPromise;
  }

  cancelPairing(): void {
    this.rejectPairing?.(new Error("Pairing was cancelled."));
    this.pairingPromise = undefined;
    this.resolvePairing = undefined;
    this.rejectPairing = undefined;
  }

  private finishPairing(token: string): void {
    this.token = token;
    storageSet(TOKEN_KEY, token);
    this.resolvePairing?.();
    this.pairingPromise = undefined;
    this.resolvePairing = undefined;
    this.rejectPairing = undefined;
  }

  async startClaim(): Promise<{ ok: boolean; expires_s: number }> {
    return this.request("/api/v1/claim/start", { method: "POST" }, true, false);
  }

  async finishClaim(code: string): Promise<void> {
    const result = await this.request<{ token: string } & Partial<DeviceIdentity>>(
      "/api/v1/claim/finish",
      { method: "POST", body: JSON.stringify({ code }) },
      true,
      false,
    );
    // Pairing is the possession-proof moment, so the device sends its
    // identity key along (firmware 0.9+): pin it now, verify it forever.
    if (result.pubkey && result.fingerprint && !this.isMock) {
      const pinned = storageGet(PUBKEY_KEY);
      if (pinned && pinned !== result.pubkey) {
        throw new Error(
          `This box's identity key (${result.fingerprint}) does not match the one this browser ` +
            "pinned earlier. If the device was reflashed or factory reset that is expected — " +
            "forget the device under Settings and connect again. Otherwise, do not trust it.",
        );
      }
      storageSet(PUBKEY_KEY, result.pubkey);
      storageSet(FINGERPRINT_KEY, result.fingerprint);
      if (result.device) storageSet(SERIAL_KEY, result.device);
    }
    this.finishPairing(result.token);
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    open = false,
    retryAfterPairing = true,
  ): Promise<T> {
    if (this.isMock) return this.mockRequest<T>(path, init);

    const headers = new Headers(init.headers);
    if (!open) headers.set("Authorization", `Bearer ${this.token}`);
    if (init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    } catch {
      this.noteReachability(false);
      throw new Error(`Could not reach ${this.address}.`);
    }
    this.noteReachability(true);

    let payload: unknown = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (response.status === 401 && !open && retryAfterPairing) {
      this.token = "";
      storageRemove(TOKEN_KEY);
      await this.waitForPairing();
      return this.request<T>(path, init, open, false);
    }
    if (!response.ok) {
      throw new Error(errorText(payload, `Device returned HTTP ${response.status}.`));
    }
    return payload as T;
  }

  private mockRequest<T>(path: string, init: RequestInit): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    let result: unknown;

    if (method === "GET" && path === "/api/v1/health") result = { ...this.mock.health };
    else if (method === "GET" && path === "/api/v1/info") result = { ...this.mock.info };
    else if (method === "GET" && path === "/api/v1/settings") result = { ...this.mock.settings };
    else if (method === "GET" && path === "/api/v1/mqtt") result = { ...this.mock.mqtt };
    else if (method === "GET" && path === "/api/v1/apps") result = { apps: this.mock.apps.apps.map((app) => ({ ...app })) };
    else if (method === "GET" && path === "/api/v1/apps/messages") result = { ...this.mock.messages, phrases: [...this.mock.messages.phrases] };
    else if (method === "GET" && path === "/api/v1/apps/custom") result = structuredClone(this.mock.custom);
    else if (method === "GET" && path === "/api/v1/apps/flights") result = { ...this.mock.flights };
    else if (method === "POST" && path === "/api/v1/display/text") {
      this.mock.info.scene = "text";
      result = { ok: true };
    } else if (method === "POST" && path === "/api/v1/display/frame") {
      const binary = atob(String(body.b64 ?? ""));
      if (binary.length !== FRAME_BYTES) return Promise.reject(new Error("Frame must be exactly 4096 bytes."));
      this.mock.lastFrameBytes = binary.length;
      this.mock.info.scene = "frame";
      result = { ok: true };
    } else if (method === "POST" && path === "/api/v1/display/clear") {
      this.mock.info.scene = "clock";
      result = { ok: true };
    } else if (method === "POST" && path === "/api/v1/display/brightness") {
      this.mock.info.brightness = Number(body.value);
      this.mock.settings.brightness = Number(body.value);
      result = { ok: true };
    } else if (method === "POST" && path === "/api/v1/apps") {
      const app = this.mock.apps.apps.find((item) => item.id === body.id);
      if (!app) return Promise.reject(new Error("Unknown app id."));
      if (typeof body.enabled === "boolean") app.enabled = body.enabled;
      if (typeof body.interval_s === "number") app.interval_s = body.interval_s;
      result = { apps: this.mock.apps.apps.map((item) => ({ ...item })) };
    } else if (method === "POST" && path === "/api/v1/apps/messages") {
      if (Array.isArray(body.phrases)) this.mock.messages.phrases = body.phrases.map(String).slice(0, 8);
      if (typeof body.rotation_s === "number") this.mock.messages.rotation_s = body.rotation_s;
      const app = this.mock.apps.apps.find((item) => item.id === "messages");
      if (app) app.refresh_s = this.mock.messages.rotation_s;
      result = { ...this.mock.messages, phrases: [...this.mock.messages.phrases] };
    } else if (method === "POST" && path === "/api/v1/apps/custom") {
      this.mock.custom = structuredClone(body) as unknown as CustomLayout;
      const app = this.mock.apps.apps.find((item) => item.id === "custom");
      if (app) app.refresh_s = this.mock.custom.source?.interval_s ?? 0;
      result = structuredClone(this.mock.custom);
    } else if (method === "POST" && /^\/api\/v1\/apps\/(messages|flights_list|custom)\/show$/.test(path)) {
      this.mock.info.scene = path.split("/")[4];
      result = { ok: true };
    } else if (method === "POST" && path === "/api/v1/apps/flights") {
      this.mock.flights = { ...this.mock.flights, ...(body as unknown as Partial<FlightsSettings>) };
      result = { ...this.mock.flights };
    } else if (method === "GET" && path === "/api/v1/apps/diag") {
      result = {
        fetch_cap: 65536,
        psram: true,
        apps: [
          { id: "messages", enabled: true, result: "offline-app", http: 0, bytes: 0, attempts: 0, ok: 0, age_s: 0, rows: 2, has_data: true },
          { id: "flights_list", enabled: false, result: "no-url", http: 0, bytes: 0, attempts: 4, ok: 0, age_s: 6, rows: 0, has_data: false },
          { id: "custom", enabled: true, result: "ok", http: 200, bytes: 5088, attempts: 6, ok: 6, age_s: 9, rows: 3, has_data: true },
        ],
      };
    } else if (method === "POST" && path === "/api/v1/settings") {
      if (typeof body.tz === "string") this.mock.settings.tz = body.tz;
      result = { ok: true };
    } else if (method === "POST" && path === "/api/v1/mqtt") {
      if (typeof body.enabled === "boolean") this.mock.mqtt.enabled = body.enabled;
      if (typeof body.host === "string") this.mock.mqtt.host = body.host;
      if (typeof body.port === "number") this.mock.mqtt.port = body.port;
      if (typeof body.username === "string") this.mock.mqtt.username = body.username;
      if (typeof body.tls === "boolean") this.mock.mqtt.tls = body.tls;
      if (typeof body.password === "string") this.mock.mqtt.has_password = body.password.length > 0;
      this.mock.mqtt.status = this.mock.mqtt.enabled && this.mock.mqtt.host ? "connected" : "disabled";
      result = { ...this.mock.mqtt };
    } else if (method === "POST" && path === "/api/v1/token/rotate") {
      this.mock.token = `dmx_lan_demo_${Date.now().toString(36)}`;
      this.token = this.mock.token;
      result = { token: this.token };
    } else if (method === "POST" && path === "/api/v1/claim/start") {
      result = { ok: true, expires_s: 300 };
    } else if (method === "POST" && path === "/api/v1/claim/finish") {
      result = { token: this.mock.token };
    } else if (path === "/api/v1/identity" || path === "/api/v1/identity/verify") {
      result = { device: this.mock.info.device, alg: "ed25519", pubkey: "(demo)", fingerprint: "DEMO-MODE" };
    } else if (method === "POST") result = { ok: true, rebooting: path.includes("reset") || path.endsWith("reboot") };
    else return Promise.reject(new Error(`Mock route not implemented: ${method} ${path}`));

    return Promise.resolve(result as T);
  }

  health(): Promise<Health> {
    return this.request("/api/v1/health", {}, true);
  }

  info(): Promise<DeviceInfo> {
    return this.request("/api/v1/info");
  }

  settings(): Promise<DeviceSettings> {
    return this.request("/api/v1/settings");
  }

  mqtt(): Promise<MqttSettings> {
    return this.request("/api/v1/mqtt");
  }

  flights(): Promise<FlightsSettings> {
    return this.request("/api/v1/apps/flights");
  }

  apps(): Promise<AppsSettings> {
    return this.request("/api/v1/apps");
  }

  messages(): Promise<MessagesSettings> {
    return this.request("/api/v1/apps/messages");
  }

  custom(): Promise<CustomLayout> {
    return this.request("/api/v1/apps/custom");
  }

  post<T = ActionResult>(path: string, body?: unknown): Promise<T> {
    return this.request(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request(path);
  }

  saveToken(token: string): void {
    this.token = token;
    storageSet(TOKEN_KEY, token);
  }

  useTokenAndRetry(token: string): void {
    this.finishPairing(token);
  }

  fleet(info: DeviceInfo): FleetDevice[] {
    if (this.isMock) return MOCK_FLEET.map((device) => ({ ...device }));
    return [
      {
        name: info.name ?? (info.mdns.replace(/\.local$/i, "") || info.device),
        serial: info.serial ?? info.device,
        address: `${info.mdns} · ${info.ip}`,
        firmware: info.fw,
        online: true,
      },
    ];
  }

  async uploadFirmware(file: File, onProgress: (percent: number) => void): Promise<void> {
    if (this.isMock) {
      for (const percent of [18, 44, 71, 100]) {
        await new Promise((resolve) => window.setTimeout(resolve, 60));
        onProgress(percent);
      }
      return;
    }

    const uploadOnce = () =>
      new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${this.baseUrl}/update`);
        xhr.setRequestHeader("Authorization", `Bearer ${this.token}`);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onerror = () => reject(new Error("Firmware upload failed."));
        xhr.onload = () => {
          let payload: unknown = {};
          try {
            payload = JSON.parse(xhr.responseText);
          } catch {
            payload = {};
          }
          if (xhr.status === 401) reject(Object.assign(new Error("unauthorized"), { unauthorized: true }));
          else if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(errorText(payload, `Device returned HTTP ${xhr.status}.`)));
        };
        const form = new FormData();
        form.append("firmware", file, file.name);
        xhr.send(form);
      });

    try {
      await uploadOnce();
    } catch (error) {
      if (error instanceof Error && "unauthorized" in error) {
        this.token = "";
        storageRemove(TOKEN_KEY);
        await this.waitForPairing();
        await uploadOnce();
        return;
      }
      throw error;
    }
  }
}

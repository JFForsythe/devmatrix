# P1 evidence — browser-to-device transport spike

**Date:** 2026-08-12 · **Gate:** P1 feasibility spike, "browser setup and
recovery … HTTPS/local-network/bootstrap experiments"
([docs/PRODUCTION-PLAN.md](../../docs/PRODUCTION-PLAN.md)). Desk research
against current browser, CA, and standards sources plus a survey of
shipping local-first products. No hardware involved. The design decision
this evidence produced is
[ADR-0031](../../docs/adr/ADR-0031-browser-to-device-transport.md).

## Why this was a launch blocker

docs/PORTAL.md carried "exact browser-to-device HTTPS trust/bootstrap
design" as an open question and called it "a P1 launch blocker, not copy
to paper over." The device serves its Console over plain HTTP today; the
question was whether that is a temporary state to be fixed with
certificates, or the permanent design.

## Correction to a previously recorded fact

**ADR-0020 constraint 1 was wrong.** It recorded that an HTTPS page
cannot fetch `http://device.local` and that Chrome's Local Network Access
permission "is additive, not a bypass."

LNA shipped — Chrome 141/142 (Oct 2025), Edge 143 (Sept 2025), Firefox
policy in 150 with GA rolling 151 (May 2026) onward — and it **is** a
permission-gated relaxation of mixed-content blocking, specifically for
`.local` names and private-IP literals. Microsoft's deployment guidance
states it directly: with LNA, "certain local network requests are now
exempt from mixed content blocking, allowing HTTPS sites to make local
network requests to these HTTP endpoints: `.local` domains …; Private IP
literals." Chrome's Intent to Ship gives the reason — "many local devices
are not able to obtain publicly trusted TLS certificates." A
manufacturer's hosted page talking to its own LAN device is a named
motivating scenario, not a loophole.

Three limits keep this from changing the recommendation:

- LNA does **not** make the device origin a secure context. `crypto.subtle`,
  service workers, Web Serial, and WebAuthn remain unavailable there.
- LNA does **not** apply to main-frame navigation. Typing the device
  address in the address bar was never mixed content and still isn't —
  which is why the recommended path is unaffected by any of this.
- **Safari has filed no position** and blocks even `http://localhost` as
  mixed content (WebKit bug 171934, open since 2017). Any LNA-based path
  must degrade, never fail.

The other three constraints are confirmed. Constraint 4 was *understated*:
the binding number is the CA's own lifetime, not the CA/Browser Forum
ceiling — Let's Encrypt is 90 days today, 64 from Feb 2027, 45 from Feb
2028. One 2026 nuance to note: Let's Encrypt began issuing IP-address
certificates (GA 2026-01-15), but only for publicly validatable IPs at a
~6-day lifetime, so RFC1918 addresses remain impossible and bare IPs are
still invalid WebAuthn RP IDs.

## What comparable products actually ship

| Approach | Products | Padlock | Survives vendor death |
|---|---|---|---|
| Plain HTTP | Home Assistant, ESPHome, OctoPrint | no | **yes** |
| Self-signed / private PKI | Hue, Shelly 2.0+, UniFi, Syncthing | no (interstitial) | **yes** |
| Loopback only | Syncthing GUI | yes | yes, same-machine only |
| Public cert on private IP via vendor DNS | **Plex**, Synology, Tailscale | yes | **no** |
| Cloud-only | Sonos app, Ring, Nest | yes | **no** (bricks) |

**No shipping product in 2026 gives a browser a clean padlock on a LAN
device without a permanent vendor dependency.**

The vendor-DNS pattern was observed failing in production, which is what
settled the decision. Plex's `*.plex.direct` scheme requires a per-server
CSR brokered through plex.tv; servers were stuck on `429 API rate limit
exceeded` through 2025–26, resolvable only by staff manually resetting
server-side state, and asked whether recurrence could be prevented, staff
answered "Unfortunately not." Plex's status page carries a component
named "plex.direct DNS servers," and during a July 2026 outage owners
could not reach their own servers **on their own LAN**. The scheme also
requires disabling router DNS-rebinding protection.

Home Assistant — the closest analogue — evaluated exactly this pattern
and declined to commit, citing "significant infrastructure implications
(running a CA, domain management, certificate renewal)." ESPHome ships
the design recommended here: HTTPS only where it is free (the hosted
installer page, reached over USB), a plain-HTTP device origin opened by
top-level navigation, and device HTTPS declined as a feature request.

## What this evidence does not settle

Four items became named P1 experiments rather than conclusions:

1. Whether `ws://` to a `.local` host is LNA-exempt. Chrome gates
   WebSockets under LNA from M147, but has no `targetAddressSpace`
   equivalent for WebSockets; an Intent to Prototype for one landed
   2026-08-05. Private-IP-literal `ws://` appears already exempt.
   Mitigation is cheap: fall back to the IP literal.
2. Whether `.local` is exempt from Chrome's HTTPS-Upgrades (strongly
   implied by the documented non-unique-hostname exemption, not verified).
3. Firefox's staged 151→153 rollout and its exact mixed-content parity.
4. The macOS/iOS OS-level local-network permission, which can stop a
   browser resolving `.local` at all regardless of page-level rules.

The IETF SETTLE working group's scope is operational guidance for
existing mechanisms, and its charter milestone is "close or recharter" in
August 2026. **No standards rescue arrives inside this product's
timeline**; re-check at P2.

## Consequence for the product

The device keeps a plain-HTTP origin permanently, and TLS never sits on
its critical path. Because plain HTTP authenticates no server and mDNS
names are unauthenticated, the security substitute is
application-layer: the device signs a Console-supplied nonce with its
device key, verified against a key captured out-of-band. That
requirement, and the full ranked design, are in ADR-0031.

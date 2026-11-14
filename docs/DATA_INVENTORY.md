# DATA INVENTORY: Apex Slipstream

Last reviewed: 2026-11-13 · Controller: Developer (Personal Project) · Processor(s): None · Laws: N/A (No personal data processed)

---

## 1. Personal Data the App Collects

| Data Field | Who it's About | Why We Need It (Purpose) | Lawful Basis | Sensitive? | Required or Optional | Stored Where (Service, Region) | Who Can See It | Shared With | Kept For | How It's Deleted |
|---|---|---|---|---|---|---|---|---|---|---|
| *None* | — | The app does not collect, transmit, or process any personal data. | N/A | No | N/A | Local Device Only (`localStorage`) | Local user only | Nobody | Until user clears browser cache | Browser clear data / In-game reset button |

> [!NOTE]
> The custom player display name entered in the game (e.g. "Player 1") is stored strictly on the user's local device in browser `localStorage`. It is never transmitted across the network, never logged to any server, and never shared with third parties.

---

## 2. Hidden Copies of Personal Data

| Place | What Personal Data Ends Up There | Can It Be Avoided or Masked? | Kept For |
|---|---|---|---|
| Server/Function Logs | None (Static hosting only via Cloudflare Pages) | Yes (No custom backend endpoints or logging services) | None |
| Error Tracking | None | Yes (No third-party error tracking SDKs integrated) | None |
| Analytics / Session Replay | None | Yes (No analytics, cookies, or trackers used) | None |
| Backups | None | Yes | None |
| Emails / SMS / Messages | None | Yes | None |
| AI Prompts & Responses | None (No LLM / generative AI integrations) | Yes | None |
| Dev / Test Databases | None (100% client-side application) | Yes | None |

---

## 3. Third Parties That Receive Personal Data (Processors)

| Service | What It Receives | Purpose | Data Location (Country/Region) | DPA Available/Signed? | Retention & Training Settings | Transfer Basis |
|---|---|---|---|---|---|---|
| **Cloudflare Pages** | IP address in standard edge HTTP routing logs | Static asset CDN hosting | Global Edge Network | Standard Cloudflare Terms | Automated edge log cycling | N/A (Standard public web delivery) |

---

## 4. Cookies, Local Storage, Pixels, and SDKs

| Name / Storage Key | Set By | Purpose | Necessary? | Loads Before Consent? | Lifetime |
|---|---|---|---|---|---|
| `apex_settings` (`localStorage`) | First Party | Stores player preferences: camera view mode, qualifying format, volume settings, screen shake toggle, and local player name. | Yes (Functional / Strictly Necessary) | Yes (Purely functional local preference) | Persistent on device until cleared |
| `apex_season_v1` (`localStorage`) | First Party | Stores championship progression: current track index, driver points table, and remaining restart tokens. | Yes (Functional / Strictly Necessary) | Yes | Persistent on device until cleared |
| `ghost_replays` (`IndexedDB`) | First Party | Stores binary `Float32Array` vehicle telemetry for personal best and previous lap ghosts in Time Trial mode. | Yes (Functional / Strictly Necessary) | Yes | Persistent on device until cleared |

---

## 5. Consent Records

- **Consent Storage:** N/A. No cookies or trackers requiring prior consent under GDPR/ePrivacy or NDPA are utilized. All storage is strictly necessary for local game function.

---

## 6. Special Categories

- **Sensitive Data Handled:** None.
- **Children (Under 18):** Suitable for all ages; no personal data or communications collected.
- **Automated Decisions with Significant Effects:** None.

---

## 7. Change Log

| Date | Change | Made In (Task/PR) | Privacy Re-Check Needed? |
|---|---|---|---|
| 2026-11-13 | Initial Data Inventory created for V1 Blueprint (P02). Verified zero personal data collection. | Initial Setup | No |

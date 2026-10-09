# SolarMind Progressive Web App, Multilingual (English, Hindi, Odia), & Low-Bandwidth Architecture

This document specifies the technical architecture, implementation, and operational safeguards for SolarMind as a **Progressive Web App (PWA)** equipped with **tri-lingual localization (English, Hindi, Odia)** and **resilient low-bandwidth / offline field support**.

---

## 1. Progressive Web App (PWA) Architecture

```
                               ┌─────────────────────────┐
                               │  Browser / Mobile Host  │
                               └────────────┬────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
          ┌─────────────────────┐                       ┌─────────────────────┐
          │   App Manifest      │                       │   Service Worker    │
          │ (/manifest.json)    │                       │     (/sw.js)        │
          └─────────────────────┘                       └──────────┬──────────┘
                     │                                             │
      ┌──────────────┴──────────────┐               ┌──────────────┴──────────────┐
      ▼                             ▼               ▼                             ▼
┌──────────────┐             ┌──────────────┐┌──────────────┐              ┌──────────────┐
│ 192x192 Icon │             │ 512x512 Icon ││ Precached    │              │ Network      │
│ & Maskable   │             │ & Shortcuts  ││ Shell Assets │              │ Safe Caching │
└──────────────┘             └──────────────┘└──────────────┘              └──────────────┘
```

### 1.1 Web App Manifest
- **Manifest URL**: [`/manifest.webmanifest`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/public/manifest.webmanifest) and [`/manifest.json`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/public/manifest.json)
- **Display Mode**: `standalone` (seamless native-like container without browser URL chrome).
- **Branding & Theme**:
  - `theme_color`: `#F59E0B` (Solar Amber)
  - `background_color`: `#0B0F19` (Deep Slate)
- **App Shortcuts**: Direct deep-links to **Homeowner Dashboard** (`/home/dashboard`), **Technician Queue** (`/technician/dashboard`), and **Why-Low Diagnostics** (`/diagnostics`).
- **Icons**:
  - `192x192` SVG standard icon ([`public/icons/icon-192.svg`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/public/icons/icon-192.svg))
  - `512x512` SVG standard icon ([`public/icons/icon-512.svg`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/public/icons/icon-512.svg))
  - `512x512` SVG Maskable icon ([`public/icons/maskable-icon.svg`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/public/icons/maskable-icon.svg))
  - Multi-size Favicon SVG ([`public/icons/favicon.svg`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/public/icons/favicon.svg))

### 1.2 Service Worker Caching Strategies
The Service Worker ([`public/sw.js`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/public/sw.js)) enforces strict lifecycle and isolation rules:
1. **Pre-Cached App Shell**: HTML entrypoint, offline fallback page, manifest, icons, and fonts.
2. **Navigation Fallback**: Network-first; if offline or unreachable, serves cached routes or falls back to [`public/offline.html`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/public/offline.html).
3. **Static Assets (Stale-While-Revalidate)**: Scripts, styles, SVGs, and Google Indic web fonts.
4. **Update Notifications**: When an updated Service Worker is detected in the `installed` state, the [`PwaUpdateToast`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/src/components/common/PwaUpdateToast.jsx) prompts the user with an "Update & Reload" button that posts `SKIP_WAITING` to activate immediately.

---

## 2. Multilingual Internationalization (i18n)

SolarMind supports three primary languages:
- **English (`en`)**: Global operational language.
- **Hindi (`hi` - हिन्दी)**: Devanagari script for widespread domestic residential users.
- **Odia (`or` - ଓଡ଼ିଆ)**: Native Eastern India regional script for local Odisha solar rooftop deployments.

### 2.1 Localization Coverage Matrix

| Area | Scope & Features Translated | Dictionary Location |
|:---|:---|:---|
| **Navigation** | Dashboard, Plants, Inverters, Monitoring, Alerts, Diagnostics, Maintenance, Work Orders, Analytics, Geo Photo, Settings, Admin Console. | `TRANSLATIONS[lang].nav` |
| **Dashboard KPIs** | Current Power, Today's Total Yield, Expected vs Actual, Energy Shortfall, Financial Savings/Loss (₹), Health Score, Active Alerts, Performance Ratio. | `TRANSLATIONS[lang].dashboard` |
| **Forms & Validation** | Email, Passwords, Full Name, Installed Capacity, Tariff Rate, Scheduled/Due Dates, Priority, Required Fields, Range Validation, Mismatch Errors. | `TRANSLATIONS[lang].forms` |
| **Fault Explanations** | Why-Low 6-step breakdown: Observed Symptoms, Probable Root Causes, Supporting Evidence, Confidence %, What to Do Next, Technician Required (Yes/No). | `TRANSLATIONS[lang].diagnostics` |
| **Maintenance Work** | Safe 5-step checklist (DC Isolator check, Combiner Box thermal check, Voc/Isc check, Torque check), parts replaced, before/after photo evidence. | `TRANSLATIONS[lang].maintenance` |
| **System Toasts** | Save confirmations, dispatch notices, recovery verification alerts, offline queuing acknowledgements, network change toasts. | `TRANSLATIONS[lang].notifications` |
| **Empty / Error States** | No active alerts, no work orders found, offline data notices, 404 not found page descriptions. | `TRANSLATIONS[lang].empty` |

### 2.2 Dynamic Switching & HTML Accessibility
- **React Context Hook**: [`useLanguage()`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/src/context/LanguageContext.jsx) exposes `language`, `setLanguage`, `t(path, fallback)`, and `supportedLanguages`.
- **Dynamic DOM Sync**: Switching language automatically updates `<html lang="hi" data-language="hi">` and `<html lang="or" data-language="or">`.
- **Typographic Fallback**: `index.html` loads Google Fonts for `Noto Sans Devanagari` and `Noto Sans Oriya` alongside `Outfit` and `Plus Jakarta Sans`.

---

## 3. Low-Bandwidth & Offline Resilience

Designed specifically for remote rooftop installations and field technicians with 2G/3G or intermittent cellular connectivity:

### 3.1 Adaptive Bandwidth Mode
- **Auto-Detection**: Automatically detects `navigator.connection.saveData` or slow cellular connections (`2g` / `slow-2g`).
- **Manual Toggle**: One-click "Lite / Full" toggle via [`SyncStatusIndicator`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/src/components/common/SyncStatusIndicator.jsx).
- **Reduced Polling**: Telemetry polling interval dynamically extends from **30 seconds** (normal) to **300 seconds** (lite mode) or **0 seconds (paused)** when offline.

### 3.2 Adaptive Image Loading
- Component: [`LowBandwidthImage`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/src/components/common/LowBandwidthImage.jsx).
- In low-bandwidth or offline modes, high-resolution inspection photos (often 3–8 MB) are not downloaded automatically. Instead, a lightweight blurred preview placeholder with image metadata and a "Load High-Resolution Photo" button is presented.

### 3.3 Visual Stale & Offline Indicators
- **Offline Banner**: [`OfflineBanner`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/frontend/src/components/common/OfflineBanner.jsx) displays at top of screen with offline status and count of queued actions.
- **Stale Telemetry Badge**: If telemetry was received $>30$ minutes ago, amber status indicators highlight data age (e.g. `Stale Data (Synced 42m ago)`).
- **Last Sync Timestamp**: Displayed with human-readable relative time ("Synced just now", "2 mins ago").

---

## 4. Security & Data Integrity Guarantees

1. **No Shared Storage of Sensitive API Credentials**:
   - The Service Worker explicitly skips all `/api/v1/auth/*` requests.
   - Authentication tokens, passwords, and user credentials are **never** written to the unencrypted Service Worker Cache Storage.
2. **Strict Mutation Isolation**:
   - All `POST`, `PUT`, `PATCH`, and `DELETE` requests bypass worker caches and execute directly over HTTPS.
3. **No False Server Persistence Claims**:
   - When a technician records an inspection or checklist while offline, the action is marked **`Queued Locally (Pending Sync)`** with an explicit offline badge.
   - The system never claims to the user that a work order or diagnosis was saved to the server until network synchronization succeeds.

---

## 5. Browser Compatibility & Offline Limitations

| Browser / Platform | PWA Installability | Service Worker & Offline Cache | Multilingual Typography | Notes |
|:---|:---:|:---:|:---:|:---|
| **Google Chrome (Desktop & Android)** | ✅ Full | ✅ Full | ✅ Full | Full support for `beforeinstallprompt` and standalone display. |
| **Microsoft Edge** | ✅ Full | ✅ Full | ✅ Full | Native Windows PWA integration and taskbar pinning. |
| **Mozilla Firefox** | ⚠️ Manual Pin | ✅ Full | ✅ Full | Service worker and offline cache fully supported. |
| **Apple Safari (iOS & macOS)** | ⚠️ "Add to Home Screen" | ✅ Full | ✅ Full | Standalone display supported via Apple touch icons. |

### Limitations:
- Real-time inverter telemetry cannot be updated while completely disconnected from the internet.
- Initial load requires network connectivity to download the web app shell and translation dictionary bundle.

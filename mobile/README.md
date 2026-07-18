# Caretaker24 — React Native (Expo) app

A full React Native port of the Caretaker24 web prototype. Same features, same navy/gold
theme, same backend contract — but this compiles to **real native Android (.apk) and iOS
(.ipa) apps**, not a browser page.

## Backend

This app now has a complete matching backend in `../server` (Node.js +
Express + MongoDB). See that folder's README for setup — it takes about 10 minutes with
either a local MongoDB install or a free MongoDB Atlas cluster.

Set your backend's address in:
```js
// src/config.js
export const API_BASE_URL = 'http://192.168.1.42:4000'; // your computer's LAN IP for dev
```

The Anthropic API key never goes in this app — every AI call goes through the backend,
same security model throughout.

## Getting a QR code to scan with Expo Go — must run on YOUR computer

I can't host a dev server your phone can reach from this sandbox — there's no network
path from here to your device, only file generation. The QR code has to come from a dev
server running on **your own computer**, with your phone on the same WiFi:

```bash
npm run install:all   # from the monorepo root — installs mobile and server independently
npm run dev:mobile    # or: cd mobile && npx expo start
```

A QR code appears right in your terminal (and at `http://localhost:8081` in a browser).
Open **Expo Go** on your phone, scan it, done.

**Heads up:** in plain Expo Go, two features will crash on open because they're custom
native modules Expo Go doesn't bundle — Razorpay checkout and live step tracking via
`expo-sensors` Pedometer (SOS push delivery and local medicine alarms both still work
fine — those don't need a custom dev client). Everything else — auth, Home, Medicines
with AI prescription scan, the Voice Assistant (tap/text based — see Troubleshooting),
Reminders, Contacts, Account, Profile, Reports, dark/light mode, biometric app lock —
works in plain Expo Go.

## Getting a real .apk / .ipa — must run on YOUR computer

I can't compile these here either — no Android SDK, no Xcode, no code-signing service in
this sandbox. EAS Build does the compiling on Expo's servers instead of yours, so you
don't need Android Studio or a Mac:

```bash
npx expo login                                          # free Expo account
eas build:configure                                       # links this project to EAS
eas build --profile development --platform android        # ~15-20 min, builds in the cloud
```

You get a download link when it's done — that's an installable APK with every native
module included (voice, pedometer, Razorpay, push), so nothing crashes. Install it on your
phone once, then for daily development:
```bash
npx expo start --dev-client
```
same QR-code flow as Expo Go, just scanned with the app you just installed instead.

For iOS, the same command with `--platform ios` needs a paid Apple Developer account
($99/year) connected via `eas credentials` — EAS handles the certificates for you.

Store-ready builds:
```bash
eas build --platform android --profile production   # → .aab for Play Store
eas build --platform ios --profile production         # → signed .ipa for App Store
```

## Biometric app lock — how it actually works

This isn't "biometric login" (Face ID can't manufacture a server session out of nothing —
only a real password/OTP/OAuth flow can). It's an **app lock**, the same model banking
apps use:

1. A normal sign-in (password, OTP, Google, or Apple) gets you a real JWT session, same as
   always. Right after that, `BiometricSetupScreen` offers to turn the lock **on**.
2. Once enabled, a resumed session starts **locked** on cold start — a token sitting in
   `expo-secure-store` proves the device was signed in before, not that the person holding
   it right now is the account owner. Only `AppLockScreen`'s fresh Face ID / Touch ID /
   fingerprint prompt (with automatic fallback to the device passcode) proves that.
3. The app also **re-locks automatically** after being backgrounded for 30+ seconds
   (`RELOCK_AFTER_MS` in `AuthContext.js`) — so leaving the phone unlocked on a table for a
   minute doesn't leave medical data exposed.
4. If biometric hardware/enrollment is ever lost (fingerprints wiped in device Settings,
   etc.), the app **fails open rather than permanently locking someone out** — `Profile →
   Biometric lock` shows a clear warning and lets you turn it off instead of trapping you.
5. Manage it anytime from `Profile → Biometric lock` — not just a one-time setup prompt.

## What changed vs. the web version

| Feature | Web (browser) | This app (native) |
|---|---|---|
| Voice commands | Web Speech API (Chrome only) | ⚠️ Temporarily disabled — see Troubleshooting below. Falls back to tap/text input; `expo-speech` (below) is unaffected |
| Guided voice replies | Not present | `expo-speech` — the app speaks its questions out loud ("Which medicine did you take?"), works in plain Expo Go, no dev-client needed |
| Step tracking | Simulated / manual button | `expo-sensors` Pedometer — reads the phone's real motion coprocessor (M-series on iPhone, step-counter sensor on Android) |
| Medicine/bill alarms | Browser `Notification` (only fires while tab open) | `expo-notifications` — real OS-scheduled local alarms that fire even if the app is closed or the phone restarts |
| Biometric app lock | Not possible in a browser | `expo-local-authentication` — real Face ID / Touch ID / Android fingerprint, re-locks automatically after 30s backgrounded |
| Prescription photo scan | `<input type=file>` | `expo-image-picker` — opens the real camera |
| Payments | Simulated checkout UI | Real `react-native-razorpay` native SDK (India) + Stripe hosted checkout via in-app browser (international) |
| Storage | `localStorage` | `AsyncStorage` (general data) + `expo-secure-store` (tokens, backed by iOS Keychain / Android Keystore) |

## Project structure

```
mobile/
├── App.js                      entry point, wires up all providers
├── app.json                    Expo config — permissions, icons, plugins
├── eas.json                    EAS Build profiles (dev/preview/production)
├── src/
│   ├── theme/theme.js          DARK/LIGHT colour palettes (ported from web)
│   ├── context/
│   │   ├── ThemeContext.js     dark/light mode switch
│   │   ├── AuthContext.js      sign-in state, biometric unlock
│   │   └── DataContext.js      medicines/contacts/reports — AsyncStorage-backed
│   ├── services/
│   │   ├── aiService.js        calls your backend's /api/ai/* routes
│   │   ├── notificationService.js   real local alarm scheduling
│   │   ├── pedometerService.js      expo-sensors step tracking
│   │   ├── voiceService.js          offline keyword fallback + language list (native listening temporarily disabled — see Troubleshooting)
│   │   ├── speechService.js         expo-speech — spoken prompts for the guided voice flow
│   │   └── paymentService.js        Razorpay native + Stripe hosted checkout
│   ├── components/              shared UI: Card, Btn, Input, VoiceModal, ChatModal, etc.
│   ├── navigation/               RootNavigator (auth vs. app) + MainTabs (bottom nav)
│   └── screens/                  one file per screen, organised like the web app's tabs
└── assets/                       icon, splash, alarm sound (placeholders — replace before shipping)
```

## Setup

### This project targets Expo SDK 54 — read this before running `npm install`

As of mid-2026, Expo Go on the App Store and Play Store only supports the current SDK
(currently SDK 54 — SDK 55/56 are still working through Apple App Store review, and Expo
Go simply refuses to open a project built on an SDK it doesn't support). This project was
originally built against SDK 51, which **Expo Go can no longer open at all** — that's the
actual reason to be on SDK 54, not just a version-number preference. Check
[expo.dev/go](https://expo.dev/go) if you want to confirm what Expo Go currently supports
before you start, since this shifts roughly three times a year.

**Immediately after `npm install`, run this — it matters more than any version number
written in `package.json`:**
```bash
npx expo install --fix
```
This queries Expo's own live compatibility data and corrects every `expo-*` package to the
exact patch version SDK 54 expects — more reliably than any hand-maintained version pin,
including the ones in this repo's `package.json`. Follow it with:
```bash
npx expo-doctor
```
which runs a full validation pass and tells you plainly if anything is still misaligned
before you spend time on a build that's likely to fail.

From the monorepo root:
```bash
npm run install:all   # installs mobile and server independently, one command
npx expo install --fix --prefix mobile   # or: cd mobile && npx expo install --fix
```
Or just this project:
```bash
cd mobile && npm install && npx expo install --fix
```

You'll need:
1. **A free [Expo account](https://expo.dev)** — `npx expo login`
2. **EAS CLI** — `npm install -g eas-cli`, then `eas build:configure` (this fills in
   `app.json`'s `extra.eas.projectId` for you)
3. **A paid Apple Developer account** ($99/year) — required for any iOS build beyond the
   simulator, and mandatory for App Store submission
4. **A Google Play Developer account** ($25 one-time) — only needed when you're ready to
   publish to the Play Store; not needed to just build and sideload an APK

### Why this needs a "dev build," not plain Expo Go

Two features here — `expo-sensors` Pedometer and `react-native-razorpay` — are native
modules that **aren't included in the standard Expo Go app** from the App/Play Store.
Running `expo start` and scanning the QR code with plain Expo Go will crash on these
features. Instead:

```bash
# Build a custom "dev client" once (includes all native modules):
eas build --profile development --platform android
eas build --profile development --platform ios

# Install that dev-client build on your phone, then for daily development:
npx expo start --dev-client
```

After that first dev-client build, iterating on JS/UI code is instant (no rebuild needed)
— only adding a *new* native module requires another dev-client build.

## Building the real .apk / .ipa

```bash
# Android APK you can sideload directly (no Play Store needed):
eas build --platform android --profile preview

# iOS — needs your Apple Developer account connected via `eas credentials`:
eas build --platform ios --profile preview

# Store-ready builds (AAB for Play Store, signed IPA for App Store):
eas build --platform android --profile production
eas build --platform ios --profile production
```

EAS builds in the cloud and gives you a download link when done (~15–25 min per platform).
No Xcode or Android Studio required on your machine for Android; iOS builds still need a
one-time Apple Developer account connection (EAS handles the certificates/provisioning
automatically if you let it).

## Building an APK in the cloud, without EAS

If EAS Build's queue specifically is the problem (not cloud builds in general), there are
other cloud options that don't touch Expo's infrastructure at all.

### GitHub Actions (free, and this repo already has a ready-to-use workflow)

`.github/workflows/build-android-apk.yml` at the root of this repo builds the APK entirely
on GitHub's own servers — free (2,000 minutes/month on private repos, unlimited on public
ones), no Expo account, no EAS queue, no Android Studio on your machine.

**To use it:**
1. Push this repo to GitHub (if it isn't already)
2. Go to the **Actions** tab on your repo
3. Click **Build Android APK** in the sidebar → **Run workflow** (or just push to `main` —
   it also runs automatically)
4. Wait for it to finish (~10-15 min including SDK setup on a fresh runner)
5. Open the finished run → scroll to **Artifacts** → download `caretaker24-debug-apk` —
   it's a zip containing the `.apk`

The workflow already includes the same `npx expo install --fix` safety net this README
keeps emphasizing, runs on JDK 17 (matching this project's requirements), and caches
Gradle between runs so builds after the first one are noticeably faster.

**One thing worth doing for reliability, same advice as everywhere else in this
README:** run `npm install` locally once, confirm `npx expo prebuild --platform android`
succeeds on your own machine, and commit the resulting `mobile/package-lock.json`. Without
one, this workflow (and EAS, and everything else) resolves dependencies fresh every time,
which is slower and less predictable than reusing versions you've actually verified work.

### Other cloud CI options (if you'd rather not touch YAML/GitHub Actions)

- **[Codemagic](https://codemagic.io)** — mobile-specific CI with a free tier, GUI-based
  configuration (no YAML editing required if you don't want it), builds both APK and IPA
- **[Bitrise](https://bitrise.io)** — similar mobile-focused CI, also has a free tier

Both work the same way in principle: connect your GitHub repo, point them at the `mobile/`
folder, and they run essentially the same steps as the GitHub Actions workflow above
(`npm install` → `expo prebuild` → native build) on their own infrastructure.

## Building an APK entirely locally — no EAS, no cloud, no Expo account

If EAS Build's cloud queue isn't working for you, this path builds the exact same APK
entirely on your own machine using nothing but standard Android build tooling. One
clarification worth making up front: `expo prebuild` below is a **local** command — it
reads your `app.json` and generates a standard native `android/` folder on your disk, the
same thing EAS Build does internally on its servers before compiling. It talks to zero
Expo cloud services and needs no Expo account; only `eas build` (a different command) uses
the cloud queue that's been failing.

### Software to install (all free)

| # | Software | Why | Verify it worked |
|---|---|---|---|
| 1 | [Node.js](https://nodejs.org) — LTS (18.x or 20.x) | Runs the JS tooling, npm, Expo CLI | `node --version` |
| 2 | JDK 17 — [Eclipse Temurin](https://adoptium.net/temurin/releases/?version=17) is a good free build, or use the one bundled inside Android Studio | Gradle (the Android build tool) needs a JDK to compile; JDK 17 for this SDK 54 / RN 0.81 project — other versions can fail with cryptic errors | `java -version` → should print `17.x` |
| 3 | [Android Studio](https://developer.android.com/studio) | Installs the Android SDK, Platform Tools (`adb`), and Build Tools that Gradle needs | Open it once, let its own setup wizard finish |
| 4 | *(Optional)* A physical Android phone with USB debugging enabled, or an emulator created via Android Studio's Device Manager | To actually install and test the APK | — |

### One-time environment setup

After Android Studio's setup wizard finishes, it will have installed the SDK to a default
location — you need to point two environment variables at it so the command line can find
it (Android Studio's own UI doesn't need this, but building from a terminal does):

**Windows** (Settings → System → About → Advanced system settings → Environment Variables):
```
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
JAVA_HOME    = C:\Program Files\Eclipse Adoptium\jdk-17.x.x  (or wherever your JDK 17 installed)
```
Then add these to your `Path` variable:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```

**Mac/Linux** (add to `~/.zshrc`, `~/.bash_profile`, or `~/.bashrc`, then restart your terminal):
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk      # Mac; Linux is usually $HOME/Android/Sdk
export JAVA_HOME=$(/usr/libexec/java_home -v 17)    # Mac; on Linux, wherever your JDK 17 installed
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

Confirm both variables are visible: `echo $ANDROID_HOME` / `echo $JAVA_HOME` (or `echo %ANDROID_HOME%` on Windows) should print real paths, not blank lines.

### Step-by-step: generate the APK

```bash
# 1. Unzip the project and go into the mobile folder
cd caretaker24/mobile

# 2. Install JS dependencies
npm install

# 3. Generate the native android/ folder — LOCAL ONLY, no cloud call happens here
npx expo prebuild --platform android --clean

# 4. Move into the generated native project
cd android

# 5. Build — this is the actual compile step, runs entirely on your machine
./gradlew assembleDebug          # Mac/Linux
gradlew.bat assembleDebug        # Windows
```

First run downloads Gradle itself plus a handful of build dependencies (can take 5-10
minutes on the first try; every build after that is much faster since those are cached).

**Your APK is here when it finishes:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Getting it onto your phone

**Option A — manual transfer:** copy that file to your phone any way you like (USB, email
yourself, upload to Google Drive and download on the phone) and tap it to install. You'll
need to allow "Install unknown apps" for whichever app you used to open it — Android will
prompt you for this the first time.

**Option B — one command, if your phone is plugged in via USB with debugging enabled**
(Settings → About phone → tap "Build number" 7 times → Developer options → USB debugging):
```bash
npx expo run:android
```
This builds and installs directly onto the connected device in one step, no manual file
transfer needed.

This build includes every native module (camera, biometrics, sensors, Razorpay) — no Expo
Go limitations, since it isn't Expo Go at all, it's your actual app compiled directly.

### For a signed release build (required before sharing widely or publishing — a debug
APK works for testing but isn't meant for distribution):
```bash
# Generate a keystore once — keep this file and its passwords safe forever;
# losing it means you can never update the app under the same signature again
keytool -genkeypair -v -keystore caretaker24-release.keystore -alias caretaker24 -keyalg RSA -keysize 2048 -validity 10000

# Then in android/gradle.properties, add:
#   CARETAKER24_RELEASE_STORE_FILE=caretaker24-release.keystore
#   CARETAKER24_RELEASE_KEY_ALIAS=caretaker24
#   CARETAKER24_RELEASE_STORE_PASSWORD=<your password>
#   CARETAKER24_RELEASE_KEY_PASSWORD=<your password>
# and wire a signingConfigs.release block into android/app/build.gradle referencing
# those properties (Android Studio's "Generate Signed Bundle/APK" wizard does this
# for you automatically if you'd rather not hand-edit Gradle files)

./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

**Fastest option if a device is plugged in via USB** (skips the manual APK transfer):
```bash
npx expo run:android
```
Builds and installs directly onto a connected device or running emulator in one step.

## Building an IPA entirely locally — no EAS, no cloud

**Hard requirement, unlike the Android path above: this needs a Mac.** Xcode only runs on
macOS — there's no way around this for iOS builds, whether through EAS or locally; Apple
doesn't allow iOS compilation on Windows/Linux under any toolchain.

### Software to install

| # | Software | Why | Verify |
|---|---|---|---|
| 1 | A Mac running a recent macOS | Xcode requirement | — |
| 2 | [Xcode](https://apps.apple.com/us/app/xcode/id497799835) 16.1+ (Xcode 26 recommended for SDK 54) from the Mac App Store | Compiles the iOS app | `xcodebuild -version` |
| 3 | Xcode Command Line Tools | `xcode-select --install` | `xcode-select -p` |
| 4 | [CocoaPods](https://cocoapods.org) — iOS's native package manager | `sudo gem install cocoapods` | `pod --version` |
| 5 | A free [Apple ID](https://appleid.apple.com) | Enough to build and run on your own device/simulator via Xcode directly | — |
| 6 | *(Only for App Store submission or sharing with others)* A paid [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year) | Required for ad-hoc distribution and App Store builds | — |

Node.js and npm from the Android section above are still required too.

### Step-by-step: generate the app and run it

```bash
cd mobile
npm install
npx expo prebuild --platform ios --clean   # generates ios/ — local only, no cloud

cd ios
pod install                                 # installs native iOS dependencies via CocoaPods
```

Then open the generated **workspace** (not the `.xcodeproj` — once CocoaPods is involved,
the `.xcworkspace` is the one that actually includes the installed pods):
```bash
open Caretaker24.xcworkspace
```

In Xcode:
1. Select your connected iPhone (or a simulator) from the device dropdown at the top
2. Click your project in the left sidebar → **Signing & Capabilities** tab → choose your
   Apple ID under "Team" (Xcode will auto-generate a free personal development certificate)
3. Press **⌘R** (or the ▶ Play button) to build and run directly on the selected
   device/simulator

That's the fastest way to get the app running on your own phone — no `.ipa` file needed for
this, Xcode installs it directly.

### Generating an actual `.ipa` file (for sharing or App Store submission)

```
Xcode menu bar → Product → Archive
```
This builds a release archive (takes a few minutes). When it finishes, the **Organizer**
window opens automatically:
1. Select your archive → **Distribute App**
2. Choose a method:
   - **Development** — installable only on devices registered to your Apple ID (free tier)
   - **Ad Hoc** — installable on a list of specific device UDIDs you register (needs the
     paid Developer account)
   - **App Store Connect** — for actual App Store submission (needs the paid account)
3. Follow the wizard's prompts (automatic signing is simplest) → **Export**

You'll get a `.ipa` file you can install via Xcode's Devices window (drag-and-drop onto a
connected device), TestFlight (if uploaded to App Store Connect), or any ad-hoc
distribution service, depending on which method you chose above.

## Before shipping — replace these placeholders

- [x] `assets/icon.png`, `assets/splash.png`, `assets/adaptive-icon.png`,
      `assets/notification-icon.png` — replaced with real branded artwork (navy
      background, gold circle, family + medicine mark) — still worth a final design pass
      before a store submission, but no longer auto-generated placeholders
- [ ] `assets/sounds/alarm.wav` — currently a simple 3-beep tone, swap for your real alarm sound
- [ ] `app.json` → `ios.bundleIdentifier` / `android.package` — currently
      `com.caretaker24.app`, change if you don't own that exact identifier
- [ ] `src/config.js` → `API_BASE_URL` — point at your deployed backend
- [ ] `app.json` → `extra.eas.projectId` — filled in automatically by `eas build:configure`
      (only needed if you do end up using EAS Build for something, e.g. OTA updates later)

## Production checklist (same as the web backend's, still applies)

- [ ] Security review of the backend, dependency audit, secrets in a real secrets manager
- [ ] Testing — this code hasn't run through a JS engine in this sandbox (no Node/RN
      runtime available here); run `npx expo start` yourself and click through every
      screen before building
- [ ] Push notifications for SOS need Firebase Cloud Messaging wired up (see the backend's
      `/api/devices` and `/api/alerts` routes) — register the Expo push token there
- [ ] App Store / Play Store review — both platforms scrutinize health-data and payment
      apps; budget time for review cycles and required privacy-policy disclosures
- [ ] `NSHealthShareUsageDescription` etc. — if you later integrate Apple HealthKit or
      Google Health Connect instead of the raw Pedometer API for richer step history

## Troubleshooting

### `None of these files exist: App(...)` during `expo export:embed`, or a Gradle `Cannot convert '' to File` error

**If you're reading this in a current checkout, you shouldn't hit either of these** — the
actual fix was to stop using npm workspaces for this project entirely, which is why
`mobile/` no longer has its own committed `index.js` or workspace-specific Metro config.
Documenting the history here in case you're comparing against an older checkout or hit
something similar in your own monorepo.

**What was happening:** this project used to live inside an npm workspaces monorepo
(`"workspaces": ["server", "mobile"]` in the root `package.json`), specifically so a
single `npm install` from the root would install everything in one pass. npm workspaces
are free to **hoist** shared dependencies (like `expo` itself) up to the monorepo root's
`node_modules` instead of keeping them inside `mobile/node_modules`, as a space-saving
optimization. That silently broke two things Expo's tooling assumes are always true:

1. `node_modules/expo/AppEntry.js` does `import App from '../../App'` — a **hardcoded
   relative filesystem path**, not a named-module import. If `expo` got hoisted to the
   monorepo root, that path resolved to the *root's* (nonexistent) `App.js` instead of
   `mobile/App.js`.
2. The native Android build scripts `expo prebuild` generates make the same "node_modules
   sits directly inside my own folder" assumption — when it didn't, a Gradle property
   meant to hold a path came back empty, and Gradle failed trying to convert `''` into a
   `File`.

**Two earlier attempts only partially fixed this** — a custom `index.js` entry point
(sidesteps error 1) plus `install-strategy=nested` in `.npmrc` (should prevent hoisting
entirely, addressing error 2). The Gradle error persisted even with both in place, most
likely because the custom entry point interacted badly with Expo's own `resolveAppEntry`
tooling during the native build's entry-file resolution step — plausible, but never fully
confirmed, since it couldn't be reproduced and debugged directly in the environment that
built this project.

**The actual fix**: stop fighting the friction and remove the source of it. `mobile/` is
no longer part of an npm workspace at all — it's a fully independent project with its own
`node_modules`, installed separately (see the root README's "Why not npm workspaces?"
section). With no workspace, there's no hoisting, no custom entry point needed, and no
custom Metro config needed — everything reverts to Expo's own plain defaults, which are
what its tooling is actually built and tested against. `npm run install:all` from the
monorepo root still gives you "one command installs everything" — it just runs two
separate, independent installs instead of relying on npm's hoisting mechanism.

If you're migrating an existing checkout to this structure, clean reinstall from scratch:
```bash
rm -rf node_modules mobile/node_modules server/node_modules package-lock.json mobile/package-lock.json server/package-lock.json
npm run install:all
```

### `npm error ERESOLVE unable to resolve dependency tree` (usually mentions a peer `react` version)

React 19 (which this project uses, matching Expo SDK 54) is new enough that some
third-party React Native packages haven't updated their `peerDependencies` ranges yet,
even when the package works fine with it in practice. npm treats that as a hard error by
default. Two things fix this:

1. This project's `.npmrc` (at both the repo root and inside `mobile/`) already sets
   `legacy-peer-deps=true`, which tells npm to warn instead of hard-fail on this class of
   mismatch — this should already be preventing the error for any *future* stale-peer-range
   package, not just the one that triggered this originally (`lucide-react-native`, fixed
   by bumping it to a version that actually lists React 19 as a supported peer).
2. If you still hit this for some other package, the immediate unblock is
   `npm install --legacy-peer-deps`, then check whether a newer version of that specific
   package exists with an updated peer range and bump to it properly rather than relying on
   the flag forever.

**If you also saw a Gradle error like `Plugin [id: 'com.facebook.react.settings'] was not
found`** immediately after this — that's not a separate bug, it's a *cascading* failure:
the ERESOLVE error above caused `npm install` to exit without finishing, which means
`node_modules/react-native/gradle-plugin` (which provides that exact plugin) never
finished installing either. Fixing the ERESOLVE error and re-running `npm install`
cleanly resolves both at once — you don't need to chase the Gradle error separately.

### Voice recognition is temporarily disabled

`@react-native-voice/voice` was causing the native Android/iOS build itself to fail (not
the `expo prebuild` config-generation step covered below — a separate, later failure in
the actual native compile). It's been removed from `package.json` entirely and
`voiceService.js`'s native-dependent functions are stubbed to safely report "unavailable"
rather than crash. **Nothing else in the app breaks** — `VoiceModal.js` already had a
complete fallback UI for exactly this case: guided mode's tap-to-select medicine/action
chips and free-form mode's typed-text input both keep working normally; only live
speech-to-text *listening* is off. Text-to-speech (the app speaking its questions out
loud) is unaffected — that's `expo-speech`, a separate package with no build issues.

**To re-enable once the package's build issue is sorted out:**
1. Add back to `package.json`: `"@react-native-voice/voice": "^3.2.4"`
2. In `voiceService.js`: uncomment the `import Voice from '@react-native-voice/voice'`
   line at the top, and restore each of the 5 commented-out original function bodies
   (`initVoice`, `startVoiceRecognition`, `stopVoiceRecognition`, `destroyVoice`,
   `isVoiceAvailable`) — the real implementation is preserved directly above each stub.
3. Add `@react-native-voice/voice` back to `app.json`'s `plugins` array with a
   `microphonePermission`/`speechRecognitionPermission` config, and add back to
   `ios.infoPlist`: `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription`,
   plus `RECORD_AUDIO` to `android.permissions` — these were removed during a later
   dead-code cleanup pass since nothing was requesting them anymore with voice fully
   disabled; exact wording used previously is in git history / earlier conversation context.
4. Rebuild with `eas build --profile development --platform android` and confirm it
   actually completes before relying on it again — if this specific package is what's
   failing the native build, that's worth confirming with the package's own GitHub issues
   for known compatibility problems with your exact Expo SDK/RN version before spending
   more build cycles on it.

### `Prebuild failed: IOSConfig.Permissions.createPermissionsPlugin is not a function`

*(This was diagnosed on Expo SDK 51, before this project upgraded to SDK 54 — see the
Setup section above. The underlying fix — removing the plugin invocations entirely, since
their only job was already done manually in `app.json` — stays in place regardless of SDK
version, so this history is kept for reference. `npx expo-doctor` after the SDK 54 upgrade
is a good way to confirm this specific issue isn't still present before assuming it is.)*

**Update: the real fix.** Earlier versions of this README pointed at version mismatches
between `@expo/config-plugins` and `expo-image-picker`'s plugin, on the theory that a
stale or duplicate copy got resolved. That turned out to be wrong — this error reproduced
even on a completely fresh local install with no prior `node_modules` at all, which means
`createPermissionsPlugin` was simply gone from `@expo/config-plugins` for that SDK 51
toolchain combination, full stop, regardless of which exact patch version resolved.
Pinning versions further wasn't going to fix that.

**The actual fix, already applied in this project:** the only thing `expo-image-picker`'s
config plugin does is inject `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`
into `Info.plist` and the camera/storage permissions into `AndroidManifest.xml`. This app
already declares all of those **manually** in `app.json`'s `ios.infoPlist` and
`android.permissions` — so the plugin was doing redundant work, and it's been removed
from the `plugins` array entirely. Same reasoning applied to `@react-native-voice/voice`
(mic/speech permissions) and `expo-local-authentication` / `expo-sensors` (Face ID /
motion permissions) — all four were hitting the identical crash pattern, and all four had
their fallback permission strings already present manually, so all four were removed from
`plugins`.

**This does not remove any functionality.** Config plugins only affect files generated
during `expo prebuild` (`Info.plist`, `AndroidManifest.xml`); they have nothing to do with
whether a package's native module is linked into the build — that's controlled entirely by
the package being present in `package.json` (which all four still are). Camera access,
voice recognition, Face ID, and step tracking all work exactly as before; only the
now-redundant plugin step that was crashing prebuild is skipped.

If you add a **new** native package later that needs its own permission plugin, either
declare its required `Info.plist`/`AndroidManifest.xml` entries manually the same way (and
skip adding it to `plugins`), or if you do add it to `plugins` and hit this same error
again, that confirms the pattern: remove it from `plugins` and add its permission strings
manually instead.

**If you're still hitting a related but different prebuild error after this fix:**

```bash
rm -rf node_modules package-lock.json
npm install
npx expo prebuild --platform android   # confirm it works locally
```

Then commit the resulting `package-lock.json` — this locks in the *exact* versions you
tested, so EAS Build's cloud install can't drift to a different resolution than what
worked on your machine. `package.json` also still pins `expo-image-picker` to `~15.0.7`
and forces `@expo/config-plugins` via both `overrides` (npm) and `resolutions` (Yarn) as
defense-in-depth, plus an explicit `"packageManager": "npm@10.5.0"` field — these weren't
sufficient on their own for *this* error, but are still reasonable hygiene against other
version-drift issues. If you're still stuck after all of this, check `node --version`
(expects 18 or 20) and `npm --version` (9+ recommended) — an unusually old toolchain on
your machine can also produce this class of resolution mismatch.

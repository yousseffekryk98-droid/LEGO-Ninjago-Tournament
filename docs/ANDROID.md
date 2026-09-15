# Android packaging

The web/PWA build remains the canonical game build. Android uses Capacitor 8.5.2 as a native wrapper around the production `dist/` output.

## Requirements

For Capacitor 8, use:

- Node.js 22 or newer;
- Android Studio 2025.2.1 or newer;
- Android SDK Platform 36 for the current release target (Capacitor 8 supports API 24+ devices);
- Android Studio's bundled JDK for local development;
- USB debugging or an Android emulator for device testing.

The GitHub release workflow independently regenerates the Android project and compiles a debug APK using Java 21 and Android SDK 36, so packaging regressions are caught before merge.

## First native setup

```bash
npm install
npm run android:init
```

`android:init` runs the production build, creates the native `android/` project, and syncs the web bundle into it.

## Normal development cycle

After changing the game:

```bash
npm run android:sync
```

Then either:

```bash
npm run android:open
```

and run/build from Android Studio, or:

```bash
npm run android:run
```

for a connected device/emulator.

## Release APK/AAB

Open the Android project with `npm run android:open`, then use Android Studio's **Build > Generate Signed App Bundle / APK**. Keep signing keys out of the repository.

For Google Play, prefer an AAB. For direct device testing, a debug or signed APK is sufficient.

CI uploads an unsigned/debug APK from every successful release-candidate run. That artifact is for acceptance testing, not store distribution.

## Release checklist

1. `npm run test:release`
2. Confirm the GitHub `android-debug` job compiles and uploads its APK artifact.
3. `npm run android:sync`
4. Test touch controls, controller input, audio, pause/resume and offline startup on a real Android device.
5. Test at least one low/mid-range device and one high-refresh device.
6. Verify landscape orientation, safe areas and no controls are obscured by gesture/navigation bars.
7. Generate a signed AAB/APK only after browser and Android acceptance pass.

## IP boundary

This native package is the same clean-room fan remake as the web build. It does not include extracted commercial APK/OBB code, LEGO/TT/Hellbent models, textures, music, voices, logos or animations. Use only original or properly licensed production assets before public distribution.

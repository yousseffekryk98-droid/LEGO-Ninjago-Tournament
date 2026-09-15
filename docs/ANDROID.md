# Android packaging

The web/PWA build remains the canonical game build. Android uses Capacitor 8.5.2 as a native wrapper around the production `dist/` output.

## Requirements

- Node.js 22+
- Android Studio with a current Android SDK/JDK configuration
- USB debugging or an Android emulator for device testing

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

## Release checklist

1. `npm run test:release`
2. `npm run android:sync`
3. Test touch controls, controller input, audio, pause/resume and offline startup on a real Android device.
4. Test at least one low/mid-range device and one high-refresh device.
5. Verify landscape orientation, safe areas and no controls are obscured by gesture/navigation bars.
6. Generate a signed AAB/APK only after browser and Android acceptance pass.

## IP boundary

This native package is the same clean-room fan remake as the web build. It does not include extracted commercial APK/OBB code, LEGO/TT/Hellbent models, textures, music, voices, logos or animations. Use only original or properly licensed production assets before public distribution.

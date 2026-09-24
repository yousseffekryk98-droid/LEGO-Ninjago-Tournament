# Contributing

Thanks for helping improve this clean-room fan remake.

## Before contributing

- Keep all code and assets clean-room and independently created.
- Do not submit extracted APK/OBB files, official game source, ripped models,
  textures, logos, music, sound effects, animations, or other proprietary assets.
- Do not upload assets from LEGO, TT Games, Hellbent Games, or another owner unless
  you have a license that clearly permits redistribution in this repository.
- Keep the project playable on desktop and mobile.
- Preserve accessibility, keyboard remapping, touch controls, and responsive layouts.

## Development

```bash
npm install
npm run dev
```

Before opening a pull request:

```bash
npm run typecheck
npm run build
npm run test:e2e
```

If your machine cannot run the full browser suite, say exactly which checks you ran.

## Pull requests

1. Keep each PR focused on one feature or fix.
2. Explain the player-facing change and technical approach.
3. Include screenshots or a short clip for visible gameplay/UI changes.
4. Add or update tests when behavior changes.
5. Do not commit generated build output, secrets, API keys, or credentials.
6. Mention any performance impact, especially for WebGL/mobile changes.

## Good first contributions

- additional original arena props and environment detail
- combat polish and new original VFX
- controller/accessibility improvements
- mobile and laptop responsiveness
- automated tests
- performance profiling
- documentation and translations

## Licensing

By contributing, you agree that your contribution may be distributed under the
repository's MIT license and that you have the right to submit it.
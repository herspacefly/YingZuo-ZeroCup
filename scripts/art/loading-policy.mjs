// Current author requirement; byte counts remain diagnostic, not a reason to remove art.
export const loadingPolicy = Object.freeze({
  revision: '2026-10-20-author-15s',
  assetReadyTargetMs: 15000,
  historicalImageFontReferenceBytes: 2 * 1024 * 1024,
  imageSizeIsBlocking: false,
  scope: 'Images: explicit opening to complete drawable intro. Music: explicit request to native media-playback readiness, not speaker hearing or whole-file download. Preserve full art/audio. Home interaction, JS and runtime frame targets are separate.',
});

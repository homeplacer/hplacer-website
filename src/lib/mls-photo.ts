// Fixed public contract: no caller-controlled origin, quality, format or crop.
export const MLS_PHOTO_WIDTHS = [320, 480, 640, 768, 1200] as const;
export const MLS_PHOTO_CACHE_SECONDS = 300;

export function isMlsListingKey(value: string) {
  return /^[1-9][0-9]{0,19}$/.test(value);
}

/** Optional media is accepted only for this listing's current first photo. */
export function mlsPhotoSource(listingKey: string, photo: unknown) {
  if (!isMlsListingKey(listingKey) || photo !== `/api/img/${listingKey}/1`) return undefined;
  return `https://forturro.com${photo}`;
}

export function isMlsPhotoSource(listingKey: string, photoUrl: unknown): photoUrl is string {
  return photoUrl === mlsPhotoSource(listingKey, `/api/img/${listingKey}/1`) && typeof photoUrl === "string";
}

export function mlsPhotoSrcSet(listingKey: string, photoUrl: unknown) {
  if (!isMlsPhotoSource(listingKey, photoUrl)) return undefined;
  return MLS_PHOTO_WIDTHS.map((width) => `/api/mls-photo/${listingKey}/${width} ${width}w`).join(", ");
}

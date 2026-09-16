// ==========================================================================
// LuciHome — storage cleanup helper
//
// Removes the actual photo files from Supabase Storage for a listing.
// Used when a listing is deleted (my-listings.js) and when an account is
// deactivated (profile.js) — without this, deleted listings would still
// leave orphaned photo files taking up space in Storage.
// ==========================================================================

async function cleanupListingPhotos(userId, listingId) {
  const folder = `${userId}/${listingId}`;
  const { data: files, error } = await supabaseClient.storage.from('listing-photos').list(folder);
  if (error || !files || files.length === 0) return;

  const paths = files.map((f) => `${folder}/${f.name}`);
  await supabaseClient.storage.from('listing-photos').remove(paths);
}

async function cleanupAvatar(userId) {
  const { data: files, error } = await supabaseClient.storage.from('avatars').list(userId);
  if (error || !files || files.length === 0) return;

  const paths = files.map((f) => `${userId}/${f.name}`);
  await supabaseClient.storage.from('avatars').remove(paths);
}

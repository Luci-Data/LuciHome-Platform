// ==========================================================================
// LuciHome — My Favorites page (Stage 7)
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  document.getElementById('favoritesLoading').style.display = 'none';

  if (!session || !session.user) {
    document.getElementById('favoritesSignedOut').style.display = 'block';
    return;
  }

  await loadFavoriteIds();
  await loadFavoriteListings(session.user.id);
});

async function loadFavoriteListings(userId) {
  const { data, error } = await supabaseClient
    .from('favorites')
    .select('listings(id,listing_type,property_type,title,price,currency,country,city,neighborhood,bedrooms,bathrooms,area_sqm,status,listing_photos(photo_url,sort_order))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Could not load your favorites: ' + error.message, 'danger');
    return;
  }

  // A favorited listing that was later deleted comes back as null — skip it.
  const listings = (data || []).map((row) => row.listings).filter(Boolean);

  if (listings.length === 0) {
    document.getElementById('favoritesEmpty').style.display = 'block';
    return;
  }

  const grid = document.getElementById('favoritesGrid');
  listings.forEach((listing) => grid.appendChild(renderListingCard(listing)));
}

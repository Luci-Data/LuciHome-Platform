// ==========================================================================
// LuciHome — "Latest listings" section on the homepage
//
// Shows the 10 most recently published listings, platform-wide. Reuses
// the same card renderer (and favorite-heart logic) as the browse page,
// via listing-card.js.
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadFavoriteIds();
  await loadLatestListings();
});

async function loadLatestListings() {
  const { data, error } = await supabaseClient
    .from('listings')
    .select('id,listing_type,property_type,title,price,currency,country,city,neighborhood,bedrooms,bathrooms,area_sqm,listing_photos(photo_url,sort_order)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) return; // keep the section hidden if there's nothing to show yet

  const section = document.getElementById('latestListingsSection');
  const grid = document.getElementById('latestListingsGrid');

  data.forEach((listing) => grid.appendChild(renderListingCard(listing)));
  section.style.display = 'block';
}

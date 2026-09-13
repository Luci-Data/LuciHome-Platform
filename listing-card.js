// ==========================================================================
// LuciHome — shared listing card renderer + favorites logic (Stage 7)
//
// Used by listings.js, listing-detail.js and favorites.js so the same
// card look and the same "heart" behavior work everywhere without
// duplicating code.
// ==========================================================================

let favoriteIds = new Set();

// Call this once per page, before rendering any cards, so hearts show the
// correct state immediately instead of flipping after a delay.
async function loadFavoriteIds() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { favoriteIds = new Set(); return; }

  const { data, error } = await supabaseClient
    .from('favorites')
    .select('listing_id')
    .eq('user_id', session.user.id);

  favoriteIds = (!error && data) ? new Set(data.map((r) => r.listing_id)) : new Set();
}

async function toggleFavorite(listingId, heartBtn) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    showToast('Create an account (or log in) to save favorites.', 'danger');
    openModal(document.getElementById('registerModal'));
    return;
  }

  const userId = session.user.id;

  if (favoriteIds.has(listingId)) {
    const { error } = await supabaseClient.from('favorites').delete().eq('user_id', userId).eq('listing_id', listingId);
    if (error) { showToast('Could not remove favorite: ' + error.message, 'danger'); return; }
    favoriteIds.delete(listingId);
    heartBtn.classList.remove('active');
  } else {
    const { error } = await supabaseClient.from('favorites').insert({ user_id: userId, listing_id: listingId });
    if (error) { showToast('Could not save favorite: ' + error.message, 'danger'); return; }
    favoriteIds.add(listingId);
    heartBtn.classList.add('active');
  }
}

function renderListingCard(listing) {
  const photos = (listing.listing_photos || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const coverUrl = photos[0]?.photo_url || '';
  const isFav = favoriteIds.has(listing.id);

  const card = document.createElement('div');
  card.className = 'listing-card';
  card.innerHTML = `
    <div style="position:relative">
      ${coverUrl
        ? `<img class="listing-card-img" src="${coverUrl}" alt="${escapeHtml(listing.title)}">`
        : `<div class="listing-card-img" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted)"><i class="fa-solid fa-house"></i></div>`}
      <button type="button" class="heart-btn ${isFav ? 'active' : ''}"><i class="fa-solid fa-heart"></i></button>
    </div>
    <div class="listing-card-body">
      <span class="listing-badge">${listing.listing_type === 'rent' ? 'For rent' : 'For sale'}</span>
      <p class="listing-card-price">${formatPrice(listing.price, listing.currency)}</p>
      <p class="listing-card-title">${escapeHtml(listing.title)}</p>
      <p class="listing-card-loc">${escapeHtml([listing.neighborhood, listing.city, listing.country].filter(Boolean).join(', '))}</p>
      <div class="listing-card-meta">
        ${listing.bedrooms != null ? `<span><i class="fa-solid fa-bed"></i> ${listing.bedrooms}</span>` : ''}
        ${listing.bathrooms != null ? `<span><i class="fa-solid fa-bath"></i> ${listing.bathrooms}</span>` : ''}
        ${listing.area_sqm != null ? `<span><i class="fa-solid fa-ruler-combined"></i> ${listing.area_sqm} m²</span>` : ''}
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    window.location.href = `listing-detail.html?id=${listing.id}`;
  });

  const heartBtn = card.querySelector('.heart-btn');
  heartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(listing.id, heartBtn);
  });

  return card;
}

function formatPrice(price, currency) {
  return new Intl.NumberFormat('en-US').format(price) + ' ' + currency;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

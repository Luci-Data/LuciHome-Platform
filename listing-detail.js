// ==========================================================================
// LuciHome — listing detail page (Stage 6)
// ==========================================================================

const FEATURE_LABELS = {
  parking: { label: 'Parking', icon: 'fa-square-parking' },
  garage: { label: 'Garage', icon: 'fa-warehouse' },
  garden: { label: 'Garden', icon: 'fa-seedling' },
  balcony: { label: 'Balcony/Terrace', icon: 'fa-border-all' },
  elevator: { label: 'Elevator', icon: 'fa-elevator' },
  air_conditioning: { label: 'Air conditioning', icon: 'fa-wind' },
  furnished: { label: 'Furnished', icon: 'fa-couch' },
  pool: { label: 'Swimming pool', icon: 'fa-water-ladder' }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadFavoriteIds();
  await loadListing();
});

async function loadListing() {
  const listingId = new URLSearchParams(window.location.search).get('id');
  const loading = document.getElementById('detailLoading');
  const notFound = document.getElementById('detailNotFound');
  const content = document.getElementById('detailContent');

  if (!listingId) {
    loading.style.display = 'none';
    notFound.style.display = 'block';
    return;
  }

  const { data: listing, error } = await supabaseClient
    .from('listings')
    .select('*, listing_photos(photo_url,sort_order)')
    .eq('id', listingId)
    .single();

  loading.style.display = 'none';

  if (error || !listing) {
    notFound.style.display = 'block';
    return;
  }

  content.style.display = 'block';
  renderListing(listing);
  loadOwner(listing.owner_id, listing.id);

  const heartBtn = document.getElementById('detailHeartBtn');
  heartBtn.classList.toggle('active', favoriteIds.has(listing.id));
  heartBtn.addEventListener('click', () => toggleFavorite(listing.id, heartBtn));
}

function renderListing(listing) {
  const photos = (listing.listing_photos || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const mainImg = document.getElementById('galleryMainImg');
  const strip = document.getElementById('galleryStrip');

  if (photos.length > 0) {
    mainImg.src = photos[0].photo_url;
    strip.innerHTML = '';
    photos.forEach((photo, index) => {
      const thumb = document.createElement('img');
      thumb.src = photo.photo_url;
      if (index === 0) thumb.classList.add('active');
      thumb.addEventListener('click', () => {
        mainImg.src = photo.photo_url;
        strip.querySelectorAll('img').forEach((i) => i.classList.remove('active'));
        thumb.classList.add('active');
      });
      strip.appendChild(thumb);
    });
  }

  document.getElementById('detailBadge').textContent = listing.listing_type === 'rent' ? 'For rent' : 'For sale';
  document.getElementById('detailPrice').textContent = formatPrice(listing.price, listing.currency);
  document.getElementById('detailLoc').textContent = [listing.neighborhood, listing.city, listing.country].filter(Boolean).join(', ');
  document.getElementById('detailTitle').textContent = listing.title;
  document.getElementById('detailDescription').textContent = listing.description || '';

  document.getElementById('detailBedrooms').textContent = listing.bedrooms ?? '—';
  document.getElementById('detailBathrooms').textContent = listing.bathrooms ?? '—';
  document.getElementById('detailArea').textContent = listing.area_sqm ?? '—';

  const featuresBox = document.getElementById('detailFeatures');
  const features = listing.features || [];
  if (features.length === 0) {
    featuresBox.innerHTML = `<p class="ms">No extra features listed.</p>`;
  } else {
    featuresBox.innerHTML = features.map((key) => {
      const meta = FEATURE_LABELS[key] || { label: key, icon: 'fa-circle-check' };
      return `<span class="feature-pill"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
    }).join('');
  }

  document.title = `${listing.title} — LuciHome`;
}

async function loadOwner(ownerId, listingId) {
  const { data, error } = await supabaseClient.rpc('get_public_profile', { profile_id: ownerId });
  const owner = Array.isArray(data) ? data[0] : data;

  if (error || !owner) {
    document.getElementById('ownerName').textContent = 'LuciHome member';
    return;
  }

  document.getElementById('ownerName').textContent = `${owner.first_name} ${owner.last_name}`;

  const avatarEl = document.getElementById('ownerAvatar');
  if (owner.avatar_url) {
    avatarEl.style.backgroundImage = `url("${owner.avatar_url}")`;
    avatarEl.style.backgroundSize = 'cover';
    avatarEl.style.backgroundPosition = 'center';
    avatarEl.textContent = '';
  } else {
    avatarEl.textContent = (owner.first_name?.[0] || '?').toUpperCase();
  }

  const phoneEl = document.getElementById('ownerPhone');
  phoneEl.innerHTML = owner.phone
    ? `<i class="fa-solid fa-phone"></i> ${owner.phone}`
    : `<span style="color:var(--text-muted)">Phone number not shared</span>`;

  document.getElementById('btnMessageOwner').addEventListener('click', () => startConversation(ownerId, listingId));
}

async function startConversation(ownerId, listingId) {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session || !session.user) {
    showToast('Create an account (or log in) to message the owner.', 'danger');
    openModal(document.getElementById('registerModal'));
    return;
  }

  if (session.user.id === ownerId) {
    showToast("This is your own listing — you can't message yourself.", 'danger');
    return;
  }

  // Look for an existing conversation for this listing + buyer first, so
  // reopening "Message owner" continues the same thread instead of a new one.
  const { data: existing } = await supabaseClient
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', session.user.id)
    .maybeSingle();

  if (existing) {
    window.location.href = `messages.html?c=${existing.id}`;
    return;
  }

  const { data: created, error } = await supabaseClient
    .from('conversations')
    .insert({ listing_id: listingId, buyer_id: session.user.id, seller_id: ownerId })
    .select()
    .single();

  if (error) {
    showToast('Could not start the conversation: ' + error.message, 'danger');
    return;
  }

  window.location.href = `messages.html?c=${created.id}`;
}

function formatPrice(price, currency) {
  return new Intl.NumberFormat('en-US').format(price) + ' ' + currency;
}

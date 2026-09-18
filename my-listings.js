// ==========================================================================
// LuciHome — My Listings page (Stage 6, views + cleanup added later)
// ==========================================================================

let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  document.getElementById('myListingsLoading').style.display = 'none';

  if (!session || !session.user) {
    document.getElementById('myListingsSignedOut').style.display = 'block';
    return;
  }

  currentUserId = session.user.id;
  await loadMyListings(currentUserId);
});

async function loadMyListings(userId) {
  const { data, error } = await supabaseClient
    .from('listings')
    .select('id,title,price,currency,status,views,listing_photos(photo_url,sort_order)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Could not load your listings: ' + error.message, 'danger');
    return;
  }

  if (!data || data.length === 0) {
    document.getElementById('myListingsEmpty').style.display = 'block';
    return;
  }

  const card = document.getElementById('myListingsCard');
  card.style.display = 'block';
  card.innerHTML = '';
  data.forEach((listing) => card.appendChild(renderRow(listing)));
}

function renderRow(listing) {
  const photos = (listing.listing_photos || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const coverUrl = photos[0]?.photo_url || '';

  const row = document.createElement('div');
  row.className = 'my-listing-row';
  row.innerHTML = `
    ${coverUrl
      ? `<img class="my-listing-thumb" src="${coverUrl}" alt="">`
      : `<div class="my-listing-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted)"><i class="fa-solid fa-house"></i></div>`}
    <div class="my-listing-info">
      <p class="t">${escapeHtml(listing.title)}</p>
      <p class="p">${formatPrice(listing.price, listing.currency)} · <i class="fa-solid fa-eye"></i> ${listing.views || 0} views</p>
    </div>
    <div class="my-listing-actions">
      <select class="select status-select" data-id="${listing.id}">
        <option value="active" ${listing.status === 'active' ? 'selected' : ''}>Active</option>
        <option value="sold" ${listing.status === 'sold' ? 'selected' : ''}>Sold</option>
        <option value="rented" ${listing.status === 'rented' ? 'selected' : ''}>Rented</option>
        <option value="archived" ${listing.status === 'archived' ? 'selected' : ''}>Archived</option>
      </select>
      <button class="btn-secondary btn-sm" data-view="${listing.id}"><i class="fa-solid fa-eye"></i></button>
      <button class="btn-secondary btn-sm" data-edit="${listing.id}"><i class="fa-solid fa-pen"></i></button>
      <button class="btn-secondary btn-sm" data-delete="${listing.id}"><i class="fa-solid fa-trash"></i></button>
    </div>
  `;

  row.querySelector('.status-select').addEventListener('change', (e) => updateStatus(listing.id, e.target.value, listing.title));
  row.querySelector('[data-view]').addEventListener('click', () => {
    window.location.href = `listing-detail.html?id=${listing.id}`;
  });
  row.querySelector('[data-edit]').addEventListener('click', () => {
    window.location.href = `edit-listing.html?id=${listing.id}`;
  });
  row.querySelector('[data-delete]').addEventListener('click', () => deleteListing(listing.id, row, listing.title));

  return row;
}

async function updateStatus(listingId, newStatus, title) {
  const { error } = await supabaseClient.from('listings').update({ status: newStatus }).eq('id', listingId);
  if (error) {
    showToast('Could not update status: ' + error.message, 'danger');
    return;
  }
  showToast('Listing status updated.', 'success');
  logNotification(currentUserId, 'listing_status_changed', 'Listing status updated', `"${title}" is now marked as ${newStatus}.`);
}

async function deleteListing(listingId, rowEl, title) {
  const confirmed = window.confirm('Delete this listing permanently? This cannot be undone.');
  if (!confirmed) return;

  await cleanupListingPhotos(currentUserId, listingId);

  const { error } = await supabaseClient.from('listings').delete().eq('id', listingId);
  if (error) {
    showToast('Could not delete the listing: ' + error.message, 'danger');
    return;
  }
  rowEl.remove();
  showToast('Listing deleted.', 'success');
  logNotification(currentUserId, 'listing_deleted', 'Listing deleted', `"${title}" was permanently deleted.`);
}

function formatPrice(price, currency) {
  return new Intl.NumberFormat('en-US').format(price) + ' ' + currency;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

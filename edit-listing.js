// ==========================================================================
// LuciHome — Edit Listing page
//
// Reuses the exact same form as Add Listing, but pre-filled with the
// listing's current data, and saves with an UPDATE instead of an INSERT.
// Photos are handled as a mix of "existing" (already in Storage) and
// "new" (freshly selected files) items in one combined array.
// ==========================================================================

let currentUserId = null;
let listingId = null;
let selectedListingType = 'sale';
let selectedPropertyType = 'house';

// Each item is either { kind:'existing', id, url, sortOrder } or { kind:'new', file, previewUrl }
let photoItems = [];
const removedPhotoIds = [];
const removedPhotoUrls = [];

const MAX_PHOTOS = 12;
const MAX_PHOTO_SIZE_MB = 15;

document.addEventListener('DOMContentLoaded', async () => {
  listingId = new URLSearchParams(window.location.search).get('id');
  const { data: { session } } = await supabaseClient.auth.getSession();
  document.getElementById('listingLoading').style.display = 'none';

  if (!session || !session.user) {
    document.getElementById('listingSignedOut').style.display = 'block';
    return;
  }
  currentUserId = session.user.id;

  if (!listingId) {
    showSignedOutMessage("This listing link isn't valid.");
    return;
  }

  const { data: listing, error } = await supabaseClient
    .from('listings')
    .select('*, listing_photos(id,photo_url,sort_order)')
    .eq('id', listingId)
    .single();

  if (error || !listing) {
    showSignedOutMessage("This listing doesn't exist or was already removed.");
    return;
  }

  if (listing.owner_id !== currentUserId) {
    showSignedOutMessage("This listing doesn't belong to your account.");
    return;
  }

  document.getElementById('listingForm').style.display = 'block';

  setupCharCounters();
  setupPhotoUpload();
  setupFormActions();
  prefillForm(listing);
});

function showSignedOutMessage(text) {
  document.getElementById('listingSignedOutReason').textContent = text;
  document.getElementById('listingSignedOut').style.display = 'block';
}

function prefillForm(listing) {
  wireToggle('listingTypeToggle', (value) => { selectedListingType = value; }, listing.listing_type);
  wireToggle('propertyTypeToggle', (value) => { selectedPropertyType = value; }, listing.property_type);
  selectedListingType = listing.listing_type;
  selectedPropertyType = listing.property_type;

  setValue('listTitle', listing.title);
  setValue('listDescription', listing.description);
  setValue('listCountry', listing.country);
  setValue('listCity', listing.city);
  setValue('listNeighborhood', listing.neighborhood);
  setValue('listAddress', listing.address);
  setValue('listPrice', listing.price);
  setValue('listCurrency', listing.currency);
  setValue('listBedrooms', listing.bedrooms);
  setValue('listBathrooms', listing.bathrooms);
  setValue('listArea', listing.area_sqm);

  (listing.features || []).forEach((key) => {
    const box = document.querySelector(`.feature-chk input[value="${key}"]`);
    if (box) box.checked = true;
  });

  photoItems = (listing.listing_photos || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ kind: 'existing', id: p.id, url: p.photo_url, sortOrder: p.sort_order }));
  renderPhotoGrid();
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el === null || value === null || value === undefined) return;
  el.value = value;
  el.dispatchEvent(new Event('input')); // refreshes character counters
}

function wireToggle(containerId, onSelect, currentValue) {
  const buttons = document.querySelectorAll(`#${containerId} .type-toggle-btn`);
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === currentValue);
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(btn.dataset.value);
    });
  });
}

// ---- Character counters ----
function setupCharCounters() {
  bindCounter('listTitle', 'titleCount');
  bindCounter('listDescription', 'descCount');
}

function bindCounter(fieldId, counterId) {
  const field = document.getElementById(fieldId);
  const counter = document.getElementById(counterId);
  const update = () => { counter.textContent = field.value.length; };
  field.addEventListener('input', update);
  update();
}

// ---- Photos: combined existing + new ----
function setupPhotoUpload() {
  const dropzone = document.getElementById('dropzone');
  const input = document.getElementById('photoInput');

  dropzone.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => addPhotos(e.target.files));

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
  });
  dropzone.addEventListener('drop', (e) => addPhotos(e.dataTransfer.files));
}

async function addPhotos(fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    if (photoItems.length >= MAX_PHOTOS) {
      showToast(`You can have up to ${MAX_PHOTOS} photos.`, 'danger');
      break;
    }
    if (!file.type.startsWith('image/')) continue;
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      showToast(`${file.name} is larger than ${MAX_PHOTO_SIZE_MB}MB and was skipped.`, 'danger');
      continue;
    }
    const compressedFile = await compressImage(file, 1920, 0.8);
    photoItems.push({ kind: 'new', file: compressedFile, previewUrl: URL.createObjectURL(compressedFile) });
  }
  renderPhotoGrid();
  document.getElementById('photoInput').value = '';
}

function removePhotoAt(index) {
  const item = photoItems[index];
  if (item.kind === 'existing') {
    removedPhotoIds.push(item.id);
    removedPhotoUrls.push(item.url);
  } else {
    URL.revokeObjectURL(item.previewUrl);
  }
  photoItems.splice(index, 1);
  renderPhotoGrid();
}

function renderPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  grid.innerHTML = '';
  photoItems.forEach((item, index) => {
    const url = item.kind === 'existing' ? item.url : item.previewUrl;
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.innerHTML = `
      <img src="${url}" alt="Listing photo ${index + 1}">
      ${index === 0 ? '<span class="cover-badge">Cover</span>' : ''}
      <button type="button" class="remove-photo" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
    `;
    thumb.querySelector('.remove-photo').addEventListener('click', () => removePhotoAt(index));
    grid.appendChild(thumb);
  });
}

// ---- Cancel / save ----
function setupFormActions() {
  document.getElementById('btnCancelListing').addEventListener('click', () => {
    window.location.href = 'my-listings.html';
  });
  document.getElementById('listingForm').addEventListener('submit', handleSave);
}

async function handleSave(e) {
  e.preventDefault();
  const form = document.getElementById('listingForm');
  if (!form.reportValidity()) return;

  if (photoItems.length === 0) {
    showToast('A listing needs at least one photo.', 'danger');
    return;
  }

  const saveBtn = document.getElementById('btnPublishListing');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving…';

  const features = Array.from(document.querySelectorAll('.feature-chk input:checked')).map((c) => c.value);

  const { error: updateError } = await supabaseClient
    .from('listings')
    .update({
      listing_type: selectedListingType,
      property_type: selectedPropertyType,
      title: document.getElementById('listTitle').value.trim(),
      description: document.getElementById('listDescription').value.trim(),
      country: document.getElementById('listCountry').value,
      city: document.getElementById('listCity').value.trim(),
      neighborhood: document.getElementById('listNeighborhood').value.trim() || null,
      address: document.getElementById('listAddress').value.trim() || null,
      price: Number(document.getElementById('listPrice').value),
      currency: document.getElementById('listCurrency').value,
      bedrooms: document.getElementById('listBedrooms').value ? Number(document.getElementById('listBedrooms').value) : null,
      bathrooms: document.getElementById('listBathrooms').value ? Number(document.getElementById('listBathrooms').value) : null,
      area_sqm: document.getElementById('listArea').value ? Number(document.getElementById('listArea').value) : null,
      features
    })
    .eq('id', listingId);

  if (updateError) {
    showToast('Could not save changes: ' + updateError.message, 'danger');
    resetSaveButton();
    return;
  }

  // Remove photos that were deleted in this session.
  if (removedPhotoIds.length > 0) {
    await supabaseClient.from('listing_photos').delete().in('id', removedPhotoIds);
    await removeStoragePhotosByUrl('listing-photos', removedPhotoUrls);
  }

  // Upload any newly added photos.
  const remainingExisting = photoItems.filter((p) => p.kind === 'existing');
  const maxSortOrder = remainingExisting.reduce((max, p) => Math.max(max, p.sortOrder), -1);
  const newItems = photoItems.filter((p) => p.kind === 'new');

  let uploadFailed = false;
  for (let i = 0; i < newItems.length; i++) {
    const { file } = newItems[i];
    const extension = file.name.split('.').pop();
    const path = `${currentUserId}/${listingId}/${Date.now()}-${i}.${extension}`;

    const { error: uploadError } = await supabaseClient.storage.from('listing-photos').upload(path, file);
    if (uploadError) { uploadFailed = true; continue; }

    const { data: { publicUrl } } = supabaseClient.storage.from('listing-photos').getPublicUrl(path);
    await supabaseClient.from('listing_photos').insert({
      listing_id: listingId,
      photo_url: publicUrl,
      sort_order: maxSortOrder + 1 + i
    });
  }

  resetSaveButton();

  if (uploadFailed) {
    showToast('Listing saved, but some new photos failed to upload.', 'danger');
  } else {
    showToast('Your listing has been updated.', 'success');
  }

  logNotification(currentUserId, 'listing_updated', 'Listing updated', `Your changes to "${document.getElementById('listTitle').value.trim()}" were saved.`);

  setTimeout(() => { window.location.href = 'my-listings.html'; }, 1000);
}

function resetSaveButton() {
  const saveBtn = document.getElementById('btnPublishListing');
  saveBtn.disabled = false;
  saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save changes';
}

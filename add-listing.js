// ==========================================================================
// LuciHome — Add Listing page (Stage 5)
//
// Handles: the type/property toggle buttons, character counters, photo
// selection with previews (drag & drop or click), and publishing the
// listing — which means: insert into "listings", then upload each photo
// to Storage and insert a row per photo into "listing_photos".
//
// Relies on supabaseClient (supabase-client.js) and showToast/openModal
// (home.js), and the auth guard pattern used on profile.js.
// ==========================================================================

let currentUserId = null;
let selectedListingType = 'sale';
let selectedPropertyType = 'house';
const selectedPhotos = []; // { file, previewUrl }
const MAX_PHOTOS = 12;
const MAX_PHOTO_SIZE_MB = 8;

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  document.getElementById('listingLoading').style.display = 'none';

  if (!session || !session.user) {
    document.getElementById('listingSignedOut').style.display = 'block';
    return;
  }

  currentUserId = session.user.id;
  document.getElementById('listingForm').style.display = 'block';

  setupTypeToggles();
  setupCharCounters();
  setupPhotoUpload();
  setupFormActions();
});

// ---- 1. Listing type / property type toggle buttons ----
function setupTypeToggles() {
  wireToggle('listingTypeToggle', (value) => { selectedListingType = value; });
  wireToggle('propertyTypeToggle', (value) => { selectedPropertyType = value; });
}

function wireToggle(containerId, onSelect) {
  const buttons = document.querySelectorAll(`#${containerId} .type-toggle-btn`);
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(btn.dataset.value);
    });
  });
}

// ---- 2. Character counters for title / description ----
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

// ---- 3. Photo upload: click, drag & drop, previews, removal ----
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

function addPhotos(fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    if (selectedPhotos.length >= MAX_PHOTOS) {
      showToast(`You can add up to ${MAX_PHOTOS} photos.`, 'danger');
      break;
    }
    if (!file.type.startsWith('image/')) continue;
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      showToast(`${file.name} is larger than ${MAX_PHOTO_SIZE_MB}MB and was skipped.`, 'danger');
      continue;
    }
    selectedPhotos.push({ file, previewUrl: URL.createObjectURL(file) });
  }
  renderPhotoGrid();
  document.getElementById('photoInput').value = ''; // allow re-selecting the same file later
}

function removePhoto(index) {
  URL.revokeObjectURL(selectedPhotos[index].previewUrl);
  selectedPhotos.splice(index, 1);
  renderPhotoGrid();
}

function renderPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  grid.innerHTML = '';
  selectedPhotos.forEach((photo, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.innerHTML = `
      <img src="${photo.previewUrl}" alt="Listing photo ${index + 1}">
      ${index === 0 ? '<span class="cover-badge">Cover</span>' : ''}
      <button type="button" class="remove-photo" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
    `;
    thumb.querySelector('.remove-photo').addEventListener('click', () => removePhoto(index));
    grid.appendChild(thumb);
  });
}

// ---- 4. Cancel / publish ----
function setupFormActions() {
  document.getElementById('btnCancelListing').addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  document.getElementById('listingForm').addEventListener('submit', handlePublish);
}

async function handlePublish(e) {
  e.preventDefault();
  const form = document.getElementById('listingForm');
  if (!form.reportValidity()) return;

  if (selectedPhotos.length === 0) {
    showToast('Add at least one photo before publishing.', 'danger');
    return;
  }

  const publishBtn = document.getElementById('btnPublishListing');
  publishBtn.disabled = true;
  publishBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Publishing…';

  const features = Array.from(document.querySelectorAll('.feature-chk input:checked')).map((c) => c.value);

  const listingPayload = {
    owner_id: currentUserId,
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
  };

  const { data: listing, error: listingError } = await supabaseClient
    .from('listings')
    .insert(listingPayload)
    .select()
    .single();

  if (listingError) {
    showToast('Could not publish the listing: ' + listingError.message, 'danger');
    resetPublishButton();
    return;
  }

  const uploadResult = await uploadAllPhotos(listing.id);

  resetPublishButton();

  if (!uploadResult.ok) {
    showToast('The listing was published, but some photos failed to upload: ' + uploadResult.error, 'danger');
  } else {
    showToast('Your listing is live!', 'success');
  }

  // Search results page (where the listing will actually be visible) is a
  // later stage — for now, back to the homepage.
  setTimeout(() => { window.location.href = 'index.html'; }, 1200);
}

async function uploadAllPhotos(listingId) {
  for (let i = 0; i < selectedPhotos.length; i++) {
    const { file } = selectedPhotos[i];
    const extension = file.name.split('.').pop();
    const path = `${currentUserId}/${listingId}/${i}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('listing-photos')
      .upload(path, file);

    if (uploadError) return { ok: false, error: uploadError.message };

    const { data: { publicUrl } } = supabaseClient.storage.from('listing-photos').getPublicUrl(path);

    const { error: photoRowError } = await supabaseClient
      .from('listing_photos')
      .insert({ listing_id: listingId, photo_url: publicUrl, sort_order: i });

    if (photoRowError) return { ok: false, error: photoRowError.message };
  }
  return { ok: true };
}

function resetPublishButton() {
  const publishBtn = document.getElementById('btnPublishListing');
  publishBtn.disabled = false;
  publishBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish listing';
}

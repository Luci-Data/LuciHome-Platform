// ==========================================================================
// LuciHome — profile page (Stage 4)
//
// Loads the logged-in person's profile into the form, handles uploading a
// new avatar photo to Supabase Storage, and saves edits back to the
// "profiles" table. Relies on supabaseClient (supabase-client.js),
// showToast/fillCountryDropdowns (home.js) and updateAuthUI (auth.js).
// ==========================================================================

let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();

  document.getElementById('profileLoading').style.display = 'none';

  if (!session || !session.user) {
    document.getElementById('profileSignedOut').style.display = 'block';
    return;
  }

  currentUserId = session.user.id;
  document.getElementById('profileForm').style.display = 'block';

  await loadProfile(session.user);
  setupProfileForm();
});

async function loadProfile(user) {
  document.getElementById('profEmail').value = user.email;

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('first_name,last_name,country,city,phone,phone_visible,avatar_url')
    .eq('id', user.id)
    .single();

  if (error) {
    showToast('Could not load your profile: ' + error.message, 'danger');
    return;
  }

  document.getElementById('profFirstName').value = profile.first_name || '';
  document.getElementById('profLastName').value = profile.last_name || '';
  document.getElementById('profCountry').value = profile.country || '';
  document.getElementById('profCity').value = profile.city || '';
  document.getElementById('profPhone').value = profile.phone || '';
  document.getElementById('profPhoneVisible').checked = !!profile.phone_visible;

  renderAvatarPreview(profile.avatar_url, profile.first_name, user.email);
}

function renderAvatarPreview(avatarUrl, firstName, email) {
  const preview = document.getElementById('avatarPreview');
  if (avatarUrl) {
    preview.textContent = '';
    preview.style.backgroundImage = `url("${avatarUrl}")`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
  } else {
    preview.style.backgroundImage = 'none';
    preview.textContent = (firstName?.[0] || email[0]).toUpperCase();
  }
}

function setupProfileForm() {
  document.getElementById('btnChangePhoto').addEventListener('click', () => {
    document.getElementById('avatarInput').click();
  });

  document.getElementById('avatarInput').addEventListener('change', handleAvatarUpload);

  document.getElementById('profileForm').addEventListener('submit', handleProfileSave);
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const extension = file.name.split('.').pop();
  const path = `${currentUserId}/avatar-${Date.now()}.${extension}`;

  const uploadBtn = document.getElementById('btnChangePhoto');
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading…';

  const { error: uploadError } = await supabaseClient.storage
    .from('avatars')
    .upload(path, file, { upsert: true });

  if (uploadError) {
    showToast('Photo upload failed: ' + uploadError.message, 'danger');
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Change photo';
    return;
  }

  const { data: { publicUrl } } = supabaseClient.storage.from('avatars').getPublicUrl(path);

  const { error: updateError } = await supabaseClient
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', currentUserId);

  uploadBtn.disabled = false;
  uploadBtn.textContent = 'Change photo';

  if (updateError) {
    showToast('Photo uploaded, but saving it to your profile failed: ' + updateError.message, 'danger');
    return;
  }

  renderAvatarPreview(publicUrl, null, document.getElementById('profEmail').value);
  showToast('Profile photo updated.', 'success');
  updateAuthUI(); // refresh the small avatar in the topbar too
}

async function handleProfileSave(e) {
  e.preventDefault();

  const saveBtn = document.getElementById('profileSave');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      first_name: document.getElementById('profFirstName').value.trim(),
      last_name: document.getElementById('profLastName').value.trim(),
      country: document.getElementById('profCountry').value,
      city: document.getElementById('profCity').value.trim(),
      phone: document.getElementById('profPhone').value.trim(),
      phone_visible: document.getElementById('profPhoneVisible').checked
    })
    .eq('id', currentUserId);

  saveBtn.disabled = false;
  saveBtn.textContent = 'Save changes';

  if (error) {
    showToast('Could not save your changes: ' + error.message, 'danger');
    return;
  }

  showToast('Your profile has been updated.', 'success');
  updateAuthUI(); // refreshes the name shown in the topbar dropdown
}

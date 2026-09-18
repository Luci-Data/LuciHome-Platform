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
  document.getElementById('dangerZone').style.display = 'block';

  await loadProfile(session.user);
  setupProfileForm();
  document.getElementById('btnDeactivateAccount').addEventListener('click', handleDeactivateAccount);
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
    preview.style.background = `#fff url("${avatarUrl}") center/cover no-repeat`;
  } else {
    preview.style.background = 'var(--accent)';
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
  logNotification(currentUserId, 'profile_updated', 'Profile updated', 'Your profile details were saved successfully.');
}

async function handleDeactivateAccount() {
  const confirmed = window.confirm(
    'This will permanently delete your listings, photos, favorites, and profile, and sign you out. This cannot be undone. Continue?'
  );
  if (!confirmed) return;

  const btn = document.getElementById('btnDeactivateAccount');
  btn.disabled = true;
  btn.textContent = 'Deactivating…';

  // 1. Clean up storage for every listing this account owns.
  const { data: myListings } = await supabaseClient.from('listings').select('id').eq('owner_id', currentUserId);
  for (const listing of myListings || []) {
    await cleanupListingPhotos(currentUserId, listing.id);
  }

  // 2. Delete the listings themselves (cascades to their listing_photos rows).
  await supabaseClient.from('listings').delete().eq('owner_id', currentUserId);

  // 3. Delete this account's favorites.
  await supabaseClient.from('favorites').delete().eq('user_id', currentUserId);

  // 4. Remove the avatar photo from storage.
  await cleanupAvatar(currentUserId);

  // 5. Delete the profile row itself.
  const { error } = await supabaseClient.from('profiles').delete().eq('id', currentUserId);

  if (error) {
    showToast('Could not finish deactivating your account: ' + error.message, 'danger');
    btn.disabled = false;
    btn.textContent = 'Deactivate my account';
    return;
  }

  // 6. Sign out.
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}

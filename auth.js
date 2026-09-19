// ==========================================================================
// LuciHome — authentication (Stage 2)
//
// This connects the Create account / Log in / Log out buttons to real
// Supabase accounts. It relies on a few helpers already defined in home.js
// (openModal, closeModal, showToast, isAtLeast18), so home.js must load
// before this file.
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  setupAuthActions();
  updateAuthUI();

  // Keeps the topbar in sync if the session changes in another tab, or
  // right after sign-up/sign-in/sign-out in this one.
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    renderAuthState(session);
  });
});

let registrationStep = 'form'; // 'form' or 'verify'
let pendingRegisterEmail = '';
let pendingRegisterFirstName = '';

function setupAuthActions() {
  document.getElementById('registerSubmit').addEventListener('click', () => {
    if (registrationStep === 'form') handleRegister();
    else handleVerifyRegistration();
  });
  document.getElementById('resendRegCode').addEventListener('click', handleResendRegisterCode);
  document.getElementById('loginSubmit').addEventListener('click', handleLogin);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);
  document.getElementById('btnMyProfile').addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
  document.getElementById('btnMyListings').addEventListener('click', () => {
    window.location.href = 'my-listings.html';
  });
  document.getElementById('btnMyFavorites').addEventListener('click', () => {
    window.location.href = 'favorites.html';
  });
  document.getElementById('btnMessages').addEventListener('click', () => {
    window.location.href = 'messages.html';
  });

  // "Add listing" behaves differently depending on whether you're logged in.
  document.getElementById('btnAddListing').addEventListener('click', () => {
    showToast('Create an account (or log in) to publish a listing.', 'danger');
    openModal(document.getElementById('registerModal'));
  });
  document.getElementById('btnAddListingLoggedIn').addEventListener('click', () => {
    window.location.href = 'add-listing.html';
  });

  const avatar = document.getElementById('userAvatar');
  const dropdown = document.getElementById('userDropdown');
  avatar.addEventListener('click', () => dropdown.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (dropdown.classList.contains('open') && !dropdown.contains(e.target) && e.target !== avatar) {
      dropdown.classList.remove('open');
    }
  });
}

async function updateAuthUI() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  renderAuthState(session);
}

// Shows the Login/Create account buttons when logged out, or the avatar
// + logout menu when logged in.
async function renderAuthState(session) {
  const authButtons = document.getElementById('authButtons');
  const userMenu = document.getElementById('userMenu');

  if (!session || !session.user) {
    authButtons.style.display = 'flex';
    userMenu.style.display = 'none';
    return;
  }

  authButtons.style.display = 'none';
  userMenu.style.display = 'flex';

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('first_name,last_name,avatar_url')
    .eq('id', session.user.id)
    .single();

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : session.user.email;
  const initial = (profile?.first_name?.[0] || session.user.email[0]).toUpperCase();

  document.getElementById('userDisplayName').textContent = displayName;
  document.getElementById('userEmail').textContent = session.user.email;

  const avatarEl = document.getElementById('userAvatar');
  if (profile?.avatar_url) {
    avatarEl.textContent = '';
    avatarEl.style.background = `#fff url("${profile.avatar_url}") center/cover no-repeat`;
  } else {
    avatarEl.style.background = 'var(--accent)';
    avatarEl.textContent = initial;
  }
}

async function handleRegister() {
  const form = document.getElementById('registerForm');
  if (!form.reportValidity()) return;

  const birthDate = document.getElementById('regBirthDate').value;
  if (!isAtLeast18(birthDate)) {
    showToast('You must be at least 18 years old to create an account.', 'danger');
    return;
  }

  const password = document.getElementById('regPassword').value;
  if (password !== document.getElementById('regPasswordConfirm').value) {
    showToast('Passwords do not match.', 'danger');
    return;
  }

  const submitBtn = document.getElementById('registerSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account…';

  const email = document.getElementById('regEmail').value.trim();
  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    showToast(error.message, 'danger');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
    return;
  }

  const userId = data.user?.id;
  if (!userId) {
    showToast('Something went wrong creating your account. Please try again.', 'danger');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
    return;
  }

  const firstName = document.getElementById('regFirstName').value.trim();

  const { error: profileError } = await supabaseClient.from('profiles').insert({
    id: userId,
    first_name: firstName,
    last_name: document.getElementById('regLastName').value.trim(),
    birth_date: birthDate,
    gender: document.getElementById('regGender').value,
    country: document.getElementById('regCountry').value,
    city: document.getElementById('regCity').value.trim(),
    phone: document.getElementById('regPhone').value.trim(),
    phone_visible: document.getElementById('regPhoneVisible').checked
  });

  if (profileError) {
    showToast('Your account was created, but saving your details failed: ' + profileError.message, 'danger');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
    return;
  }

  // With email confirmation OFF (shouldn't normally happen with this flow,
  // but handled just in case), signUp already returns a session.
  if (data.session) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
    form.reset();
    closeModal(document.getElementById('registerModal'));
    showToast(`Welcome to LuciHome, ${firstName}! 🎉`, 'success');
    updateAuthUI();
    return;
  }

  // Normal path: switch the same modal to the "enter your code" step.
  pendingRegisterEmail = email;
  pendingRegisterFirstName = firstName;
  registrationStep = 'verify';

  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('regVerifyEmail').textContent = email;
  document.getElementById('registerVerifyStep').style.display = 'block';

  submitBtn.disabled = false;
  submitBtn.textContent = 'Verify & finish';

  showToast('Check your email for a verification code.', 'success');
}

async function handleVerifyRegistration() {
  const code = document.getElementById('regVerifyCode').value.trim();
  if (!code) {
    showToast('Enter the code from your email.', 'danger');
    return;
  }

  const submitBtn = document.getElementById('registerSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying…';

  const { error } = await supabaseClient.auth.verifyOtp({
    email: pendingRegisterEmail,
    token: code,
    type: 'signup'
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Verify & finish';

  if (error) {
    showToast('Invalid or expired code: ' + error.message, 'danger');
    return;
  }

  const firstName = pendingRegisterFirstName;
  registrationStep = 'form';
  document.getElementById('registerForm').reset();
  closeModal(document.getElementById('registerModal'));
  showToast(`Welcome to LuciHome, ${firstName}! 🎉`, 'success');
  updateAuthUI();
}

async function handleResendRegisterCode(e) {
  e.preventDefault();
  if (!pendingRegisterEmail) return;

  const { error } = await supabaseClient.auth.resend({ type: 'signup', email: pendingRegisterEmail });
  if (error) {
    showToast('Could not resend the code: ' + error.message, 'danger');
    return;
  }
  showToast('A new code is on its way.', 'success');
}

// Called every time the register modal is opened, so a cancelled
// verification doesn't carry over into the next attempt.
function resetRegisterModalStep() {
  registrationStep = 'form';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('registerVerifyStep').style.display = 'none';
  document.getElementById('registerSubmit').textContent = 'Create account';
}

async function handleLogin() {
  const form = document.getElementById('loginForm');
  if (!form.reportValidity()) return;

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const submitBtn = document.getElementById('loginSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in…';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Log in';

  if (error) {
    showToast(error.message, 'danger');
    return;
  }

  form.reset();
  closeModal(document.getElementById('loginModal'));
  updateAuthUI();

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('first_name')
    .eq('id', data.user.id)
    .single();

  showToast(profile?.first_name ? `Welcome back, ${profile.first_name}!` : 'Welcome back!', 'success');
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  document.getElementById('userDropdown').classList.remove('open');
  showToast('You have been logged out.', 'success');
  updateAuthUI();
}

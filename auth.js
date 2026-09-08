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

function setupAuthActions() {
  document.getElementById('registerSubmit').addEventListener('click', handleRegister);
  document.getElementById('loginSubmit').addEventListener('click', handleLogin);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);

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
    .select('first_name,last_name')
    .eq('id', session.user.id)
    .single();

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : session.user.email;
  const initial = (profile?.first_name?.[0] || session.user.email[0]).toUpperCase();

  document.getElementById('userDisplayName').textContent = displayName;
  document.getElementById('userEmail').textContent = session.user.email;
  document.getElementById('userAvatar').textContent = initial;
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

  // With "Confirm email" turned off (Stage 2 setup), data.user exists right
  // away and the person is already logged in. If confirmation gets turned
  // back on later, data.user still exists but there's no session yet —
  // we still save the profile so it's ready the moment they confirm.
  const userId = data.user?.id;
  if (!userId) {
    showToast('Something went wrong creating your account. Please try again.', 'danger');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
    return;
  }

  const { error: profileError } = await supabaseClient.from('profiles').insert({
    id: userId,
    first_name: document.getElementById('regFirstName').value.trim(),
    last_name: document.getElementById('regLastName').value.trim(),
    birth_date: birthDate,
    gender: document.getElementById('regGender').value,
    country: document.getElementById('regCountry').value,
    city: document.getElementById('regCity').value.trim(),
    phone: document.getElementById('regPhone').value.trim(),
    phone_visible: document.getElementById('regPhoneVisible').checked
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Create account';

  if (profileError) {
    showToast('Your account was created, but saving your details failed: ' + profileError.message, 'danger');
    return;
  }

  showToast('Account created — welcome to LuciHome!', 'success');
  form.reset();
  closeModal(document.getElementById('registerModal'));
  updateAuthUI();
}

async function handleLogin() {
  const form = document.getElementById('loginForm');
  if (!form.reportValidity()) return;

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const submitBtn = document.getElementById('loginSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in…';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Log in';

  if (error) {
    showToast(error.message, 'danger');
    return;
  }

  showToast('Welcome back!', 'success');
  form.reset();
  closeModal(document.getElementById('loginModal'));
  updateAuthUI();
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  document.getElementById('userDropdown').classList.remove('open');
  showToast('You have been logged out.', 'success');
  updateAuthUI();
}

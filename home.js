// ==========================================================================
// LuciHome — homepage logic (Stage 1: no backend calls yet)
//
// This file only handles what the user SEES: filling the country dropdowns,
// opening/closing the login & register windows (modals), switching the
// "For sale / For rent" tabs, and showing small confirmation messages
// (toasts). Nothing here talks to Supabase yet — that connection is added
// in the next stage, once this UI is confirmed to work.
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  fillCountryDropdowns();
  setupSearchTabs();
  setupModals();
  setupSearchForm();
  document.getElementById('year').textContent = new Date().getFullYear();
});

// Fill every <select> that should list countries (search box + register form)
function fillCountryDropdowns() {
  const selects = document.querySelectorAll('#fCountry, #regCountry, #profCountry, #listCountry');
  selects.forEach((select) => {
    LUCIHOME_COUNTRIES.forEach((country) => {
      const option = document.createElement('option');
      option.value = country;
      option.textContent = country;
      select.appendChild(option);
    });
  });
}

// "For sale" / "For rent" tabs above the search box
function setupSearchTabs() {
  const tabs = document.querySelectorAll('.search-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

// Opening / closing the login and register modals
function setupModals() {
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');

  document.getElementById('btnOpenLogin').addEventListener('click', () => openModal(loginModal));
  document.getElementById('btnOpenRegister').addEventListener('click', () => openModal(registerModal));

  document.getElementById('switchToRegister').addEventListener('click', () => {
    closeModal(loginModal);
    openModal(registerModal);
  });

  // Any element with data-close-modal closes its parent modal
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal-overlay')));
  });

  // Clicking the dark backdrop also closes the modal
  [loginModal, registerModal].forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });
}

function openModal(modal) { modal.classList.add('open'); }
function closeModal(modal) { modal.classList.remove('open'); }

// The property search itself (results page) is a later stage — for now
// we just confirm the click so the button doesn't feel dead.
function setupSearchForm() {
  const searchForm = document.getElementById('searchForm');
  if (!searchForm) return; // this page (e.g. profile.html) has no search bar
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Search results page is coming in a later stage.', 'success');
  });
}

function isAtLeast18(dateString) {
  if (!dateString) return false;
  const birthDate = new Date(dateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 18;
}

// Small snackbar-style confirmation message (uses the .toast styles from workspace.css)
function showToast(message, type = 'success') {
  const stack = document.getElementById('toastStack');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'danger' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${message}</span>`;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

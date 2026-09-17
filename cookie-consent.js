// ==========================================================================
// LuciHome — cookie / local storage consent banner
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;

  if (localStorage.getItem('lucihome_cookie_consent') === 'yes') return;

  banner.style.display = 'flex';
  document.getElementById('cookieAccept').addEventListener('click', () => {
    localStorage.setItem('lucihome_cookie_consent', 'yes');
    banner.style.display = 'none';
  });
});

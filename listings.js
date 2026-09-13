// ==========================================================================
// LuciHome — browse / search results (Stage 6, favorites added in Stage 7)
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupResultsTypeToggle();
  applyFiltersFromUrl();
  document.getElementById('filtersForm').addEventListener('submit', (e) => {
    e.preventDefault();
    runSearchFromForm();
  });
  await loadFavoriteIds();
  runSearchFromForm();
});

function setupResultsTypeToggle() {
  const buttons = document.querySelectorAll('#resultsTypeToggle .type-toggle-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// Pre-fill the filter bar from ?country=&type=&city=&propertyType= (set by
// the homepage search box), so the results match what was searched there.
function applyFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const type = params.get('type');
  if (type) {
    const buttons = document.querySelectorAll('#resultsTypeToggle .type-toggle-btn');
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.value === type));
  }
  if (params.get('country')) document.getElementById('resCountry').value = params.get('country');
  if (params.get('city')) document.getElementById('resCity').value = params.get('city');
  if (params.get('propertyType')) document.getElementById('resPropertyType').value = params.get('propertyType');
}

async function runSearchFromForm() {
  const activeTypeBtn = document.querySelector('#resultsTypeToggle .type-toggle-btn.active');

  const filters = {
    listingType: activeTypeBtn ? activeTypeBtn.dataset.value : '',
    country: document.getElementById('resCountry').value,
    city: document.getElementById('resCity').value.trim(),
    propertyType: document.getElementById('resPropertyType').value,
    minPrice: document.getElementById('resMinPrice').value,
    maxPrice: document.getElementById('resMaxPrice').value
  };

  await runSearch(filters);
}

async function runSearch(filters) {
  const loading = document.getElementById('resultsLoading');
  const empty = document.getElementById('resultsEmpty');
  const grid = document.getElementById('resultsGrid');
  const count = document.getElementById('resultsCount');

  loading.style.display = 'block';
  empty.style.display = 'none';
  grid.innerHTML = '';
  count.textContent = '';

  let query = supabaseClient
    .from('listings')
    .select('id,listing_type,property_type,title,price,currency,country,city,neighborhood,bedrooms,bathrooms,area_sqm,listing_photos(photo_url,sort_order)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(60);

  if (filters.listingType) query = query.eq('listing_type', filters.listingType);
  if (filters.country) query = query.eq('country', filters.country);
  if (filters.city) query = query.ilike('city', `%${filters.city}%`);
  if (filters.propertyType) query = query.eq('property_type', filters.propertyType);
  if (filters.minPrice) query = query.gte('price', Number(filters.minPrice));
  if (filters.maxPrice) query = query.lte('price', Number(filters.maxPrice));

  const { data, error } = await query;

  loading.style.display = 'none';

  if (error) {
    showToast('Could not load listings: ' + error.message, 'danger');
    return;
  }

  if (!data || data.length === 0) {
    empty.style.display = 'block';
    count.textContent = '';
    return;
  }

  count.textContent = `${data.length} listing${data.length === 1 ? '' : 's'} found`;
  data.forEach((listing) => grid.appendChild(renderListingCard(listing)));
}

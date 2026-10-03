(() => {
  const search = document.querySelector('#tool-search');
  if (!search) return;
  const english = document.documentElement.lang === 'en';
  const groups = [...document.querySelectorAll('.tech-group')];
  const links = groups.flatMap(group => [...group.querySelectorAll('a')]);
  const status = document.querySelector('.search-status');
  const empty = document.querySelector('.empty-state');
  const categoryLinks = [...document.querySelectorAll('.tech-jump a')];
  const all = document.querySelector('[data-category="all"]');
  const detailsState = new Map();
  let category = 'all';
  let wasSearching = false;
  const normalize = text => text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  document.querySelector('.directory-summary').textContent = english
    ? `${groups.length} categories · ${links.length} entry points`
    : `${groups.length} kategorier · ${links.length} innganger`;
  document.querySelector('.directory-search').hidden = false;
  status.hidden = false;
  all.hidden = false;
  function update() {
    const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    const searching = words.length > 0;
    if (searching && !wasSearching) groups.forEach(group => group.querySelectorAll('details').forEach(detail => detailsState.set(detail, detail.open)));
    let count = 0;
    let groupCount = 0;
    groups.forEach(group => {
      let matches = 0;
      const heading = group.querySelector('h2').textContent;
      group.querySelectorAll('a').forEach(link => {
        const text = normalize(heading + ' ' + link.textContent);
        const visible = (category === 'all' || category === group.id) && words.every(word => text.includes(word));
        link.hidden = !visible;
        if (visible) matches++;
      });
      group.hidden = matches === 0;
      group.querySelectorAll('details').forEach(detail => {
        const hasMatch = [...detail.querySelectorAll('a')].some(link => !link.hidden);
        detail.hidden = !hasMatch;
        if (searching) detail.open = hasMatch;
        else if (wasSearching) detail.open = detailsState.get(detail) ?? false;
      });
      count += matches;
      if (matches) groupCount++;
    });
    wasSearching = searching;
    all.setAttribute('aria-pressed', String(category === 'all'));
    categoryLinks.forEach(link => {
      if (link.hash.slice(1) === category) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    status.textContent = english
      ? `${count} ${count === 1 ? "entry point" : "entry points"} in ${groupCount} ${groupCount === 1 ? "category" : "categories"}`
      : `${count} ${count === 1 ? "inngang" : "innganger"} i ${groupCount} ${groupCount === 1 ? "kategori" : "kategorier"}`;
    empty.hidden = count !== 0;
  }
  search.addEventListener('input', update);
  document.querySelector('#clear-search').addEventListener('click', () => {
    search.value = '';
    update();
    search.focus();
  });
  all.addEventListener('click', () => { category = 'all'; update(); });
  categoryLinks.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    category = link.hash.slice(1);
    update();
  }));
  update();
})();

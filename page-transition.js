(() => {
  const legacyPaths = {
    '/shop.html': '/shop',
    '/account.html': '/account',
  };
  const cleanPath = legacyPaths[location.pathname];
  if (cleanPath) history.replaceState(null, '', `${cleanPath}${location.search}${location.hash}`);

  const customerPages = new Set(['', 'shop', 'account']);

  const scrollToCurrentSection = behavior => {
    if (!location.hash) return;
    const section = document.querySelector(location.hash);
    if (section) window.requestAnimationFrame(() => section.scrollIntoView({ behavior, block: 'start' }));
  };

  const finishEntering = () => {
    document.documentElement.classList.remove('page-leaving');
    document.documentElement.classList.add('page-entering');
    window.setTimeout(() => document.documentElement.classList.remove('page-entering'), 180);
    scrollToCurrentSection('instant');
  };

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;

    const destination = new URL(link.href, location.href);
    const page = destination.pathname.split('/').pop();
    if (destination.origin !== location.origin || !customerPages.has(page) || destination.href === location.href) return;

    if (destination.pathname === location.pathname && destination.hash) {
      const section = document.querySelector(destination.hash);
      if (!section) return;
      event.preventDefault();
      history.pushState(null, '', destination.href);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    event.preventDefault();
    document.documentElement.classList.add('page-leaving');
    window.setTimeout(() => { location.href = destination.href; }, 90);
  });

  window.addEventListener('pageshow', finishEntering);
  finishEntering();
})();

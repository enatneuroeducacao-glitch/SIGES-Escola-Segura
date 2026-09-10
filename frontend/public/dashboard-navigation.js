(() => {
  const targets = [
    { label: 'Base Escolar', filter: null },
    { label: 'Base Escolar', filter: 'P1' },
    { label: 'Base Escolar', filter: 'P2' },
    { label: 'Base Escolar', filter: 'P3' },
    { label: 'Radar Territorial', filter: null },
    { label: 'Radar Territorial', filter: null },
    { label: 'Evidências', filter: null },
    { label: 'Sinistros / Corredores', filter: null }
  ];

  const findNav = (label) => [...document.querySelectorAll('aside nav button')].find((b) =>
    b.textContent.trim().toLowerCase() === label.toLowerCase()
  );

  const go = (label, filter) => {
    const button = findNav(label);
    if (!button) return;
    button.click();
    if (!filter) return;
    let attempts = 0;
    const apply = () => {
      const filterButton = [...document.querySelectorAll('.filters button')].find((b) => b.textContent.trim() === filter);
      if (filterButton) filterButton.click();
      else if (++attempts < 20) setTimeout(apply, 50);
    };
    setTimeout(apply, 50);
  };

  const makeInteractive = (element, target, title) => {
    if (!element || element.dataset.sigesDashboardNav) return;
    element.dataset.sigesDashboardNav = '1';
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('title', title);
    element.style.cursor = 'pointer';
    element.addEventListener('click', () => go(target.label, target.filter));
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        go(target.label, target.filter);
      }
    });
  };

  const enhance = () => {
    if (!document.querySelector('.app')) return;
    document.querySelectorAll('.cards .metric').forEach((card, index) => {
      const target = targets[index];
      if (target) makeInteractive(card, target, `Abrir ${target.filter ? `Base Escolar · ${target.filter}` : target.label}`);
    });

    document.querySelectorAll('.grid2 .panel').forEach((panel) => {
      const heading = panel.querySelector('h3')?.textContent?.trim();
      if (heading === 'Unidades que entram primeiro no radar') {
        makeInteractive(panel, { label: 'Base Escolar', filter: null }, 'Abrir Base Escolar');
      }
    });
  };

  const start = () => {
    enhance();
    new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

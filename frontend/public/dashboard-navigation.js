(() => {
  const metricTargets = ['Escolas','Alunos','Alunos Guia','Professores e Instrutores','Escolas'];

  function navButton(label) {
    return [...document.querySelectorAll('.nav-item')].find((button) =>
      button.textContent.trim().toLowerCase().includes(label.toLowerCase())
    );
  }

  function go(label) {
    const button = navButton(label);
    if (button) {
      button.click();
      return true;
    }
    return false;
  }

  function makeInteractive(element, label, title) {
    if (!element || element.dataset.sigesDashboardNav === label) return;
    element.dataset.sigesDashboardNav = label;
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('title', title || `Abrir ${label}`);
    element.style.cursor = 'pointer';
    element.addEventListener('click', () => go(label));
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        go(label);
      }
    });
  }

  function enhanceDashboard() {
    const dashboard = document.querySelector('.dashboard');
    if (!dashboard) return;

    dashboard.querySelectorAll('.metric').forEach((card, index) => {
      const label = metricTargets[index];
      if (label) makeInteractive(card, label, `Abrir ${label}`);
    });

    const indexCards = dashboard.querySelectorAll('.highlight-grid .index-card');
    if (indexCards[0]) makeInteractive(indexCards[0], 'Avaliações e HSI-DOTH-P', 'Abrir avaliações HSI-DOTH-P de trânsito');
    if (indexCards[1]) makeInteractive(indexCards[1], 'Avaliações e HSI-DOTH-P', 'Abrir avaliações HSI-DOTH-P de bullying');

    const attention = dashboard.querySelectorAll('.attention > div');
    if (attention[0]) makeInteractive(attention[0], 'Riscos e Ocorrências', 'Abrir riscos e ocorrências');
    if (attention[1]) makeInteractive(attention[1], 'Reivindicações', 'Abrir reivindicações');
    if (attention[2]) makeInteractive(attention[2], 'Plano de Ação', 'Abrir planos de ação');

    const governance = dashboard.querySelectorAll('.gov > div');
    if (governance[0]) makeInteractive(governance[0], 'Certificação', 'Abrir certificação');
    if (governance[1]) makeInteractive(governance[1], 'Avaliações e HSI-DOTH-P', 'Abrir avaliações registradas');
    if (governance[2]) makeInteractive(governance[2], 'Auditoria', 'Abrir auditoria e usuários');
  }

  const observer = new MutationObserver(enhanceDashboard);
  const start = () => {
    if (!document.body) return;
    enhanceDashboard();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

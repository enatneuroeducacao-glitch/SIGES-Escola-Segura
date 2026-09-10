(() => {
  const kpiTargets = [
    { label: 'Base Escolar', filter: null },
    { label: 'Base Escolar', filter: 'P1' },
    { label: 'Base Escolar', filter: 'P2' },
    { label: 'Base Escolar', filter: 'P3' },
    { label: 'Radar Territorial', filter: null },
    { label: 'Radar Territorial', filter: null },
    { label: 'Evidências', filter: null },
    { label: 'Sinistros / Corredores', filter: null }
  ];

  const quickLinks = [
    ['Base Escolar', 'Consultar as 162 unidades e abrir dossiês'],
    ['Radar Territorial', 'Prioridades territoriais e corredores'],
    ['Evidências', 'Fontes técnicas e evidências rastreáveis'],
    ['Sinistros / Corredores', 'Acidentes e corredores críticos'],
    ['Fontes e Dados Externos', 'Dados públicos e fontes utilizadas'],
    ['Riscos e Ocorrências', 'Registrar e acompanhar ocorrências'],
    ['Reivindicações', 'Demandas e reivindicações institucionais'],
    ['Plano de Ação', 'Planejar ações e responsáveis'],
    ['Aluno Guia', 'Avaliações HSI-DOTH-P do Aluno Guia'],
    ['Relatórios', 'Relatórios executivos e operacionais'],
    ['Auditoria', 'Histórico e rastreabilidade administrativa'],
    ['Configurações', 'Parâmetros e configurações do SIGES']
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
      else if (++attempts < 30) setTimeout(apply, 50);
    };
    setTimeout(apply, 80);
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

  const injectQuickNavigation = () => {
    const dashboard = document.querySelector('.app main > section');
    const cards = dashboard?.querySelector('.cards');
    if (!dashboard || !cards || document.querySelector('[data-siges-quick-nav]')) return;

    const wrap = document.createElement('div');
    wrap.setAttribute('data-siges-quick-nav', '1');
    wrap.style.cssText = 'margin-top:16px;background:#fff;border:1px solid #e0e8ec;border-radius:13px;padding:18px 19px;';

    const heading = document.createElement('div');
    heading.style.cssText = 'display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:13px;';
    heading.innerHTML = '<div><small style="color:#58aaa8;letter-spacing:.16em;font-size:9px;font-weight:900;">NAVEGAÇÃO EXECUTIVA</small><h3 style="font-size:15px;font-weight:600;margin:5px 0 0;color:#173044;">Acesse diretamente os módulos do SIGES</h3></div><span style="font-size:9px;color:#87959f;">Painel → módulo</span>';
    wrap.appendChild(heading);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;';

    quickLinks.forEach(([label, description]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.style.cssText = 'border:1px solid #dbe5e9;background:#f8fafb;border-radius:9px;padding:11px 12px;text-align:left;color:#173044;min-height:66px;transition:.15s;';
      button.innerHTML = `<strong style="display:block;font-size:10px;margin-bottom:4px;">${label}</strong><span style="display:block;font-size:8px;line-height:1.45;color:#7d8c96;">${description}</span>`;
      button.addEventListener('mouseenter', () => { button.style.borderColor = '#57aaa7'; button.style.background = '#edf7f6'; });
      button.addEventListener('mouseleave', () => { button.style.borderColor = '#dbe5e9'; button.style.background = '#f8fafb'; });
      button.addEventListener('click', () => go(label));
      grid.appendChild(button);
    });

    wrap.appendChild(grid);
    cards.insertAdjacentElement('afterend', wrap);
  };

  const enhance = () => {
    if (!document.querySelector('.app')) return;

    document.querySelectorAll('.cards .metric').forEach((card, index) => {
      const target = kpiTargets[index];
      if (target) makeInteractive(card, target, `Abrir ${target.filter ? `Base Escolar · ${target.filter}` : target.label}`);
    });

    document.querySelectorAll('.grid2 .panel').forEach((panel) => {
      const heading = panel.querySelector('h3')?.textContent?.trim();
      if (heading === 'Unidades que entram primeiro no radar') {
        makeInteractive(panel, { label: 'Base Escolar', filter: null }, 'Abrir Base Escolar');
      }
    });

    injectQuickNavigation();
  };

  const start = () => {
    enhance();
    new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

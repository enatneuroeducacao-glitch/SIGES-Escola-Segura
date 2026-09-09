import React, { useEffect, useState } from 'react';
import {
  Database,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  LocateFixed,
  Printer,
} from 'lucide-react';
import './public-sources.css';

const fmt = (value) => {
  if (value == null) return '—';
  return typeof value === 'number'
    ? value.toLocaleString('pt-BR')
    : String(value);
};

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

function printTable(title, subtitle, headers, rows) {
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    alert('Permita pop-ups para imprimir.');
    return;
  }

  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
body{font:13px Arial,sans-serif;color:#182b39;margin:30px}
h1{font-size:23px;margin-bottom:6px}
p{color:#667782;font-size:11px}
table{width:100%;border-collapse:collapse;font-size:10px}
th,td{border:1px solid #ccd5da;padding:6px;text-align:left;vertical-align:top}
th{background:#f0f3f5}
a{color:#145f72}
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(subtitle)}</p>
<table>
<thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
</table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body>
</html>`);
  win.document.close();
}

function SourceCard({ name, desc, active, onClick }) {
  return (
    <button
      type="button"
      className={`source-card ${active ? 'active' : 'planned'}`}
      onClick={onClick}
    >
      <div className="source-icon"><Database size={20} /></div>
      <div><b>{name}</b><span>{desc}</span></div>
      <em>
        {active ? <><CheckCircle2 size={14} /> CONSULTANDO</> : 'CONECTOR'}
      </em>
    </button>
  );
}

export default function PublicSources() {
  const [tab, setTab] = useState('cbvj');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (source) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/public-sources/${source}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Falha na fonte pública');
      setData(json);
    } catch (err) {
      setData(null);
      setError(err.message || 'Falha na consulta');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('cbvj');
  }, []);

  const select = (source) => {
    setTab(source);
    load(source);
  };

  const print = () => {
    if (!data) return;

    let headers;
    let rows;

    if (tab === 'cbvj') {
      headers = ['Rank', 'Corredor', '2024', '2025', 'Variação'];
      rows = (data.corridors || []).map((item) => [
        item.rank2025,
        item.road,
        item.value2024,
        item.value2025,
        item.variation2024to2025 == null ? '—' : `${item.variation2024to2025}%`,
      ]);
    } else if (tab === 'detrans') {
      headers = ['Rank', 'Corredor', 'Estudos'];
      rows = (data.corridors || []).slice(0, 50).map((item) => [
        item.rank,
        item.road,
        item.count,
      ]);
    } else {
      headers = ['Escola', 'Correspondência', 'Distância', 'Estudo'];
      rows = (data.records || []).map((item) => [
        item.school,
        item.correspondence,
        item.distanceMeters == null ? '—' : `${item.distanceMeters} m`,
        item.studyTitle || '—',
      ]);
    }

    printTable(
      `SIGES — Fonte ${tab.toUpperCase()}`,
      `Consulta pública · ${data.retrievedAt ? new Date(data.retrievedAt).toLocaleString('pt-BR') : 'data não informada'}`,
      headers,
      rows.map((row) => row.map(esc)),
    );
  };

  return (
    <section>
      <div className="section-head">
        <div>
          <small>CENTRAL DE FONTES · DADOS PÚBLICOS</small>
          <h2>Fontes e Dados Externos</h2>
          <p>Leitura somente consulta; fontes originais não são alteradas pelo SIGES.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary" type="button" onClick={() => load(tab)} disabled={loading}>
            <RefreshCw size={15} /> {loading ? 'Consultando' : 'Atualizar fonte'}
          </button>
          <button className="primary" type="button" onClick={print} disabled={!data}>
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>

      {error && (
        <div className="source-alert">
          <AlertTriangle size={18} />
          <div>
            <b>Fonte temporariamente indisponível</b>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="source-grid">
        <SourceCard
          name="CBVJ"
          desc="Ocorrências e ranking de corredores"
          active={tab === 'cbvj'}
          onClick={() => select('cbvj')}
        />
        <SourceCard
          name="DETRANS"
          desc="Estudos técnicos publicados"
          active={tab === 'detrans'}
          onClick={() => select('detrans')}
        />
        <SourceCard
          name="DETRANS ↔ SIMGeo"
          desc="Correlação espacial conservadora"
          active={tab === 'detransSpatial'}
          onClick={() => select('detransSpatial')}
        />
        <SourceCard
          name="SIMGEO"
          desc="Camadas geográficas públicas"
          active={tab === 'simgeo'}
          onClick={() => select('simgeo')}
        />
      </div>

      {data && tab === 'cbvj' && (
        <div className="panel">
          <div className="section-head">
            <div>
              <small>CBVJ</small>
              <h3>Corredores com maior número de acidentes</h3>
            </div>
            {data.urls?.['2025'] && (
              <a href={data.urls['2025']} target="_blank" rel="noreferrer">
                Abrir publicação <ExternalLink size={14} />
              </a>
            )}
          </div>
          <div className="source-meta">
            <div><small>ANO</small><strong>{fmt(data.latestCompleteYear)}</strong></div>
            <div><small>OCORRÊNCIAS 2025</small><strong>{fmt(data.summary?.totalOccurrences2025)}</strong></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rank</th><th>Corredor</th><th>2024</th><th>2025</th><th>Variação</th></tr></thead>
              <tbody>
                {(data.corridors || []).map((item) => (
                  <tr key={`${item.rank2025}-${item.road}`}>
                    <td>{item.rank2025}</td>
                    <td><b>{item.road}</b></td>
                    <td>{fmt(item.value2024)}</td>
                    <td>{fmt(item.value2025)}</td>
                    <td>{item.variation2024to2025 == null ? '—' : `${item.variation2024to2025}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && tab === 'detrans' && (
        <div className="panel">
          <div className="section-head">
            <div><small>DETRANS</small><h3>Estudos por corredor</h3></div>
            {data.urls?.publication && (
              <a href={data.urls.publication} target="_blank" rel="noreferrer">
                Abrir publicação <ExternalLink size={14} />
              </a>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rank</th><th>Corredor</th><th>Estudos</th></tr></thead>
              <tbody>
                {(data.corridors || []).slice(0, 50).map((item) => (
                  <tr key={`${item.rank}-${item.road}`}><td>{item.rank}</td><td>{item.road}</td><td>{item.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && tab === 'detransSpatial' && (
        <div className="panel">
          <div className="section-head">
            <div>
              <small>DETRANS ↔ SIMGeo</small>
              <h3>Correspondência espacial</h3>
              <p>Classificação: ponto exato, mesmo corredor, proximidade até 250 m ou sem correspondência.</p>
            </div>
            <LocateFixed size={22} />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Escola</th><th>Correspondência</th><th>Distância</th><th>Estudo associado</th></tr></thead>
              <tbody>
                {(data.records || []).map((item) => (
                  <tr key={item.schoolId || item.school}>
                    <td><b>{item.school}</b><br /><small>{item.address}</small></td>
                    <td>{item.correspondence}</td>
                    <td>{item.distanceMeters == null ? '—' : `${item.distanceMeters} m`}</td>
                    <td>
                      {item.studyTitle && item.studyUrl ? (
                        <a href={item.studyUrl} target="_blank" rel="noreferrer">
                          {item.studyTitle} <ExternalLink size={11} />
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && tab === 'simgeo' && (
        <div className="panel">
          <div className="section-head">
            <div><small>SIMGEO</small><h3>Inventário geográfico</h3></div>
            {data.urls?.portal && (
              <a href={data.urls.portal} target="_blank" rel="noreferrer">
                Abrir SIMGeo <ExternalLink size={14} />
              </a>
            )}
          </div>
          <div className="cards">
            <div className="metric"><small>Unidades escolares</small><strong>{fmt(data.summary?.schoolUnits)}</strong></div>
            <div className="metric"><small>Camadas de planejamento</small><strong>{fmt(data.summary?.planningLayers)}</strong></div>
          </div>
        </div>
      )}

      <div className="source-note">
        <span><b>Rastreabilidade:</b> fonte, URL original, data da leitura e método permanecem visíveis. “—” significa ausência de série comparável, não zero.</span>
      </div>
    </section>
  );
}

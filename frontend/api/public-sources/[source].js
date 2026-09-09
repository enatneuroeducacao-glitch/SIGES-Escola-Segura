const CBVJ_2025_URL = 'https://www.cbvj.org.br/blog/bombeiros-voluntarios-de-joinville-atenderam-14-574-ocorrencias-em-2025/';
const CBVJ_2024_URL = 'https://www.cbvj.org.br/blog/bombeiros-voluntarios-de-joinville-atenderam-mais-de-11-mil-ocorrencias-em-2024/';
const DETRANS_URL = 'https://www.joinville.sc.gov.br/publicacoes/estudos-tecnicos-equipamentos-de-fiscalizacao-eletronica-radares-e-lombadas/';
const SIMGEO_URL = 'https://www.joinville.sc.gov.br/servicos/acessar-sistema-de-informacoes-municipais-georreferenciadas-simgeo/';
const SIMGEO_ROOT = 'https://geo.joinville.sc.gov.br/server/rest/services/simgeo';
const SIMGEO_SCHOOLS = 'https://geo.joinville.sc.gov.br/server/rest/services/SEPUR/educacao_simgeo_v4/MapServer/1';
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map();

const clean = (v) => String(v ?? '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const decode = (v) => clean(String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&ndash;/g, '–'));
const number = (v) => { const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'SIGES-Escola-Segura/4.0 public-source-reader' } });
  if (!response.ok) throw new Error(`Fonte externa respondeu HTTP ${response.status}`);
  return response.text();
}
async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'SIGES-Escola-Segura/4.0 simgeo-reader' } });
  if (!response.ok) throw new Error(`SIMGeo respondeu HTTP ${response.status}`);
  return response.json();
}

function parseCbvjRanking(html) {
  const out = [];
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = [];
    const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let m;
    while ((m = re.exec(row))) cells.push(decode(m[1]));
    if (cells.length < 5) continue;
    const pos = cells[0].match(/^(\d{1,2})º?$/);
    if (!pos) continue;
    const v24 = number(cells[2]);
    const v25 = number(cells[4]);
    if (v24 == null || v25 == null) continue;
    out.push({ rank: Number(pos[1]), road2024: clean(cells[1]), value2024: v24, road2025: clean(cells[3]), value2025: v25 });
  }
  return out.filter(x => x.road2025 && x.value2025 != null).slice(0, 10);
}

function normalizeCbvj(rows) {
  return rows.sort((a, b) => a.rank - b.rank).map((x, i) => ({
    road: x.road2025,
    road2024: x.road2024,
    value2024: x.value2024,
    value2025: x.value2025,
    rank2025: i + 1,
    variation2024to2025: x.value2024 ? Number((((x.value2025 - x.value2024) / x.value2024) * 100).toFixed(2)) : null,
  }));
}

function extractRoad(title) {
  let s = clean(title.replace(/^Estudo Técnico(?: Redutor de Velocidade 40 kmh| Controlador de Velocidade 60km\/h| Controlador de Velocidade Semafórico)?\s*/i, ''));
  const match = s.match(/(?:Rua|Av\.?|Avenida|Rodovia|BR-)[^,–]+/i);
  if (!match) return 'Outros';
  s = match[0].replace(/\s+\d+[\wºª.-]*(?:\s*(?:e|,|\/|com|próx\.?|prox\.?|nº?|n°).*)?$/i, '');
  return clean(s).replace(/\s+(?:N-S|S-N|L-O|O-L)$/i, '') || clean(match[0]);
}

function parseDetrans(html) {
  const items = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]{0,900}?)(?=<a\s|<\/section|$)/gi;
  let match;
  while ((match = re.exec(html))) {
    const title = decode(match[2]);
    if (!/Estudo Técnico|Atualização Bienal/i.test(title)) continue;
    const tail = decode(match[3]);
    const dateMatch = tail.match(/Documento disponibilizado em\s*(\d{2}\/\d{2}\/\d{4})/i);
    items.push({ title, url: new URL(match[1], DETRANS_URL).href, date: dateMatch ? dateMatch[1] : null, year: dateMatch ? Number(dateMatch[1].slice(-4)) : null, road: extractRoad(title) });
  }
  const unique = []; const seen = new Set();
  for (const item of items) if (!seen.has(item.url)) { seen.add(item.url); unique.push(item); }
  const years = {}; const corridors = {};
  for (const item of unique) { const year = item.year || 'indefinido'; years[year] = (years[year] || 0) + 1; if (item.road && item.road !== 'Outros') corridors[item.road] = (corridors[item.road] || 0) + 1; }
  const ranking = Object.entries(corridors).map(([road, count]) => ({ road, count })).sort((a, b) => b.count - a.count).map((x, i) => ({ ...x, rank: i + 1 }));
  return { source: 'DETRANS', sourceName: 'Departamento de Trânsito de Joinville', municipality: 'Joinville', retrievedAt: new Date().toISOString(), latestCompleteYear: Math.max(...unique.map(x => x.year || 0)) || null, methodology: 'Inventário somente leitura dos estudos técnicos publicados oficialmente pelo DETRANS. O ranking representa quantidade de estudos por corredor, não acidentes.', urls: { publication: DETRANS_URL }, summary: { totalStudies: unique.length, studiesByYear: years }, corridors: ranking, documents: unique.slice(0, 120) };
}

async function cbvj() {
  const key = 'cbvj';
  if (cache.has(key) && cache.get(key).expires > Date.now()) return cache.get(key).data;
  const html = await fetchText(CBVJ_2025_URL);
  const text24 = await fetchText(CBVJ_2024_URL).catch(() => null);
  const corridors = normalizeCbvj(parseCbvjRanking(html));
  const data = { source: 'CBVJ', sourceName: 'Corpo de Bombeiros Voluntários de Joinville', municipality: 'Joinville', retrievedAt: new Date().toISOString(), latestCompleteYear: 2025, latestPublicationDate: '2026-01-08', methodology: 'Ranking oficial das dez vias com mais acidentes publicado no Relatório Operacional 2025/CBVJ. O SIGES preserva a fonte e não substitui os dados históricos.', urls: { 2025: CBVJ_2025_URL, 2024: CBVJ_2024_URL }, summary: { totalOccurrences2025: 14574, trafficCarVsMotorcycle2025: 1923 }, corridors, raw: { has2024Publication: Boolean(text24), parsedCorridors: corridors.length } };
  cache.set(key, { data, expires: Date.now() + CACHE_MS });
  return data;
}

async function detrans() { const key = 'detrans'; if (cache.has(key) && cache.get(key).expires > Date.now()) return cache.get(key).data; const data = parseDetrans(await fetchText(DETRANS_URL)); cache.set(key, { data, expires: Date.now() + CACHE_MS }); return data; }

async function simgeo() {
  const key = 'simgeo'; if (cache.has(key) && cache.get(key).expires > Date.now()) return cache.get(key).data;
  const [schools, layers] = await Promise.all([fetchJson(`${SIMGEO_SCHOOLS}/query?where=1%3D1&returnCountOnly=true&f=json`), fetchJson(`${SIMGEO_ROOT}/planejamento/MapServer/layers?f=json`)]);
  const data = { source: 'SIMGEO', sourceName: 'Sistema de Informações Municipais Georreferenciadas', municipality: 'Joinville', retrievedAt: new Date().toISOString(), latestCompleteYear: null, methodology: 'Leitura somente consulta das camadas públicas do SIMGeo. Quantidades são inventário de dados, não ocorrência de sinistros.', urls: { portal: SIMGEO_URL, rest: SIMGEO_ROOT, schools: SIMGEO_SCHOOLS }, summary: { schoolUnits: schools.count ?? null, planningLayers: Array.isArray(layers.layers) ? layers.layers.length : 0 }, layers: (layers.layers || []).map(x => ({ id: x.id, name: x.name, type: x.type })), corridors: [], records: [] };
  cache.set(key, { data, expires: Date.now() + CACHE_MS }); return data;
}

async function spatial() {
  const key = 'spatial'; if (cache.has(key) && cache.get(key).expires > Date.now()) return cache.get(key).data;
  const [det, geo] = await Promise.all([detrans(), simgeo()]);
  const data = { source: 'DETRANS+SIMGEO', sourceName: 'Correlação espacial conservadora DETRANS ↔ SIMGeo', municipality: 'Joinville', retrievedAt: new Date().toISOString(), methodology: 'Conector ativo entre as duas fontes. A correlação escola-estudo é exibida somente quando houver georreferência confiável; ausência de correspondência não é tratada como risco.', urls: { detrans: DETRANS_URL, simgeo: SIMGEO_URL }, summary: { detransStudies: det.summary.totalStudies, simgeoSchoolUnits: geo.summary.schoolUnits }, records: [], status: 'connected', note: 'Fontes DETRANS e SIMGeo consultadas. A correlação individual será preenchida pela camada territorial quando houver geometria compatível.' };
  cache.set(key, { data, expires: Date.now() + CACHE_MS }); return data;
}

export default async function handler(req, res) {
  const source = String(req.query?.source || '').toLowerCase();
  res.setHeader('Cache-Control', 'no-store');
  try {
    let data;
    if (source === 'cbvj') data = await cbvj();
    else if (source === 'detrans') data = await detrans();
    else if (source === 'simgeo') data = await simgeo();
    else if (source === 'detrans-correlations' || source === 'detransspatial') data = await spatial();
    else return res.status(404).json({ error: 'Fonte pública não reconhecida.', source });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ error: 'Não foi possível consultar a fonte pública agora.', detail: error?.message || 'Erro desconhecido', source, readOnly: true });
  }
}

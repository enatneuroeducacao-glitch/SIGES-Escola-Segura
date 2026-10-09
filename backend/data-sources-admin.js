const express = require('express');

function buildDataSourcesAdminRouter({ auth }) {
  const router = express.Router();

  function configured() {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  async function supabaseGet(path) {
    const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!base || !key) {
      const error = new Error('Integração Supabase não configurada no backend.');
      error.statusCode = 503;
      throw error;
    }
    const response = await fetch(base + '/rest/v1/' + path, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const error = new Error('Supabase respondeu HTTP ' + response.status + (detail ? ': ' + detail.slice(0, 300) : ''));
      error.statusCode = response.status >= 500 ? 502 : response.status;
      throw error;
    }
    return response.json();
  }

  router.use(auth);
  router.use((req, res, next) => {
    if (req.user?.role !== 'enat') return res.status(403).json({ error: 'Apenas a Administração ENAT pode acessar o catálogo de dados.' });
    next();
  });

  router.get('/health', async (req, res) => {
    if (!configured()) return res.status(503).json({ ok: false, status: 'not_configured', requiredEnv: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] });
    try {
      const rows = await supabaseGet('data_source_catalog?select=id&limit=1');
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, status: 'connected', checkedAt: new Date().toISOString(), querySucceeded: Array.isArray(rows) });
    } catch (error) {
      res.status(error.statusCode || 502).json({ ok: false, status: 'connection_failed', checkedAt: new Date().toISOString(), error: error.message });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const rows = await supabaseGet('data_source_catalog?select=id,slug,organization,name,homepage_url,catalog_url,access_method,expected_frequency,is_active,last_checked_at,metadata&order=name.asc');
      res.set('Cache-Control', 'no-store');
      res.json({ sources: rows, count: rows.length, storage: 'supabase', retrievedAt: new Date().toISOString() });
    } catch (error) {
      res.status(error.statusCode || 502).json({ error: 'Não foi possível consultar o catálogo persistente do SIGES.', detail: error.message });
    }
  });

  router.get('/resources', async (req, res) => {
    try {
      const rows = await supabaseGet('data_source_resources?select=id,source_id,external_resource_id,resource_name,resource_url,release_date,media_type,content_length_bytes,checksum_sha256,discovered_at,last_seen_at,metadata&order=last_seen_at.desc&limit=500');
      res.set('Cache-Control', 'no-store');
      res.json({ resources: rows, count: rows.length, storage: 'supabase', retrievedAt: new Date().toISOString() });
    } catch (error) {
      res.status(error.statusCode || 502).json({ error: 'Não foi possível consultar os recursos catalogados.', detail: error.message });
    }
  });

  router.get('/runs', async (req, res) => {
    try {
      const rows = await supabaseGet('data_ingestion_runs?select=id,source_id,resource_id,status,started_at,finished_at,records_read,records_inserted,records_updated,records_skipped,records_rejected,error_message,metadata&order=started_at.desc&limit=100');
      res.set('Cache-Control', 'no-store');
      res.json({ runs: rows, count: rows.length, storage: 'supabase', retrievedAt: new Date().toISOString() });
    } catch (error) {
      res.status(error.statusCode || 502).json({ error: 'Não foi possível consultar o histórico de importações.', detail: error.message });
    }
  });

  return router;
}

module.exports = buildDataSourcesAdminRouter;

#!/usr/bin/env python3
"""Importação incremental dos CSVs RENAST/RENAEST do pacote de Dados Abertos para PostgreSQL.

Uso:
  pip install -r scripts/renaest-import-requirements.txt
  set DATABASE_URL=postgresql://...
  python scripts/import_renaest_zip.py caminho\para\renaest_dabertos_20260412.zip

O importador NÃO apaga tabelas existentes. Cada conjunto é carregado em transação,
em tabelas de staging com valores TEXT para preservar os dados originais.
"""
from __future__ import annotations
import argparse, csv, hashlib, io, os, sys, zipfile
from datetime import datetime, timezone
import psycopg
from psycopg import sql

FILES = {
 "Acidentes_DadosAbertos_20260412.csv": ("renaest_acidentes_raw", ["num_acidente","chv_localidade","data_acidente","uf_acidente","ano_acidente","mes_acidente","mes_ano_acidente","codigo_ibge","dia_semana","fase_dia","tp_acidente","cond_meteorologica","end_acidente","num_end_acidente","cep_acidente","bairro_acidente","km_via_acidente","latitude_acidente","longitude_acidente","hora_acidente","tp_rodovia","cond_pista","tp_cruzamento","tp_pavimento","tp_curva","lim_velocidade","tp_pista","ind_guardrail","ind_cantcentral","ind_acostamento","qtde_acidente","qtde_acid_com_obitos","qtde_envolvidos","qtde_feridosilesos","qtde_obitos"]),
 "Localidade_DadosAbertos_20260412.csv": ("renaest_localidades_raw", ["chv_localidade","ano_referencia","mes_referencia","mes_ano_referencia","regiao","uf","codigo_ibge","municipio","regiao_metropolitana","qtde_habitantes","frota_total","frota_circulante"]),
 "TipoVeiculo_DadosAbertos_20260412.csv": ("renaest_tipos_veiculo_raw", ["num_acidente","tipo_veiculo","ind_veic_estrangeiro","qtde_veiculos"]),
 "Vitimas_DadosAbertos_20260412.csv": ("renaest_vitimas_raw", ["num_acidente","chv_localidade","data_acidente","uf_acidente","ano_acidente","mes_acidente","mes_ano_acidente","faixa_idade","genero","tp_envolvido","gravidade_lesao","equip_seguranca","ind_motorista","susp_alcool","qtde_envolvidos","qtde_feridosilesos","qtde_obitos"])
}
CHUNK_LOG_EVERY = 100_000

def ensure_schema(conn):
    conn.execute("""
      CREATE TABLE IF NOT EXISTS renaest_import_runs (
        id BIGSERIAL PRIMARY KEY, archive_sha256 TEXT NOT NULL, source_file TEXT NOT NULL,
        target_table TEXT NOT NULL, status TEXT NOT NULL, rows_loaded BIGINT NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
        error TEXT, UNIQUE (archive_sha256, source_file)
      )
    """)
    for filename, (table, columns) in FILES.items():
        definitions = sql.SQL(", ").join(sql.SQL("{} TEXT").format(sql.Identifier(c)) for c in columns)
        conn.execute(sql.SQL("CREATE TABLE IF NOT EXISTS {} ({})").format(sql.Identifier(table), definitions))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("zip_path")
    ap.add_argument("--skip-existing", action="store_true", default=True,
                    help="Ignora arquivos já importados com o mesmo hash do ZIP (padrão).")
    args = ap.parse_args()
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        sys.exit("ERRO: defina DATABASE_URL com a conexão PostgreSQL de destino.")
    if not os.path.isfile(args.zip_path):
        sys.exit("ERRO: arquivo ZIP não encontrado.")
    sha = hashlib.sha256()
    with open(args.zip_path, "rb") as f:
        for block in iter(lambda: f.read(8 * 1024 * 1024), b""):
            sha.update(block)
    archive_hash = sha.hexdigest()
    with zipfile.ZipFile(args.zip_path) as zf, psycopg.connect(dsn) as conn:
        ensure_schema(conn)
        conn.commit()  # torna cada arquivo uma transação independente
        members = set(zf.namelist())
        missing = set(FILES) - members
        if missing:
            sys.exit("ERRO: arquivos ausentes no ZIP: " + ", ".join(sorted(missing)))
        for filename, (table, columns) in FILES.items():
            existing = conn.execute(
                "SELECT status, rows_loaded FROM renaest_import_runs WHERE archive_sha256=%s AND source_file=%s",
                (archive_hash, filename)).fetchone()
            if existing and existing[0] == "completed":
                print(f"SKIP {filename}: já importado ({existing[1]} linhas).", flush=True)
                continue
            # Uma transação por arquivo: falhas não deixam carga parcial visível.
            try:
                with conn.transaction():
                    conn.execute("DELETE FROM renaest_import_runs WHERE archive_sha256=%s AND source_file=%s",
                                 (archive_hash, filename))
                    run_id = conn.execute(
                        "INSERT INTO renaest_import_runs (archive_sha256, source_file, target_table, status) VALUES (%s,%s,%s,'running') RETURNING id",
                        (archive_hash, filename, table)).fetchone()[0]
                    # Staging só recebe a carga deste arquivo quando estiver vazia.
                    # Não truncar dados existentes: exige tabela vazia ou nova versão do dataset.
                    count = conn.execute(sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table))).fetchone()[0]
                    if count:
                        raise RuntimeError(f"{table} já contém {count} linhas; interrompido para evitar duplicação.")
                    with zf.open(filename) as raw, io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as text_stream:
                        reader = csv.reader(text_stream, delimiter=";")
                        header = next(reader, None)
                        if header != columns:
                            raise RuntimeError(f"Cabeçalho inesperado em {filename}: {header}")
                        copy_stmt = sql.SQL("COPY {} ({}) FROM STDIN").format(
                            sql.Identifier(table), sql.SQL(", ").join(sql.Identifier(c) for c in columns))
                        loaded = 0
                        with conn.cursor().copy(copy_stmt) as copy:
                            for row in reader:
                                if len(row) != len(columns):
                                    raise RuntimeError(f"Linha {loaded+2}: esperado {len(columns)} campos, recebido {len(row)}.")
                                copy.write_row([v if v != "" else None for v in row])
                                loaded += 1
                                if loaded % CHUNK_LOG_EVERY == 0:
                                    print(f"{filename}: {loaded:,} linhas processadas...", flush=True)
                    conn.execute("UPDATE renaest_import_runs SET status='completed', rows_loaded=%s, finished_at=now() WHERE id=%s",
                                 (loaded, run_id))
                print(f"OK {filename}: {loaded:,} linhas.", flush=True)
            except Exception as exc:
                # Registra erro fora da transação de carga, sem preservar dados parciais.
                with conn.transaction():
                    conn.execute("DELETE FROM renaest_import_runs WHERE archive_sha256=%s AND source_file=%s",
                                 (archive_hash, filename))
                    conn.execute("INSERT INTO renaest_import_runs (archive_sha256,source_file,target_table,status,error,finished_at) VALUES (%s,%s,%s,'failed',%s,now())",
                                 (archive_hash, filename, table, str(exc)[:4000]))
                raise
    print("Importação concluída. Confira renaest_import_runs e os totais por tabela.", flush=True)

if __name__ == "__main__":
    main()

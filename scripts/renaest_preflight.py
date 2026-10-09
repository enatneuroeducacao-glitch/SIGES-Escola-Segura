#!/usr/bin/env python3
"""Preflight RENAEST ZIP/CSV archives without extracting them to disk.

This script is read-only: it does not connect to Supabase, change files, or import
records. It streams CSV members so large national datasets are not loaded into RAM.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import zipfile
from pathlib import Path
from typing import Any

CITY_IBGE = {"4209102"}  # Joinville/SC
CITY_NAMES = {"JOINVILLE"}
TEXT_EXTENSIONS = {".csv", ".txt"}
MAX_SAMPLE_ROWS = 3


def normalize(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def detect_encoding(stream) -> tuple[str, str]:
    """Peek at a small prefix and choose a conservative encoding/delimiter."""
    prefix = stream.read(64 * 1024)
    stream.seek(0)
    candidates = ("utf-8-sig", "cp1252", "latin-1")
    decoded = None
    encoding = "utf-8-sig"
    for candidate in candidates:
        try:
            decoded = prefix.decode(candidate)
            encoding = candidate
            break
        except UnicodeDecodeError:
            continue
    if decoded is None:
        decoded = prefix.decode("latin-1", errors="replace")
        encoding = "latin-1"
    try:
        dialect = csv.Sniffer().sniff(decoded[:16 * 1024], delimiters=";,	|")
        delimiter = dialect.delimiter
    except csv.Error:
        counts = {delimiter: decoded.splitlines()[0].count(delimiter) for delimiter in ";,	|"}
        delimiter = max(counts, key=counts.get)
    return encoding, delimiter


def inspect_member(archive: zipfile.ZipFile, info: zipfile.ZipInfo) -> dict[str, Any]:
    suffix = Path(info.filename).suffix.lower()
    result: dict[str, Any] = {
        "member": info.filename,
        "compressed_bytes": info.compress_size,
        "uncompressed_bytes": info.file_size,
        "crc32": f"{info.CRC:08x}",
        "rows": 0,
        "header": [],
        "candidate_key_columns": [],
        "joinville_rows_detected": None,
        "warnings": [],
    }
    if suffix not in TEXT_EXTENSIONS:
        result["warnings"].append("Extensão não reconhecida como CSV/TXT; conteúdo não analisado.")
        return result

    with archive.open(info, "r") as raw:
        prefix = raw.read(64 * 1024)
        raw.seek(0)
        encoding = "utf-8-sig"
        decoded = None
        for candidate in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                decoded = prefix.decode(candidate)
                encoding = candidate
                break
            except UnicodeDecodeError:
                continue
        if decoded is None:
            encoding = "latin-1"
            decoded = prefix.decode(encoding, errors="replace")
        try:
            delimiter = csv.Sniffer().sniff(decoded[:16 * 1024], delimiters=";,	|").delimiter
        except csv.Error:
            first = decoded.splitlines()[0] if decoded.splitlines() else ""
            delimiter = max((";", ",", "	", "|"), key=first.count)
        result["encoding"] = encoding
        result["delimiter"] = "TAB" if delimiter == "\t" else delimiter

        text = __import__("io").TextIOWrapper(raw, encoding=encoding, errors="replace", newline="")
        reader = csv.reader(text, delimiter=delimiter)
        try:
            header = next(reader)
        except StopIteration:
            result["warnings"].append("Arquivo vazio.")
            return result
        header = [str(item).strip().lstrip("\ufeff") for item in header]
        result["header"] = header
        normalized = {normalize(name): name for name in header}
        candidates = [
            name for key, name in normalized.items()
            if any(token in key for token in ("numacidente", "chvlocalidade", "codigoibge", "municipio", "uf", "idacidente"))
        ]
        result["candidate_key_columns"] = candidates

        city_indexes = []
        for idx, name in enumerate(header):
            key = normalize(name)
            if key in {"codigoibge", "codigomunicipio", "codmun"}:
                city_indexes.append((idx, "ibge"))
            elif key in {"municipio", "nomemunicipio", "cidade"}:
                city_indexes.append((idx, "city"))
            elif key in {"uf", "siglauf", "ufocorrencia"}:
                city_indexes.append((idx, "uf"))

        joinville_rows = 0
        for row in reader:
            if not row or not any(str(value).strip() for value in row):
                continue
            result["rows"] += 1
            values = {kind: str(row[idx]).strip() for idx, kind in city_indexes if idx < len(row)}
            ibge = re.sub(r"\.0$", "", values.get("ibge", ""))
            city = values.get("city", "").upper()
            uf = values.get("uf", "").upper()
            if ibge in CITY_IBGE or (city in CITY_NAMES and (not uf or uf == "SC")):
                joinville_rows += 1
        if city_indexes:
            result["joinville_rows_detected"] = joinville_rows
        else:
            result["warnings"].append(
                "Não há coluna municipal reconhecida; vínculo territorial depende do relacionamento com outro CSV."
            )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Caminho para o ZIP RENAEST")
    parser.add_argument("--json", dest="json_path", type=Path, help="Salvar relatório JSON neste caminho")
    args = parser.parse_args()

    if not args.archive.is_file():
        print(f"ERRO: arquivo não encontrado: {args.archive}", file=sys.stderr)
        return 2
    try:
        with zipfile.ZipFile(args.archive, "r") as archive:
            members = [
                info for info in archive.infolist()
                if not info.is_dir() and Path(info.filename).suffix.lower() in TEXT_EXTENSIONS
            ]
            report = {
                "archive": args.archive.name,
                "archive_bytes": args.archive.stat().st_size,
                "mode": "read-only-preflight",
                "city_filter": {"municipality": "Joinville", "uf": "SC", "ibge_code": "4209102"},
                "members": [inspect_member(archive, info) for info in members],
            }
    except (OSError, zipfile.BadZipFile, RuntimeError) as exc:
        print(f"ERRO ao ler ZIP: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.json_path:
        args.json_path.write_text(output + "\n", encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# SIGES 3.5.1

Production deployment marker. The Vercel project is connected to `main`.

- Next.js build is configured to ignore TypeScript build blocking because the GitHub Next.js gate runs `tsc --noEmit` separately.
- Root dependencies are pinned to stable versions to prevent `latest` drift.
- The stale root lockfile was removed; the backend remains isolated under `backend/`.
- Vercel/GitHub integration revalidated on 2026-09-12; production deployment trigger committed to `main`.

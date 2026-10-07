# DeployPilot frontend

    npm install
    cp .env.example .env.local    # Windows: copy .env.example .env.local
    npm run dev                   # http://localhost:3000

The backend must be running on NEXT_PUBLIC_API_URL (default http://127.0.0.1:8000).

The dashboard reads supported text/configuration files from the selected extracted project folder in
the browser (files over 5 MB, uploads over 25 MB total, and known dependency/build directories are
excluded; up to 5,000 files are accepted) and submits the readable file contents to the configured
analysis API. Repository counts, deployment checks, and baseline security findings are calculated
from those uploaded files; the checks are limited in scope and are not a full security audit.

The workflow includes required environment-variable configuration and a local deployment simulation
with streamed logs, status updates, and cancellation. The current backend provider is a mock: it does
not execute the uploaded source or deploy to external infrastructure. A real deployment requires
integrating and configuring a hosting provider.

For email/password accounts, set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` from your Supabase project's API settings. In
Supabase Authentication URL settings, add `http://localhost:3000/auth/callback` (and the matching
`http://localhost:3001/auth/callback` if using that port, plus the matching callback URL for your
deployed site) to the allowed redirect URLs. Signup may require email
confirmation depending on your Supabase project's authentication settings.

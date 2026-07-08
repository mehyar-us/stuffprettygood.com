# Deploy stuffprettygood.com dist/ to production branch on Cloudflare Pages.
# Reads Global API Key from ~/.hermes/.env and uses legacy wrangler auth.
import os, sys, subprocess, base64, re, pathlib

env_path = pathlib.Path.home() / '.hermes' / '.env'
raw = env_path.read_bytes().decode('utf-8-sig')
vars_ = {}
for line in raw.splitlines():
    if '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        vars_[k.strip()] = v.strip()

email = vars_.get('CLOUDFLARE_EMAIL', '')
key   = vars_.get('CLOUDFLARE_API_TOKEN', '')
acct  = vars_.get('CLOUDFLARE_ACCOUNT_ID', '')

print(f"email={email} key_len={len(key)} acct={acct}")
if not (email and key and acct):
    print("MISSING env vars", file=sys.stderr); sys.exit(2)

# Use base64 to bypass any shell-quoting hazards
env = os.environ.copy()
env['CLOUDFLARE_EMAIL']    = email
env['CLOUDFLARE_API_KEY']  = key
env['CLOUDFLARE_ACCOUNT_ID'] = acct
# Also unset the misnamed token var so wrangler doesn't pick it up
env.pop('CLOUDFLARE_API_TOKEN', None)

proj = pathlib.Path(r'C:/Users/mehya/OneDrive/Documents/GitHub/stuffprettygood.com')
result = subprocess.run(
    ['C:/Users/mehya/AppData/Roaming/npm/wrangler.cmd', 'pages', 'deploy', 'dist',
     '--project-name', 'stuffprettygood',
     '--commit-dirty=true'],
    cwd=str(proj),
    env=env,
    capture_output=True,
    text=True,
)
print("STDOUT:")
print(result.stdout)
print("STDERR:")
print(result.stderr)
print(f"EXIT={result.returncode}")
sys.exit(result.returncode)

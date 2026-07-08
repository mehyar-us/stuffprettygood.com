@echo off
rem Deploy stuffprettygood.com dist/ to production branch on Cloudflare Pages
rem Uses Global API Key auth (the env var CLOUDFLARE_API_TOKEN is misnamed)
setlocal
for /f "usebackq tokens=1,* delims==" %%a in ("%USERPROFILE%\.hermes\.env") do (
  set "line=%%a"
  if "!line!"=="CLOUDFLARE_EMAIL" set "CF_EMAIL=%%b"
  if "!line!"=="CLOUDFLARE_API_TOKEN" set "CF_KEY=%%b"
  if "!line!"=="CLOUDFLARE_ACCOUNT_ID" set "CF_ACCT=%%b"
)
set CLOUDFLARE_EMAIL=%CF_EMAIL%
set CLOUDFLARE_API_KEY=%CF_KEY%
set CLOUDFLARE_ACCOUNT_ID=%CF_ACCT%
cd /d "C:\Users\mehya\OneDrive\Documents\GitHub\stuffprettygood.com"
wrangler pages deploy dist --project-name stuffprettygood --branch production --commit-dirty=true
endlocal

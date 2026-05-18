from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = 'http://127.0.0.1:3008/crm/opportunity-desk'
OUT_DIR = Path('qa/screenshots/opportunity-desk-t_ca09b85d')
OUT_DIR.mkdir(parents=True, exist_ok=True)

viewports = [
    ('mobile', 390, 844),
    ('tablet', 820, 1180),
    ('desktop', 1440, 1100),
]
schemes = ['light', 'dark']

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for scheme in schemes:
        for name, width, height in viewports:
            page = browser.new_page(viewport={'width': width, 'height': height}, color_scheme=scheme)
            page.goto(BASE_URL, wait_until='networkidle')
            session_id = page.evaluate("""
                async () => {
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ email: 'admin@mehyarmedia.local', password: 'change-me-before-production' })
                    });
                    const body = await response.json();
                    if (!response.ok) throw new Error(body.error || 'login failed');
                    return body.session.id;
                }
            """)
            page.evaluate("""
                async (sessionId) => {
                    document.getElementById('token').value = sessionId;
                    state.token = sessionId;
                    await loadDesk();
                    document.getElementById('token').value = '';
                }
            """, session_id)
            page.wait_for_function("document.getElementById('authStatus').textContent.includes('Connected')", timeout=10000)
            page.screenshot(path=str(OUT_DIR / f'{name}-{scheme}.png'), full_page=True)
            # Basic DOM assertions for required CRM surfaces.
            visible = page.locator('body').inner_text()
            required = [
                'Daily Digest', 'Source health', 'env names only',
                'Pursue now', 'Watch', 'Reject', 'Needs partner', 'Needs Boss approval',
                'Buyer intelligence', 'Source evidence', 'Scoring breakdown',
                'AI go/no-go memo', 'Kanban route proposal', 'External action blocker',
                'SAM', 'Grants', 'State/local', 'Affiliate', 'Sponsor', 'Job', 'Marketplace',
            ]
            missing = [item for item in required if item not in visible]
            if missing:
                raise AssertionError(f'{name}-{scheme} missing: {missing}')
            page.close()
    browser.close()

print('Opportunity Desk responsive screenshot QA PASS')
for path in sorted(OUT_DIR.glob('*.png')):
    print(path)

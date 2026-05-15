from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:4180/index.html'
OUT = Path('/home/mehya/work/mehyarmedia/qa/screenshots')
OUT.mkdir(parents=True, exist_ok=True)
viewports = [
    ('mobile-light', 390, 844, 'light'),
    ('tablet-light', 768, 1024, 'light'),
    ('desktop-light', 1440, 1100, 'light'),
    ('mobile-dark', 390, 844, 'dark'),
    ('tablet-dark', 768, 1024, 'dark'),
    ('desktop-dark', 1440, 1100, 'dark'),
]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, width, height, scheme in viewports:
        page = browser.new_page(viewport={'width': width, 'height': height}, color_scheme=scheme)
        page.goto(BASE, wait_until='networkidle')
        page.screenshot(path=str(OUT / f'{name}.png'), full_page=False)
        # scroll evidence: offer wall top for desktop/tablet, mid-grid for mobile
        page.locator('.offer-wall').scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / f'{name}-offerwall.png'), full_page=False)
        page.close()
    browser.close()
print('\n'.join(str(p) for p in sorted(OUT.glob('*.png'))))

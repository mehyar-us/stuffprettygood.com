from pathlib import Path
from subprocess import run
from urllib.request import urlopen

base = 'http://127.0.0.1:4174'
out = Path('qa/screenshots')
out.mkdir(parents=True, exist_ok=True)
viewports = {
    'mobile': '390,844',
    'tablet': '768,1024',
    'desktop': '1440,1000',
}
pages = {
    'spg-home': '/index.html',
    'spg-trends-hub': '/trends.html',
    'spg-trend-ai-note-takers': '/trends/ai-note-takers.html',
    'spg-go-amazon-air-purifiers': '/go/amazon-air-purifiers.html',
    'spg-reactivation': '/reactivation.html',
    'spg-preferences': '/preferences.html',
    'spg-unsubscribe': '/unsubscribe.html',
    'spg-admin-ux': '/crm-command-center-ux.html',
}

required = ['Affiliate disclosure', '/privacy.html', '/preferences.html', '/unsubscribe.html']
summary = []
for page_name, path in pages.items():
    html = urlopen(f'{base}{path}', timeout=10).read().decode('utf-8', errors='replace')
    for needle in required:
        assert needle in html, f'{page_name} missing {needle}'
    if page_name.startswith('spg-trend') or page_name == 'spg-trends-hub':
        assert 'Google Trends' in html, f'{page_name} missing Google Trends copy'
        assert 'Save this preference' in html or 'weekly Pretty Good Picks' in html, f'{page_name} missing signup hook'
    if page_name.startswith('spg-go-'):
        assert 'StoreID mehyarmedia-20' in html, f'{page_name} missing visible StoreID disclosure'
        assert 'No Amazon prices, ratings, reviews, images, or availability are copied' in html, f'{page_name} missing Amazon content guardrail'
    for viewport_name, viewport in viewports.items():
        for scheme in ('light', 'dark'):
            screenshot = out / f'{page_name}-{viewport_name}-{scheme}.png'
            run([
                'npx', '--yes', 'playwright', 'screenshot',
                '--full-page',
                '--viewport-size', viewport,
                '--color-scheme', scheme,
                '--wait-for-selector', 'main',
                f'{base}{path}',
                str(screenshot),
            ], check=True)
            assert screenshot.exists() and screenshot.stat().st_size > 1000, f'{screenshot} not written'
            summary.append(f'{page_name} {viewport_name}-{scheme} -> {screenshot}')

print('\n'.join(summary))
print(f'QA screenshots written: {len(summary)}')

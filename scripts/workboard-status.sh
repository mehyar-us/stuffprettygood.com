#!/usr/bin/env bash
# Workboard status reporter — posts the current state of the SPG image-first
# cards to the configured Telegram chat. Designed to run via cron every ~2h.

set -euo pipefail

DB="/home/openclaw/.openclaw/plugins/workboard/workboard.sqlite"
CHAT_ID="6829435996"

if [[ ! -f "$DB" ]]; then
  echo "workboard db not found: $DB" >&2
  exit 1
fi

python3 - "$DB" > /tmp/spg-wb-status.txt <<'PY'
import sqlite3, sys, time, datetime

db = sys.argv[1]
con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
cur = con.cursor()

# labels table has composite key (card_id, ordinal)
labels = {}
for row in cur.execute("SELECT card_id, label FROM workboard_card_labels"):
    labels.setdefault(row['card_id'], []).append(row['label'])

rows = cur.execute(
    """SELECT id, title, status, priority, completed_at, updated_at
       FROM workboard_cards
       ORDER BY created_at"""
).fetchall()

match = [r for r in rows if any(l in (labels.get(r['id']) or []) for l in ('spg','image-first'))]

if not match:
    print("(no SPG cards on workboard)")
    sys.exit(0)

def fmt_time(ms):
    if not ms: return "—"
    return datetime.datetime.fromtimestamp(ms/1000).strftime("%Y-%m-%d %H:%M ET")

now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M ET")
print(f"📋 *StuffPrettyGood — image-first tracker*")
print(f"updated {now}")
print()

by_status = {}
for r in match:
    by_status.setdefault(r['status'], []).append(r)

order = ['ready','running','blocked','review','todo','done','archived']
for s in order:
    cards = by_status.get(s) or []
    if not cards: continue
    icon = {'ready':'🟢','running':'🟡','blocked':'🔴','review':'🟣','todo':'⚪','done':'✅','archived':'🗄'}.get(s, '·')
    print(f"{icon} *{s.upper()}* ({len(cards)})")
    for c in cards:
        age = fmt_time(c['updated_at'])
        print(f"   • {c['title']}  _({age})_")
    print()

total = len(match)
done = len(by_status.get('done', []))
print(f"Progress: {done}/{total} cards done ({int(done*100/total) if total else 0}%)")
PY

STATUS=$(cat /tmp/spg-wb-status.txt)

if [[ ${#STATUS} -gt 3800 ]]; then
  STATUS="${STATUS:0:3800}…"
fi

# Use the openclaw message tool. Falls back to stdout if unavailable.
openclaw message send \
  --channel telegram \
  --target "$CHAT_ID" \
  --message "$STATUS" 2>&1 || {
  echo "[workboard-status] could not send via gateway; payload:"
  echo "$STATUS"
}

rm -f /tmp/spg-wb-status.txt
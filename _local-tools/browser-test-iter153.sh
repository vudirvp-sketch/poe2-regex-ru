#!/usr/bin/env bash
# iter 153 — browser testing on 7 category pages.
# Verifies:
#   - iter 148: <select> for Сортировка/Показывать render correctly
#   - iter 149: Priority filter removed (no "Приоритет" select)
#   - iter 150 KI#40: ⭐ pin button visible on all 7 category pages (after group expand)
#   - iter 150 KI#41: ⓘ tooltip button present (Показать пояснение)
#   - KI#37: origin text present (for jewel/waystone)
#   - KI#42: search input retains focus after typing
# Output: /tmp/browser-test-results.txt

set -u

PORT=4173
BASE="http://127.0.0.1:${PORT}/poe2-regex-ru"
OUT=/tmp/browser-test-results.txt
> "$OUT"

PAGES=(belt ring amulet jewel waystone tablet relic)

echo "=== iter 153 Browser Test — $(date) ===" | tee -a "$OUT"

for page in "${PAGES[@]}"; do
  echo "" | tee -a "$OUT"
  echo "─── Page: $page ───" | tee -a "$OUT"
  agent-browser open "${BASE}/${page}" 2>&1 | tail -1 >> "$OUT"
  agent-browser wait 1200 2>&1 > /dev/null

  SNAP=/tmp/snap-${page}.txt
  agent-browser snapshot -i > "$SNAP" 2>&1

  # iter 148: Сортировка select (only for pages with sortMode — relic doesn't have it)
  if [[ "$page" == "relic" ]]; then
    if grep -q 'combobox "Сортировка"' "$SNAP"; then
      echo "  [FAIL] iter 148: relic should NOT have Сортировка (no tier-first sort for relics)" | tee -a "$OUT"
    else
      echo "  [PASS] iter 148: relic intentionally omits Сортировка (by design)" | tee -a "$OUT"
    fi
  else
    if grep -q 'combobox "Сортировка"' "$SNAP"; then
      echo "  [PASS] iter 148: Сортировка <select> present" | tee -a "$OUT"
    else
      echo "  [FAIL] iter 148: Сортировка <select> MISSING" | tee -a "$OUT"
    fi
  fi

  # iter 148: Показывать select
  if grep -q 'combobox "Показывать"' "$SNAP"; then
    echo "  [PASS] iter 148: Показывать <select> present" | tee -a "$OUT"
  else
    echo "  [FAIL] iter 148: Показывать <select> MISSING" | tee -a "$OUT"
  fi

  # iter 149: Priority filter removed
  if grep -q 'combobox "Приоритет"' "$SNAP"; then
    echo "  [FAIL] iter 149: Priority <select> STILL PRESENT" | tee -a "$OUT"
  else
    echo "  [PASS] iter 149: Priority <select> absent (removed)" | tee -a "$OUT"
  fi

  # Search input present
  if grep -q 'textbox "Поиск аффиксов' "$SNAP"; then
    echo "  [PASS] Search input present" | tee -a "$OUT"
  else
    echo "  [INFO] No search input (vendor has different layout)" | tee -a "$OUT"
  fi

  # iter 150 KI#41: ⓘ tooltip button (Показать пояснение)
  if grep -q 'Показать пояснение' "$SNAP"; then
    echo "  [PASS] iter 150 KI#41: ⓘ tooltip button present" | tee -a "$OUT"
  else
    echo "  [FAIL] iter 150 KI#41: ⓘ tooltip button MISSING" | tee -a "$OUT"
  fi

  # KI#37: origin text (jewel/waystone only — others don't have origin variants)
  if [[ "$page" == "jewel" || "$page" == "waystone" ]]; then
    if grep -qE 'Оскверн|Неоскверн|Делир|Обычные|Очерн|Разлом|Сущность' "$SNAP"; then
      echo "  [PASS] KI#37: origin text/badge present" | tee -a "$OUT"
    else
      echo "  [FAIL] KI#37: origin text NOT visible" | tee -a "$OUT"
    fi
  fi

  # Expand first group, then check for pin button
  FIRST_GROUP=$(grep -m1 'Развернуть группу' "$SNAP" | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
  if [ -n "$FIRST_GROUP" ]; then
    agent-browser click "@${FIRST_GROUP}" 2>&1 > /dev/null
    agent-browser wait 700 2>&1 > /dev/null
    agent-browser snapshot -i > "$SNAP" 2>&1
  fi

  # iter 150 KI#40: ⭐ pin button (aria-label "Добавить семейство в избранное" or "Убрать семейство из избранного")
  if grep -qE 'Добавить семейство в избранное|Убрать семейство из избранного' "$SNAP"; then
    PIN_COUNT=$(grep -cE 'Добавить семейство в избранное|Убрать семейство из избранного' "$SNAP")
    echo "  [PASS] iter 150 KI#40: ⭐ pin button present (${PIN_COUNT} found in expanded group)" | tee -a "$OUT"
  else
    echo "  [FAIL] iter 150 KI#40: ⭐ pin button MISSING in expanded group" | tee -a "$OUT"
  fi

  # KI#42: search focus retention — type and verify focus
  SEARCH_REF=$(grep -m1 'textbox "Поиск аффиксов' "$SNAP" | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
  if [ -n "$SEARCH_REF" ]; then
    # Focus + type
    agent-browser fill "@${SEARCH_REF}" "те" 2>&1 > /dev/null
    agent-browser wait 400 2>&1 > /dev/null
    FOCUSED_1=$(agent-browser eval "document.activeElement?.tagName || 'none'" 2>&1 | tail -1 | tr -d '"')
    # Type more
    agent-browser fill "@${SEARCH_REF}" "тест" 2>&1 > /dev/null
    agent-browser wait 400 2>&1 > /dev/null
    FOCUSED_2=$(agent-browser eval "document.activeElement?.tagName || 'none'" 2>&1 | tail -1 | tr -d '"')
    # Backspace (clear)
    agent-browser fill "@${SEARCH_REF}" "" 2>&1 > /dev/null
    agent-browser wait 300 2>&1 > /dev/null
    FOCUSED_3=$(agent-browser eval "document.activeElement?.tagName || 'none'" 2>&1 | tail -1 | tr -d '"')

    if [[ "$FOCUSED_1" == "INPUT" && "$FOCUSED_2" == "INPUT" && "$FOCUSED_3" == "INPUT" ]]; then
      echo "  [PASS] KI#42: search retains focus (те=$FOCUSED_1, тест=$FOCUSED_2, clear=$FOCUSED_3)" | tee -a "$OUT"
    else
      echo "  [FAIL] KI#42: focus lost — те=$FOCUSED_1, тест=$FOCUSED_2, clear=$FOCUSED_3" | tee -a "$OUT"
    fi
  fi
done

echo "" | tee -a "$OUT"
echo "=== Test complete ===" | tee -a "$OUT"

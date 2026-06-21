#!/usr/bin/env python3
"""
Audit script for iter 112+ block sort rules coverage.

For each block with explicit sort rules (resistances, attributes, minions,
ailments, damage-type [iter 113], defence-stats [iter 114], resources
[iter 115], weapon-specific + flasks [iter 116], offence-speed + crit +
buff-skills [iter 117], skill-levels + area-duration + meta-skills [iter 118],
rage-charges + runes-barrier + penetration [iter 119]), enumerates all
production family-keys and checks whether the rule set covers them. Reports
any family-keys that fall into the "900::" fallback bucket (rules exist but
none matched) — these need new rules.

Usage:
    python3 scripts/audit_block_sort_coverage.py
"""
import json
import os
import re
import sys

# Add project root to path for imports
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

GENERATED_DIR = os.path.join(PROJECT_ROOT, 'public', 'generated')

# Mirror of BLOCK_SORT_RULES from src/shared/block-sort-rules.ts
# (kept in sync manually — update both files when adding rules)
BLOCK_SORT_RULES = {
    'resistances': [
        # Passive-tree first (most specific)
        (re.compile(r'значимые пассивные умения.*сопротивлению хаосу', re.I), 30, 'passive chaos'),
        (re.compile(r'значимые пассивные умения.*сопротивлению молнии', re.I), 31, 'passive lightning'),
        (re.compile(r'значимые пассивные умения.*сопротивлению холоду', re.I), 32, 'passive cold'),
        (re.compile(r'значимые пассивные умения.*сопротивлению огню', re.I), 33, 'passive fire'),
        # Single-element regular
        (re.compile(r'к сопротивлению хаосу$', re.I), 0, 'chaos single'),
        (re.compile(r'к сопротивлению молнии$', re.I), 1, 'lightning single'),
        (re.compile(r'к сопротивлению холоду$', re.I), 2, 'cold single'),
        (re.compile(r'к сопротивлению огню$', re.I), 3, 'fire single'),
        # Dual-element
        (re.compile(r'к сопротивлениям молнии и хаосу', re.I), 4, 'lightning+chaos'),
        (re.compile(r'к сопротивлениям холоду и хаосу', re.I), 5, 'cold+chaos'),
        (re.compile(r'к сопротивлениям огню и хаосу', re.I), 6, 'fire+chaos'),
        # All-elements
        (re.compile(r'к сопротивлению всем стихиям', re.I), 7, 'all-elements regular'),
        (re.compile(r'к максимуму сопротивлений всем стихиям', re.I), 8, 'all-elements max'),
        # Max-resist single
        (re.compile(r'к максимальному сопротивлению хаосу$', re.I), 10, 'chaos max'),
        (re.compile(r'к максимальному сопротивлению молнии$', re.I), 11, 'lightning max'),
        (re.compile(r'к максимальному сопротивлению холоду$', re.I), 12, 'cold max'),
        (re.compile(r'к максимальному сопротивлению огню$', re.I), 13, 'fire max'),
        # Meta
        (re.compile(r'добавленных свойств сопротивлений', re.I), 20, 'meta: added-resist props'),
    ],
    'attributes': [
        (re.compile(r'к силе$', re.I), 0, 'Сила flat'),
        (re.compile(r'к ловкости$', re.I), 1, 'Ловкость flat'),
        (re.compile(r'к интеллекту$', re.I), 2, 'Интеллект flat'),
        (re.compile(r'ко всем характеристикам', re.I), 3, 'all attrs flat'),
        (re.compile(r'к силе и ловкости', re.I), 4, 'Сила+Ловкость'),
        (re.compile(r'к силе и интеллекту', re.I), 5, 'Сила+Интеллект'),
        (re.compile(r'к ловкости и интеллекту', re.I), 6, 'Ловкость+Интеллект'),
        (re.compile(r'силе, ловкости или интеллекту', re.I), 7, 'tri-or flat'),
        (re.compile(r'повышение силы', re.I), 10, 'Сила %'),
        (re.compile(r'повышение ловкости', re.I), 11, 'Ловкость %'),
        (re.compile(r'повышение интеллекта', re.I), 12, 'Интеллект %'),
        (re.compile(r'увеличение силы, ловкости или интеллекта', re.I), 13, 'tri-or %'),
        (re.compile(r'уменьшение требований', re.I), 20, 'requirement reduction'),
    ],
    'minions': [
        # Companion
        (re.compile(r'максимума здоровья компаньонов', re.I), 0, 'Companion: health'),
        (re.compile(r'компаньоны наносят.*урон', re.I), 1, 'Companion: damage'),
        # Minion health
        (re.compile(r'приспешники имеют.*максимума здоровья', re.I), 100, 'Minion: health'),
        (re.compile(r'приспешники.*дополнительного уменьшения.*физического урона', re.I), 101, 'Minion: phys reduction'),
        # Minion damage
        (re.compile(r'приспешники имеют.*увеличение урона(?!.*умениями|.*скорости)', re.I), 110, 'Minion: damage (generic)'),
        (re.compile(r'приспешники наносят.*урон умениями-приказами', re.I), 111, 'Minion: damage (order skills)'),
        (re.compile(r'приспешники наносят.*урон, если недавно вы наносили удар', re.I), 112, 'Minion: damage (conditional)'),
        (re.compile(r'приспешники.*увеличение силы наносящих урон состояний', re.I), 113, 'Minion: ailment damage'),
        (re.compile(r'приспешники разрушают броню', re.I), 114, 'Minion: armour break'),
        (re.compile(r'приспешников за каждое.*умение-приказ', re.I), 115, 'Minion: damage (per-order)'),
        # Minion crit — word order varies
        (re.compile(r'(приспешников.*критическому урону|критическому урону приспешников)', re.I), 120, 'Minion: crit damage'),
        (re.compile(r'приспешники имеют.*шанса критического удара', re.I), 121, 'Minion: crit chance'),
        # Minion speed
        (re.compile(r'приспешники имеют.*скорости атаки и сотворения', re.I), 130, 'Minion: atk+cast speed'),
        (re.compile(r'приспешники имеют.*скорости умений приказов', re.I), 131, 'Minion: order skill speed'),
        (re.compile(r'приспешники имеют.*скорости перезарядки', re.I), 132, 'Minion: reload speed'),
        (re.compile(r'приспешники имеют.*скорости передвижения', re.I), 133, 'Minion: move speed'),
        (re.compile(r'приспешники воскрешаются.*быстрее', re.I), 134, 'Minion: resurrect speed'),
        # Minion area
        (re.compile(r'приспешники имеют.*области действия', re.I), 140, 'Minion: area'),
        # Minion resists
        (re.compile(r'приспешники имеют.*сопротивлению всем стихиям', re.I), 150, 'Minion: all-res'),
        (re.compile(r'приспешники имеют.*сопротивлению хаосу', re.I), 151, 'Minion: chaos res'),
        # Minion utility (word order varies)
        (re.compile(r'приспешники имеют.*накопления обездвиживания', re.I), 160, 'Minion: slow accum'),
        (re.compile(r'приспешники имеют.*выпустить дополнительный снаряд', re.I), 161, 'Minion: extra projectile'),
        (re.compile(r'(приспешников.*превосходящий шанс|кукловода)', re.I), 162, 'Minion: puppeteer charge'),
        (re.compile(r'(приспешников.*меткости|меткости приспешников)', re.I), 163, 'Minion: accuracy'),
        (re.compile(r'(приспешников.*эффективности удержания ресурсов|удержания ресурсов умениями приспешников)', re.I), 164, 'Minion: reservation eff'),
        (re.compile(r'(приспешников.*времени существования|времени существования приспешников)', re.I), 165, 'Minion: duration'),
        (re.compile(r'лимит.*приспешников', re.I), 166, 'Minion: minion cap'),
        (re.compile(r'приспешники становятся гигантскими', re.I), 167, 'Minion: giant transform'),
        (re.compile(r'усиленные удары приспешников', re.I), 168, 'Minion: enhanced hits'),
        (re.compile(r'урона от ударов.*здоровья ваших призраков', re.I), 169, 'Minion: ghost damage redirect'),
        # Offerings
        (re.compile(r'максимума здоровья подношений', re.I), 200, 'Offering: health'),
        (re.compile(r'усиление эффекта подношений', re.I), 210, 'Offering: effect'),
        (re.compile(r'длительности умений подношений', re.I), 220, 'Offering: duration'),
        (re.compile(r'архонта нежити.*подношения', re.I), 230, 'Offering: archon undead'),
    ],
    'ailments': [
        # Увеличение силы
        (re.compile(r'увеличение силы накладываемого вами Истощения Бездны', re.I), 0, 'str: Abyss Depletion'),
        (re.compile(r'увеличение силы истощения', re.I), 1, 'str: depletion'),
        (re.compile(r'увеличение силы накладываемого вами кровотечения', re.I), 2, 'str: bleed'),
        (re.compile(r'увеличение силы накладываемого вами отравления', re.I), 3, 'str: poison'),
        (re.compile(r'увеличение силы поджога, если недавно', re.I), 4, 'str: burn (cond)'),
        (re.compile(r'увеличение силы поджога', re.I), 5, 'str: burn'),
        (re.compile(r'увеличение силы накладываемого вами шока', re.I), 6, 'str: shock'),
        (re.compile(r'увеличение силы шока, если недавно', re.I), 7, 'str: shock (cond)'),
        (re.compile(r'увеличение силы накладываемых вами состояний', re.I), 8, 'str: states (generic)'),
        (re.compile(r'увеличение силы горючести', re.I), 9, 'str: combustibility'),
        (re.compile(r'увеличение урона парирования', re.I), 10, 'str: parry damage'),
        # Увеличение шанса
        (re.compile(r'увеличение шанса наложения кровотечения', re.I), 100, 'chance: bleed'),
        (re.compile(r'увеличение шанса отравить', re.I), 101, 'chance: poison'),
        (re.compile(r'увеличение шанса наложения шока', re.I), 102, 'chance: shock'),
        (re.compile(r'увеличение шанса наложения состояний', re.I), 103, 'chance: states (generic)'),
        # Увеличение длительности
        (re.compile(r'увеличение длительности кровотечения', re.I), 200, 'dur: bleed'),
        (re.compile(r'увеличение длительности яда', re.I), 201, 'dur: poison'),
        (re.compile(r'увеличение длительности поджога, шока и охлаждения', re.I), 202, 'dur: burn+shock+chill combo'),
        (re.compile(r'увеличение длительности охлаждения', re.I), 203, 'dur: chill'),
        (re.compile(r'увеличение длительности шока', re.I), 204, 'dur: shock'),
        (re.compile(r'увеличение длительности эффекта парирован', re.I), 205, 'dur: parried'),
        (re.compile(r'увеличение длительности наносящих урон состояний', re.I), 206, 'dur: damaging states'),
        # Уменьшение длительности
        (re.compile(r'уменьшение длительности кровотечения на вас', re.I), 300, 'reduce: bleed on you'),
        (re.compile(r'уменьшение длительности отравления на вас', re.I), 301, 'reduce: poison on you'),
        (re.compile(r'уменьшение длительности поджога на вас', re.I), 302, 'reduce: burn on you'),
        # Шанс наложения
        (re.compile(r'шанс наложить кровотечение при нанесении удара', re.I), 400, 'proc: bleed on hit'),
        (re.compile(r'шанс отравить при нанесении удара', re.I), 401, 'proc: poison on hit'),
        (re.compile(r'шанс наложения оцепенения при нанесении удара', re.I), 402, 'proc: stun on hit'),
        (re.compile(r'шанс ослепить врагов при нанесении удара атаками', re.I), 403, 'proc: blind on hit (attacks)'),
        # iter 112 fix: Разрез has different wording
        (re.compile(r'наложить разрез|шансом.*разрез', re.I), 404, 'proc: slit on hit'),
        # Порог
        (re.compile(r'увеличение порога заморозки', re.I), 500, 'threshold: freeze'),
        (re.compile(r'увеличение порога стихийных состояний', re.I), 501, 'threshold: elemental states'),
        # Скорость накопления (use stem 'скорост' for case variants)
        (re.compile(r'скорост.* накопления шкалы заморозки(?!.*боевыми)', re.I), 600, 'gauge: freeze speed'),
        (re.compile(r'скорост.* накопления шкалы пригвождения', re.I), 601, 'gauge: pin speed'),
        (re.compile(r'увеличение накопления шкалы заморозки, если недавно', re.I), 602, 'gauge: freeze (cond)'),
        # Прочее
        (re.compile(r'усиление эффекта восприимчивости', re.I), 700, 'other: susceptibility'),
        (re.compile(r'усиление эффекта ослепления', re.I), 701, 'other: blind effect'),
        (re.compile(r'на вас нельзя наложить эффект оскверненной крови', re.I), 702, 'other: corrupted blood immune'),
        (re.compile(r'накладывает восприимчивость к стихиям', re.I), 703, 'other: elem susceptibility proc'),
        (re.compile(r'наносящие урон состояния наносят урон на #% быстрее', re.I), 704, 'other: faster damaging states'),
    ],
    'damage-type': [
        # Conversion (before generic element rules)
        (re.compile(r'наносит.*дополнительного урона от огня', re.I), 13, 'fire: conversion to fire'),
        (re.compile(r'дарует.*дополнительного урона от холода', re.I), 23, 'cold: phys→cold (Дарует)'),
        (re.compile(r'наносит.*дополнительного урона от холода', re.I), 24, 'cold: conversion to cold (Наносит)'),
        (re.compile(r'наносит.*дополнительного урона от молнии', re.I), 33, 'lightning: conversion to lightning'),
        (re.compile(r'чары наносят.*дополнительного урона хаосом', re.I), 41, 'chaos: conversion to chaos'),
        # Added damage to attacks (before generic)
        (re.compile(r'добавляет.*физического урона к атакам', re.I), 1, 'physical: added to attacks'),
        (re.compile(r'добавляет.*урона от огня к атакам', re.I), 11, 'fire: added to attacks'),
        (re.compile(r'добавляет.*урона от холода к атакам', re.I), 21, 'cold: added to attacks'),
        (re.compile(r'добавляет.*урона от молнии к атакам', re.I), 31, 'lightning: added to attacks'),
        # Saturation-conditional (before generic)
        (re.compile(r'увеличение урона от огня, если вы подобрали', re.I), 12, 'fire: saturation-conditional'),
        (re.compile(r'увеличение урона от холода, если вы подобрали', re.I), 22, 'cold: saturation-conditional'),
        (re.compile(r'увеличение урона от молнии, если вы подобрали', re.I), 32, 'lightning: saturation-conditional'),
        # Thorns (before generic)
        (re.compile(r'физического урона шипами', re.I), 2, 'physical: thorns (flat)'),
        (re.compile(r'урона от огня шипами', re.I), 14, 'fire: thorns (per 100 max health)'),
        # Generic element damage (end-anchored)
        (re.compile(r'глобального физического урона', re.I), 0, 'physical: global %'),
        (re.compile(r'увеличение урона от огня$', re.I), 10, 'fire: increase generic'),
        (re.compile(r'увеличение урона от холода$', re.I), 20, 'cold: increase generic'),
        (re.compile(r'увеличение урона от молнии$', re.I), 30, 'lightning: increase generic'),
        (re.compile(r'увеличение урона хаосом', re.I), 40, 'chaos: increase generic'),
        (re.compile(r'увеличение урона от стихий$', re.I), 50, 'elemental: all-elements increase'),
        # Elemental saturation mechanics
        (re.compile(r'максимальному количеству стихийных насыщений', re.I), 51, 'elemental: max saturation count'),
        (re.compile(r'могут не удалить стихийные насыщения', re.I), 52, 'elemental: saturation preservation mechanic'),
        # Conditional damage (before by-source generic)
        (re.compile(r'увеличение урона от атак при малом количестве здоровья', re.I), 80, 'conditional: low-HP attacks'),
        (re.compile(r'увеличение урона от чар при полном энергетическом щите', re.I), 81, 'conditional: full-ES spells'),
        (re.compile(r'увеличение урона будучи превращенным', re.I), 82, 'conditional: transformed'),
        (re.compile(r'увеличение урона, если вы недавно поглотили труп', re.I), 83, 'conditional: corpse consumed'),
        (re.compile(r'увеличение урона в ближнем бою, если', re.I), 84, 'conditional: melee if projectile'),
        (re.compile(r'увеличение урона снарядами, если', re.I), 85, 'conditional: projectile if melee'),
        # Generic + by-source
        (re.compile(r'^#% увеличение урона$', re.I), 60, 'generic: damage increase (bare)'),
        (re.compile(r'увеличение урона от атак$', re.I), 61, 'by-source: attacks generic'),
        (re.compile(r'увеличение урона от чар$', re.I), 62, 'by-source: spells generic'),
        (re.compile(r'увеличение урона снарядов$', re.I), 63, 'by-source: projectiles generic'),
        (re.compile(r'увеличение урона в ближнем бою$', re.I), 64, 'by-source: melee generic'),
        (re.compile(r'увеличение урона тотемов', re.I), 65, 'by-source: totems'),
        (re.compile(r'увеличение урона боевыми кличами', re.I), 66, 'by-source: warcries'),
        (re.compile(r'увеличение урона умениями растений', re.I), 67, 'by-source: plants'),
        (re.compile(r'увеличение урона от ловушек', re.I), 68, 'by-source: traps'),
        (re.compile(r'увеличение урона помехами', re.I), 69, 'by-source: obstacles'),
        (re.compile(r'увеличение урона шипами$', re.I), 70, 'by-source: thorns generic'),
        (re.compile(r'улучшенные атаки наносят', re.I), 71, 'by-source: enhanced attacks'),
        (re.compile(r'срабатывающие чары наносят', re.I), 72, 'by-source: triggered spells'),
        (re.compile(r'умения вестников наносят', re.I), 73, 'by-source: heralds'),
        # By-target
        (re.compile(r'увеличение урона от ударов по редким', re.I), 90, 'by-target: rare/unique enemies'),
        # Special mechanics
        (re.compile(r'накладываемых чарами проколов', re.I), 100, 'special: Puncture strength'),
        (re.compile(r'увеличение величины элементальных недугов', re.I), 101, 'special: elemental ailments magnitude'),
        (re.compile(r'накладывает анем', re.I), 102, 'special: Anemia on hit'),
        (re.compile(r'отрицательных эффектов оскверненной крови', re.I), 103, 'special: corrupted blood extra debuffs'),
    ],
    'defence-stats': [
        # Triple-stat (before single-stat rules)
        (re.compile(r'от щита в руках', re.I), 3, 'armour: shield triple-stat'),
        (re.compile(r'глобальной брони', re.I), 4, 'armour: global triple-stat'),
        # Броня
        (re.compile(r'к броне$', re.I), 0, 'armour: flat'),
        (re.compile(r'повышение брони', re.I), 1, 'armour: % generic'),
        (re.compile(r'увеличение брони от надетого нательного доспеха', re.I), 2, 'armour: from body'),
        # Уклонение
        (re.compile(r'к уклонению$', re.I), 10, 'evasion: flat'),
        (re.compile(r'увеличение уклонения от вашего нательного доспеха', re.I), 12, 'evasion: from body'),
        (re.compile(r'увеличение уклонения$', re.I), 11, 'evasion: % generic'),
        # Энергетический щит
        (re.compile(r'увеличение энергетического щита от надетого нательного доспеха', re.I), 20, 'ES: from body'),
        (re.compile(r'увеличение энергетического щита от фокуса в руках', re.I), 21, 'ES: from focus'),
        (re.compile(r'скорости перезарядки энергетического щита', re.I), 22, 'ES: recharge speed'),
        (re.compile(r'ускорение начала перезарядки энергетического щита', re.I), 23, 'ES: recharge start'),
        # Блок
        (re.compile(r'увеличение шанса блока', re.I), 30, 'block: chance'),
        # Порог оглушения (conditionals first)
        (re.compile(r'увеличение порога оглушения если недавно', re.I), 42, 'stun threshold: conditional (recently)'),
        (re.compile(r'увеличение порога оглушения при парировании', re.I), 43, 'stun threshold: conditional (parry)'),
        (re.compile(r'увеличение порога оглушения$', re.I), 41, 'stun threshold: % generic'),
        (re.compile(r'к порогу оглушения$', re.I), 40, 'stun threshold: flat'),
        # Отклонение
        (re.compile(r'увеличение отклонения ударов', re.I), 50, 'deflection: %'),
        # Обереги
        (re.compile(r'увеличение длительности эффекта оберега', re.I), 60, 'ward: duration'),
        (re.compile(r'увеличение количества получаемых зарядов оберегов', re.I), 61, 'ward: charges gained'),
        (re.compile(r'уменьшение количества используемых зарядов оберегов', re.I), 62, 'ward: charges used reduction'),
        (re.compile(r'уменьшение силы замедления.*если недавно вы использовали оберег', re.I), 63, 'ward: conditional slow reduction'),
        (re.compile(r'обереги с .* шансом могут не потратить заряды', re.I), 64, 'ward: free use chance'),
        (re.compile(r'обереги получают зарядов в секунду', re.I), 65, 'ward: regen per second'),
        (re.compile(r'увеличение урона.*активен оберег', re.I), 66, 'ward: damage while ward active'),
        # Разрушение брони
        (re.compile(r'увеличение длительности разрушения брони', re.I), 70, 'armour break: duration'),
        (re.compile(r'увеличение количества разрушаемой брони', re.I), 71, 'armour break: quantity'),
        (re.compile(r'увеличение урона по врагам с полностью разрушенной брон', re.I), 72, 'armour break: damage vs broken'),
    ],
    'resources': [
        # ES→threshold conversions (most-specific, use .* bridge)
        (re.compile(r'дарует дополнительный порог оглушения.*от максимума энергетического щита', re.I), 22, 'ES: →stun threshold conversion'),
        (re.compile(r'дарует дополнительный порог состояний.*от максимума энергетического щита', re.I), 23, 'ES: →ailment threshold conversion'),
        # Здоровье (0-9) — fire-variant listed before generic recovery
        (re.compile(r'полученного урона от огня восполняется в виде здоровья', re.I), 7, 'health: fire-damage recovery'),
        (re.compile(r'физического урона от атак похищается в виде здоровья', re.I), 5, 'health: phys-attack leech'),
        (re.compile(r'к максимуму здоровья$', re.I), 0, 'health: flat max'),
        (re.compile(r'увеличение максимума здоровья', re.I), 1, 'health: % max'),
        (re.compile(r'регенерация .* здоровья в секунду', re.I), 2, 'health: flat regen'),
        (re.compile(r'повышение скорости регенерации здоровья', re.I), 3, 'health: % regen speed'),
        (re.compile(r'увеличение количества похищенного здоровья', re.I), 4, 'health: leech generic'),
        (re.compile(r'полученного урона восполняется в виде здоровья', re.I), 6, 'health: damage recovery'),
        (re.compile(r'восстанавливает .* здоровья при убийстве', re.I), 8, 'health: on-kill %'),
        (re.compile(r'дарует .* здоровья за каждого убитого врага', re.I), 9, 'health: per-kill flat'),
        # Мана (10-19)
        (re.compile(r'физического урона от атак похищается в виде маны', re.I), 15, 'mana: phys-attack leech'),
        (re.compile(r'к максимуму маны$', re.I), 10, 'mana: flat max'),
        (re.compile(r'увеличение максимума маны', re.I), 11, 'mana: % max'),
        (re.compile(r'повышение скорости регенерации маны', re.I), 12, 'mana: % regen speed'),
        (re.compile(r'увеличение количества похищенной маны', re.I), 13, 'mana: leech generic'),
        (re.compile(r'полученного урона восполняется в виде маны', re.I), 14, 'mana: damage recovery'),
        (re.compile(r'восстанавливает .* маны при убийстве', re.I), 16, 'mana: on-kill %'),
        (re.compile(r'дарует .* маны за каждого убитого врага', re.I), 17, 'mana: per-kill flat'),
        (re.compile(r'увеличение эффективности расхода маны чарами', re.I), 18, 'mana: cost efficiency'),
        # ES (20-29) — generic, after conversions
        (re.compile(r'к максимуму энергетического щита$', re.I), 20, 'ES: flat max'),
        (re.compile(r'увеличение максимума энергетического щита', re.I), 21, 'ES: % max'),
        # Конверсия урона (30-39)
        (re.compile(r'от получаемого урона берется сначала из маны', re.I), 30, 'conversion: MoM'),
        (re.compile(r'стоимости умений в мане берется из здоровья', re.I), 31, 'conversion: mana-cost→health'),
        (re.compile(r'дарует.*максимума маны в виде брони', re.I), 32, 'conversion: mana→armour'),
        # Тотем (40-49)
        (re.compile(r'увеличение здоровья тотема', re.I), 40, 'totem: health'),
        # Прочее (50-59)
        (re.compile(r'увеличение радиуса обзора', re.I), 50, 'other: vision radius'),
        (re.compile(r'усиление эффекта Колдовского выброса', re.I), 51, 'other: Hexblast effect'),
    ],
    'weapon-specific': [
        # Мечи (0-9)
        (re.compile(r'увеличение урона мечами', re.I), 0, 'swords: damage'),
        (re.compile(r'скорости атаки мечами', re.I), 1, 'swords: attack-speed'),
        # Топоры (10-19)
        (re.compile(r'увеличение урона топорами', re.I), 10, 'axes: damage'),
        (re.compile(r'скорости атаки топорами', re.I), 11, 'axes: attack-speed'),
        # Булавы (20-29)
        (re.compile(r'увеличение урона булавами', re.I), 20, 'maces: damage'),
        (re.compile(r'скорости накопления шкалы оглушения булавами', re.I), 21, 'maces: stun-gauge'),
        # Боевые посохи (30-39)
        (re.compile(r'увеличение урона боевыми посохами', re.I), 30, 'warstaves: damage'),
        (re.compile(r'скорости атаки боевыми посохами', re.I), 31, 'warstaves: attack-speed'),
        (re.compile(r'скорости накопления шкалы заморозки боевыми посохами', re.I), 32, 'warstaves: freeze-gauge'),
        # Кинжалы (40-49)
        (re.compile(r'увеличение урона кинжалами', re.I), 40, 'daggers: damage'),
        (re.compile(r'скорости атаки кинжалами', re.I), 41, 'daggers: attack-speed'),
        (re.compile(r'шанса критического удара кинжалами', re.I), 42, 'daggers: crit-chance'),
        # Копья (50-59)
        (re.compile(r'увеличение урона копьями', re.I), 50, 'spears: damage'),
        (re.compile(r'скорости атаки копьями', re.I), 51, 'spears: attack-speed'),
        (re.compile(r'бонуса к критическому урону копьями', re.I), 52, 'spears: crit-damage'),
        # Кистени (60-69)
        (re.compile(r'увеличение урона кистенями', re.I), 60, 'flails: damage'),
        (re.compile(r'шанса критического удара кистенями', re.I), 61, 'flails: crit-chance'),
        # Луки (70-79)
        (re.compile(r'увеличение урона луками', re.I), 70, 'bows: damage'),
        (re.compile(r'скорости атаки луками', re.I), 71, 'bows: attack-speed'),
        (re.compile(r'меткости луками', re.I), 72, 'bows: accuracy'),
        # Самострелы (80-89)
        (re.compile(r'увеличение урона самострелами', re.I), 80, 'crossbows: damage'),
        (re.compile(r'скорости атаки самострелами', re.I), 81, 'crossbows: attack-speed'),
        # Без оружия (90-99)
        (re.compile(r'увеличение урона атаками без оружия', re.I), 90, 'unarmed: damage'),
        (re.compile(r'скорости атаки без оружия', re.I), 91, 'unarmed: attack-speed'),
    ],
    'flasks': [
        # Health flask (0-9) — 5 keys
        (re.compile(r'скорости восстановления здоровья от флакона', re.I), 0, 'health-flask: recovery-speed'),
        (re.compile(r'восстановления здоровья от флаконов', re.I), 1, 'health-flask: recovery-amount'),
        (re.compile(r'получаемых зарядов флакона здоровья', re.I), 2, 'health-flask: charges-gained'),
        (re.compile(r'регенерации здоровья во время действия эффекта', re.I), 3, 'health-flask: regen-during-effect'),
        (re.compile(r'^Флаконы здоровья получают зарядов в секунду', re.I), 4, 'health-flask: regen-per-sec'),
        # Mana flask (10-19) — 4 keys
        (re.compile(r'скорости восстановления маны от флакона', re.I), 10, 'mana-flask: recovery-speed'),
        (re.compile(r'восстановления маны от флаконов', re.I), 11, 'mana-flask: recovery-amount'),
        (re.compile(r'получаемых зарядов флакона маны', re.I), 12, 'mana-flask: charges-gained'),
        (re.compile(r'^Флаконы маны получают зарядов в секунду', re.I), 13, 'mana-flask: regen-per-sec'),
        # Any flask (20-29) — 5 keys (end-anchored to avoid collision with health/mana specific)
        (re.compile(r'увеличение длительности эффекта флакона$', re.I), 20, 'any-flask: duration'),
        (re.compile(r'получаемых зарядов флакона$', re.I), 21, 'any-flask: charges-gained'),
        (re.compile(r'уменьшение используемого количества зарядов флакона', re.I), 22, 'any-flask: charges-used-reduction'),
        (re.compile(r'шанс сохранить заряды флаконов', re.I), 23, 'any-flask: keep-charges'),
        (re.compile(r'^Флаконы получают зарядов в секунду', re.I), 24, 'any-flask: regen-per-sec'),
        # Flask buffs (30-39) — 2 keys
        (re.compile(r'увеличение скорости сотворения чар во время действия любого флакона', re.I), 30, 'buff: cast-speed while flask active'),
        (re.compile(r'увеличение урона чар во время действия любого флакона', re.I), 31, 'buff: spell-damage while flask active'),
    ],
    'offence-speed': [
        # Most-specific FIRST (substring-conflict resolution)
        (re.compile(r'умения метки имеют.*скорости сотворения чар', re.I), 11, 'cast-speed: mark skills (subset)'),
        (re.compile(r'скорости умений будучи превращенным', re.I), 91, 'skill-speed: transformed (conditional)'),
        # Generic speeds (end-anchored for safety)
        (re.compile(r'скорости атаки$', re.I), 0, 'attack-speed'),
        (re.compile(r'скорости сотворения чар$', re.I), 10, 'cast-speed: generic spells'),
        (re.compile(r'скорости передвижения', re.I), 20, 'move-speed'),
        (re.compile(r'скорости снарядов', re.I), 30, 'projectile-speed'),
        (re.compile(r'скорости перезарядки самострела', re.I), 40, 'crossbow-reload-speed'),
        (re.compile(r'скорости применения боевых кличей', re.I), 50, 'warcry-application-speed'),
        (re.compile(r'скорости броска ловушки', re.I), 60, 'trap-throw-speed'),
        (re.compile(r'скорости установки тотемов', re.I), 70, 'totem-place-speed'),
        (re.compile(r'скорости смены оружия', re.I), 80, 'weapon-swap-speed'),
        (re.compile(r'скорости умений$', re.I), 90, 'skill-speed: generic'),
    ],
    'crit': [
        # Flat (dative word form — distinct from % increase)
        (re.compile(r'шансу критического удара шипами', re.I), 30, 'crit-chance: thorns (flat +)'),
        (re.compile(r'шансу критического удара чар огня', re.I), 60, 'crit-chance: fire spells (flat +)'),
        (re.compile(r'бонусу критического урона для урона атаками', re.I), 50, 'crit-damage: attacks (flat +)'),
        # % increase — specific variants BEFORE end-anchored generic
        (re.compile(r'бонуса к критическому урону от чар', re.I), 41, 'crit-damage: spells %'),
        (re.compile(r'бонуса к критическому урону$', re.I), 40, 'crit-damage: generic %'),
        (re.compile(r'шанса критического удара атаками', re.I), 10, 'crit-chance: attacks %'),
        (re.compile(r'шанса критического удара для чар', re.I), 20, 'crit-chance: spells %'),
        (re.compile(r'шанса критического удара$', re.I), 0, 'crit-chance: generic %'),
        # Crit-induced ailment strength (synergy mod, comes last)
        (re.compile(r'силы наносящих урон состояний.*критическими ударами', re.I), 70, 'crit: ailment strength from crits'),
    ],
    'buff-skills': [
        # Auras (0-9) — skill strength
        (re.compile(r'силы умений аур', re.I), 0, 'auras: skill strength'),
        # Heralds (10-19) — reservation efficiency
        (re.compile(r'эффективности удержания ресурсов умениями вестниками', re.I), 10, 'heralds: reservation efficiency'),
        # Curses (20-29) — strength + activation speed
        (re.compile(r'силы проклятий', re.I), 20, 'curses: strength'),
        (re.compile(r'быстрее активация проклятия', re.I), 21, 'curses: activation speed'),
        # Warcries (40-49) — buff effect + reload speed
        (re.compile(r'усиление положительного эффекта боевого клича', re.I), 40, 'warcries: buff effect'),
        (re.compile(r'скорости перезарядки боевых кличей', re.I), 41, 'warcries: reload speed'),
        # Marks (50-59) — effect
        (re.compile(r'усиление эффекта.*умений меток', re.I), 50, 'marks: effect'),
    ],
    'skill-levels': [
        # Mark skill duration (subset — listed FIRST before generic)
        (re.compile(r'умения меток имеют.*длительности эффекта умения', re.I), 31, 'mark-skills: effect duration (subset)'),
        # Gem levels — generic end-anchored, then specific subsets
        (re.compile(r'уровню всех камней умений$', re.I), 0, 'all-skills: +level (most universal)'),
        (re.compile(r'уровню всех камней умений чар', re.I), 10, 'spell-skills: +level'),
        (re.compile(r'уровню всех камней умений ближнего боя', re.I), 11, 'melee-skills: +level'),
        (re.compile(r'уровню всех камней умений приспешников', re.I), 12, 'minion-skills: +level'),
        (re.compile(r'уровню всех камней умений снарядов', re.I), 13, 'projectile-skills: +level'),
        # Quality
        (re.compile(r'качеству всех умений', re.I), 20, 'quality: +% (all skills)'),
        (re.compile(r'максимальному качеству', re.I), 21, 'quality: +% max cap'),
        # Generic duration (end-anchored to avoid matching mark variant)
        (re.compile(r'увеличение длительности эффекта умения$', re.I), 30, 'skill-effect-duration: generic'),
        # Cooldown recovery
        (re.compile(r'скорости перезарядки умений', re.I), 40, 'skill-cooldown: recovery speed'),
    ],
    'area-duration': [
        # Area — generic end-anchored, then specific subsets
        (re.compile(r'увеличение области действия$', re.I), 0, 'area: generic'),
        (re.compile(r'увеличение области действия умений чар', re.I), 10, 'area: spells'),
        (re.compile(r'увеличение области действия проклятий', re.I), 11, 'area: curses'),
        (re.compile(r'увеличение области действия умений знамён', re.I), 12, 'area: banners'),
        (re.compile(r'увеличение области действия присутствия', re.I), 13, 'area: presence'),
        # Radius improvement (special mod)
        (re.compile(r'Улучшает радиус до очень большого', re.I), 20, 'area: radius improvement (special)'),
        # Duration
        (re.compile(r'увеличение длительности проклятий', re.I), 30, 'duration: curses'),
        (re.compile(r'увеличение длительности умений знамён', re.I), 31, 'duration: banners'),
    ],
    'meta-skills': [
        # Energy (most universal meta-skill stat)
        (re.compile(r'Мета-умения получают.*количество энергии', re.I), 0, 'meta-skill: energy amount'),
        (re.compile(r'максимума энергии вызываемых умений', re.I), 1, 'meta-skill: max energy (triggered skills)'),
        # Archon (buff effect before duration)
        (re.compile(r'усиление положительных эффектов Архонта', re.I), 10, 'archon: buff effect strength'),
        (re.compile(r'длительности эффекта Архонта', re.I), 11, 'archon: effect duration'),
        # Sealed skills (max charges before frequency)
        (re.compile(r'максимуму зарядов печати', re.I), 20, 'sealed-skills: max charges (cap)'),
        (re.compile(r'частоты получения зарядов печати', re.I), 21, 'sealed-skills: charge frequency (speed)'),
    ],
    'rage-charges': [
        # Flat max cap (end-anchored)
        (re.compile(r'максимуму свирепости$', re.I), 0, 'rage: flat max cap'),
        # Active gain (player-initiated trigger)
        (re.compile(r'Дарует.*свирепости.*в ближнем бою', re.I), 10, 'rage: gain on melee hit (active)'),
        # Passive gain (enemy-initiated trigger)
        (re.compile(r'Дарует.*свирепости.*получении удара', re.I), 11, 'rage: gain on being hit (passive)'),
        # Alt-resource (Слава for banner skills)
        (re.compile(r'скорости накопления славы', re.I), 20, 'glory: gain speed for banner skills'),
    ],
    'runes-barrier': [
        # Flat max cap (end-anchored — bare flat)
        (re.compile(r'максимуму рунического барьера$', re.I), 0, 'runes: flat max cap'),
        # % max cap (distinctive leading phrase)
        (re.compile(r'увеличение максимума рунического барьера', re.I), 1, 'runes: % max cap'),
        # Regen speed
        (re.compile(r'скорости регенерации рунического барьера', re.I), 10, 'runes: regen speed %'),
        # Conditional recovery (when using ward)
        (re.compile(r'Восстанавливает.*рунического барьера.*оберега', re.I), 20, 'runes: on-ward-use recovery'),
    ],
    'penetration': [
        # Lightning penetration (mirrors resistances element order 1)
        (re.compile(r'пробивает.*сопротивления молнии', re.I), 0, 'penetration: lightning'),
        # Cold penetration (mirrors resistances element order 2)
        (re.compile(r'пробивает.*сопротивления холоду', re.I), 1, 'penetration: cold'),
        # Fire penetration (mirrors resistances element order 3)
        (re.compile(r'пробивает.*сопротивления огню', re.I), 2, 'penetration: fire'),
    ],
}


def compute_sort_key(block: str, family_key: str) -> tuple[str, str | None]:
    """Returns (sort_key, matched_rule_comment)."""
    rules = BLOCK_SORT_RULES.get(block)
    if not rules:
        return (f'999::{family_key}', None)
    for pattern, order, comment in rules:
        if pattern.search(family_key):
            return (f'{order:03d}::{family_key}', comment)
    return (f'900::{family_key}', None)


def main() -> int:
    # Aggregate family-keys per functionalCategory across jewellery files
    by_cat: dict[str, dict[str, str]] = {}
    for fname in ['amulet.json', 'ring.json', 'belt.json', 'jewel.json',
                  'jewel-desecrated.json', 'jewel-corrupted.json']:
        path = os.path.join(GENERATED_DIR, fname)
        with open(path, encoding='utf-8') as f:
            d = json.load(f)
        for t in d.get('tokens', []):
            cat = t.get('functionalCategory', 'other')
            fk = t['familyKey']['ru']
            by_cat.setdefault(cat, {})[fk] = fk

    exit_code = 0
    for block in ['resistances', 'attributes', 'minions', 'ailments', 'damage-type',
                  'defence-stats', 'resources', 'weapon-specific', 'flasks',
                  'offence-speed', 'crit', 'buff-skills',
                  'skill-levels', 'area-duration', 'meta-skills',
                  'rage-charges', 'runes-barrier', 'penetration']:
        family_keys = sorted(by_cat.get(block, {}).keys())
        print(f'\n=== {block} ({len(family_keys)} family-keys) ===')
        uncovered = []
        for fk in family_keys:
            sort_key, comment = compute_sort_key(block, fk)
            if sort_key.startswith('900::'):
                uncovered.append((fk, comment))
        if uncovered:
            print(f'  ⚠ {len(uncovered)} family-key(s) NOT matched by any rule:')
            for fk, _ in uncovered:
                print(f'    - "{fk}"')
            exit_code = 1
        else:
            print(f'  ✓ All {len(family_keys)} family-keys covered by rules.')

    if exit_code == 0:
        print('\n✓ All 18 blocks fully covered. No gaps.')
    else:
        print('\n⚠ Some family-keys uncovered — add rules to BLOCK_SORT_RULES.')
    return exit_code


if __name__ == '__main__':
    sys.exit(main())

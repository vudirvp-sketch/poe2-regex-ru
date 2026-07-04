/**
 * BasketToRegexFlow — iter 167 (REDESIGN_CONCEPT_v4 §A3, Variant C).
 *
 * Visual connector between `SelectedBasket` (above) and `RegexOutput` (below)
 * in the right `<aside>` of every category page. Renders a thin gold-gradient
 * vertical line with a centered ↓ arrow when the basket has at least one
 * chip (selected / optional / excluded). When the basket is empty, renders
 * nothing — the connector only appears once there is actual content to
 * "flow" from selection to result.
 *
 * Why: per the v4 §A3 audit, when `RegexOutput` is empty (no regex yet) it
 * visually competes with the equally-empty `SelectedBasket` placeholder, so
 * the user doesn't know where to look. The connector gives an explicit
 * «selection → result» cue: once the user picks the first chip, the
 * connector appears between the two panels, pointing down to where the
 * regex will be generated. Combined with the empty-state ↑ arrow inside
 * `RegexOutput`, the full loop reads:
 *
 *   ↑ (RegexOutput placeholder) → user clicks a chip → ↓ connector appears
 *   → RegexOutput populates + pulses (iter 164 P3 animation).
 *
 * Rendering rules:
 * - `hasContent === false` → returns `null` (no DOM, no gap).
 * - `hasContent === true`  → renders a 14px-tall centered column with a
 *   2px-wide gold-gradient line + ↓ glyph. The element is `aria-hidden`
 *   for screen readers (the relationship is already described via the
 *   `basket.to_regex_flow_aria` label on the wrapper).
 *
 * The fade-in animation is short (200ms) and respects
 * `prefers-reduced-motion`. The connector is purely decorative — no JS
 * state, no event handlers, no store coupling.
 *
 * Backward compat: `CategoryLayout` only renders this component when
 * `basketHasContent === true`. Pages that don't pass the prop behave as
 * before (no connector).
 */
import React from 'react';
import { t } from '@shared/i18n';

interface BasketToRegexFlowProps {
  /** Whether the SelectedBasket above has at least one chip (any of
   *  selected / optional / excluded). When false, the connector is
   *  not rendered. */
  hasContent: boolean;
}

export const BasketToRegexFlow: React.FC<BasketToRegexFlowProps> = ({ hasContent }) => {
  if (!hasContent) return null;
  return (
    <div
      className="basket-to-regex-flow"
      role="presentation"
      aria-label={t('basket.to_regex_flow_aria')}
    >
      <span className="basket-to-regex-flow__line" aria-hidden="true" />
      <span className="basket-to-regex-flow__arrow" aria-hidden="true">↓</span>
    </div>
  );
};

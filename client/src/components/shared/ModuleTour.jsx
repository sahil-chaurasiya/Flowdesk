import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './module-tour.css';

/**
 * Spotlight product tour. No dependencies, theme-token styled.
 *
 * steps: [{
 *   id, title, body,
 *   target?: () => Element | null,   // omit for a centred "welcome" card
 *   placement?: ('bottom'|'top'|'right'|'left')[],  // preferred popover sides, in order
 *   pad?: number,                    // breathing room around the highlighted element
 *   icon?: ReactComponent            // optional icon for centred cards
 * }]
 *
 * Props: open, onClose(reason: 'finish' | 'skip'), finishLabel (last button, default "Done"),
 *        lastSkipLabel (optional "no thanks" button shown on the last step, e.g. "Maybe later").
 *
 * Steps whose target can't be found or isn't on screen (e.g. the sidebar on a phone)
 * are skipped when the tour opens, so it never points at nothing.
 */

const POP_GAP = 14;
const EDGE = 12;

const isShown = (el) => {
  if (!el || !el.getClientRects().length) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
};

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

function placePopover(rect, pop, vw, vh, order) {
  if (!rect) return { x: (vw - pop.w) / 2, y: Math.max(EDGE, (vh - pop.h) / 2) };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const options = {
    bottom: { x: cx - pop.w / 2, y: rect.bottom + POP_GAP, ok: rect.bottom + POP_GAP + pop.h <= vh - EDGE },
    top:    { x: cx - pop.w / 2, y: rect.top - POP_GAP - pop.h, ok: rect.top - POP_GAP - pop.h >= EDGE },
    right:  { x: rect.right + POP_GAP, y: cy - pop.h / 2, ok: rect.right + POP_GAP + pop.w <= vw - EDGE },
    left:   { x: rect.left - POP_GAP - pop.w, y: cy - pop.h / 2, ok: rect.left - POP_GAP - pop.w >= EDGE },
  };
  const pick = order.find((o) => options[o]?.ok);
  const o = pick ? options[pick] : { x: (vw - pop.w) / 2, y: vh - pop.h - EDGE };   // last resort: float at the bottom
  return { x: clamp(o.x, EDGE, vw - pop.w - EDGE), y: clamp(o.y, EDGE, vh - pop.h - EDGE) };
}

export default function ModuleTour({ steps, open, onClose, finishLabel = 'Done', lastSkipLabel }) {
  const [live, setLive] = useState([]);          // steps that can actually be shown right now
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);        // padded, viewport-clamped highlight box
  const [pop, setPop] = useState({ w: 340, h: 200 });
  const popRef = useRef(null);
  const nextRef = useRef(null);
  const returnFocus = useRef(null);

  // Decide which steps to show each time the tour opens.
  useLayoutEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement;
    setLive(steps.filter((s) => !s.target || isShown(s.target())));
    setI(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const step = live[i];
  const last = i === live.length - 1;

  const close = useCallback((reason = 'skip') => {
    onClose?.(reason);
    try { returnFocus.current?.focus?.({ preventScroll: true }); } catch { /* element may be gone */ }
  }, [onClose]);
  const next = useCallback(() => (last ? close('finish') : setI((n) => n + 1)), [last, close]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  // Bring the target into view when a step starts.
  useEffect(() => {
    if (!open || !step?.target) return;
    const el = step.target();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [open, step]);

  // Track the target + popover size. Cheap rAF loop that only sets state when something moved,
  // so it follows scrolling, resizing and sidebar animations without extra wiring.
  useEffect(() => {
    if (!open || !step) return undefined;
    let raf;
    const tick = () => {
      const el = step.target?.();
      let nextRect = null;
      if (el && isShown(el)) {
        const r = el.getBoundingClientRect();
        const p = step.pad ?? 6;
        const left = Math.max(4, r.left - p);
        const top = Math.max(4, r.top - p);
        const right = Math.min(window.innerWidth - 4, r.right + p);
        const bottom = Math.min(window.innerHeight - 4, r.bottom + p);
        nextRect = { left, top, right, bottom, width: right - left, height: bottom - top };
      }
      setRect((prev) => {
        if (!nextRect && !prev) return prev;
        if (nextRect && prev && ['left', 'top', 'width', 'height'].every((k) => Math.abs(prev[k] - nextRect[k]) < 0.5)) return prev;
        return nextRect;
      });
      const ph = popRef.current;
      if (ph) {
        setPop((prev) => (Math.abs(prev.w - ph.offsetWidth) < 1 && Math.abs(prev.h - ph.offsetHeight) < 1 ? prev : { w: ph.offsetWidth, h: ph.offsetHeight }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, step]);

  // Keyboard: Esc closes, arrows move.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close('skip'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, next, back]);

  useEffect(() => { if (open && step) nextRef.current?.focus({ preventScroll: true }); }, [open, step]);

  if (!open || !step || typeof document === 'undefined') return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(340, vw - EDGE * 2);
  const { x, y } = placePopover(step.target ? rect : null, { w, h: pop.h }, vw, vh, step.placement || ['bottom', 'top', 'right', 'left']);
  const Icon = step.icon;
  const centred = !step.target;

  return createPortal(
    <div className="fd-tour" role="presentation">
      {/* swallows clicks so the page underneath can't be used mid-tour */}
      <div className="fd-tour__blocker" />
      {centred || !rect
        ? <div className="fd-tour__dim" />
        : <div className="fd-tour__spot" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />}

      <div
        ref={popRef}
        key={step.id}
        className={`fd-tour__pop${centred ? ' fd-tour__pop--center' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fd-tour-title"
        aria-describedby="fd-tour-body"
        style={{ left: x, top: y, width: w }}
      >
        {Icon && centred && <span className="fd-tour__badge"><Icon size={20} strokeWidth={1.8} /></span>}
        <div className="fd-tour__progress" aria-label={`Step ${i + 1} of ${live.length}`}>
          {live.map((s, n) => <span key={s.id} className={n <= i ? 'is-done' : ''} />)}
        </div>
        <h2 id="fd-tour-title" className="fd-tour__title">{step.title}</h2>
        <p id="fd-tour-body" className="fd-tour__body">{step.body}</p>
        <div className="fd-tour__actions">
          {!last || lastSkipLabel
            ? <button type="button" className="fd-tour__skip" onClick={() => close('skip')}>{last ? lastSkipLabel : 'Skip tour'}</button>
            : <span />}
          <div className="fd-tour__nav">
            {i > 0 && <button type="button" className="fd-tour__btn" onClick={back}>Back</button>}
            <button ref={nextRef} type="button" className="fd-tour__btn fd-tour__btn--primary" onClick={next}>
              {last ? finishLabel : i === 0 && centred ? 'Show me around' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
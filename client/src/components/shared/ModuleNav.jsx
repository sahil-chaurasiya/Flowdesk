import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import './module-nav.css';

/**
 * Sub-navigation for embedded modules (Attendance, Finance).
 *
 *  - Lives in the page content, never in the Flowdesk sidebar.
 *  - Two-level when a module has several groups: a small mode switch (e.g. Me / Team)
 *    on the left, and a "dock" of that group's pages next to it, so only the relevant
 *    5–7 tabs are ever on screen instead of all 12 at once.
 *  - A highlight slides between tabs; the dock scrolls sideways inside its own box
 *    and can never widen the page.
 *
 * groups: [{ label?, icon?, items: [{ to, label, icon?, end? }] }]
 * trailing: optional node pinned to the right (e.g. a "Read-only" tag)
 */

function SlidingTabs({ items, variant = 'dock', ariaLabel }) {
  const scroller = useRef(null);
  const track = useRef(null);
  const { pathname } = useLocation();
  const [thumb, setThumb] = useState(null);       // { x, w }
  const [ready, setReady] = useState(false);      // no slide-in animation on first paint
  const [edge, setEdge] = useState({ left: false, right: false });

  const measureEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdge((p) => (p.left === left && p.right === right ? p : { left, right }));
  }, []);

  const measureThumb = useCallback(() => {
    const a = track.current?.querySelector('[aria-current="page"]');
    if (!a) { setThumb(null); return; }
    setThumb((p) => (p && p.x === a.offsetLeft && p.w === a.offsetWidth ? p : { x: a.offsetLeft, w: a.offsetWidth }));
  }, []);

  useLayoutEffect(() => {
    measureThumb();
    measureEdges();
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [pathname, items, measureThumb, measureEdges]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const onResize = () => { measureThumb(); measureEdges(); };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(el);
    if (track.current) ro?.observe(track.current);
    window.addEventListener('resize', onResize);
    return () => { ro?.disconnect(); window.removeEventListener('resize', onResize); };
  }, [measureThumb, measureEdges]);

  // keep the active tab in view (scrolls the dock only, never the page)
  useEffect(() => {
    const el = scroller.current;
    const a = track.current?.querySelector('[aria-current="page"]');
    if (!el || !a) return;
    el.scrollTo({ left: Math.max(0, a.offsetLeft - (el.clientWidth - a.offsetWidth) / 2), behavior: 'smooth' });
  }, [pathname, items]);

  return (
    <div className={`fd-modnav__box fd-modnav__box--${variant}`}>
      <div
        ref={scroller}
        className="fd-modnav__scroll"
        onScroll={measureEdges}
        data-edge-left={edge.left || undefined}
        data-edge-right={edge.right || undefined}
      >
        <nav ref={track} className="fd-modnav__track" aria-label={ariaLabel}>
          <span
            className="fd-modnav__thumb"
            data-ready={ready || undefined}
            style={thumb ? { width: thumb.w, transform: `translateX(${thumb.x}px)`, opacity: 1 } : { opacity: 0 }}
            aria-hidden="true"
          />
          {items.map((t) => {
            const Icon = t.icon;
            const inner = (<>{Icon && <Icon size={14} strokeWidth={1.9} className="fd-modnav__icon" />}<span>{t.label}</span></>);
            return t.to ? (
              <NavLink key={t.key || t.to} to={t.to} end={t.end} className="fd-modnav__tab">{inner}</NavLink>
            ) : (
              <button key={t.key || t.label} type="button" className="fd-modnav__tab" aria-current={t.active ? 'page' : undefined} onClick={t.onSelect}>{inner}</button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function ModuleNav({ groups, trailing }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lastVisited = useRef({});

  const visible = groups.filter((g) => g.items?.length);

  // Which group does the current URL belong to? The longest matching prefix wins,
  // so deep pages (e.g. an employee detail page) keep the right mode selected.
  let activeIdx = 0;
  let best = -1;
  visible.forEach((g, gi) => g.items.forEach((t) => {
    if (pathname === t.to || pathname.startsWith(`${t.to}/`)) {
      if (t.to.length > best) { best = t.to.length; activeIdx = gi; }
    }
  }));

  useEffect(() => { lastVisited.current[activeIdx] = pathname; }, [pathname, activeIdx]);

  const active = visible[Math.min(activeIdx, visible.length - 1)];
  if (!active) return null;

  const modes = visible.length > 1
    ? visible.map((g, gi) => ({
        key: g.label || String(gi),
        label: g.label,
        icon: g.icon,
        active: gi === activeIdx,
        onSelect: () => navigate(lastVisited.current[gi] || g.items[0].to),
      }))
    : null;

  return (
    <div className="fd-modnav">
      {modes && <SlidingTabs items={modes} variant="mode" ariaLabel="Switch view" />}
      <SlidingTabs items={active.items} variant="dock" ariaLabel="Section navigation" />
      {trailing ? <div className="fd-modnav__trailing">{trailing}</div> : null}
    </div>
  );
}
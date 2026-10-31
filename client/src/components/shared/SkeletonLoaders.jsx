import React from 'react';

/**
 * SkeletonTable — drop-in loading placeholder for any table-based page.
 * Usage: <SkeletonTable rows={6} cols={5} />
 */
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-4 px-5 py-3 border-b"
        style={{ background: 'var(--fd-surface-sunken)', borderColor: 'var(--fd-border)' }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="shimmer h-3 rounded flex-1" style={{ maxWidth: i === 0 ? 120 : undefined }} />
        ))}
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-5 py-4 border-b last:border-0"
          style={{ borderColor: 'var(--fd-border-subtle)' }}
        >
          {/* Avatar / icon placeholder */}
          <div className="shimmer w-8 h-8 rounded-full flex-shrink-0" />

          {/* Main content */}
          <div className="flex-1 space-y-1.5">
            <div className="shimmer h-3 rounded" style={{ width: `${50 + Math.random() * 30}%` }} />
            <div className="shimmer h-2.5 rounded" style={{ width: `${30 + Math.random() * 20}%` }} />
          </div>

          {/* Pill badges */}
          {Array.from({ length: Math.max(0, cols - 2) }).map((_, c) => (
            <div key={c} className="shimmer h-5 w-16 rounded-full flex-shrink-0" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonCards — grid of stat-card skeletons
 */
export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-5"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="shimmer w-9 h-9 rounded-lg" />
          </div>
          <div className="shimmer h-7 w-16 rounded mb-2" />
          <div className="shimmer h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonList — simple vertical list of shimmer rows
 */
export function SkeletonList({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
        >
          <div className="shimmer w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="shimmer h-3 rounded" style={{ width: `${40 + Math.random() * 40}%` }} />
            <div className="shimmer h-2.5 rounded" style={{ width: `${25 + Math.random() * 20}%` }} />
          </div>
          <div className="shimmer h-5 w-14 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonKanban — 4-column kanban shimmer
 */
export function SkeletonKanban() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 4 }).map((_, col) => (
        <div
          key={col}
          className="flex-shrink-0 w-64 rounded-xl overflow-hidden"
          style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
        >
          <div className="px-3.5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--fd-border)' }}>
            <div className="shimmer w-5 h-5 rounded" />
            <div className="shimmer h-3 flex-1 rounded" />
            <div className="shimmer w-5 h-5 rounded-full" />
          </div>
          <div className="p-2.5 space-y-2">
            {Array.from({ length: 2 + col }).map((_, card) => (
              <div
                key={card}
                className="rounded-xl p-3.5"
                style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
              >
                <div className="flex gap-2 mb-2">
                  <div className="shimmer w-2 h-2 rounded-full mt-1 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="shimmer h-3 rounded" />
                    <div className="shimmer h-2.5 rounded w-3/4" />
                  </div>
                </div>
                <div className="flex justify-between mt-3">
                  <div className="shimmer w-5 h-5 rounded-full" />
                  <div className="shimmer h-4 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

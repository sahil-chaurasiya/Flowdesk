export default function StatusBadge({ status }) {
  if (status === 'present') return (
    <span className="badge-present">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
      Present
    </span>
  );
  if (status === 'late') return (
    <span className="badge-late">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      Late
    </span>
  );
  if (status === 'holiday') return (
    <span className="badge-present" style={{ background: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
      Holiday
    </span>
  );
  if (status === 'on_leave') return (
    <span className="badge-present" style={{ background: 'rgba(56,189,248,0.12)', borderColor: 'rgba(56,189,248,0.3)', color: '#7dd3fc' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
      On Leave
    </span>
  );
  return (
    <span className="badge-absent">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
      Absent
    </span>
  );
}
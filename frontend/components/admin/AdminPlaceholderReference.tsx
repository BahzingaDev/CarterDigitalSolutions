import type { CorrespondencePlaceholder } from '../../src/data/correspondencePlaceholders';

export function PlaceholderSelect({ definitions, label, onInsert }: { definitions: CorrespondencePlaceholder[]; label: string; onInsert: (key: string) => void }) {
  const groups = grouped(definitions);
  return <select aria-label={label} className="form-select admin-placeholder-select" onChange={(event) => { if (event.target.value) onInsert(event.target.value); event.target.value = ''; }} value="">
    <option value="">Insert placeholder</option>
    {groups.map(([group, items]) => <optgroup key={group} label={group}>{items.map((item) => <option key={item.key} value={item.key}>{item.label} — {'{{'}{item.key}{'}}'}</option>)}</optgroup>)}
  </select>;
}

export function PlaceholderReference({ definitions, title }: { definitions: CorrespondencePlaceholder[]; title: string }) {
  return <details className="admin-placeholder-reference">
    <summary>{title} ({definitions.length})</summary>
    <div>{grouped(definitions).map(([group, items]) => <section key={group}><h3>{group}</h3><dl>{items.map((item) => <div key={item.key}><dt><code>{'{{'}{item.key}{'}}'}</code></dt><dd><strong>{item.label}</strong><span>{item.description}</span><small>Example: {item.sample}</small></dd></div>)}</dl></section>)}</div>
  </details>;
}

function grouped(definitions: CorrespondencePlaceholder[]) {
  return Array.from(new Set(definitions.map((item) => item.group))).map((group) => [group, definitions.filter((item) => item.group === group)] as const);
}

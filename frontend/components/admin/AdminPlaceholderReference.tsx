import type { CorrespondencePlaceholder } from '../../src/data/correspondencePlaceholders';
import { useState } from 'react';

export function PlaceholderInput({ definitions, label, maxLength = 180, onChange, value }: { definitions: CorrespondencePlaceholder[]; label: string; maxLength?: number; onChange: (value: string) => void; value: string }) {
  const [suggestions, setSuggestions] = useState<CorrespondencePlaceholder[]>([]);
  const [active, setActive] = useState(0);
  const update = (next: string) => {
    onChange(next);
    const prefix = next.match(/\{\{([a-z_]*)$/i)?.[1].toLowerCase();
    setSuggestions(prefix === undefined ? [] : definitions.filter((item) => item.key.startsWith(prefix)).slice(0, 6));
    setActive(0);
  };
  const insert = (item: CorrespondencePlaceholder) => { onChange(value.replace(/\{\{[a-z_]*$/i, `{{${item.key}}}`)); setSuggestions([]); };
  return <div className="admin-placeholder-input"><label>{label}<input className="form-control" maxLength={maxLength} onChange={(event) => update(event.target.value)} onKeyDown={(event) => { if (!suggestions.length) return; if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length); } if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); insert(suggestions[active]); } if (event.key === 'Escape') setSuggestions([]); }} value={value} /></label>{suggestions.length ? <div className="admin-placeholder-suggestions" role="listbox">{suggestions.map((item, index) => <button aria-selected={active === index} className={active === index ? 'is-active' : ''} key={item.key} onMouseDown={(event) => { event.preventDefault(); insert(item); }} role="option" title={item.description} type="button"><code>{'{{'}{item.key}{'}}'}</code><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</div> : null}</div>;
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

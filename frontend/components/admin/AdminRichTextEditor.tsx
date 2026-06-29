import DOMPurify from 'dompurify';
import { Bold, Code2, Italic, Link, List, ListOrdered, RemoveFormatting, Underline } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { CorrespondencePlaceholder } from '../../src/data/correspondencePlaceholders';

const allowedTags = ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'blockquote', 'font'];

export function AdminRichTextEditor({ label, maxLength = 5000, onChange, placeholders = [], value }: { label: string; maxLength?: number; onChange: (value: string) => void; placeholders?: CorrespondencePlaceholder[]; value: string }) {
  const editor = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState(value);
  const [suggestions, setSuggestions] = useState<CorrespondencePlaceholder[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  useEffect(() => {
    if (!editor.current || document.activeElement === editor.current) return;
    const html = normaliseRichText(value);
    if (editor.current.innerHTML !== html) editor.current.innerHTML = html;
  }, [value]);

  const update = () => {
    if (!editor.current) return;
    const clean = sanitiseRichText(editor.current.innerHTML);
    if (editor.current.innerHTML !== clean) editor.current.innerHTML = clean;
    onChange(clean);
  };
  const command = (name: string, commandValue?: string) => {
    editor.current?.focus();
    if (savedRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange.current);
    }
    document.execCommand(name, false, commandValue);
    rememberSelection();
    update();
  };
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  };
  const updateSuggestions = () => {
    if (!editor.current || !placeholders.length) return setSuggestions([]);
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.current.contains(selection.anchorNode)) return setSuggestions([]);
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(editor.current);
    range.setEnd(selection.anchorNode!, selection.anchorOffset);
    const match = range.toString().match(/\{\{([a-z_]*)$/i);
    const matches = match ? placeholders.filter((item) => item.key.startsWith(match[1].toLowerCase())).slice(0, 6) : [];
    setSuggestions(matches);
    setActiveSuggestion(0);
  };
  const insertPlaceholder = (placeholder: CorrespondencePlaceholder) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.current?.contains(selection.anchorNode)) return;
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(editor.current);
    range.setEnd(selection.anchorNode!, selection.anchorOffset);
    const prefix = range.toString().match(/\{\{([a-z_]*)$/i)?.[1] ?? '';
    command('insertText', `${placeholder.key.slice(prefix.length)}}}`);
    setSuggestions([]);
  };
  const insertLink = () => {
    const url = window.prompt('Enter a secure link URL beginning with https://');
    if (!url) return;
    if (!/^https:\/\//i.test(url)) return;
    command('createLink', url);
  };

  return <div className="admin-rich-text-field">
    <span>{label}</span>
    <div className="admin-rich-text-toolbar" role="toolbar" aria-label={`${label} formatting`}>
      <EditorButton icon={Bold} label="Bold" onClick={() => command('bold')} />
      <EditorButton icon={Italic} label="Italic" onClick={() => command('italic')} />
      <EditorButton icon={Underline} label="Underline" onClick={() => command('underline')} />
      <EditorButton icon={List} label="Bulleted list" onClick={() => command('insertUnorderedList')} />
      <EditorButton icon={ListOrdered} label="Numbered list" onClick={() => command('insertOrderedList')} />
      <EditorButton icon={Link} label="Add link" onClick={insertLink} />
      <select aria-label="Font family" disabled={htmlMode} onChange={(event) => command('fontName', event.target.value)} title="Font family" defaultValue=""><option value="" disabled>Font</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times</option><option value="Verdana">Verdana</option></select>
      <select aria-label="Font size" disabled={htmlMode} onChange={(event) => command('fontSize', event.target.value)} title="Font size" defaultValue=""><option value="" disabled>Size</option><option value="1">Small</option><option value="3">Normal</option><option value="5">Large</option><option value="6">Heading</option></select>
      <label className="admin-rich-text-colour" title="Text colour"><span className="visually-hidden">Text colour</span><input aria-label="Text colour" disabled={htmlMode} onChange={(event) => command('foreColor', event.target.value)} type="color" /></label>
      <EditorButton icon={RemoveFormatting} label="Clear formatting" onClick={() => command('removeFormat')} />
      <EditorButton icon={Code2} label={htmlMode ? 'Return to rich text' : 'Edit HTML'} onClick={() => { if (htmlMode) { const clean = sanitiseRichText(htmlDraft); onChange(clean); setHtmlMode(false); } else { setHtmlDraft(value); setHtmlMode(true); setSuggestions([]); } }} />
    </div>
    {htmlMode ? <textarea aria-label={`${label} HTML`} className="admin-rich-text-source" maxLength={10000} onBlur={() => { const clean = sanitiseRichText(htmlDraft); setHtmlDraft(clean); onChange(clean); }} onChange={(event) => setHtmlDraft(event.target.value)} spellCheck={false} value={htmlDraft} /> : <div
      aria-label={label}
      aria-multiline="true"
      className="admin-rich-text-editor"
      contentEditable
      onBlur={update}
      onInput={() => {
        if (!editor.current) return;
        if ((editor.current.textContent ?? '').length <= maxLength) onChange(editor.current.innerHTML);
        updateSuggestions();
        rememberSelection();
      }}
      onKeyDown={(event) => {
        if (!suggestions.length) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion((current) => (current + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length); }
        if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); insertPlaceholder(suggestions[activeSuggestion]); }
        if (event.key === 'Escape') setSuggestions([]);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        command('insertHTML', html ? sanitiseRichText(html) : escapeText(text).replace(/\n/g, '<br>'));
      }}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      ref={editor}
      role="textbox"
      suppressContentEditableWarning
    />}
    {!htmlMode && suggestions.length > 0 ? <div className="admin-placeholder-suggestions" role="listbox" aria-label="Placeholder suggestions">{suggestions.map((item, index) => <button aria-selected={index === activeSuggestion} className={index === activeSuggestion ? 'is-active' : ''} key={item.key} onMouseDown={(event) => { event.preventDefault(); insertPlaceholder(item); }} role="option" type="button"><code>{'{{'}{item.key}{'}}'}</code><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</div> : null}
  </div>;
}

export function sanitiseRichText(value: string) {
  return DOMPurify.sanitize(value, { ALLOWED_ATTR: ['href', 'target', 'rel', 'face', 'size', 'color'], ALLOWED_TAGS: allowedTags });
}

export function normaliseRichText(value: string) {
  if (!value) return '';
  return sanitiseRichText(/<\/?[a-z][\s\S]*>/i.test(value) ? value : escapeText(value).replace(/\n/g, '<br>'));
}

function EditorButton({ icon: Icon, label, onClick }: { icon: typeof Bold; label: string; onClick: () => void }) {
  return <button aria-label={label} onMouseDown={(event) => { event.preventDefault(); onClick(); }} title={label} type="button"><Icon size={16} /></button>;
}

function escapeText(value: string) {
  const node = document.createElement('div');
  node.textContent = value;
  return node.innerHTML;
}

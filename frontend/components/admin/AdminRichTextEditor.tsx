import DOMPurify from 'dompurify';
import { Bold, Italic, Link, List, ListOrdered, RemoveFormatting, Underline } from 'lucide-react';
import { useEffect, useRef } from 'react';

const allowedTags = ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'blockquote'];

export function AdminRichTextEditor({ label, maxLength = 5000, onChange, value }: { label: string; maxLength?: number; onChange: (value: string) => void; value: string }) {
  const editor = useRef<HTMLDivElement>(null);

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
    document.execCommand(name, false, commandValue);
    update();
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
      <EditorButton icon={RemoveFormatting} label="Clear formatting" onClick={() => command('removeFormat')} />
    </div>
    <div
      aria-label={label}
      aria-multiline="true"
      className="admin-rich-text-editor"
      contentEditable
      onBlur={update}
      onInput={() => {
        if (!editor.current) return;
        if ((editor.current.textContent ?? '').length <= maxLength) onChange(editor.current.innerHTML);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        command('insertHTML', html ? sanitiseRichText(html) : escapeText(text).replace(/\n/g, '<br>'));
      }}
      ref={editor}
      role="textbox"
      suppressContentEditableWarning
    />
  </div>;
}

export function sanitiseRichText(value: string) {
  return DOMPurify.sanitize(value, { ALLOWED_ATTR: ['href', 'target', 'rel'], ALLOWED_TAGS: allowedTags });
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

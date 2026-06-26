import { useMemo, useState } from 'react';

const readinessItems = [
  'I know the main outcome I want from the project.',
  'I can describe who the website, tool, or workflow is for.',
  'I have examples, references, or notes that show the style or direction.',
  'I know what content, files, data, or accounts may be involved.',
  'I have a rough deadline or preferred launch window.',
  'I know whether I need build work, advice, support, or all three.',
  'I have considered a budget range or comfortable starting point.',
  'I know who needs to review or approve the work.',
];

export function ReadinessPage() {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const completedCount = checkedItems.size;
  const progress = useMemo(
    () => Math.round((completedCount / readinessItems.length) * 100),
    [completedCount],
  );

  const toggleItem = (item: string) => {
    setCheckedItems((current) => {
      const next = new Set(current);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="section-kicker">Readiness</p>
          <h1>Check what is ready before starting.</h1>
          <p>
            You do not need every answer before making contact, but these points help
            make scoping clearer and faster.
          </p>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="readiness-layout">
            <aside className="readiness-score" aria-live="polite">
              <span>Readiness</span>
              <strong>{progress}%</strong>
              <small>
                {completedCount} of {readinessItems.length} items checked
              </small>
            </aside>

            <div className="readiness-list">
              {readinessItems.map((item) => (
                <label className="readiness-item" key={item}>
                  <input
                    checked={checkedItems.has(item)}
                    onChange={() => {
                      toggleItem(item);
                    }}
                    type="checkbox"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

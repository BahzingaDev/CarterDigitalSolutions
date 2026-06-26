import { type FormEvent, useMemo, useState } from 'react';

import { submitEnquiry } from '../src/api/enquiries';
import { formatCurrency, pricingCategories } from '../src/data/pricing';

const complexityLevels = [
  {
    level: 1,
    label: 'Simple',
    hours: 6,
    description: 'Small setup, light changes, or a clearly defined single outcome.',
  },
  {
    level: 2,
    label: 'Standard',
    hours: 12,
    description: 'A modest build or improvement with a few moving parts.',
  },
  {
    level: 3,
    label: 'Detailed',
    hours: 18,
    description: 'More planning, integration, content, or workflow detail required.',
  },
  {
    level: 4,
    label: 'Advanced',
    hours: 24,
    description: 'A larger piece of work with multiple screens, states, or systems.',
  },
  {
    level: 5,
    label: 'Complex',
    hours: 30,
    description: 'A broad or open-ended project requiring deeper scoping.',
  },
] as const;

type ComplexityLevel = (typeof complexityLevels)[number]['level'];

const quoteModifiers = [
  {
    id: 'urgent-turnaround',
    label: 'Urgent turnaround',
    description: 'Adds a planning buffer for accelerated scheduling.',
    type: 'percentage',
    value: 0.25,
  },
  {
    id: 'content-support',
    label: 'Content writing or editing',
    description: 'Adds time for page copy, structure, or content cleanup.',
    type: 'hours',
    value: 6,
  },
  {
    id: 'third-party-integration',
    label: 'Third-party integration',
    description: 'Adds time for APIs, booking tools, payment systems, or external platforms.',
    type: 'hours',
    value: 12,
  },
  {
    id: 'handover-support',
    label: 'Handover and support',
    description: 'Adds time for walkthroughs, documentation, or post-launch guidance.',
    type: 'hours',
    value: 4,
  },
] as const;

const quoteSections = pricingCategories
  .filter((category) => category.category !== 'Working With You')
  .map((category) => ({
    title: category.category,
    items: category.groups.flatMap((group) =>
      group.services.map((service) => ({
        id: `${category.category}-${service.slug}`,
        category: group.subcategory,
        service: service.name,
        description: service.bestFor,
        hours: service.estimatedHours,
        rate: service.hourlyRate ?? 0,
      })),
    ),
  }));

const quoteItems = quoteSections.flatMap((section) => section.items);

export function QuoteBuilder() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedModifierIds, setSelectedModifierIds] = useState<Set<string>>(new Set());
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [complexity, setComplexity] = useState<ComplexityLevel>(2);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const selectedItems = quoteItems.filter((item) => selectedIds.has(item.id));
  const selectedModifiers = quoteModifiers.filter((modifier) =>
    selectedModifierIds.has(modifier.id),
  );
  const selectedComplexity = complexityLevels.find((level) => level.level === complexity);
  const complexityHours = selectedComplexity?.hours ?? 12;
  const averageRate =
    selectedItems.length > 0
      ? selectedItems.reduce((total, item) => total + item.rate, 0) / selectedItems.length
      : 0;

  const quote = useMemo(() => {
    if (selectedItems.length === 0) {
      return { hours: 0, cost: 0 };
    }

    const base = selectedItems.reduce(
      (total, item) => ({
        hours: total.hours + complexityHours,
        cost: total.cost + complexityHours * item.rate,
      }),
      { hours: 0, cost: 0 },
    );

    return selectedModifiers.reduce((total, modifier) => {
      const addedHours =
        modifier.type === 'percentage'
          ? Math.ceil(base.hours * modifier.value)
          : modifier.value;

      return {
        hours: total.hours + addedHours,
        cost: total.cost + addedHours * averageRate,
      };
    }, base);
  }, [averageRate, complexityHours, selectedItems, selectedModifiers]);

  const toggleItem = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const toggleModifier = (id: string) => {
    setSelectedModifierIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const toggleSection = (sectionTitle: string) => {
    setOpenSection((current) => (current === sectionTitle ? null : sectionTitle));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('submitting');
    setError('');

    const formData = new FormData(form);
    const baseHours = selectedItems.length * complexityHours;
    const modifierQuoteItems =
      selectedItems.length === 0
        ? []
        : selectedModifiers.map((modifier) => {
            const addedHours =
              modifier.type === 'percentage'
                ? Math.ceil(baseHours * modifier.value)
                : modifier.value;

            return {
              service: modifier.label,
              category: 'Quote modifier',
              hours: addedHours,
              rate: averageRate,
            };
          });

    try {
      await submitEnquiry({
        type: 'quote',
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        projectType: 'Quote builder',
        message: String(formData.get('message') ?? ''),
        website: String(formData.get('website') ?? ''),
        quoteItems: [
          ...selectedItems.map((item) => ({
            service: item.service,
            category: `${item.category} - Complexity ${complexity}`,
            hours: complexityHours,
            rate: item.rate,
          })),
          ...modifierQuoteItems,
        ],
        estimatedHours: quote.hours,
        estimatedCost: quote.cost,
      });
      form.reset();
      setSelectedIds(new Set());
      setSelectedModifierIds(new Set());
      setComplexity(2);
      setStatus('success');
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to submit quote',
      );
      setStatus('error');
    }
  };

  return (
    <section className="quote-builder" aria-labelledby="quote-builder-title">
      <div className="quote-builder-header">
        <div>
          <p className="section-kicker">Build a quote</p>
          <h2 id="quote-builder-title">Select the services and features you may need.</h2>
          <p>
            These figures are planning estimates based on approximate hours and hourly
            complexity rates. Final quotes are confirmed after scope review.
          </p>
        </div>
        <div className="quote-total-panel" aria-live="polite">
          <span>Estimated total</span>
          <strong>{formatCurrency(quote.cost)}</strong>
          <small>
            {quote.hours} estimated hours selected at complexity {complexity}
          </small>
        </div>
      </div>

      <div className="quote-complexity-panel" aria-labelledby="quote-complexity-title">
        <div>
          <p className="section-kicker">Complexity</p>
          <h3 id="quote-complexity-title">Choose the likely depth of work.</h3>
          <p>
            Complexity sets the planning estimate per selected item. Level 5 starts at
            30 hours and may increase after scope review.
          </p>
        </div>
        <div className="quote-complexity-options" role="radiogroup" aria-label="Project complexity">
          {complexityLevels.map((level) => (
            <label
              className="quote-complexity-option"
              key={level.level}
              htmlFor={`complexity-${level.level}`}
            >
              <input
                checked={complexity === level.level}
                id={`complexity-${level.level}`}
                name="complexity"
                onChange={() => {
                  setComplexity(level.level);
                }}
                type="radio"
              />
              <span>
                <strong>{level.level}</strong>
                <small>{level.hours}+ hrs</small>
              </span>
            </label>
          ))}
        </div>
        {selectedComplexity ? (
          <p className="quote-complexity-description mb-0">
            <strong>{selectedComplexity.label}:</strong> {selectedComplexity.description}
          </p>
        ) : null}
      </div>

      <div className="quote-section-stack">
        {quoteSections.map((section) => {
          const isOpen = openSection === section.title;
          const selectedCount = section.items.filter((item) => selectedIds.has(item.id)).length;
          const sectionId = `quote-${section.title.toLowerCase().replace(/\s+/g, '-')}`;

          return (
            <div className="quote-section" key={section.title}>
              <button
                className="quote-section-toggle"
                type="button"
                aria-controls={sectionId}
                aria-expanded={isOpen}
                onClick={() => {
                  toggleSection(section.title);
                }}
              >
                <span>
                  <strong>{section.title}</strong>
                  <small>
                    {selectedCount > 0
                      ? `${selectedCount} selected`
                      : `${section.items.length} options`}
                  </small>
                </span>
                <span className="quote-section-indicator" aria-hidden="true">
                  {isOpen ? '-' : '+'}
                </span>
              </button>

              {isOpen ? (
                <div className="quote-item-grid" id={sectionId}>
                  {section.items.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    const itemCost = complexityHours * item.rate;

                    return (
                      <label className="quote-item" key={item.id}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            toggleItem(item.id);
                          }}
                        />
                        <span className="quote-item-content">
                          <span className="quote-item-category">{item.category}</span>
                          <span className="quote-item-title">{item.service}</span>
                          <span className="quote-item-description">{item.description}</span>
                          <span className="quote-item-meta">
                            {complexityHours} hrs x {formatCurrency(item.rate)} ={' '}
                            {formatCurrency(itemCost)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="quote-modifier-panel" aria-labelledby="quote-modifier-title">
        <div>
          <p className="section-kicker">Estimate modifiers</p>
          <h3 id="quote-modifier-title">Add details that may affect the estimate.</h3>
          <p>
            These options add planning time based on common project factors. Final
            scope is still reviewed before any quote is confirmed.
          </p>
        </div>
        <div className="quote-modifier-grid">
          {quoteModifiers.map((modifier) => {
            const isSelected = selectedModifierIds.has(modifier.id);
            const baseHours = selectedItems.length * complexityHours;
            const addedHours =
              modifier.type === 'percentage'
                ? Math.ceil(baseHours * modifier.value)
                : modifier.value;

            return (
              <label className="quote-modifier-item" key={modifier.id}>
                <input
                  checked={isSelected}
                  disabled={selectedItems.length === 0}
                  onChange={() => {
                    toggleModifier(modifier.id);
                  }}
                  type="checkbox"
                />
                <span>
                  <strong>{modifier.label}</strong>
                  <small>{modifier.description}</small>
                  <em>+{addedHours} estimated hrs</em>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {selectedItems.length > 0 ? (
        <div className="quote-summary">
          <h3>Selected items</h3>
          <ul>
            {selectedItems.map((item) => (
              <li key={item.id}>
                <span>
                  {item.service} <small>({complexityHours} hrs)</small>
                </span>
                <strong>{formatCurrency(complexityHours * item.rate)}</strong>
              </li>
            ))}
            {selectedModifiers.map((modifier) => {
              const baseHours = selectedItems.length * complexityHours;
              const addedHours =
                modifier.type === 'percentage'
                  ? Math.ceil(baseHours * modifier.value)
                  : modifier.value;

              return (
                <li key={modifier.id}>
                  <span>
                    {modifier.label} <small>({addedHours} hrs)</small>
                  </span>
                  <strong>{formatCurrency(addedHours * averageRate)}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <form className="quote-submit-form" method="post" onSubmit={handleSubmit}>
        <div className="visually-hidden" aria-hidden="true">
          <label htmlFor="quoteWebsite">Website</label>
          <input id="quoteWebsite" maxLength={200} name="website" type="text" tabIndex={-1} />
        </div>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="quoteName">
              Name
            </label>
            <input
              autoComplete="name"
              className="form-control"
              id="quoteName"
              maxLength={120}
              name="name"
              required
              type="text"
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="quoteEmail">
              Email
            </label>
            <input
              autoComplete="email"
              className="form-control"
              id="quoteEmail"
              maxLength={254}
              name="email"
              required
              type="email"
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="quoteMessage">
              Notes
            </label>
            <textarea
              className="form-control"
              id="quoteMessage"
              maxLength={4000}
              name="message"
              required
              rows={4}
            />
          </div>
          {status === 'success' ? (
            <div className="col-12">
              <div className="alert alert-success mb-0" role="status">
                Quote enquiry received. I will review the selected items and follow up.
              </div>
            </div>
          ) : null}
          {status === 'error' ? (
            <div className="col-12">
              <div className="alert alert-danger mb-0" role="alert">
                {error}
              </div>
            </div>
          ) : null}
          <div className="col-12">
            <button
              className="btn btn-accent"
              disabled={selectedItems.length === 0 || status === 'submitting'}
              type="submit"
            >
              {status === 'submitting' ? 'Sending quote...' : 'Send quote enquiry'}
            </button>
          </div>
          <div className="col-12">
            <p className="form-privacy-note mb-0">
              Your selected items and contact details are used only to review and
              respond to this quote enquiry. The estimate is not final until scope is
              confirmed. Read the <a href="/privacy">privacy notice</a>.
            </p>
          </div>
        </div>
      </form>
    </section>
  );
}

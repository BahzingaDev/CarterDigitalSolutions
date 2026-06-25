import { type FormEvent, useMemo, useState } from 'react';

import { submitEnquiry } from '../src/api/enquiries';
import { formatCurrency, pricingCategories } from '../src/data/pricing';

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
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const selectedItems = quoteItems.filter((item) => selectedIds.has(item.id));

  const quote = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) => ({
          hours: total.hours + item.hours,
          cost: total.cost + item.hours * item.rate,
        }),
        { hours: 0, cost: 0 },
      ),
    [selectedItems],
  );

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

  const toggleSection = (sectionTitle: string) => {
    setOpenSection((current) => (current === sectionTitle ? null : sectionTitle));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('submitting');
    setError('');

    const formData = new FormData(form);

    try {
      await submitEnquiry({
        type: 'quote',
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        projectType: 'Quote builder',
        message: String(formData.get('message') ?? ''),
        website: String(formData.get('website') ?? ''),
        quoteItems: selectedItems.map((item) => ({
          service: item.service,
          category: item.category,
          hours: item.hours,
          rate: item.rate,
        })),
        estimatedHours: quote.hours,
        estimatedCost: quote.cost,
      });
      form.reset();
      setSelectedIds(new Set());
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
          <small>{quote.hours} estimated hours selected</small>
        </div>
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
                    const itemCost = item.hours * item.rate;

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
                            {item.hours} hrs x {formatCurrency(item.rate)} ={' '}
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

      {selectedItems.length > 0 ? (
        <div className="quote-summary">
          <h3>Selected items</h3>
          <ul>
            {selectedItems.map((item) => (
              <li key={item.id}>
                <span>{item.service}</span>
                <strong>{formatCurrency(item.hours * item.rate)}</strong>
              </li>
            ))}
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
              confirmed.
            </p>
          </div>
        </div>
      </form>
    </section>
  );
}

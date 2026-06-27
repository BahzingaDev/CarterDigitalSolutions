import { useEffect, useState } from 'react';

import {
  formatCurrency,
  formatHourlyRate,
  pricingCategories,
} from '../src/data/pricing';
import { fetchServiceOverrides, mergeServiceCatalogue } from '../src/api/services';

function CategoryIcon({ icon }: { icon: string }) {
  if (icon === 'industry') {
    return (
      <svg className="pricing-category-icon" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 27V13l7 4v-4l7 4v-6h10v16H4Z" />
        <path d="M21 11V6h5v5" />
        <path d="M9 22h3M16 22h3M23 22h2" />
      </svg>
    );
  }

  if (icon === 'individual') {
    return (
      <svg className="pricing-category-icon" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 16a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
        <path d="M6 28c1.4-6 5-9 10-9s8.6 3 10 9" />
      </svg>
    );
  }

  return (
    <svg className="pricing-category-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 7h16v6H8zM8 19h16v6H8z" />
      <path d="M16 13v6M11 10h2M11 22h2M19 10h2M19 22h2" />
    </svg>
  );
}

export function PricingTable() {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState(pricingCategories);
  useEffect(() => { void fetchServiceOverrides().then((items) => setCategories(mergeServiceCatalogue(items))); }, []);

  const toggleCategory = (categoryName: string) => {
    setOpenCategory((current) => (current === categoryName ? null : categoryName));
  };

  return (
    <div className="pricing-category-stack">
      {categories.map((category) => {
        const isOpen = openCategory === category.category;
        const tableId = `pricing-${category.category.toLowerCase().replace(/\s+/g, '-')}`;

        return (
          <section className="pricing-category-table" key={category.category}>
            <button
              className="pricing-category-band"
              type="button"
              aria-controls={tableId}
              aria-expanded={isOpen}
              onClick={() => {
                toggleCategory(category.category);
              }}
            >
              <span className="pricing-category-title">
                <CategoryIcon icon={category.icon} />
                <span>{category.category}</span>
              </span>
              <span className="pricing-collapse-indicator" aria-hidden="true">
                {isOpen ? '-' : '+'}
              </span>
            </button>

            {isOpen ? (
              <div className="pricing-table-scroll" id={tableId}>
                <table className="pricing-table">
                  <colgroup>
                    <col className="pricing-col-subcategory" />
                    <col className="pricing-col-service-row" />
                    <col className="pricing-col-starting" />
                    <col className="pricing-col-rate" />
                    <col className="pricing-col-deposit" />
                    <col className="pricing-col-best" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Subcategory</th>
                      <th scope="col">Service</th>
                      <th scope="col">Starting From</th>
                      <th scope="col">Hourly Rate</th>
                      <th scope="col">Deposit</th>
                      <th scope="col">Best For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.groups.map((group) =>
                      group.services.map((service, serviceIndex) => (
                        <tr
                          className={
                            serviceIndex === 0
                              ? 'pricing-subcategory-start'
                              : 'pricing-service-continuation'
                          }
                          key={`${group.subcategory}-${service.name}`}
                        >
                          {serviceIndex === 0 ? (
                            <th
                              className="pricing-subcategory-cell"
                              scope="rowgroup"
                              rowSpan={group.services.length}
                            >
                              <span className="pricing-service-name">{group.subcategory}</span>
                              <span className="pricing-service-description">
                                {group.description}
                              </span>
                            </th>
                          ) : null}
                          <td>{service.name}</td>
                          <td>{formatCurrency(service.startingFrom)}</td>
                          <td>{formatHourlyRate(service.hourlyRate)}</td>
                          <td>{service.deposit}</td>
                          <td>{service.bestFor}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ContactCTA } from '../components/ContactCTA';
import { formatCurrency, getPricingServiceBySlug } from '../src/data/pricing';
import { getServiceBySlug } from '../src/data/services';
import { fetchServiceOverrides } from '../src/api/services';
import type { AdminServiceOverride } from '../src/api/admin';

interface ServicePageProps {
  slug: string;
}

const technologyByCategory: Record<string, string[]> = {
  'Digital Presence': [
    'React, TypeScript, Vite, or static-site tooling for fast frontends',
    'Bootstrap 5 or custom responsive CSS for accessible layouts',
    'Contact forms, analytics events, SEO metadata, and performance checks',
  ],
  Development: [
    'Flask, Python, REST APIs, and structured backend services',
    'React, TypeScript, dashboards, portals, and reusable UI components',
    'Databases, authentication flows, cloud hosting, and deployment pipelines',
  ],
  Consultancy: [
    'Workflow mapping, requirements capture, and practical documentation',
    'Automation tools, spreadsheets, scripts, and lightweight internal systems',
    'Training materials, handover notes, and support sessions',
  ],
  'Personal Brand': [
    'Responsive portfolio layouts, content sections, and profile-led navigation',
    'SEO basics, metadata, image optimization, and clear contact routes',
    'Git-based or lightweight CMS-friendly content structures where useful',
  ],
  Productivity: [
    'Small scripts, forms, dashboards, and personal workflow tools',
    'No-code, low-code, or custom-code automation depending on the task',
    'Data cleanup, repeatable templates, and simple maintenance notes',
  ],
  Support: [
    'Secure account setup, domain/DNS guidance, and software configuration',
    'Screen-share support, plain-language walkthroughs, and checklists',
    'Small fixes, troubleshooting, and practical technical documentation',
  ],
};

const approachByCategory: Record<string, string[]> = {
  'Digital Presence': [
    'Start with the audience, offer, and conversion goal before choosing page structure.',
    'Build mobile-first pages with clear calls to action and measurable user journeys.',
    'Keep the site maintainable so future edits do not require a full rebuild.',
  ],
  Development: [
    'Define the smallest useful version first, then expand through staged milestones.',
    'Separate frontend, backend, data, and security concerns so the system remains maintainable.',
    'Test core workflows with realistic data before adding secondary features.',
  ],
  Consultancy: [
    'Observe how the work is currently done before recommending new tools.',
    'Prioritize improvements by effort, risk, and likely time saved.',
    'Leave behind clear documentation so changes can be repeated without dependency.',
  ],
  'Personal Brand': [
    'Shape the page around credibility, clarity, and the next action visitors should take.',
    'Use a content-first structure so the design supports the work rather than hiding it.',
    'Keep the first version focused, then add depth as the profile grows.',
  ],
  Productivity: [
    'Identify the repeated task and decide whether automation is actually worthwhile.',
    'Choose the simplest reliable implementation before reaching for heavier tooling.',
    'Document how to use, adjust, and recover the workflow if something changes.',
  ],
  Support: [
    'Work through the issue in plain language and avoid unnecessary technical noise.',
    'Prioritize secure setup, clear ownership, and confidence using the tools afterward.',
    'Provide concise follow-up notes so the solution is not trapped in the session.',
  ],
};

function getServiceDetail(category: string, title: string) {
  if (category === 'Development') {
    return `${title} work is scoped around the actual workflow, the users involved, and the data that needs to move through the system. The implementation may combine a typed React interface with a Flask or Python backend, secure API routes, database-backed features, and deployment to a suitable cloud environment.`;
  }

  if (category === 'Digital Presence' || category === 'Personal Brand') {
    return `${title} work focuses on clarity, speed, accessibility, and trust. The page structure, content hierarchy, calls to action, metadata, and responsive layout are planned together so the finished site feels useful rather than decorative.`;
  }

  if (category === 'Consultancy' || category === 'Productivity') {
    return `${title} work begins by understanding the current process before suggesting tools or automation. The goal is to reduce friction with practical systems, clear documentation, and technology choices that are realistic to maintain.`;
  }

  return `${title} support is handled with a practical, plain-language approach. The focus is on secure setup, clear steps, and leaving you with enough confidence and documentation to keep moving afterward.`;
}

export function ServicePage({ slug }: ServicePageProps) {
  const service = getServiceBySlug(slug);
  const [override, setOverride] = useState<AdminServiceOverride>();
  useEffect(() => { void fetchServiceOverrides().then((items) => setOverride(items.find((item) => item.slug === slug))); }, [slug]);

  if (!service) {
    return (
      <section className="page-hero">
        <div className="container">
          <p className="section-kicker">Service</p>
          <h1>Service not found.</h1>
          <p>The service page you are looking for is not available yet.</p>
        </div>
      </section>
    );
  }

  const technologies = technologyByCategory[service.category] ?? [];
  const approaches = approachByCategory[service.category] ?? [];
  const pricing = getPricingServiceBySlug(service.slug);

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="service-hero-grid">
            <div>
              <p className="section-kicker">
                {service.audience} / {service.category}
              </p>
              <h1>{override?.name ?? service.title}</h1>
              <p>{override?.description || service.summary}</p>
            </div>

            <aside className="service-summary-box" aria-label="Service summary">
              <p className="deposit-policy-label">Starting from</p>
              <h2>{formatCurrency(override?.starting_from ?? pricing?.service.startingFrom ?? null)}</h2>
              <p>{override?.best_for || pricing?.service.bestFor || service.bestFor}</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <article className="service-detail-panel">
            <p className="section-kicker">Service detail</p>
            <h2>What this can involve</h2>
            <p>{getServiceDetail(service.category, service.title)}</p>
          </article>

          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <article className="workflow-info-panel h-100">
                <h2>Typical outcomes</h2>
                <ul className="feature-list">
                  {service.outcomes.map((outcome) => (
                    <li key={outcome}>{outcome}</li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="col-12 col-lg-6">
              <article className="workflow-info-panel h-100">
                <h2>How this usually works</h2>
                <ul className="feature-list">
                  {service.processNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section section-muted">
        <div className="container">
          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <article className="workflow-info-panel h-100">
                <h2>Technologies that may be used</h2>
                <ul className="feature-list">
                  {technologies.map((technology) => (
                    <li key={technology}>{technology}</li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="col-12 col-lg-6">
              <article className="workflow-info-panel h-100">
                <h2>Approach</h2>
                <ul className="feature-list">
                  {approaches.map((approach) => (
                    <li key={approach}>{approach}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </div>
      </section>

      <ContactCTA />
    </>
  );
}

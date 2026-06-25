import { type FormEvent, useState } from 'react';

import { submitEnquiry } from '../src/api/enquiries';

const projectTypes = [
  'Business website or refresh',
  'Portfolio or personal website',
  'Custom tool, app, or automation',
  'Workflow, productivity, or technical support',
];

export function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('submitting');
    setError('');

    const formData = new FormData(form);

    try {
      await submitEnquiry({
        type: 'contact',
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        projectType: String(formData.get('projectType') ?? ''),
        message: String(formData.get('message') ?? ''),
        website: String(formData.get('website') ?? ''),
      });
      form.reset();
      setStatus('success');
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to submit enquiry',
      );
      setStatus('error');
    }
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="contact-hero-grid">
            <div>
              <p className="section-kicker">Contact</p>
              <h1>Tell me what you want to build, fix, or improve.</h1>
              <p>
                Share the goal, rough timeline, and any existing links or materials.
                If the request is not clearly listed elsewhere, send it anyway and I
                can suggest the closest route forward.
              </p>
            </div>

            <aside className="service-summary-box" aria-label="Contact information">
              <p className="deposit-policy-label">Response</p>
              <h2>Start with a short project outline.</h2>
              <p>
                Include what you need, who it is for, and whether there is a preferred
                launch date or budget range.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="row g-4">
            <div className="col-12 col-lg-7">
              <form className="contact-form" method="post" onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="visually-hidden" aria-hidden="true">
                    <label htmlFor="contactWebsite">Website</label>
                    <input
                      id="contactWebsite"
                      maxLength={200}
                      name="website"
                      type="text"
                      tabIndex={-1}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="name">
                      Name
                    </label>
                    <input
                      autoComplete="name"
                      className="form-control"
                      id="name"
                      maxLength={120}
                      name="name"
                      required
                      type="text"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="email">
                      Email
                    </label>
                    <input
                      autoComplete="email"
                      className="form-control"
                      id="email"
                      maxLength={254}
                      name="email"
                      required
                      type="email"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="projectType">
                      Project type
                    </label>
                    <select className="form-select" id="projectType" name="projectType">
                      {projectTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="message">
                      Message
                    </label>
                    <textarea
                      className="form-control"
                      id="message"
                      maxLength={4000}
                      name="message"
                      required
                      rows={6}
                    />
                  </div>
                  {status === 'success' ? (
                    <div className="col-12">
                      <div className="alert alert-success mb-0" role="status">
                        Enquiry received. I will review it and follow up.
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
                      disabled={status === 'submitting'}
                      type="submit"
                    >
                      {status === 'submitting' ? 'Sending...' : 'Send enquiry'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="col-12 col-lg-5">
              <article className="workflow-info-panel h-100">
                <h2>Helpful details to include</h2>
                <ul className="feature-list">
                  <li>The outcome you want from the work.</li>
                  <li>Any current website, tool, file, or workflow involved.</li>
                  <li>What feels urgent, confusing, or time-consuming.</li>
                  <li>Your preferred timescale or deadline.</li>
                </ul>
              </article>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

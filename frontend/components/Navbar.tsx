import { useEffect, useState } from 'react';

const navSections = [
  {
    title: 'Services',
    industryGroups: [
      {
        heading: 'Digital Presence',
        links: [
          { label: 'Professional websites', href: '/services/professional-websites' },
          { label: 'Lead conversion', href: '/services/lead-conversion' },
          { label: 'Social media', href: '/services/social-media' },
        ],
      },
      {
        heading: 'Development',
        links: [
          { label: 'Desktop software', href: '/services/desktop-software' },
          { label: 'Cloud platforms', href: '/services/cloud-platforms' },
          { label: 'Web and mobile apps', href: '/services/web-mobile-apps' },
        ],
      },
      {
        heading: 'Consultancy',
        links: [
          { label: 'Productivity auditing', href: '/services/productivity-auditing' },
          { label: 'Workflow optimization', href: '/services/workflow-optimization' },
          { label: 'Training and support', href: '/services/training-support' },
        ],
      },
    ],
    individualGroups: [
      {
        heading: 'Personal Brand',
        links: [
          { label: 'Portfolio websites', href: '/services/portfolio-websites' },
          { label: 'Personal websites', href: '/services/personal-websites' },
          { label: 'Online profiles', href: '/services/online-profiles' },
        ],
      },
      {
        heading: 'Productivity',
        links: [
          { label: 'Custom tools', href: '/services/custom-tools' },
          { label: 'Automation setup', href: '/services/automation-setup' },
          { label: 'Digital organization', href: '/services/digital-organization' },
        ],
      },
      {
        heading: 'Support',
        links: [
          { label: 'One-to-one training', href: '/services/one-to-one-training' },
          { label: 'Technical setup', href: '/services/technical-setup' },
          { label: 'Ongoing help', href: '/services/ongoing-help' },
        ],
      },
    ],
    workingWithYouLinks: [
      { label: 'Pricing & deposit', href: '/pricing' },
      { label: 'Workflow', href: '/workflow' },
    ],
  },
];

const standardLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export function Navbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = window.localStorage.getItem('theme');

    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const closeMenu = () => {
    setOpenMenu(null);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.bsTheme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <nav className="site-navbar navbar navbar-expand-lg border-bottom">
      <div className="container">
        <a className="navbar-brand logo-lockup" href="/" aria-label="Carter Digital Solutions home">
          <span className="logo-wordmark" aria-hidden="true">
            <span>CARTER</span>
            <span>DIGITAL SOLUTIONS</span>
          </span>
        </a>

        <button
          className="navbar-toggler"
          type="button"
          aria-controls="primaryNavigation"
          aria-expanded={isNavOpen}
          aria-label="Toggle navigation"
          onClick={() => {
            setIsNavOpen((current) => !current);
            closeMenu();
          }}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div
          className={`collapse navbar-collapse ${isNavOpen ? 'show' : ''}`}
          id="primaryNavigation"
        >
          <ul className="navbar-nav nav-primary mb-3 mb-lg-0">
            {standardLinks.map((link) => (
              <li className="nav-item" key={link.label}>
                <a
                  className="nav-link"
                  href={link.href}
                  onClick={() => {
                    closeMenu();
                    setIsNavOpen(false);
                  }}
                >
                  {link.label}
                </a>
              </li>
            ))}

            {navSections.map((section) => {
              const isOpen = openMenu === section.title;

              return (
                <li className="nav-item dropdown nav-dropdown" key={section.title}>
                  <button
                    className="nav-link dropdown-toggle nav-menu-button"
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpenMenu(isOpen ? null : section.title);
                    }}
                    onBlur={(event) => {
                      const nextTarget = event.relatedTarget;

                      if (
                        nextTarget instanceof Node &&
                        !event.currentTarget.parentElement?.contains(nextTarget)
                      ) {
                        closeMenu();
                      }
                    }}
                  >
                    {section.title}
                  </button>

                  <div className={`dropdown-menu nav-menu ${isOpen ? 'show' : ''}`}>
                    <section>
                      <h2 className="nav-section-title">For Industry</h2>
                      <div className="row g-4">
                        {section.industryGroups.map((group) => (
                          <div className="col-12 col-md-4" key={group.heading}>
                            <h3 className="nav-subsection-title">{group.heading}</h3>
                            <ul className="list-unstyled mb-0">
                              {group.links.map((link) => (
                                <li key={link.label}>
                                  <a
                                    className="dropdown-item nav-menu-link"
                                    href={link.href}
                                    onClick={() => {
                                      closeMenu();
                                      setIsNavOpen(false);
                                    }}
                                  >
                                    {link.label}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="nav-service-section">
                      <h2 className="nav-section-title">For Individuals</h2>
                      <div className="row g-4">
                        {section.individualGroups.map((group) => (
                          <div className="col-12 col-md-4" key={group.heading}>
                            <h3 className="nav-subsection-title">{group.heading}</h3>
                            <ul className="list-unstyled mb-0">
                              {group.links.map((link) => (
                                <li key={link.label}>
                                  <a
                                    className="dropdown-item nav-menu-link"
                                    href={link.href}
                                    onClick={() => {
                                      closeMenu();
                                      setIsNavOpen(false);
                                    }}
                                  >
                                    {link.label}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>

                    <hr className="nav-menu-separator" />

                    <section>
                      <h2 className="nav-section-title">Working With You</h2>
                      <ul className="working-links list-unstyled mb-0">
                        {section.workingWithYouLinks.map((link) => (
                          <li key={link.label}>
                            <a
                              className="dropdown-item nav-menu-link"
                              href={link.href}
                              onClick={() => {
                                closeMenu();
                                setIsNavOpen(false);
                              }}
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="nav-actions">
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={() => {
                setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
              }}
            >
              <span className="theme-toggle-track" aria-hidden="true">
                <span className="theme-toggle-thumb" />
              </span>
            </button>

            <a className="btn btn-accent nav-cta" href="/quote">
              Start a project
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

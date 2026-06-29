import { useEffect, useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';

import { fetchServiceCatalogue, mergeServiceCatalogue } from '../src/api/services';
import { pricingCategories } from '../src/data/pricing';
import { useTheme } from '../src/hooks/useTheme';

const standardLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

const workingWithYouLinks = [
  { label: 'Pricing & deposit', href: '/pricing' },
  { label: 'Workflow', href: '/workflow' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Readiness checklist', href: '/readiness' },
];

export function Navbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [catalogue, setCatalogue] = useState(pricingCategories);
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    void fetchServiceCatalogue().then((data) => setCatalogue(mergeServiceCatalogue(data.services, data.categories, data.unavailable_slugs)));
  }, []);

  const closeNavigation = () => {
    setOpenMenu(null);
    setIsNavOpen(false);
  };
  const industryGroups = catalogue.find((item) => item.category === 'For Industry')?.groups ?? [];
  const individualGroups = catalogue.find((item) => item.category === 'For Individuals')?.groups ?? [];
  const isServicesOpen = openMenu === 'Services';
  const currentPath = window.location.pathname;
  const isActive = (href: string) => href === '/' ? currentPath === '/' : currentPath.startsWith(href);

  return (
    <nav className="site-navbar navbar navbar-expand-lg border-bottom" aria-label="Primary navigation">
      <div className="container">
        <a className="navbar-brand logo-lockup" href="/" aria-label="Carter Digital Solutions home">
          <span className="logo-wordmark" aria-hidden="true"><span>CARTER</span><span>DIGITAL SOLUTIONS</span></span>
        </a>

        <button className="navbar-toggler" type="button" aria-controls="primaryNavigation" aria-expanded={isNavOpen} aria-label={isNavOpen ? 'Close navigation' : 'Open navigation'} onClick={() => { setIsNavOpen((current) => !current); setOpenMenu(null); }}>
          {isNavOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className={`collapse navbar-collapse ${isNavOpen ? 'show' : ''}`} id="primaryNavigation">
          <ul className="navbar-nav nav-primary mb-3 mb-lg-0">
            {standardLinks.map((link) => <li className="nav-item" key={link.label}><a aria-current={isActive(link.href) ? 'page' : undefined} className="nav-link" href={link.href} onClick={closeNavigation}>{link.label}</a></li>)}
            <li className="nav-item dropdown nav-dropdown">
              <button
                className={`nav-link dropdown-toggle nav-menu-button ${currentPath.startsWith('/services') || workingWithYouLinks.some((link) => isActive(link.href)) ? 'active' : ''}`}
                type="button"
                aria-expanded={isServicesOpen}
                onClick={() => setOpenMenu(isServicesOpen ? null : 'Services')}
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget;
                  if (nextTarget instanceof Node && !event.currentTarget.parentElement?.contains(nextTarget)) setOpenMenu(null);
                }}
              >Services</button>

              <div className={`dropdown-menu nav-menu ${isServicesOpen ? 'show' : ''}`}>
                <ServiceAudience title="For Industry" groups={industryGroups} onNavigate={closeNavigation} />
                <ServiceAudience className="nav-service-section" title="For Individuals" groups={individualGroups} onNavigate={closeNavigation} />
                <hr className="nav-menu-separator" />
                <section>
                  <h2 className="nav-section-title">Working With You</h2>
                  <ul className="working-links list-unstyled mb-0">
                    {workingWithYouLinks.map((link) => <li key={link.label}><a className="dropdown-item nav-menu-link" href={link.href} onClick={closeNavigation}>{link.label}</a></li>)}
                  </ul>
                </section>
              </div>
            </li>
          </ul>

          <div className="nav-actions">
            <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <a className="btn btn-accent nav-cta" href="/quote">Start a project</a>
          </div>
        </div>
      </div>
    </nav>
  );
}

function ServiceAudience({ title, groups, onNavigate, className = '' }: {
  title: string;
  groups: typeof pricingCategories[number]['groups'];
  onNavigate: () => void;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="nav-section-title">{title}</h2>
      <div className="row g-4">
        {groups.map((group) => (
          <div className="col-12 col-md-4" key={group.subcategory}>
            <h3 className="nav-subsection-title">{group.subcategory}</h3>
            <ul className="list-unstyled mb-0">
              {group.services.map((service) => <li key={service.slug}><a className="dropdown-item nav-menu-link" href={`/services/${service.slug}`} onClick={onNavigate}>{service.name}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

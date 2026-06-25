interface ServiceListProps {
  services: string[];
}

export function ServiceList({ services }: ServiceListProps) {
  return (
    <div className="row g-3">
      {services.map((service) => (
        <div className="col-12 col-md-4" key={service}>
          <article className="service-card h-100">
            <span className="service-marker" aria-hidden="true" />
            <h2 className="h5 mb-0">{service}</h2>
          </article>
        </div>
      ))}
    </div>
  );
}

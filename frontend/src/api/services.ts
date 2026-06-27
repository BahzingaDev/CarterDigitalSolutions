import type { AdminServiceCategory, AdminServiceOverride } from './admin';
import { type PricingCategory, pricingCategories } from '../data/pricing';

export interface ServiceCatalogue {
  categories: AdminServiceCategory[];
  services: AdminServiceOverride[];
  unavailable_slugs: string[];
}

export async function fetchServiceCatalogue(): Promise<ServiceCatalogue> {
  const response = await fetch('/api/services', { headers: { Accept: 'application/json' } });
  if (!response.ok) return { categories: [], services: [], unavailable_slugs: [] };
  const data = await response.json() as Partial<ServiceCatalogue>;
  return { categories: data.categories ?? [], services: data.services ?? [], unavailable_slugs: data.unavailable_slugs ?? [] };
}

export async function fetchServiceOverrides(): Promise<AdminServiceOverride[]> {
  return (await fetchServiceCatalogue()).services;
}

export function getBaselineCategories(): AdminServiceCategory[] {
  return pricingCategories.flatMap((audience) => audience.groups.map((group, index) => ({
    id: '',
    slug: slugify(`${audience.category}-${group.subcategory}`),
    name: group.subcategory,
    audience: audience.category,
    description: group.description,
    active: true,
    sort_order: index * 100,
    status: 'published' as const,
  })));
}

export function mergeServiceCatalogue(
  overrides: AdminServiceOverride[],
  managedCategories: AdminServiceCategory[] = [],
  unavailableSlugs: string[] = [],
): PricingCategory[] {
  const overrideMap = new Map(overrides.map((item) => [item.slug, item]));
  const unavailable = new Set(unavailableSlugs);
  const managedCategoryByName = new Map(
    managedCategories.map((item) => [`${item.audience}:${item.name}`, item]),
  );

  const catalogue = pricingCategories.map((audience) => {
    const groups = new Map<string, PricingCategory['groups'][number]>();
    audience.groups.forEach((group) => group.services.forEach((service) => {
      const override = overrideMap.get(service.slug);
      if (unavailable.has(service.slug)) return;
      if (override?.active === false) return;
      const managed = override?.category_id
        ? managedCategories.find((item) => item.id === override.category_id)
        : managedCategoryByName.get(`${audience.category}:${override?.category || group.subcategory}`);
      if (managed && (!managed.active || managed.status !== 'published')) return;
      const groupName = managed?.name || override?.category || group.subcategory;
      const target = groups.get(groupName) ?? {
        subcategory: groupName,
        description: managed?.description || override?.description || group.description,
        services: [],
      };
      target.services.push(override ? toPricingService(override, service) : service);
      groups.set(groupName, target);
    }));

    overrides
      .filter((item) => item.audience === audience.category && item.active && !hasBaselineService(item.slug))
      .forEach((item) => {
        const managed = item.category_id
          ? managedCategories.find((category) => category.id === item.category_id)
          : managedCategoryByName.get(`${item.audience}:${item.category}`);
        if (managed && (!managed.active || managed.status !== 'published')) return;
        const groupName = managed?.name || item.category;
        const target = groups.get(groupName) ?? {
          subcategory: groupName,
          description: managed?.description || item.description,
          services: [],
        };
        target.services.push(toPricingService(item));
        groups.set(groupName, target);
      });

    const categoryOrder = new Map(
      managedCategories
        .filter((item) => item.audience === audience.category)
        .map((item) => [item.name, item.sort_order]),
    );
    const serviceOrder = new Map(overrides.map((item) => [item.slug, item.sort_order]));
    return {
      ...audience,
      groups: [...groups.values()]
        .map((group) => ({
          ...group,
          services: [...group.services].sort((left, right) =>
            (serviceOrder.get(left.slug) ?? 10000) - (serviceOrder.get(right.slug) ?? 10000)),
        }))
        .sort((left, right) =>
          (categoryOrder.get(left.subcategory) ?? 10000) - (categoryOrder.get(right.subcategory) ?? 10000)),
    };
  });

  return catalogue.filter((category) => category.groups.length > 0);
}

function hasBaselineService(slug: string) {
  return pricingCategories.some((category) => category.groups.some((group) =>
    group.services.some((service) => service.slug === slug)));
}

function toPricingService(item: AdminServiceOverride, fallback?: PricingCategory['groups'][number]['services'][number]) {
  return {
    slug: item.slug,
    name: item.name,
    startingFrom: item.starting_from,
    hourlyRate: item.hourly_rate,
    estimatedHours: item.estimated_hours,
    deposit: item.deposit,
    depositAmount: item.deposit_amount,
    bestFor: item.best_for,
    ...(!fallback ? {} : fallback),
    ...(fallback ? {
      name: item.name,
      startingFrom: item.starting_from,
      hourlyRate: item.hourly_rate,
      estimatedHours: item.estimated_hours,
      deposit: item.deposit,
      depositAmount: item.deposit_amount,
      bestFor: item.best_for,
    } : {}),
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

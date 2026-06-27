import type { AdminServiceOverride } from './admin';
import { type PricingCategory, pricingCategories } from '../data/pricing';

export async function fetchServiceOverrides(): Promise<AdminServiceOverride[]> {
  const response = await fetch('/api/services', { headers: { Accept: 'application/json' } });
  if (!response.ok) return [];
  const data = await response.json() as { services: AdminServiceOverride[] };
  return data.services;
}

export function mergeServiceCatalogue(overrides: AdminServiceOverride[]): PricingCategory[] {
  const overrideMap = new Map(overrides.map((item) => [item.slug, item]));
  return pricingCategories.map((category) => {
    const groups = new Map<string, PricingCategory['groups'][number]>();
    category.groups.forEach((group) => group.services.forEach((service) => {
      const override = overrideMap.get(service.slug);
      if (override?.active === false) return;
      const groupName = override?.category || group.subcategory;
      const target = groups.get(groupName) ?? { subcategory: groupName, description: override?.description || group.description, services: [] };
      target.services.push(override ? { ...service, name: override.name, startingFrom: override.starting_from, hourlyRate: override.hourly_rate, estimatedHours: override.estimated_hours, deposit: override.deposit, bestFor: override.best_for } : service);
      groups.set(groupName, target);
    }));
    overrides.filter((item) => item.audience === category.category && item.active && !pricingCategories.some((source) => source.groups.some((group) => group.services.some((service) => service.slug === item.slug)))).forEach((item) => {
      const target = groups.get(item.category) ?? { subcategory: item.category, description: item.description, services: [] };
      target.services.push({ slug: item.slug, name: item.name, startingFrom: item.starting_from, hourlyRate: item.hourly_rate, estimatedHours: item.estimated_hours, deposit: item.deposit, bestFor: item.best_for });
      groups.set(item.category, target);
    });
    return { ...category, groups: [...groups.values()] };
  }).filter((category) => category.groups.length > 0);
}

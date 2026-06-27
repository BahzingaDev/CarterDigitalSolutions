export interface PricingService {
  slug: string;
  name: string;
  startingFrom: number | null;
  hourlyRate: number | null;
  estimatedHours: number;
  deposit: string;
  depositAmount?: number;
  bestFor: string;
}

export interface PricingGroup {
  subcategory: string;
  description: string;
  services: PricingService[];
}

export interface PricingCategory {
  category: 'For Industry' | 'For Individuals' | 'Working With You';
  icon: 'industry' | 'individual' | 'process';
  groups: PricingGroup[];
}

export const pricingCategories: PricingCategory[] = [
  {
    category: 'For Industry',
    icon: 'industry',
    groups: [
      {
        subcategory: 'Digital Presence',
        description: 'Online visibility and conversion support for businesses.',
        services: [
          {
            slug: 'professional-websites',
            name: 'Professional websites',
            startingFrom: 250,
            hourlyRate: 16.5,
            estimatedHours: 16,
            deposit: '30%',
            bestFor: 'Small businesses needing a polished web presence',
          },
          {
            slug: 'lead-conversion',
            name: 'Lead conversion',
            startingFrom: 180,
            hourlyRate: 19.5,
            estimatedHours: 9,
            deposit: '25%',
            bestFor: 'Service providers improving enquiries and bookings',
          },
          {
            slug: 'social-media',
            name: 'Social media',
            startingFrom: 95,
            hourlyRate: 16.5,
            estimatedHours: 5,
            deposit: 'Paid upfront',
            bestFor: 'Businesses needing profile setup or content support',
          },
        ],
      },
      {
        subcategory: 'Development',
        description: 'Custom software and platforms built around operational needs.',
        services: [
          {
            slug: 'desktop-software',
            name: 'Desktop software',
            startingFrom: 250,
            hourlyRate: 22.5,
            estimatedHours: 28,
            deposit: '35%',
            bestFor: 'Internal tools and offline business workflows',
          },
          {
            slug: 'cloud-platforms',
            name: 'Cloud platforms',
            startingFrom: 450,
            hourlyRate: 22.5,
            estimatedHours: 40,
            deposit: '40%',
            bestFor: 'Teams needing shared access and scalable systems',
          },
          {
            slug: 'web-mobile-apps',
            name: 'Web and mobile apps',
            startingFrom: 350,
            hourlyRate: 22.5,
            estimatedHours: 32,
            deposit: '35%',
            bestFor: 'Customer portals, dashboards, and interactive products',
          },
        ],
      },
      {
        subcategory: 'Consultancy',
        description: 'Practical review, planning, and support for better workflows.',
        services: [
          {
            slug: 'productivity-auditing',
            name: 'Productivity auditing',
            startingFrom: 120,
            hourlyRate: 19.5,
            estimatedHours: 7,
            deposit: 'Paid upfront',
            bestFor: 'Businesses unsure where time is being lost',
          },
          {
            slug: 'workflow-optimization',
            name: 'Workflow optimization',
            startingFrom: 180,
            hourlyRate: 19.5,
            estimatedHours: 12,
            deposit: '25%',
            bestFor: 'Teams improving repeatable processes',
          },
          {
            slug: 'training-support',
            name: 'Training and support',
            startingFrom: 95,
            hourlyRate: 16.5,
            estimatedHours: 5,
            deposit: 'Paid upfront',
            bestFor: 'Teams adopting new tools or processes',
          },
        ],
      },
    ],
  },
  {
    category: 'For Individuals',
    icon: 'individual',
    groups: [
      {
        subcategory: 'Personal Brand',
        description: 'A stronger digital presence for independent professionals.',
        services: [
          {
            slug: 'portfolio-websites',
            name: 'Portfolio websites',
            startingFrom: 120,
            hourlyRate: 16.5,
            estimatedHours: 10,
            deposit: '30%',
            bestFor: 'Creatives and freelancers showcasing work',
          },
          {
            slug: 'personal-websites',
            name: 'Personal websites',
            startingFrom: 95,
            hourlyRate: 16.5,
            estimatedHours: 7,
            deposit: '25%',
            bestFor: 'Professionals building a simple online home',
          },
          {
            slug: 'online-profiles',
            name: 'Online profiles',
            startingFrom: 65,
            hourlyRate: 16.5,
            estimatedHours: 3,
            deposit: 'Paid upfront',
            bestFor: 'LinkedIn, portfolio, and profile polishing',
          },
        ],
      },
      {
        subcategory: 'Productivity',
        description: 'Small tools and automations to reduce repetitive admin.',
        services: [
          {
            slug: 'custom-tools',
            name: 'Custom tools',
            startingFrom: 95,
            hourlyRate: 19.5,
            estimatedHours: 8,
            deposit: '25%',
            bestFor: 'Individuals needing a focused digital helper',
          },
          {
            slug: 'automation-setup',
            name: 'Automation setup',
            startingFrom: 85,
            hourlyRate: 19.5,
            estimatedHours: 6,
            deposit: 'Paid upfront',
            bestFor: 'Reducing repetitive personal admin',
          },
          {
            slug: 'digital-organization',
            name: 'Digital organization',
            startingFrom: 65,
            hourlyRate: 16.5,
            estimatedHours: 4,
            deposit: 'Paid upfront',
            bestFor: 'Tidying files, tools, accounts, and workflows',
          },
        ],
      },
      {
        subcategory: 'Support',
        description: 'Hands-on technical help, setup, and guided learning.',
        services: [
          {
            slug: 'one-to-one-training',
            name: 'One-to-one training',
            startingFrom: 45,
            hourlyRate: 16.5,
            estimatedHours: 2,
            deposit: 'Paid upfront',
            bestFor: 'Learning specific tools with guided support',
          },
          {
            slug: 'technical-setup',
            name: 'Technical setup',
            startingFrom: 65,
            hourlyRate: 16.5,
            estimatedHours: 3,
            deposit: 'Paid upfront',
            bestFor: 'Setting up devices, accounts, domains, or tools',
          },
          {
            slug: 'ongoing-help',
            name: 'Ongoing help',
            startingFrom: 40,
            hourlyRate: 16.5,
            estimatedHours: 2,
            deposit: 'Paid upfront',
            bestFor: 'Light-touch support when needed',
          },
        ],
      },
    ],
  },
  {
    category: 'Working With You',
    icon: 'process',
    groups: [
      {
        subcategory: 'Project Booking',
        description: 'Discovery, planning, scope agreement, and project scheduling.',
        services: [
          {
            slug: 'discovery-call',
            name: 'Discovery call',
            startingFrom: null,
            hourlyRate: null,
            estimatedHours: 0,
            deposit: 'None',
            bestFor: 'Checking fit before committing to a project',
          },
          {
            slug: 'written-scope',
            name: 'Written scope',
            startingFrom: 45,
            hourlyRate: 19.5,
            estimatedHours: 2,
            deposit: 'Paid upfront',
            bestFor: 'Clarifying requirements before a larger quote',
          },
          {
            slug: 'deposit-invoice',
            name: 'Deposit invoice',
            startingFrom: null,
            hourlyRate: null,
            estimatedHours: 0,
            deposit: '25-40%',
            bestFor: 'Securing a build slot for agreed work',
          },
        ],
      },
      {
        subcategory: 'Retainers',
        description: 'Ongoing help after launch or for regular technical support.',
        services: [
          {
            slug: 'maintenance',
            name: 'Maintenance',
            startingFrom: 95,
            hourlyRate: 16.5,
            estimatedHours: 4,
            deposit: 'None',
            bestFor: 'Keeping websites updated and healthy',
          },
          {
            slug: 'updates',
            name: 'Updates',
            startingFrom: 45,
            hourlyRate: 16.5,
            estimatedHours: 3,
            deposit: 'Paid upfront',
            bestFor: 'Small content, styling, or feature changes',
          },
          {
            slug: 'monitoring-support',
            name: 'Monitoring and support',
            startingFrom: 120,
            hourlyRate: 19.5,
            estimatedHours: 6,
            deposit: 'None',
            bestFor: 'Priority help and regular technical oversight',
          },
        ],
      },
    ],
  },
];

export function formatCurrency(value: number | null) {
  if (value === null) {
    return 'Custom quote';
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value);
}

export function formatHourlyRate(value: number | null) {
  return value === null ? 'Included' : formatCurrency(value);
}

export function getPricingServiceBySlug(slug: string) {
  for (const category of pricingCategories) {
    for (const group of category.groups) {
      const service = group.services.find((item) => item.slug === slug);

      if (service) {
        return { category, group, service };
      }
    }
  }

  return undefined;
}

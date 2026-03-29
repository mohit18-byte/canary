import type { Provider } from "@/types";

/** Seed providers shipped with Canary. */
export const SEED_PROVIDERS: Omit<Provider, "id" | "created_at">[] = [
  {
    name: "Stripe",
    slug: "stripe",
    logo_url: null,
    changelog_url: "https://docs.stripe.com/changelog",
    deprecation_url: "https://docs.stripe.com/changelog",
    status_url: "https://status.stripe.com",
    is_custom: false,
  },
  {
    name: "GitHub",
    slug: "github",
    logo_url: null,
    changelog_url: "https://github.blog/changelog/",
    deprecation_url: "https://github.blog/changelog/",
    status_url: "https://www.githubstatus.com",
    is_custom: false,
  },
  {
    name: "Twilio",
    slug: "twilio",
    logo_url: null,
    changelog_url: "https://www.twilio.com/en-us/changelog",
    deprecation_url: "https://www.twilio.com/en-us/changelog",
    status_url: "https://status.twilio.com",
    is_custom: false,
  },
  {
    name: "Vercel",
    slug: "vercel",
    logo_url: null,
    changelog_url: "https://vercel.com/changelog",
    deprecation_url: "https://vercel.com/changelog",
    status_url: "https://www.vercel-status.com",
    is_custom: false,
  },
  {
    name: "OpenAI",
    slug: "openai",
    logo_url: null,
    changelog_url: "https://platform.openai.com/docs/changelog",
    deprecation_url: "https://platform.openai.com/docs/deprecations",
    status_url: "https://status.openai.com",
    is_custom: false,
  }
];

/** Simple colored-initial avatar for providers (no broken image risk). */
const PROVIDER_COLORS: Record<string, string> = {
  stripe: "#635BFF",
  openai: "#10A37F",
  github: "#F0F6FC",
  twilio: "#F22F46",
  vercel: "#FFFFFF",
};

export function getProviderColor(slug: string): string {
  return PROVIDER_COLORS[slug] ?? "#6366F1";
}

export function getProviderInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

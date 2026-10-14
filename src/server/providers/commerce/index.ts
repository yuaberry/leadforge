import { CommerceParseError, type CommercePlatform, type CommerceProvider } from "./types";
import { kiwifyProvider } from "./kiwify";
import { kirvanoProvider } from "./kirvano";

const PROVIDERS: Partial<Record<CommercePlatform, CommerceProvider>> = {
  kiwify: kiwifyProvider,
  kirvano: kirvanoProvider,
};

export function getCommerceProvider(platform: string): CommerceProvider {
  const provider = PROVIDERS[platform as CommercePlatform];
  if (!provider) {
    throw new CommerceParseError(`Plataforma não suportada: ${platform}`);
  }
  return provider;
}

export { CommerceParseError };
export type { CommercePlatform, SaleEvent } from "./types";

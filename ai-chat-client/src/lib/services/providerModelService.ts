import type { Provider, ProviderModelSelection } from "@/types/provider";

export interface EnabledModelOption {
  providerId: string;
  providerName: string;
  modelId: string;
  label: string;
}

export function buildModelSelectionKey(value: ProviderModelSelection | EnabledModelOption): string {
  return `${value.providerId}:${value.modelId}`;
}

export function getEnabledModelOptions(providers: Provider[]): EnabledModelOption[] {
  const options: EnabledModelOption[] = [];

  for (const provider of providers) {
    const enabledModels = provider.models.filter((model) => model.enabled);
    for (const model of enabledModels) {
      const label = provider.name ? `${provider.name} · ${model.id}` : model.id;
      options.push({
        providerId: provider.id,
        providerName: provider.name,
        modelId: model.id,
        label,
      });
    }
  }

  options.sort((a, b) => {
    const providerCompare = a.providerName.localeCompare(b.providerName);
    if (providerCompare !== 0) return providerCompare;
    return a.modelId.localeCompare(b.modelId);
  });

  return options;
}

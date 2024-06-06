import { LLMModel } from "../client/api";

const customProvider = (modelName: string) => ({
  id: modelName,
  providerName: "",
  providerType: "custom",
});

export function collectModelArray(
  models: readonly LLMModel[],
  customModels: string,
) {
  const modelArray: {
    name: string;
    displayName: string;
    available: boolean;
    provider?: LLMModel["provider"];
    isDefault?: boolean;
  }[] = [];

  models.forEach((m) => {
    modelArray.push({
      name: m.name,
      displayName: m.name,
      available: m.available,
      provider: m.provider,
    });
  });

  const customModelConfig: {
    [key: string]: { available: boolean; displayName?: string };
  } = {};
  customModels
    .split(",")
    .filter((v) => !!v && v.length > 0)
    .forEach((m) => {
      const available = !m.startsWith("-");
      const nameConfig =
        m.startsWith("+") || m.startsWith("-") ? m.slice(1) : m;
      const [name, displayName] = nameConfig.split("=");

      if (name === "all") {
        modelArray.forEach((model) => (model.available = available));
      } else {
        customModelConfig[name] = { available, displayName };
      }
    });

  modelArray.forEach((model) => {
    const customConfig = customModelConfig[model.name];
    if (customConfig) {
      model.available = customConfig.available;
      model.displayName = customConfig.displayName || model.name;
      model.provider = model?.provider ?? customProvider(model.name);
    }
  });

  return modelArray;
}

export function collectModelArrayWithDefaultModel(
  models: readonly LLMModel[],
  customModels: string,
  defaultModel: string,
) {
  let modelArray = collectModelArray(models, customModels);
  if (defaultModel && defaultModel !== "") {
    modelArray
      .filter((m) => m.name === defaultModel)
      .forEach((m) => {
        m.name = defaultModel;
        m.available = true;
        m.isDefault = true;
      });
  }
  return modelArray;
}

/**
 * Generate full model table.
 */
export function collectModels(
  models: readonly LLMModel[],
  customModels: string,
) {
  return collectModelArray(models, customModels);
}

export function collectModelsWithDefaultModel(
  models: readonly LLMModel[],
  customModels: string,
  defaultModel: string,
) {
  return collectModelArrayWithDefaultModel(models, customModels, defaultModel);
}

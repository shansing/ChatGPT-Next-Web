import { useMemo } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { collectModelsWithDefaultModel } from "./model";

export function useAllModels() {
  const accessStore = useAccessStore();
  const configStore = useAppConfig();
  const models = useMemo(() => {
    return collectModelsWithDefaultModel(
      configStore.models,
      // [configStore.customModels, accessStore.customModels].join(","),
      accessStore.modelChoices,
      accessStore.defaultModel,
    );
  }, [configStore.models, accessStore.modelChoices, accessStore.defaultModel]);

  return models;
}

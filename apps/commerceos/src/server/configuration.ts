import {
  initializeInferenceFromEnvironment,
  type InferenceEnvironment,
  type InferenceProvider,
} from "@commerceos/inference";

export type ServerConfiguration = {
  inferenceProvider: InferenceProvider | null;
};

export const initializeServerConfiguration = (
  environment: InferenceEnvironment = process.env,
): ServerConfiguration => ({
  inferenceProvider: initializeInferenceFromEnvironment(environment),
});

import {
  capabilityStatusSchema,
  type CapabilityStatus,
} from "@commerceos/contracts";

const definitions: CapabilityStatus[] = [
  {
    id: "promiseguard",
    label: "PromiseGuard",
    description:
      "Core module foundation only; business implementation has not started.",
    state: "stub",
    routes: [],
  },
  {
    id: "marginleak",
    label: "MarginLeak",
    description:
      "Secondary module planned; business implementation has not started.",
    state: "planned",
    routes: [],
  },
  {
    id: "rescuecart",
    label: "RescueCart",
    description: "Optional future module excluded from Mission 002.",
    state: "disabled",
    routes: [],
  },
];

export const moduleRegistry = Object.freeze(
  definitions.map((definition) => capabilityStatusSchema.parse(definition)),
);

export const register = async (): Promise<void> => {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  const { initializeServerConfiguration } =
    await import("./server/configuration");
  initializeServerConfiguration();
};

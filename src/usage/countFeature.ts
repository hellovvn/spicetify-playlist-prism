// countFeature(): one more use of a Prism feature, for the anonymous usage counts
// (src/usage/featureStats.ts sends them; relay/src/features.ts lists what is counted).
// Kept small and separate so any module (page or always-on bundle) can call it.

import type { Feature } from "../../relay/src/features";
import { loadUsageCountsText, loadUsageSharingSetting, saveUsageCountsText } from "../storage";
import { addCount, isUsageSharingOn, parsePending } from "./featureCounts";

export function isUsageSharingEnabled(): boolean {
  try {
    return isUsageSharingOn(loadUsageSharingSetting());
  } catch {
    return false;
  }
}

/** One more use of a feature. Never throws, never slows anything down. Off = does nothing. */
export function countFeature(feature: Feature): void {
  try {
    if (!isUsageSharingEnabled()) return;
    saveUsageCountsText(JSON.stringify(addCount(parsePending(loadUsageCountsText()), feature)));
  } catch {
    // Counting must never break a feature.
  }
}

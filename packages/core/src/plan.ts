import { HORIZON_KEY, type Blocker, type ExistingBlocker } from "./blockers.ts";

export interface ChangePlan {
  readonly create: readonly Blocker[];
  readonly update: readonly { readonly eventId: string; readonly blocker: Blocker }[];
  readonly delete: readonly ExistingBlocker[];
}

export interface PlanInput {
  readonly desired: readonly Blocker[];
  readonly existing: readonly ExistingBlocker[];
  readonly readSourceIds: ReadonlySet<string>;
  readonly activeSourceIds: ReadonlySet<string>;
}

export const EMPTY_PLAN: ChangePlan = { create: [], update: [], delete: [] };

export function planChanges(input: PlanInput): ChangePlan {
  const deletable = (blocker: ExistingBlocker) =>
    input.readSourceIds.has(blocker.sourceId) || !input.activeSourceIds.has(blocker.sourceId);
  return diffBlockers(
    input.desired,
    input.existing.filter((blocker) => blocker.key !== HORIZON_KEY),
    deletable,
  );
}

export function diffBlockers(
  desired: readonly Blocker[],
  existing: readonly ExistingBlocker[],
  deletable: (blocker: ExistingBlocker) => boolean,
): ChangePlan {
  const { byKey: existingByKey, duplicates } = indexByKey(existing);
  const { byKey: desiredByKey } = indexByKey(desired);
  const create: Blocker[] = [];
  const update: { eventId: string; blocker: Blocker }[] = [];
  for (const blocker of desiredByKey.values()) {
    const current = existingByKey.get(blocker.key);
    if (!current) create.push(blocker);
    else if (current.hash !== blocker.hash) update.push({ eventId: current.eventId, blocker });
  }
  const stale = [...existingByKey.values()].filter((blocker) => !desiredByKey.has(blocker.key) && deletable(blocker));
  return { create, update, delete: [...stale, ...duplicates] };
}

export function mergePlans(...plans: readonly ChangePlan[]): ChangePlan {
  return {
    create: plans.flatMap((plan) => plan.create),
    update: plans.flatMap((plan) => plan.update),
    delete: plans.flatMap((plan) => plan.delete),
  };
}

export function isEmptyPlan(plan: ChangePlan): boolean {
  return plan.create.length === 0 && plan.update.length === 0 && plan.delete.length === 0;
}

function indexByKey<T extends Blocker>(blockers: readonly T[]) {
  const byKey = new Map<string, T>();
  const duplicates: T[] = [];
  for (const blocker of blockers) {
    if (byKey.has(blocker.key)) duplicates.push(blocker);
    else byKey.set(blocker.key, blocker);
  }
  return { byKey, duplicates };
}

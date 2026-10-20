import { getCurrentInstance, inject, type InjectionKey, type Ref, ref } from 'vue';

/**
 * Whether the horizon cuts the tasks of the views. A query that names planned dates (`planned:2026-11`) is not cut by it:
 * whoever asks about planning wants the answer, whatever the horizon is.
 */
export const HorizonAppliesKey: InjectionKey<Ref<boolean>> = Symbol('horizonApplies');

/** Outside a component (or outside a layout that says otherwise) the horizon applies. */
export const useHorizonApplies = (): Ref<boolean> => (getCurrentInstance() ? inject(HorizonAppliesKey, null) : null) ?? ref(true);

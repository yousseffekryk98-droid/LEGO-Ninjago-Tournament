import type { MinifigureModelOptions } from '../minifigure-model';
import { createMinifigureModel as c998d2fce } from './minifigure-998d2fce5ef9';
import { createMinifigureModel as c819add38 } from './minifigure-819add385e76';
import { createMinifigureModel as cb9eb6bfc } from './minifigure-b9eb6bfc87d5';
import { createMinifigureModel as cd1e20ac2 } from './minifigure-d1e20ac26365';
import { createMinifigureModel as cd11705e6 } from './minifigure-d11705e6aeab';
import { createMinifigureModel as ccae32dc0 } from './minifigure-cae32dc0e722';
import { createMinifigureModel as c3dfe70cb } from './minifigure-3dfe70cb5b31';
import { createMinifigureModel as c8c67c327 } from './minifigure-8c67c3277784';
import { createMinifigureModel as c67a0ba97 } from './minifigure-67a0ba97a0de';

const FACTORIES: Readonly<Record<string, (options: MinifigureModelOptions) => ReturnType<typeof c998d2fce>>> = {
  '998d2fce5ef9': c998d2fce,
  '819add385e76': c819add38,
  'b9eb6bfc87d5': cb9eb6bfc,
  'd1e20ac26365': cd1e20ac2,
  'd11705e6aeab': cd11705e6,
  'cae32dc0e722': ccae32dc0,
  '3dfe70cb5b31': c3dfe70cb,
  '8c67c3277784': c8c67c327,
  '67a0ba97a0de': c67a0ba97
};

export function createHistoricalMinifigureModel(commit: string, options: MinifigureModelOptions) {
  const factory = FACTORIES[commit];
  if (!factory) throw new Error(`Unknown historical minifigure design commit: ${commit}`);
  return factory(options);
}

export const HISTORICAL_MINIFIGURE_COMMITS = Object.freeze(Object.keys(FACTORIES));

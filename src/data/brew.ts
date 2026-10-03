import type { L } from './products';
import RECIPES from '../content/recipes.json';

export type Step = { t: L; secs?: number };
// The recipes are edited in the desk (Admin → Shop → Words), which saves them to src/content/recipes.json.
export const BREW = RECIPES as Record<'palm' | 'mountain' | 'house' | 'husk', { title: L; vessel: L; yields: L; steps: Step[]; serve: L }>;

import type { LDtkLevel, LDtkWorld } from "./level.ts";
import type { LDtkProject } from "./project.ts";

/**
 * the LDtk projects loaded, by the name they were loaded under
 * @ignore
 */
export const ldtkProjects = new Map<string, LDtkProject>();

/**
 * the levels and worlds of those projects, by the id the level director
 * loads them by
 * @ignore
 */
export const ldtkMaps = new Map<string, LDtkLevel | LDtkWorld>();

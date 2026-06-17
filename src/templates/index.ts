export { templateGenerico } from "./generico";
export { templateCarnes }  from "./carnes";
export { templateNatal }   from "./natal";
export { templatePascoa }  from "./pascoa";

import { templateGenerico } from "./generico";
import { templateCarnes }   from "./carnes";
import { templateNatal }    from "./natal";
import { templatePascoa }   from "./pascoa";
import type { Template }    from "../remotion/template-types";

export const BUILTIN_TEMPLATES: Template[] = [
  templateGenerico,
  templateCarnes,
  templateNatal,
  templatePascoa,
];

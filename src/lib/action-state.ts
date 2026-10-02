/**
 * React resets a form's fields after every action, so failed submissions echo
 * the user's input back in `values` for the inputs' defaultValue.
 */
export type ActionState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

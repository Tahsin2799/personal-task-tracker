"use client";

import { useActionState } from "react";
import { createBoard } from "../../actions";
import { FormMessage, SubmitButton } from "@/components/form-bits";

/** The next blank line of the table: write a board name (and optionally its key) to add it. */
export function NewBoardRow({ workspaceId, isFirst }: { workspaceId: string; isFirst: boolean }) {
  const [state, formAction] = useActionState(createBoard, undefined);

  return (
    <tr className="border-t border-rule-strong">
      <td colSpan={6} className="px-4 py-4 md:px-8">
        <form action={formAction} className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <div className="w-[96px]">
            <label htmlFor="board-key" className="field-label">
              Key
            </label>
            <input
              id="board-key"
              name="key"
              maxLength={10}
              placeholder="Auto"
              autoComplete="off"
              defaultValue={state?.values?.key}
              className="field font-mono uppercase"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label htmlFor="board-name" className="field-label">
              {isFirst ? "First board" : "New board"}
            </label>
            <input
              id="board-name"
              name="name"
              required
              maxLength={80}
              placeholder="e.g. Thesis chapters"
              autoComplete="off"
              defaultValue={state?.values?.name}
              className="field"
            />
          </div>
          <SubmitButton pendingLabel="Adding…">Add board</SubmitButton>
          <FormMessage state={state} className="w-full" />
        </form>
      </td>
    </tr>
  );
}

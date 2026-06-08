/** Double-click inline text editing — shared by Sort and Tasks views. */

let activeEdit: { el: HTMLElement; cancel: () => void } | null = null;

export type InlineTextEditOpts = {
  getText: () => string;
  onCommit: (text: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
};

export function beginInlineTextEdit(el: HTMLElement, opts: InlineTextEditOpts): void {
  if (el.isContentEditable) return;
  activeEdit?.cancel();
  startInlineEdit(el, opts);
}

export function wireInlineTextEdit(el: HTMLElement, opts: InlineTextEditOpts): void {
  el.addEventListener("dblclick", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    beginInlineTextEdit(el, opts);
  });
}

function startInlineEdit(el: HTMLElement, opts: InlineTextEditOpts): void {
  const original = opts.getText();
  el.textContent = original;
  el.contentEditable = "true";
  el.classList.add("inline-editing");
  opts.onEditStart?.();

  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);

  let finished = false;

  const finish = (save: boolean) => {
    if (finished) return;
    finished = true;
    activeEdit = null;

    const raw = el.textContent ?? "";
    const trimmed = raw.trim();
    el.contentEditable = "false";
    el.classList.remove("inline-editing");
    el.removeEventListener("keydown", onKeyDown);
    el.removeEventListener("blur", onBlur);
    opts.onEditEnd?.();

    if (save && trimmed && trimmed !== original) {
      el.textContent = trimmed;
      opts.onCommit(trimmed);
    } else {
      el.textContent = original;
    }
  };

  const cancel = () => finish(false);
  const commit = () => finish(true);

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      commit();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      cancel();
    }
  };

  const onBlur = () => commit();

  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("blur", onBlur);
  activeEdit = { el, cancel };
}

"use client";

import { cn } from "../../ui/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../../ui/components/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/components/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../ui/components/hover-card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "../../ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/components/select";
import { Spinner } from "../../ui/components/spinner";
import {
  ChatStatusEnum,
  type FileUIPart,
  type SourceDocumentUIPart,
} from "./types";
import { PromptInputFileSource } from "./prompt-input-file-source";
import { useAgentMessages } from "../../i18n/runtime";
import {
  CornerDownLeftIcon,
  ImageIcon,
  PlusIcon,
  SquareIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import {
  DEFAULT_AUTO_RESIZE_TEXTAREA_MAX_HEIGHT_PX,
  useAutoResizeTextarea,
} from "../hooks/use-auto-resize-textarea";
import {
  type ChangeEvent,
  type ChangeEventHandler,
  Children,
  type ClipboardEventHandler,
  type ComponentProps,
  createContext,
  type FormEvent,
  type FormEventHandler,
  forwardRef,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type PropsWithChildren,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================================
// Provider Context & Types
// ============================================================================

export interface AttachmentsContext {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList, source?: PromptInputFileSource) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export interface TextInputContext {
  value: string;
  setInput: (v: string) => void;
  clear: () => void;
}

export interface PromptInputControllerProps {
  textInput: TextInputContext;
  attachments: AttachmentsContext;
  /** INTERNAL: Allows PromptInput to register its file textInput + "open" callback */
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void,
  ) => void;
}

const PromptInputController = createContext<PromptInputControllerProps | null>(
  null,
);
const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(
  null,
);

export const usePromptInputController = () => {
  const ctx = useContext(PromptInputController);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController().",
    );
  }
  return ctx;
};

// Optional variants (do NOT throw). Useful for dual-mode components.
const useOptionalPromptInputController = () =>
  useContext(PromptInputController);

export const useProviderAttachments = () => {
  const ctx = useContext(ProviderAttachmentsContext);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use useProviderAttachments().",
    );
  }
  return ctx;
};

const useOptionalProviderAttachments = () =>
  useContext(ProviderAttachmentsContext);

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
}>;

/**
 * Optional global provider that lifts PromptInput state outside of PromptInput.
 * If you don't use it, PromptInput stays fully self-managed.
 */
export function PromptInputProvider({
  initialInput: initialTextInput = "",
  children,
}: PromptInputProviderProps) {
  // ----- textInput state
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  // ----- attachments state (global when wrapped)
  const [attachmentFiles, setAttachmentFiles] = useState<
    (FileUIPart & { id: string })[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openRef = useRef<() => void>(() => undefined);

  const add = useCallback((files: File[] | FileList) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) {
      return;
    }

    setAttachmentFiles((prev) =>
      prev.concat(
        incoming.map((file) => ({
          id: nanoid(),
          type: "file" as const,
          url: URL.createObjectURL(file),
          mediaType: file.type,
          filename: file.name,
        })),
      ),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setAttachmentFiles((prev) => {
      const found = prev.find((f) => f.id === id);
      if (found?.url) {
        URL.revokeObjectURL(found.url);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setAttachmentFiles((prev) => {
      for (const f of prev) {
        if (f.url) {
          URL.revokeObjectURL(f.url);
        }
      }
      return [];
    });
  }, []);

  // Keep a ref to attachments for cleanup on unmount (avoids stale closure)
  const attachmentsRef = useRef(attachmentFiles);
  attachmentsRef.current = attachmentFiles;

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(
    () => () => {
      for (const f of attachmentsRef.current) {
        if (f.url) {
          URL.revokeObjectURL(f.url);
        }
      }
    },
    [],
  );

  const openFileDialog = useCallback(() => {
    openRef.current?.();
  }, []);

  const attachments = useMemo<AttachmentsContext>(
    () => ({
      files: attachmentFiles,
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef,
    }),
    [attachmentFiles, add, remove, clear, openFileDialog],
  );

  const __registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>, open: () => void) => {
      fileInputRef.current = ref.current;
      openRef.current = open;
    },
    [],
  );

  const controller = useMemo<PromptInputControllerProps>(
    () => ({
      textInput: {
        value: textInput,
        setInput: setTextInput,
        clear: clearInput,
      },
      attachments,
      __registerFileInput,
    }),
    [textInput, clearInput, attachments, __registerFileInput],
  );

  return (
    <PromptInputController.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        {children}
      </ProviderAttachmentsContext.Provider>
    </PromptInputController.Provider>
  );
}

// ============================================================================
// Component Context & Hooks
// ============================================================================

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputAttachments = () => {
  // Prefer local context (inside PromptInput) as it has validation, fall back to provider
  const provider = useOptionalProviderAttachments();
  const local = useContext(LocalAttachmentsContext);
  const context = local ?? provider;
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider",
    );
  }
  return context;
};

// ============================================================================
// Referenced Sources (Local to PromptInput)
// ============================================================================

export interface ReferencedSourcesContext {
  sources: (SourceDocumentUIPart & { id: string })[];
  add: (sources: SourceDocumentUIPart[] | SourceDocumentUIPart) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const LocalReferencedSourcesContext =
  createContext<ReferencedSourcesContext | null>(null);

export const usePromptInputReferencedSources = () => {
  const ctx = useContext(LocalReferencedSourcesContext);
  if (!ctx) {
    throw new Error(
      "usePromptInputReferencedSources must be used within a LocalReferencedSourcesContext.Provider",
    );
  }
  return ctx;
};

export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string;
};

export const PromptInputActionAddAttachments = ({
  label,
  ...props
}: PromptInputActionAddAttachmentsProps) => {
  const attachments = usePromptInputAttachments();
  const t = useAgentMessages("prompt-input");

  return (
    <DropdownMenuItem
      {...props}
      onSelect={() => {
        attachments.openFileDialog();
      }}
    >
      <ImageIcon className="mr-2 size-4" /> {label ?? t.addFiles}
    </DropdownMenuItem>
  );
};

export interface PromptInputMessage {
  text: string;
  files: FileUIPart[];
}

/** PromptInput 暴露给父组件的命令式方法 */
export type PromptInputHandle = {
  clear: () => void;
  /** 使用当前附件上下文的文件选择器，保留上传校验和 Provider 行为。 */
  openFileDialog: () => void;
};

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit" | "onError" | "ref"
> & {
  accept?: string; // e.g., "image/*" or leave undefined for any
  multiple?: boolean;
  // When true, accepts drops anywhere on document. Default false (opt-in).
  globalDrop?: boolean;
  // Render a hidden input with given name and keep it in sync for native form posts. Default false.
  syncHiddenInput?: boolean;
  // Minimal constraints
  maxFiles?: number;
  maxFileSize?: number; // bytes
  /** 在附件入队前按来源处理文件；返回可继续添加的文件 */
  prepareFiles?: (files: File[], source: PromptInputFileSource) => File[];
  onError?: (err: {
    code: "max_files" | "max_file_size" | "accept";
    message: string;
  }) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) => void | false | Promise<void | false>;
};

export const PromptInput = forwardRef<PromptInputHandle, PromptInputProps>(
  (
    {
      className,
      accept,
      multiple,
      globalDrop,
      syncHiddenInput,
      maxFiles,
      maxFileSize,
      prepareFiles,
      onError,
      onSubmit,
      children,
      ...props
    },
    ref,
  ) => {
    // Try to use a provider controller if present
    const controller = useOptionalPromptInputController();
    const usingProvider = !!controller;
    const t = useAgentMessages("prompt-input");

    // Refs
    const inputRef = useRef<HTMLInputElement | null>(null);
    const formRef = useRef<HTMLFormElement | null>(null);

    // ----- Local attachments (only used when no provider)
    const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
    const files = usingProvider ? controller.attachments.files : items;

    // ----- Local referenced sources (always local to PromptInput)
    const [referencedSources, setReferencedSources] = useState<
      (SourceDocumentUIPart & { id: string })[]
    >([]);

    // Keep a ref to files for cleanup on unmount (avoids stale closure)
    const filesRef = useRef(files);
    filesRef.current = files;

    const openFileDialogLocal = useCallback(() => {
      inputRef.current?.click();
    }, []);

    const matchesAccept = useCallback(
      (f: File) => {
        if (!accept || accept.trim() === "") {
          return true;
        }

        const patterns = accept
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        return patterns.some((pattern) => {
          // 通用 MIME 通配符表示任意类型，不能按 image/* 的前缀规则处理。
          if (pattern === "*/*") {
            return true;
          }
          if (pattern.endsWith("/*")) {
            const prefix = pattern.slice(0, -1); // e.g: image/* -> image/
            return f.type.startsWith(prefix);
          }
          return f.type === pattern;
        });
      },
      [accept],
    );

    /** 统一校验附件类型和大小，返回可继续添加的文件 */
    const validateFiles = useCallback(
      (fileList: File[] | FileList, source: PromptInputFileSource) => {
        const incoming = Array.from(fileList);
        const accepted: File[] = [];
        const unsupported: File[] = [];

        for (const file of incoming) {
          if (matchesAccept(file)) {
            accepted.push(file);
          } else {
            unsupported.push(file);
          }
        }

        if (unsupported.length > 0) {
          const fileNames = unsupported.map((file) => file.name).join(", ");
          onError?.({
            code: "accept",
            message: t.unsupportedFileTypes({ files: fileNames }).value,
          });
        }
        if (accepted.length === 0) {
          return [];
        }

        const sized = accepted.filter((file) =>
          maxFileSize ? file.size <= maxFileSize : true,
        );
        if (sized.length === 0) {
          onError?.({
            code: "max_file_size",
            message: t.allFilesExceedSize.value,
          });
        }

        return prepareFiles?.(sized, source) ?? sized;
      },
      [matchesAccept, maxFileSize, onError, prepareFiles, t],
    );

    const addLocal = useCallback(
      (fileList: File[] | FileList, source = PromptInputFileSource.PICKER) => {
        const sized = validateFiles(fileList, source);
        if (sized.length === 0) {
          return;
        }

        setItems((prev) => {
          const capacity =
            typeof maxFiles === "number"
              ? Math.max(0, maxFiles - prev.length)
              : undefined;
          const capped =
            typeof capacity === "number" ? sized.slice(0, capacity) : sized;
          if (typeof capacity === "number" && sized.length > capacity) {
            onError?.({
              code: "max_files",
              message: t.tooManyFiles.value,
            });
          }
          const next: (FileUIPart & { id: string })[] = [];
          for (const file of capped) {
            next.push({
              id: nanoid(),
              type: "file",
              url: URL.createObjectURL(file),
              mediaType: file.type,
              filename: file.name,
            });
          }
          return prev.concat(next);
        });
      },
      [maxFiles, onError, t.tooManyFiles.value, validateFiles],
    );

    const removeLocal = useCallback(
      (id: string) =>
        setItems((prev) => {
          const found = prev.find((file) => file.id === id);
          if (found?.url) {
            URL.revokeObjectURL(found.url);
          }
          return prev.filter((file) => file.id !== id);
        }),
      [],
    );

    // Wrapper that validates files before calling provider's add
    const addWithProviderValidation = useCallback(
      (fileList: File[] | FileList, source = PromptInputFileSource.PICKER) => {
        const sized = validateFiles(fileList, source);
        if (sized.length === 0) {
          return;
        }

        const currentCount = files.length;
        const capacity =
          typeof maxFiles === "number"
            ? Math.max(0, maxFiles - currentCount)
            : undefined;
        const capped =
          typeof capacity === "number" ? sized.slice(0, capacity) : sized;
        if (typeof capacity === "number" && sized.length > capacity) {
          onError?.({
            code: "max_files",
            message: t.tooManyFiles.value,
          });
        }

        if (capped.length > 0) {
          controller?.attachments.add(capped);
        }
      },
      [
        controller,
        files.length,
        maxFiles,
        onError,
        t.tooManyFiles.value,
        validateFiles,
      ],
    );

    const clearAttachments = useCallback(
      () =>
        usingProvider
          ? controller?.attachments.clear()
          : setItems((prev) => {
              for (const file of prev) {
                if (file.url) {
                  URL.revokeObjectURL(file.url);
                }
              }
              return [];
            }),
      [usingProvider, controller],
    );

    const clearReferencedSources = useCallback(
      () => setReferencedSources([]),
      [],
    );

    const add = usingProvider ? addWithProviderValidation : addLocal;
    const remove = usingProvider ? controller.attachments.remove : removeLocal;
    const openFileDialog = usingProvider
      ? controller.attachments.openFileDialog
      : openFileDialogLocal;

    const clear = useCallback(() => {
      clearAttachments();
      clearReferencedSources();
    }, [clearAttachments, clearReferencedSources]);

    useImperativeHandle(ref, () => ({ clear, openFileDialog }), [clear, openFileDialog]);

    // Let provider know about our hidden file input so external menus can call openFileDialog()
    useEffect(() => {
      if (!usingProvider) {
        return;
      }
      controller.__registerFileInput(inputRef, () => inputRef.current?.click());
    }, [usingProvider, controller]);

    // Note: File input cannot be programmatically set for security reasons
    // The syncHiddenInput prop is no longer functional
    useEffect(() => {
      if (syncHiddenInput && inputRef.current && files.length === 0) {
        inputRef.current.value = "";
      }
    }, [files, syncHiddenInput]);

    // Attach drop handlers on nearest form and document (opt-in)
    useEffect(() => {
      const form = formRef.current;
      if (!form) {
        return;
      }
      if (globalDrop) {
        return; // when global drop is on, let the document-level handler own drops
      }

      const onDragOver = (e: DragEvent) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
        }
      };
      const onDrop = (e: DragEvent) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
        }
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          add(e.dataTransfer.files, PromptInputFileSource.DROP);
        }
      };
      form.addEventListener("dragover", onDragOver);
      form.addEventListener("drop", onDrop);
      return () => {
        form.removeEventListener("dragover", onDragOver);
        form.removeEventListener("drop", onDrop);
      };
    }, [add, globalDrop]);

    useEffect(() => {
      if (!globalDrop) {
        return;
      }

      const onDragOver = (e: DragEvent) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
        }
      };
      const onDrop = (e: DragEvent) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
        }
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          add(e.dataTransfer.files, PromptInputFileSource.DROP);
        }
      };
      document.addEventListener("dragover", onDragOver);
      document.addEventListener("drop", onDrop);
      return () => {
        document.removeEventListener("dragover", onDragOver);
        document.removeEventListener("drop", onDrop);
      };
    }, [add, globalDrop]);

    useEffect(
      () => () => {
        if (!usingProvider) {
          for (const f of filesRef.current) {
            if (f.url) {
              URL.revokeObjectURL(f.url);
            }
          }
        }
      },
      [usingProvider],
    );

    const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
      if (event.currentTarget.files) {
        add(event.currentTarget.files, PromptInputFileSource.PICKER);
      }
      // Reset input value to allow selecting files that were previously removed
      event.currentTarget.value = "";
    };

    const convertBlobUrlToDataUrl = async (
      url: string,
    ): Promise<string | null> => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };

    const attachmentsCtx = useMemo<AttachmentsContext>(
      () => ({
        files: files.map((item) => ({ ...item, id: item.id })),
        add,
        remove,
        clear: clearAttachments,
        openFileDialog,
        fileInputRef: inputRef,
      }),
      [files, add, remove, clearAttachments, openFileDialog],
    );

    const refsCtx = useMemo<ReferencedSourcesContext>(
      () => ({
        sources: referencedSources,
        add: (incoming: SourceDocumentUIPart[] | SourceDocumentUIPart) => {
          const array = Array.isArray(incoming) ? incoming : [incoming];
          setReferencedSources((prev) =>
            prev.concat(array.map((s) => ({ ...s, id: nanoid() }))),
          );
        },
        remove: (id: string) => {
          setReferencedSources((prev) => prev.filter((s) => s.id !== id));
        },
        clear: clearReferencedSources,
      }),
      [referencedSources, clearReferencedSources],
    );

    const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const text = usingProvider
        ? controller.textInput.value
        : (() => {
            const formData = new FormData(form);
            return (formData.get("message") as string) || "";
          })();

      // Reset form immediately after capturing text to avoid race condition
      // where user input during async blob conversion would be lost
      if (!usingProvider) {
        form.reset();
      }

      // Convert blob URLs to data URLs asynchronously
      Promise.all(
        files.map(async ({ id: _id, ...item }) => {
          if (item.url?.startsWith("blob:")) {
            const dataUrl = await convertBlobUrlToDataUrl(item.url);
            // If conversion failed, keep the original blob URL
            return {
              ...item,
              url: dataUrl ?? item.url,
            };
          }
          return item;
        }),
      )
        .then((convertedFiles: FileUIPart[]) => {
          try {
            const result = onSubmit({ text, files: convertedFiles }, event);

            // Handle both sync and async onSubmit
            if (result instanceof Promise) {
              result
                .then((accepted) => {
                  if (accepted === false) return;
                  clear();
                  if (usingProvider) {
                    controller.textInput.clear();
                  }
                })
                .catch(() => {
                  // Don't clear on error - user may want to retry
                });
            } else if (result !== false) {
              // Sync function completed without throwing, clear inputs
              clear();
              if (usingProvider) {
                controller.textInput.clear();
              }
            }
          } catch {
            // Don't clear on error - user may want to retry
          }
        })
        .catch(() => {
          // Don't clear on error - user may want to retry
        });
    };

    // Render with or without local provider
    const inner = (
      <>
        <input
          accept={accept}
          aria-label={t.uploadFiles.value}
          className="hidden"
          multiple={multiple}
          onChange={handleChange}
          ref={inputRef}
          title={t.uploadFiles.value}
          type="file"
        />
        <form
          className={cn("w-full", className)}
          onSubmit={handleSubmit}
          ref={formRef}
          {...props}
        >
          {/*
           * 显式声明 flex-col 与 h-auto，绕开 InputGroup 内部的 :has() 选择器。
           * :has() 需要 Chrome 105+，奇安信可信浏览器实际为 Chromium 102，不支持 :has()，
           * 导致 InputGroup 锁死在 h-9（36px）和 flex-row，textarea 被横向挤压至 24px 宽不可见。
           * Tailwind merge 会用这里的 flex-col/h-auto 覆盖默认的隐式 flex-row/h-9。
           */}
          <InputGroup className="flex-col h-auto items-stretch overflow-hidden">
            {children}
          </InputGroup>
        </form>
      </>
    );

    const withReferencedSources = (
      <LocalReferencedSourcesContext.Provider value={refsCtx}>
        {inner}
      </LocalReferencedSourcesContext.Provider>
    );

    // Always provide LocalAttachmentsContext so children get validated add function
    return (
      <LocalAttachmentsContext.Provider value={attachmentsCtx}>
        {withReferencedSources}
      </LocalAttachmentsContext.Provider>
    );
  },
);

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({
  className,
  ...props
}: PromptInputBodyProps) => (
  <div className={cn("contents", className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
> & {
  /** textarea 自动伸高的最大高度，单位为像素 */
  maxHeight?: number;
};

export const PromptInputTextarea = ({
  onChange,
  onKeyDown,
  className,
  placeholder,
  maxHeight = DEFAULT_AUTO_RESIZE_TEXTAREA_MAX_HEIGHT_PX,
  style,
  ref: forwardedRef,
  ...props
}: PromptInputTextareaProps) => {
  const controller = useOptionalPromptInputController();
  const attachments = usePromptInputAttachments();
  const t = useAgentMessages("prompt-input");
  const [isComposing, setIsComposing] = useState(false);

  // 受控值（用于驱动 auto-resize 重算高度）
  const rawValue = controller?.textInput.value ?? props.value ?? "";
  const controlledValue =
    typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useAutoResizeTextarea(textareaRef, controlledValue, maxHeight);

  // React 19 会将函数组件接收到的 ref 作为普通 prop 继续展开；这里显式合并
  // 外部 ref 与内部 ref，避免 {...props} 覆盖自动伸高 Hook 使用的 textareaRef。
  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    // Call the external onKeyDown handler first
    onKeyDown?.(e);

    // If the external handler prevented default, don't run internal logic
    if (e.defaultPrevented) {
      return;
    }

    if (e.key === "Enter") {
      if (isComposing || e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();

      // Check if the submit button is disabled before submitting
      const form = e.currentTarget.form;
      const submitButton = form?.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement | null;
      if (submitButton?.disabled) {
        return;
      }

      form?.requestSubmit();
    }
  };

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    const items = event.clipboardData?.items;

    if (!items) {
      return;
    }

    const files: File[] = [];

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      attachments.add(files, PromptInputFileSource.CLIPBOARD);
    }
  };

  const controlledProps = controller
    ? {
        value: controller.textInput.value,
        onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
          controller.textInput.setInput(e.currentTarget.value);
          onChange?.(e);
        },
      }
    : {
        onChange,
      };

  return (
    <InputGroupTextarea
      // 纵向 auto-height 容器中 flex-1 会忽略动态 height，必须禁用伸缩才能随内容增高
      className={cn("min-h-10 flex-none", className)}
      name="message"
      // rows=1 兜底初始高度，避免奇安信等不支持 field-sizing 的浏览器高度坍塌为 0
      rows={1}
      ref={setTextareaRef}
      style={{ ...style, maxHeight }}
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder ?? t.placeholder.value}
      {...props}
      {...controlledProps}
    />
  );
};

export type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputHeader = ({
  className,
  ...props
}: PromptInputHeaderProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("order-first flex-wrap gap-1", className)}
    {...props}
  />
);

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputFooter = ({
  className,
  ...props
}: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn(
      "justify-between gap-1 px-1.5 pb-1.5",
      className,
    )}
    {...props}
  />
);

export type PromptInputToolsProps = ComponentProps<"div">;

export const PromptInputTools = ({
  className,
  ref,
  ...props
}: PromptInputToolsProps) => (
  <div
    ref={ref}
    className={cn("flex flex-wrap items-center gap-1 min-w-0", className)}
    {...props}
  />
);

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton>;

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  ...props
}: PromptInputButtonProps) => {
  const newSize =
    size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

  return (
    <InputGroupButton
      className={cn("transition-colors", className)}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  );
};

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
  <DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps) => (
  <DropdownMenuTrigger asChild>
    <PromptInputButton className={className} {...props}>
      {children ?? <PlusIcon className="size-4" />}
    </PromptInputButton>
  </DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;
export const PromptInputActionMenuContent = ({
  className,
  ...props
}: PromptInputActionMenuContentProps) => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
);

export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;
export const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps) => (
  <DropdownMenuItem className={cn(className)} {...props} />
);

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatusEnum;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const t = useAgentMessages("prompt-input");
  const isGenerating =
    status === ChatStatusEnum.SUBMITTED || status === ChatStatusEnum.STREAMING;

  let Icon = <CornerDownLeftIcon className="size-4" />;

  if (status === ChatStatusEnum.SUBMITTED) {
    Icon = <Spinner />;
  } else if (status === ChatStatusEnum.STREAMING) {
    Icon = <SquareIcon className="size-4" />;
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isGenerating && onStop) {
      e.preventDefault();
      onStop();
      return;
    }
    onClick?.(e);
  };

  return (
    <InputGroupButton
      aria-label={isGenerating && onStop ? t.stop.value : t.submit.value}
      className={cn(className)}
      onClick={handleClick}
      size={size}
      type={isGenerating && onStop ? "button" : "submit"}
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </InputGroupButton>
  );
};

export type PromptInputSelectProps = ComponentProps<typeof Select>;

export const PromptInputSelect = (props: PromptInputSelectProps) => (
  <Select {...props} />
);

export type PromptInputSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export const PromptInputSelectTrigger = ({
  className,
  ...props
}: PromptInputSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
      "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
      className,
    )}
    {...props}
  />
);

export type PromptInputSelectContentProps = ComponentProps<
  typeof SelectContent
>;

export const PromptInputSelectContent = ({
  className,
  ...props
}: PromptInputSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
);

export type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputSelectItem = ({
  className,
  ...props
}: PromptInputSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);

export type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>;

export const PromptInputSelectValue = ({
  className,
  ...props
}: PromptInputSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);

export type PromptInputHoverCardProps = ComponentProps<typeof HoverCard>;

export const PromptInputHoverCard = ({
  openDelay = 0,
  closeDelay = 0,
  ...props
}: PromptInputHoverCardProps) => (
  <HoverCard closeDelay={closeDelay} openDelay={openDelay} {...props} />
);

export type PromptInputHoverCardTriggerProps = ComponentProps<
  typeof HoverCardTrigger
>;

export const PromptInputHoverCardTrigger = (
  props: PromptInputHoverCardTriggerProps,
) => <HoverCardTrigger {...props} />;

export type PromptInputHoverCardContentProps = ComponentProps<
  typeof HoverCardContent
>;

export const PromptInputHoverCardContent = ({
  align = "start",
  ...props
}: PromptInputHoverCardContentProps) => (
  <HoverCardContent align={align} {...props} />
);

export type PromptInputTabsListProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTabsList = ({
  className,
  ...props
}: PromptInputTabsListProps) => <div className={cn(className)} {...props} />;

export type PromptInputTabProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTab = ({
  className,
  ...props
}: PromptInputTabProps) => <div className={cn(className)} {...props} />;

export type PromptInputTabLabelProps = HTMLAttributes<HTMLHeadingElement>;

export const PromptInputTabLabel = ({
  className,
  ...props
}: PromptInputTabLabelProps) => (
  <h3
    className={cn(
      "mb-2 px-3 font-medium text-muted-foreground text-xs",
      className,
    )}
    {...props}
  />
);

export type PromptInputTabBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTabBody = ({
  className,
  ...props
}: PromptInputTabBodyProps) => (
  <div className={cn("space-y-1", className)} {...props} />
);

export type PromptInputTabItemProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTabItem = ({
  className,
  ...props
}: PromptInputTabItemProps) => (
  <div
    className={cn(
      "flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent",
      className,
    )}
    {...props}
  />
);

export type PromptInputCommandProps = ComponentProps<typeof Command>;

export const PromptInputCommand = ({
  className,
  ...props
}: PromptInputCommandProps) => <Command className={cn(className)} {...props} />;

export type PromptInputCommandInputProps = ComponentProps<typeof CommandInput>;

export const PromptInputCommandInput = ({
  className,
  ...props
}: PromptInputCommandInputProps) => (
  <CommandInput className={cn(className)} {...props} />
);

export type PromptInputCommandListProps = ComponentProps<typeof CommandList>;

export const PromptInputCommandList = ({
  className,
  ...props
}: PromptInputCommandListProps) => (
  <CommandList className={cn(className)} {...props} />
);

export type PromptInputCommandEmptyProps = ComponentProps<typeof CommandEmpty>;

export const PromptInputCommandEmpty = ({
  className,
  ...props
}: PromptInputCommandEmptyProps) => (
  <CommandEmpty className={cn(className)} {...props} />
);

export type PromptInputCommandGroupProps = ComponentProps<typeof CommandGroup>;

export const PromptInputCommandGroup = ({
  className,
  ...props
}: PromptInputCommandGroupProps) => (
  <CommandGroup className={cn(className)} {...props} />
);

export type PromptInputCommandItemProps = ComponentProps<typeof CommandItem>;

export const PromptInputCommandItem = ({
  className,
  ...props
}: PromptInputCommandItemProps) => (
  <CommandItem className={cn(className)} {...props} />
);

export type PromptInputCommandSeparatorProps = ComponentProps<
  typeof CommandSeparator
>;

export const PromptInputCommandSeparator = ({
  className,
  ...props
}: PromptInputCommandSeparatorProps) => (
  <CommandSeparator className={cn(className)} {...props} />
);

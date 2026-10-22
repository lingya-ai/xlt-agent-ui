"use client";

import {Button} from "../../ui/components/button";
import {ButtonGroup, ButtonGroupText} from "../../ui/components/button-group";
import {cn} from "../../ui/lib/utils";
import {toast} from "../../ui/components/sonner";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "../../ui/components/tooltip";
import {useAgentMessages} from "../../i18n/runtime";
import {cjk} from "@streamdown/cjk";
import {code} from "@streamdown/code";
import {math} from "@streamdown/math";
import {mermaid} from "@streamdown/mermaid";
import {type ChatItemMessageRole} from "../hooks/use-chat/types";
import {ChevronLeftIcon, ChevronRightIcon, CopyIcon} from "lucide-react";
import type {ComponentProps, HTMLAttributes, ReactElement} from "react";
import {createContext, memo, useContext, useEffect, useState} from "react";
import {Streamdown} from "streamdown";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: ChatItemMessageRole;
};

export const Message = ({className, from, ...props}: MessageProps) => (
  <div
    className={cn(
      "group flex min-w-0 max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
                                 children,
                                 className,
                                 ...props
                               }: MessageContentProps) => (
  <div
    className={cn(
      "is-user:dark flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
                                 className,
                                 children,
                                 ...props
                               }: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
                                tooltip,
                                children,
                                label,
                                variant = "ghost",
                                size = "icon-sm",
                                ...props
                              }: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

interface MessageBranchContextType {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
}

const MessageBranchContext = createContext<MessageBranchContextType | null>(
  null
);

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext);

  if (!context) {
    throw new Error(
      "MessageBranch components must be used within MessageBranch"
    );
  }

  return context;
};

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

export const MessageBranch = ({
                                defaultBranch = 0,
                                onBranchChange,
                                className,
                                ...props
                              }: MessageBranchProps) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = (newBranch: number) => {
    setCurrentBranch(newBranch);
    onBranchChange?.(newBranch);
  };

  const goToPrevious = () => {
    const newBranch =
      currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  };

  const goToNext = () => {
    const newBranch =
      currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  };

  const contextValue: MessageBranchContextType = {
    currentBranch,
    totalBranches: branches.length,
    goToPrevious,
    goToNext,
    branches,
    setBranches,
  };

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div
        className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
        {...props}
      />
    </MessageBranchContext.Provider>
  );
};

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageBranchContent = ({
                                       children,
                                       ...props
                                     }: MessageBranchContentProps) => {
  const {currentBranch, setBranches, branches} = useMessageBranch();
  const childrenArray = Array.isArray(children) ? children : [children];

  // Use useEffect to update branches when they change
  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden"
      )}
      key={branch.key}
      {...props}
    >
      {branch}
    </div>
  ));
};

export type MessageBranchSelectorProps = HTMLAttributes<HTMLDivElement> & {
  from: ChatItemMessageRole;
};

export const MessageBranchSelector = ({
                                        className,
                                        from: _from,
                                        ...props
                                      }: MessageBranchSelectorProps) => {
  const {totalBranches} = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
    return null;
  }

  return (
    <ButtonGroup
      className={cn("[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md",className)}
      orientation="horizontal"
      {...props}
    />
  );
};

export type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export const MessageBranchPrevious = ({
                                        children,
                                        ...props
                                      }: MessageBranchPreviousProps) => {
  const {goToPrevious, totalBranches} = useMessageBranch();
  const t = useAgentMessages("message");

  return (
    <Button
      aria-label={t.previousBranch.value}
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14}/>}
    </Button>
  );
};

export type MessageBranchNextProps = ComponentProps<typeof Button>;

export const MessageBranchNext = ({
                                    children,
                                    ...props
                                  }: MessageBranchNextProps) => {
  const {goToNext, totalBranches} = useMessageBranch();
  const t = useAgentMessages("message");

  return (
    <Button
      aria-label={t.nextBranch.value}
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14}/>}
    </Button>
  );
};

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export const MessageBranchPage = ({
                                    className,
                                    ...props
                                  }: MessageBranchPageProps) => {
  const {currentBranch, totalBranches} = useMessageBranch();
  const t = useAgentMessages("message");

  return (
    <ButtonGroupText
      className={cn(
        "border-none bg-transparent text-muted-foreground shadow-none",
        className
      )}
      {...props}
    >
      {t.branchOfTotal({current: currentBranch + 1, total: totalBranches})}
    </ButtonGroupText>
  );
};

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
  ({className, ...props}: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={{code, mermaid, math, cjk}}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

MessageResponse.displayName = "MessageResponse";

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({
                                 className,
                                 children,
                                 ...props
                               }: MessageToolbarProps) => (
  <div
    className={cn(
      "mt-4 flex w-full items-center justify-between gap-4",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

/** 复制按钮：点击后将传入的文本写入剪贴板 */
export type MessageCopyButtonProps = {
  text: string;
  tooltip?: string;
  className?: string;
};

export const MessageCopyButton = ({
  text,
  tooltip,
  className
}: MessageCopyButtonProps) => {
  const t = useAgentMessages("message");
  const resolvedTooltip = tooltip ?? t.copy.value;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t.copied);
    } catch {
      toast.error(t.copyFailed);
    }
  };

  return (
    <MessageAction
      aria-label={resolvedTooltip}
      className={cn("mt-1 self-start", className)}
      onClick={handleCopy}
      tooltip={resolvedTooltip}
      type="button"
    >
      <CopyIcon size={14} />
    </MessageAction>
  );
};

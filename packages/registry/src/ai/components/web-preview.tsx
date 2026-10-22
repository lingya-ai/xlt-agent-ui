"use client";

import {Badge} from "../../ui/components/badge";
import {Button} from "../../ui/components/button";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "../../ui/components/collapsible";
import {Input} from "../../ui/components/input";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "../../ui/components/tooltip";
import {cn} from "../../ui/lib/utils";
import { useAgentMessages } from "../../i18n/runtime";
import {AlertTriangleIcon, ChevronDownIcon, CircleXIcon, WandSparklesIcon} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

export interface WebPreviewContextValue {
  url: string;
  setUrl: (url: string) => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
}

const WebPreviewContext = createContext<WebPreviewContextValue | null>(null);

const useWebPreview = () => {
  const context = useContext(WebPreviewContext);
  if (!context) {
    throw new Error("WebPreview components must be used within a WebPreview");
  }
  return context;
};

export type WebPreviewProps = ComponentProps<"div"> & {
  /** 非受控模式下的初始地址。 */
  defaultUrl?: string;
  /** 受控地址。传入后由调用方维护预览与地址栏的同步。 */
  url?: string;
  onUrlChange?: (url: string) => void;
  /** 非受控模式下控制台的初始展开状态。 */
  defaultConsoleOpen?: boolean;
  /** 受控控制台展开状态。 */
  consoleOpen?: boolean;
  onConsoleOpenChange?: (open: boolean) => void;
};

export const WebPreview = ({
  className,
  children,
  defaultUrl = "",
  url: controlledUrl,
  onUrlChange,
  defaultConsoleOpen = false,
  consoleOpen: controlledConsoleOpen,
  onConsoleOpenChange,
  ...props
}: WebPreviewProps) => {
  const [uncontrolledUrl, setUncontrolledUrl] = useState(defaultUrl);
  const [uncontrolledConsoleOpen, setUncontrolledConsoleOpen] =
    useState(defaultConsoleOpen);
  const url = controlledUrl ?? uncontrolledUrl;
  const consoleOpen = controlledConsoleOpen ?? uncontrolledConsoleOpen;

  const handleUrlChange = (newUrl: string) => {
    if (controlledUrl === undefined) setUncontrolledUrl(newUrl);
    onUrlChange?.(newUrl);
  };

  const handleConsoleOpenChange = (open: boolean) => {
    if (controlledConsoleOpen === undefined) setUncontrolledConsoleOpen(open);
    onConsoleOpenChange?.(open);
  };

  const contextValue: WebPreviewContextValue = {
    url,
    setUrl: handleUrlChange,
    consoleOpen,
    setConsoleOpen: handleConsoleOpenChange,
  };

  return (
    <WebPreviewContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex size-full flex-col rounded-lg border bg-card",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </WebPreviewContext.Provider>
  );
};

export type WebPreviewNavigationProps = ComponentProps<"div">;

export const WebPreviewNavigation = ({
  className,
  children,
  ...props
}: WebPreviewNavigationProps) => (
  <div
    className={cn("flex items-center gap-1 border-b p-2", className)}
    {...props}
  >
    {children}
  </div>
);

export type WebPreviewNavigationButtonProps = ComponentProps<typeof Button> & {
  tooltip?: string;
};

export const WebPreviewNavigationButton = ({
  onClick,
  disabled,
  tooltip,
  children,
  ...props
}: WebPreviewNavigationButtonProps) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="h-8 w-8 p-0 hover:text-foreground"
          disabled={disabled}
          onClick={onClick}
          size="sm"
          variant="ghost"
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export type WebPreviewUrlProps = ComponentProps<typeof Input>;

export const WebPreviewUrl = ({
  value,
  onChange,
  onKeyDown,
  ...props
}: WebPreviewUrlProps) => {
  const { url, setUrl } = useWebPreview();
  const t = useAgentMessages("web-preview");
  const [inputValue, setInputValue] = useState(url);

  // Sync input value with context URL when it changes externally
  useEffect(() => {
    setInputValue(url);
  }, [url]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    onChange?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      const target = event.target as HTMLInputElement;
      setUrl(target.value);
    }
    onKeyDown?.(event);
  };

  return (
    <Input
      className="h-8 flex-1 text-sm"
      onChange={onChange ?? handleChange}
      onKeyDown={handleKeyDown}
      placeholder={t.enterUrl.value}
      value={value ?? inputValue}
      {...props}
    />
  );
};

export type WebPreviewBodyProps = Omit<ComponentProps<"iframe">, "loading"> & {
  /** iframe 加载期间显示的覆盖内容。 */
  loading?: ReactNode;
};

export const WebPreviewBody = ({
  className,
  loading,
  src,
  ...props
}: WebPreviewBodyProps) => {
  const { url } = useWebPreview();
  const t = useAgentMessages("web-preview");

  return (
    <div className="relative min-h-0 flex-1">
      <iframe
        className={cn("block size-full", className)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        src={(src ?? url) || undefined}
        title={t.preview.value}
        {...props}
      />
      {loading}
    </div>
  );
};

export type WebPreviewConsoleProps = ComponentProps<"div"> & {
  logs?: Array<{
    level: "log" | "warn" | "error";
    message: string;
    timestamp: Date;
  }>;
  /** 存在错误日志时，请求将修复提示插入聊天输入框。 */
  onRequestAiFix?: () => void;
};

export const WebPreviewConsole = ({
  className,
  logs = [],
  onRequestAiFix,
  children,
  ...props
}: WebPreviewConsoleProps) => {
  const { consoleOpen, setConsoleOpen } = useWebPreview();
  const t = useAgentMessages("web-preview");
  const warningCount = logs.filter((log) => log.level === "warn").length;
  const errorCount = logs.filter((log) => log.level === "error").length;

  return (
    <Collapsible
      className={cn("border-t bg-muted/50 font-mono text-sm", className)}
      onOpenChange={setConsoleOpen}
      open={consoleOpen}
      {...props}
    >
      <div className="flex items-center">
        <CollapsibleTrigger asChild>
          <Button
            className="h-auto min-w-0 flex-1 justify-start rounded-none px-4 py-3 text-left font-medium hover:bg-muted/50"
            type="button"
            variant="ghost"
          >
            <span>{t.console}</span>
            {warningCount > 0 && (
              <Badge
                aria-label={`${t.warningCount.value}: ${warningCount}`}
                className="h-5 gap-0.5 px-1.5 py-0 text-[10px]"
                title={`${t.warningCount.value}: ${warningCount}`}
                variant="warning"
              >
                <AlertTriangleIcon aria-hidden="true" className={"size-4"}/>
                {warningCount}
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge
                aria-label={`${t.errorCount.value}: ${errorCount}`}
                className="h-5 gap-0.5 px-1.5 py-0 text-[10px]"
                title={`${t.errorCount.value}: ${errorCount}`}
                variant="destructive"
              >
                <CircleXIcon aria-hidden="true" className={"size-4"}/>
                {errorCount}
              </Badge>
            )}
            <ChevronDownIcon
              className={cn(
                "ml-auto size-4 transition-transform duration-200",
                consoleOpen && "rotate-180",
              )}
            />
          </Button>
        </CollapsibleTrigger>
        {errorCount > 0 && onRequestAiFix && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={t.aiFixConsoleErrors.value}
                  className="mr-2"
                  onClick={onRequestAiFix}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <WandSparklesIcon aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t.aiFixConsoleErrors}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <CollapsibleContent
        className={cn(
          "min-h-0 flex-1 px-4 pb-4",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        )}
      >
        <div className="flex h-full min-h-0 flex-col gap-1 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">{t.noConsoleOutput}</p>
          ) : (
            logs.map((log, index) => (
              <div
                className={cn(
                  "text-xs",
                  log.level === "error" && "text-destructive",
                  log.level === "warn" && "text-warning",
                  log.level === "log" && "text-foreground",
                )}
                key={`${log.timestamp.getTime()}-${index}`}
              >
                <span className="text-muted-foreground">
                  {log.timestamp.toLocaleTimeString()}
                </span>{" "}
                {log.message}
              </div>
            ))
          )}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

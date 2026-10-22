"use client";

import {
  type ComponentProps,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import copy from "copy-to-clipboard";
import { ClockIcon, CopyIcon, Loader2 } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../ui/components/alert";
import { AutosizeTextarea } from "../../ui/components/autosize-textarea";
import { Badge } from "../../ui/components/badge";
import { Button } from "../../ui/components/button";
import { Checkbox } from "../../ui/components/checkbox";
import { Label } from "../../ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "../../ui/components/radio-group";
import { toast } from "../../ui/components/sonner";
import { cn } from "../../ui/lib/utils";

import type { AskUserQuestionOption } from "../hooks/use-chat/schema";
import { useServerCountdown } from "../hooks/use-chat/use-server-countdown";
import {
  type AskUserQuestionAnswer,
  buildAskUserQuestionAnswer,
  getRecommendedOptions,
  isValidAskUserQuestionAnswer,
  toggleSelectedOption,
} from "../lib/ask-user-question";
import { createTimeoutAt } from "../lib/server-countdown";
import { formatWorkingDuration } from "../lib/time";

interface AskContextValue {
  question: string;
  questionDetails: string;
  options: (AskUserQuestionOption | string)[];
  multiple: boolean;
  selectedOptions: string[];
  customInput: string;
  customInputActive: boolean;
  remaining: number;
  loading: boolean;
  isExpired: boolean;
  isDisabled: boolean;
  selectSingleOption: (value: string) => void;
  toggleOption: (value: string, checked: boolean) => void;
  activateCustomInput: () => void;
  changeCustomInput: (value: string) => void;
  submit: () => void;
}

const AskContext = createContext<AskContextValue | null>(null);

function useAsk() {
  const context = useContext(AskContext);
  if (!context) throw new Error("Ask components must be used within Ask");
  return context;
}

export type AskProps = ComponentProps<typeof Alert> & {
  /** 提问文本。 */
  question: string;
  /** 问题的详细说明。 */
  questionDetails: string;
  /** 后端提供的候选项。 */
  options: (AskUserQuestionOption | string)[];
  /** 是否允许多选。 */
  multiple: boolean;
  /** 服务端生成等待事件时的 UTC 时间；简要事件可能缺失。 */
  serverNow: Date | string;
  /** 超时秒数。 */
  timeoutSeconds: number;
  /** 用户提交选择后的回调。 */
  onAnswer: (answer: AskUserQuestionAnswer) => Promise<void> | void;
  /** 是否正在提交。 */
  loading?: boolean;
  /** 是否已禁用。 */
  disabled?: boolean;
};

export function Ask({
  className,
  question,
  questionDetails,
  options,
  multiple,
  serverNow,
  timeoutSeconds,
  onAnswer,
  loading = false,
  disabled = false,
  ...props
}: AskProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(() =>
    getRecommendedOptions(options, multiple),
  );
  const [customInput, setCustomInput] = useState("");
  const [customInputActive, setCustomInputActive] = useState(false);
  // 简要事件没有 serverNow；将本次挂载的本地接收时刻固定到截止时间中，避免重渲染重置倒计时。
  const timeoutAt = useMemo(
    () => createTimeoutAt(serverNow, timeoutSeconds),
    [serverNow, timeoutSeconds],
  );
  const { remainingSeconds: remaining, isTimeout } = useServerCountdown(
    { serverNow, timeoutAt },
    { enabled: !disabled && !loading },
  );

  useEffect(() => {
    setSelectedOptions(getRecommendedOptions(options, multiple));
    setCustomInput("");
    setCustomInputActive(false);
  }, [multiple, options]);

  const handleSelectSingleOption = useCallback((value: string) => {
    setSelectedOptions([value]);
    setCustomInput("");
    setCustomInputActive(false);
  }, []);

  const handleToggleOption = useCallback(
    (value: string, checked: boolean) => {
      if (checked) {
        setCustomInput("");
        setCustomInputActive(false);
      }
      setSelectedOptions((current) =>
        toggleSelectedOption(options, current, value, checked),
      );
    },
    [options],
  );

  const handleActivateCustomInput = useCallback(() => {
    setCustomInputActive(true);
  }, []);

  const handleChangeCustomInput = useCallback((value: string) => {
    setCustomInput(value);
    setCustomInputActive(true);
    if (value.trim()) setSelectedOptions([]);
  }, []);

  const isExpired = isTimeout && !loading;
  const isDisabled = disabled || loading || isExpired;

  const handleSubmit = useCallback(() => {
    if (isDisabled) return;
    const answer = buildAskUserQuestionAnswer(
      options,
      selectedOptions,
      customInput,
    );
    if (!isValidAskUserQuestionAnswer(options, answer, multiple)) return;
    void onAnswer(answer);
  }, [
    customInput,
    isDisabled,
    multiple,
    onAnswer,
    options,
    selectedOptions,
  ]);

  return (
    <AskContext.Provider
      value={{
        question,
        questionDetails,
        options,
        multiple,
        selectedOptions,
        customInput,
        customInputActive,
        remaining,
        loading,
        isExpired,
        isDisabled,
        selectSingleOption: handleSelectSingleOption,
        toggleOption: handleToggleOption,
        activateCustomInput: handleActivateCustomInput,
        changeCustomInput: handleChangeCustomInput,
        submit: handleSubmit,
      }}
    >
      <Alert
        className={cn(
          "not-prose flex w-full min-w-0 max-w-full flex-col gap-2",
          className,
        )}
        {...props}
      />
    </AskContext.Provider>
  );
}

export type AskTitleProps = ComponentProps<typeof AlertTitle>;

export function AskTitle({ className, ...props }: AskTitleProps) {
  const { question } = useAsk();
  return (
    <AlertTitle className={cn("text-sm font-medium", className)} {...props}>
      {question}
    </AlertTitle>
  );
}

export type AskDetailsProps = ComponentProps<typeof AlertDescription>;

export function AskDetails({ className, ...props }: AskDetailsProps) {
  const { questionDetails } = useAsk();
  if (!questionDetails.trim()) return null;

  return (
    <AlertDescription
      className={cn(
        "whitespace-pre-wrap break-words text-sm text-muted-foreground",
        className,
      )}
      {...props}
    >
      {questionDetails}
    </AlertDescription>
  );
}

export type AskOptionsProps = ComponentProps<"fieldset">;

export function AskOptions({ className, ...props }: AskOptionsProps) {
  const {
    question,
    options,
    multiple,
    selectedOptions,
    isDisabled,
    selectSingleOption,
    toggleOption,
  } = useAsk();
  const t = useAgentMessages("ask");
  const idPrefix = useId();

  const handleCopyOption = async (option: string) => {
    try {
      const copied = await copy(option);
      if (!copied) throw new Error("复制选项失败");
      toast.success(t.copied);
    } catch {
      toast.error(t.copyFailed);
    }
  };

  const renderOptionContent = (option: AskUserQuestionOption | string) => (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
        {(typeof option === 'string' ? option : option.text)}
      </span>
      {(typeof option !== 'string' && option.recommended) && <Badge variant="secondary">{t.recommended}</Badge>}
    </span>
  );

  return (
    <fieldset
      className={cn(
        "flex w-full min-w-0 max-w-full flex-col gap-1.5",
        className,
      )}
      {...props}
    >
      <legend className="sr-only">{question}</legend>
      {multiple ? (
        options.map((option, index) => {
          const optionId = `${idPrefix}-option-${index}`;
          const isSelected = selectedOptions.includes((typeof option === 'string' ? option : option.text));
          return (
            <div
              key={(typeof option === 'string' ? option : option.text)}
              className={cn(
                "flex w-full min-w-0 items-center rounded-md border transition-colors",
                isSelected ? "border-primary bg-muted" : "border-border",
              )}
            >
              <Checkbox
                id={optionId}
                checked={isSelected}
                disabled={isDisabled}
                onCheckedChange={(checked) =>
                  toggleOption((typeof option === 'string' ? option : option.text), checked === true)
                }
                className="ml-3"
              />
              <Label
                htmlFor={optionId}
                className="min-w-0 flex-1 cursor-pointer px-3 py-2 text-sm font-normal"
              >
                {renderOptionContent(option)}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="m-0.5 self-center"
                aria-label={`${t.copyOption.value}: ${(typeof option === 'string' ? option : option.text)}`}
                title={t.copyOption.value}
                onClick={() => handleCopyOption((typeof option === 'string' ? option : option.text))}
              >
                <CopyIcon />
              </Button>
            </div>
          );
        })
      ) : (
        <RadioGroup
          value={selectedOptions[0] ?? ""}
          disabled={isDisabled}
          onValueChange={selectSingleOption}
          className="gap-1.5"
        >
          {options.map((option, index) => {
            const optionId = `${idPrefix}-option-${index}`;
            const isSelected = selectedOptions[0] === (typeof option === 'string' ? option : option.text);
            return (
              <div
                key={(typeof option === 'string' ? option : option.text)}
                className={cn(
                  "flex w-full min-w-0 items-center rounded-md border transition-colors",
                  isSelected ? "border-primary bg-muted" : "border-border",
                )}
              >
                <RadioGroupItem
                  id={optionId}
                  value={(typeof option === 'string' ? option : option.text)}
                  className="ml-3"
                />
                <Label
                  htmlFor={optionId}
                  className="min-w-0 flex-1 cursor-pointer px-3 py-2 text-sm font-normal"
                >
                  {renderOptionContent(option)}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="m-0.5 self-center"
                  aria-label={`${t.copyOption.value}: ${(typeof option === 'string' ? option : option.text)}`}
                  title={t.copyOption.value}
                  onClick={() => handleCopyOption((typeof option === 'string' ? option : option.text))}
                >
                  <CopyIcon />
                </Button>
              </div>
            );
          })}
        </RadioGroup>
      )}
      <AskCustomInput />
    </fieldset>
  );
}

export type AskCustomInputProps = ComponentProps<typeof AutosizeTextarea>;

export function AskCustomInput({ className, ...props }: AskCustomInputProps) {
  const {
    customInput,
    customInputActive,
    isDisabled,
    activateCustomInput,
    changeCustomInput,
  } = useAsk();
  const t = useAgentMessages("ask");

  return (
    <AutosizeTextarea
      value={customInput}
      onChange={(event) => changeCustomInput(event.target.value)}
      onFocus={activateCustomInput}
      placeholder={t.customInputPlaceholder.value}
      aria-label={t.customInputPlaceholder.value}
      minHeight={36}
      maxHeight={160}
      className={cn(
        "text-sm",
        customInputActive && "border-primary bg-muted",
        className,
      )}
      disabled={isDisabled}
      {...props}
    />
  );
}

export type AskFooterProps = ComponentProps<"div">;

export function AskFooter({ className, ...props }: AskFooterProps) {
  const {
    options,
    multiple,
    selectedOptions,
    customInput,
    remaining,
    loading,
    isExpired,
    isDisabled,
    submit,
  } = useAsk();
  const t = useAgentMessages("ask");
  const answer = buildAskUserQuestionAnswer(
    options,
    selectedOptions,
    customInput,
  );
  const canSubmit =
    !isDisabled && isValidAskUserQuestionAnswer(options, answer, multiple);

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ClockIcon className="size-3" />
        <span>
          {loading
            ? t.submitting.value
            : isExpired
              ? t.timeout.value
              : formatWorkingDuration(0, remaining * 1000)}
        </span>
      </div>
      <Button size="sm" disabled={!canSubmit} onClick={submit}>
        {loading && (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        )}
        {loading ? t.submitting.value : t.submit.value}
      </Button>
    </div>
  );
}

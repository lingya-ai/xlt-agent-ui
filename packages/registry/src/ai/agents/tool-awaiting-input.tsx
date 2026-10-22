"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  Loader2,
  PauseIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import { useApiRequest } from "../../api/hooks/use-api-request";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../ui/components/alert";
import { Badge } from "../../ui/components/badge";
import { Button } from "../../ui/components/button";
import { toast } from "../../ui/components/sonner";
import { cn } from "../../ui/lib/utils";

import {
  Ask,
  AskDetails,
  AskFooter,
  AskOptions,
  AskTitle,
} from "../components/ask";
import type { AskUserQuestionOption } from "../hooks/use-chat/schema";
import {
  type UserInputAnswerOutput,
  useFetchUserInputStatus,
} from "../hooks/use-chat/use-hitl";
import type { AskUserQuestionAnswer } from "../lib/ask-user-question";
import { useAiChatContext } from "./context";

type AskQuestionViewStatus =
  | "checking"
  | "pending"
  | "submitting"
  | "answered"
  | "interrupted"
  | "expired"
  | "failed";

export type ToolAwaitingInputProps = {
  conversationId?: string;
  messageId?: string;
  questionId: string;
  question: string;
  questionDetails: string;
  options: (AskUserQuestionOption | string)[];
  multiple: boolean;
  serverNow: Date | string;
  timeoutSeconds: number;
  /** 所属消息或工具是否已中断。 */
  interrupted: boolean;
  onAnswer?: (answer: AskUserQuestionAnswer) => Promise<UserInputAnswerOutput>;
  selectedOptions?: string[];
  customInput?: string | null;
};

/** 工具等待用户输入交互组件。 */
export function ToolAwaitingInput({
  conversationId,
  messageId,
  questionId,
  question,
  questionDetails,
  options,
  multiple,
  serverNow,
  timeoutSeconds,
  interrupted,
  onAnswer,
  selectedOptions: completedSelectedOptions,
  customInput: completedCustomInput,
}: ToolAwaitingInputProps) {
  const t = useAgentMessages("tool-awaiting-input");
  const { httpClient } = useAiChatContext();
  const fetchUserInputStatus = useFetchUserInputStatus(httpClient);
  const { runAsync: fetchStatus } = useApiRequest(fetchUserInputStatus, {
    manual: true,
    disableErrorNotification: true,
  });
  const hasCompletedAnswer = completedSelectedOptions !== undefined;
  const fetchStatusRef = useRef(fetchStatus);
  const onAnswerRef = useRef(onAnswer);
  const submittingRef = useRef(false);
  const answeredRef = useRef(hasCompletedAnswer);
  const statusCheckIdRef = useRef(0);
  const [viewStatus, setViewStatus] = useState<AskQuestionViewStatus>(
    hasCompletedAnswer
      ? "answered"
      : interrupted
        ? "interrupted"
        : "checking",
  );
  const [currentQuestion, setCurrentQuestion] = useState(question);
  const [currentQuestionDetails, setCurrentQuestionDetails] =
    useState(questionDetails);
  const [currentOptions, setCurrentOptions] = useState<(AskUserQuestionOption | string)[]>(options);
  const [currentMultiple, setCurrentMultiple] = useState(multiple);
  const [answeredSelectedOptions, setAnsweredSelectedOptions] = useState(
    completedSelectedOptions ?? [],
  );
  const [answeredCustomInput, setAnsweredCustomInput] = useState(
    completedCustomInput?.trim() ?? "",
  );

  useEffect(() => {
    fetchStatusRef.current = fetchStatus;
    onAnswerRef.current = onAnswer;
    if (hasCompletedAnswer) answeredRef.current = true;
  }, [fetchStatus, hasCompletedAnswer, onAnswer]);

  const applyStatus = useCallback(async () => {
    const statusCheckId = statusCheckIdRef.current + 1;
    statusCheckIdRef.current = statusCheckId;

    if (hasCompletedAnswer) {
      answeredRef.current = true;
      setAnsweredSelectedOptions(completedSelectedOptions ?? []);
      setAnsweredCustomInput(completedCustomInput?.trim() ?? "");
      setViewStatus("answered");
      return;
    }
    if (answeredRef.current) {
      setViewStatus("answered");
      return;
    }
    if (interrupted) {
      setViewStatus("interrupted");
      return;
    }
    if (!onAnswerRef.current || !conversationId || !messageId) {
      setViewStatus("expired");
      return;
    }

    setViewStatus("checking");
    try {
      const status = await fetchStatusRef.current(
        questionId,
        conversationId,
        messageId,
      );
      if (statusCheckId !== statusCheckIdRef.current) return;
      if (!status.pending) {
        setViewStatus("expired");
        return;
      }
      setCurrentQuestion(status.question ?? question);
      setCurrentQuestionDetails(status.questionDetails ?? "");
      setCurrentOptions(status.options ?? []);
      setCurrentMultiple(status.multiple ?? false);
      setViewStatus("pending");
    } catch {
      if (statusCheckId !== statusCheckIdRef.current) return;
      setViewStatus("failed");
    }
  }, [
    completedCustomInput,
    completedSelectedOptions,
    conversationId,
    hasCompletedAnswer,
    interrupted,
    messageId,
    questionId,
  ]);

  useEffect(() => {
    void applyStatus();
    return () => {
      statusCheckIdRef.current += 1;
    };
  }, [applyStatus]);

  const handleAnswer = useCallback(
    async (answer: AskUserQuestionAnswer) => {
      const submitAnswer = onAnswerRef.current;
      if (
        !submitAnswer ||
        !conversationId ||
        !messageId ||
        submittingRef.current
      )
        return;
      submittingRef.current = true;
      const submitStatusCheckId = statusCheckIdRef.current;
      setViewStatus("submitting");
      try {
        const result = await submitAnswer(answer);
        if (result.success) {
          answeredRef.current = true;
          setAnsweredSelectedOptions(answer.selectedOptions);
          setAnsweredCustomInput(answer.customInput?.trim() ?? "");
          setViewStatus("answered");
          return;
        }
        if (submitStatusCheckId !== statusCheckIdRef.current) return;
        toast.warning(result.message ?? t.unavailable.value);
        setViewStatus("expired");
      } catch (error) {
        if (submitStatusCheckId !== statusCheckIdRef.current) return;
        const errorMessage =
          error instanceof Error && error.message.trim()
            ? error.message
            : t.submitFailed.value;
        toast.error(errorMessage);
        await applyStatus();
      } finally {
        submittingRef.current = false;
      }
    },
    [applyStatus, conversationId, messageId, t.submitFailed, t.unavailable],
  );

  if (viewStatus === "answered") {
    return (
      <Alert className="not-prose flex w-full min-w-0 max-w-full flex-col gap-2">
        <QuestionHeading
          question={currentQuestion}
          questionDetails={currentQuestionDetails}
        />
        <ReadonlyQuestionOptions
          options={options}
          selectedOptions={answeredSelectedOptions}
          recommendedLabel={t.recommended}
        />
        {answeredCustomInput && (
          <div className="flex items-center gap-2 rounded-md border border-success/40 bg-muted px-3 py-2 text-sm">
            <CheckCircleIcon className="size-4 shrink-0 text-success" />
            <span className="min-w-0 whitespace-pre-wrap break-words">
              {answeredCustomInput}
            </span>
          </div>
        )}
      </Alert>
    );
  }

  if (viewStatus === "interrupted") {
    return (
      <Alert className="not-prose flex w-full min-w-0 max-w-full flex-col gap-2">
        <QuestionHeading
          question={currentQuestion}
          questionDetails={currentQuestionDetails}
        />
        <ReadonlyQuestionOptions
          options={options}
          selectedOptions={[]}
          recommendedLabel={t.recommended}
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PauseIcon className="size-4 shrink-0" />
          <span>{t.interrupted}</span>
        </div>
      </Alert>
    );
  }

  if (viewStatus === "checking") {
    return (
      <Alert className="not-prose flex w-full min-w-0 max-w-full flex-col gap-2">
        <QuestionHeading
          question={currentQuestion}
          questionDetails={currentQuestionDetails}
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>{t.checkingStatus}</span>
        </div>
      </Alert>
    );
  }

  if (viewStatus === "expired") {
    return (
      <Alert className="not-prose flex w-full min-w-0 max-w-full flex-col gap-2">
        <QuestionHeading
          question={currentQuestion}
          questionDetails={currentQuestionDetails}
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClockIcon className="size-4 shrink-0" />
          <span>{t.unavailable}</span>
        </div>
      </Alert>
    );
  }

  if (viewStatus === "failed") {
    return (
      <Alert className="not-prose flex w-full min-w-0 max-w-full flex-col gap-2">
        <QuestionHeading
          question={currentQuestion}
          questionDetails={currentQuestionDetails}
        />
        <div className="flex items-center gap-2 text-sm text-destructive">
          <TriangleAlertIcon className="size-4 shrink-0" />
          <span>{t.statusFailed}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => void applyStatus()}
        >
          {t.retryStatus}
        </Button>
      </Alert>
    );
  }

  return (
    <Ask
      question={currentQuestion}
      questionDetails={currentQuestionDetails}
      options={currentOptions}
      multiple={currentMultiple}
      serverNow={serverNow}
      timeoutSeconds={timeoutSeconds}
      onAnswer={handleAnswer}
      loading={viewStatus === "submitting"}
    >
      <AskTitle />
      <AskDetails />
      <AskOptions />
      <AskFooter />
    </Ask>
  );
}

function ReadonlyQuestionOptions({
  options,
  selectedOptions,
  recommendedLabel,
}: {
  options: (AskUserQuestionOption | string)[];
  selectedOptions: string[];
  recommendedLabel: ReactNode;
}) {
  if (options.length === 0) return null;

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-1.5">
      {options.map((option) => {
        const isSelected = selectedOptions.includes((typeof option === 'string' ? option : option.text));
        return (
          <div
            key={(typeof option === 'string' ? option : option.text)}
            data-selected={isSelected}
            className={cn(
              "flex w-full min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm",
              isSelected
                ? "border-success/40 bg-muted"
                : "border-border",
            )}
          >
            {isSelected ? (
              <CheckCircleIcon className="size-4 shrink-0 text-success" />
            ) : (
              <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
              {(typeof option === 'string' ? option : option.text)}
            </span>
            {(typeof option !== 'string' && option.recommended) && (
              <Badge variant="secondary">{recommendedLabel}</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuestionHeading({
  question,
  questionDetails,
}: {
  question: string;
  questionDetails: string;
}) {
  return (
    <>
      <AlertTitle className="text-sm font-medium">{question}</AlertTitle>
      {Boolean(questionDetails.trim()) && (
        <AlertDescription className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {questionDetails}
        </AlertDescription>
      )}
    </>
  );
}

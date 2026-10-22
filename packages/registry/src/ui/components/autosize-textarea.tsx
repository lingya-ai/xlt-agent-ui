"use client"

import * as React from "react"
import {useImperativeHandle} from "react"
import {cn} from "../lib/utils"

interface UseAutosizeTextAreaProps {
  textAreaRef: React.MutableRefObject<HTMLTextAreaElement | null>
  minHeight?: number
  maxHeight?: number
  triggerAutoSize: string
}

function useAutosizeTextArea({
  textAreaRef,
  triggerAutoSize,
  maxHeight = Number.MAX_SAFE_INTEGER,
  minHeight = 0,
}: UseAutosizeTextAreaProps) {
  const [init, setInit] = React.useState(true)
  React.useEffect(() => {
    const offsetBorder = 6
    const textAreaElement = textAreaRef.current
    if (textAreaElement) {
      if (init) {
        textAreaElement.style.minHeight = `${minHeight + offsetBorder}px`
        if (maxHeight > minHeight) {
          textAreaElement.style.maxHeight = `${maxHeight}px`
        }
        setInit(false)
      }
      textAreaElement.style.height = `${minHeight + offsetBorder}px`
      const scrollHeight = textAreaElement.scrollHeight
      if (scrollHeight > maxHeight) {
        textAreaElement.style.height = `${maxHeight}px`
      } else {
        textAreaElement.style.height = `${scrollHeight + offsetBorder}px`
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textAreaRef.current, triggerAutoSize])
}

export type AutosizeTextAreaRef = {
  textArea: HTMLTextAreaElement
  maxHeight: number
  minHeight: number
  focus: () => void
}

export type AutosizeTextareaProps = {
  maxHeight?: number
  minHeight?: number
} & React.ComponentProps<"textarea">

const AutosizeTextarea = React.forwardRef<AutosizeTextAreaRef, AutosizeTextareaProps>(
  ({
    maxHeight = Number.MAX_SAFE_INTEGER,
    minHeight = 52,
    className,
    onChange,
    value,
    ...props
  }: AutosizeTextareaProps,
  ref: React.Ref<AutosizeTextAreaRef>,
  ) => {
    const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null)
    const [triggerAutoSize, setTriggerAutoSize] = React.useState("")

    useAutosizeTextArea({
      textAreaRef,
      triggerAutoSize: triggerAutoSize,
      maxHeight,
      minHeight,
    })

    useImperativeHandle(ref, () => ({
      textArea: textAreaRef.current as HTMLTextAreaElement,
      focus: () => textAreaRef?.current?.focus(),
      maxHeight,
      minHeight,
    }))

    React.useEffect(() => {
      setTriggerAutoSize(value as string)
    }, [props?.defaultValue, value])

    return (
      <textarea
        {...props}
        data-slot="autosize-textarea"
        value={value}
        ref={textAreaRef}
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        onChange={(e) => {
          setTriggerAutoSize(e.target.value)
          onChange?.(e)
        }}
      />
    )
  },
)
AutosizeTextarea.displayName = "AutosizeTextarea"

export {AutosizeTextarea}

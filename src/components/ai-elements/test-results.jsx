import { cn } from "cn"

import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

function TestResults({ summary, children, ...props }) {
  return (
    <Trace {...props}>
      <TraceCollapsible>{children ?? summary}</TraceCollapsible>
    </Trace>
  )
}

function TestResultsHeader({ failed = 0, className, children, ...props }) {
  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      <TraceLine status={failed > 0 ? "error" : undefined}>{children}</TraceLine>
    </TraceCollapsibleTrigger>
  )
}

function TestResultsSummary({ passed = 0, failed = 0, total, className, children, ...props }) {
  const count = total ?? passed + failed
  return (
    <TraceTitle className={className} {...props}>
      {children ?? `Ran ${count} tests${failed ? `, ${failed} failed` : ""}`}
    </TraceTitle>
  )
}

function TestResultsDuration({ className, children, ...props }) {
  return <span className={cn("text-xs text-muted-foreground", className)} {...props}>{children}</span>
}

function TestResultsProgress({ passed = 0, failed = 0, className, ...props }) {
  const total = passed + failed || 1
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)} {...props}>
      <div className="h-full bg-primary" style={{ width: `${(passed / total) * 100}%` }} />
    </div>
  )
}

function TestResultsContent({ className, children, ...props }) {
  return (
    <TraceCollapsibleContent className={className} {...props}>
      <Trace>{children}</Trace>
    </TraceCollapsibleContent>
  )
}

function TestSuite({ failed = 0, children, ...props }) {
  return (
    <TraceCollapsible defaultOpen={failed > 0} {...props}>
      {children}
    </TraceCollapsible>
  )
}

function TestSuiteName({ className, children, ...props }) {
  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      <TraceLine>
        <TraceTitle>{children}</TraceTitle>
      </TraceLine>
    </TraceCollapsibleTrigger>
  )
}

function TestSuiteStats({ className, ...props }) {
  return <span className={cn("text-xs text-muted-foreground", className)} {...props} />
}

function TestSuiteContent({ children, ...props }) {
  return (
    <TraceCollapsibleContent {...props}>
      <Trace>{children}</Trace>
    </TraceCollapsibleContent>
  )
}

function Test({ failed = false, name, children, ...props }) {
  return (
    <TraceLine status={failed ? "error" : undefined} {...props}>
      <TraceTitle>{name ?? children}</TraceTitle>
    </TraceLine>
  )
}

function TestName({ className, ...props }) {
  return <span className={className} {...props} />
}

function TestDuration({ className, ...props }) {
  return <span className={cn("text-xs text-muted-foreground", className)} {...props} />
}

function TestStatus({ className, ...props }) {
  return <span className={cn("text-xs", className)} {...props} />
}

function TestError({ message, stack, children, className }) {
  return (
    <CodeBlock size="sm" className={className}>
      <CodeBlockContent wrap className="max-h-64">
        {children ?? (
          <>
            <TestErrorMessage>{message}</TestErrorMessage>
            {stack ? <TestErrorStack>{stack}</TestErrorStack> : null}
          </>
        )}
      </CodeBlockContent>
    </CodeBlock>
  )
}

function TestErrorMessage({ className, ...props }) {
  return <div className={className} {...props} />
}

function TestErrorStack({ className, ...props }) {
  return <pre className={cn("mt-2 whitespace-pre-wrap", className)} {...props} />
}

export {
  TestResults,
  TestResultsHeader,
  TestResultsSummary,
  TestResultsDuration,
  TestResultsProgress,
  TestResultsContent,
  TestSuite,
  TestSuiteName,
  TestSuiteStats,
  TestSuiteContent,
  Test,
  TestName,
  TestDuration,
  TestStatus,
  TestError,
  TestErrorMessage,
  TestErrorStack,
}

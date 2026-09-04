import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AssistantPageContext = {
  plantId: number
  currentPage?: string
  journalEntryId?: number
  selectedDate?: string
}

type AssistantContextValue = {
  pageContext: AssistantPageContext | null
  setPageContext: (context: AssistantPageContext | null) => void
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContextState] = useState<AssistantPageContext | null>(null)
  const setPageContext = useCallback((context: AssistantPageContext | null) => {
    setPageContextState(context)
  }, [])

  const value = useMemo(
    () => ({ pageContext, setPageContext }),
    [pageContext, setPageContext],
  )

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

export function useAssistantContext() {
  const ctx = useContext(AssistantContext)
  if (!ctx) {
    throw new Error('useAssistantContext must be used within AssistantProvider')
  }
  return ctx
}

export function useRegisterAssistantContext(context: AssistantPageContext | null) {
  const { setPageContext } = useAssistantContext()

  useEffect(() => {
    setPageContext(context)
    return () => setPageContext(null)
  }, [
    context?.plantId,
    context?.currentPage,
    context?.journalEntryId,
    context?.selectedDate,
    setPageContext,
  ])
}

import { createContext, useContext } from 'react';

export interface CodeBlockActions {
  onInsertIntoFile?: (code: string, language: string) => void;
  onCreateFile?: (code: string, language: string) => void;
  onRunCommand?: (command: string) => void;
  onSaveAsArtifact?: (code: string, language: string) => void;
}

export const CodeBlockActionsContext = createContext<CodeBlockActions>({});

export function useCodeBlockActions(): CodeBlockActions {
  return useContext(CodeBlockActionsContext);
}

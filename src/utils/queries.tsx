import {useMutation, UseMutationResult, useQuery} from 'react-query';
import {CreateSnippet, PaginatedSnippets, Snippet, UpdateSnippet} from './snippet.ts';
import {SnippetOperations} from "./snippetOperations.ts";
import {PaginatedUsers} from "./users.ts";
import {TestCase} from "../types/TestCase.ts";
import {FileType} from "../types/FileType.ts";
import {Rule} from "../types/Rule.ts";
import {useSessionContext} from "../contexts/sessionContext.tsx";
import {useSnackbarContext} from "../contexts/snackbarContext.tsx";


// Real (contra /api) o fake según la configuración; ver contexts/sessionProvider.tsx
export const useSnippetsOperations = (): SnippetOperations => useSessionContext().operations

// Muestra el error de una mutación (Problem Details del backend) en un snackbar
const useErrorSnackbar = () => {
  const {createSnackbar} = useSnackbarContext()
  return (error: Error) => createSnackbar('error', error.message)
}

export const useGetSnippets = (page: number = 0, pageSize: number = 10, snippetName?: string) => {
  const snippetOperations = useSnippetsOperations()

  return useQuery<PaginatedSnippets, Error>(['listSnippets', page,pageSize,snippetName], () => snippetOperations.listSnippetDescriptors(page, pageSize,snippetName));
};

export const useGetSnippetById = (id: string) => {
  const snippetOperations = useSnippetsOperations()

  return useQuery<Snippet | undefined, Error>(['snippet', id], () => snippetOperations.getSnippetById(id), {
    enabled: !!id, // This query will not execute until the id is provided
  });
};

export const useCreateSnippet = ({onSuccess}: {onSuccess: () => void}): UseMutationResult<Snippet, Error, CreateSnippet> => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<Snippet, Error, CreateSnippet>(createSnippet => snippetOperations.createSnippet(createSnippet), {onSuccess, onError});
};

export const useUpdateSnippetById = ({onSuccess}: {onSuccess: () => void}): UseMutationResult<Snippet, Error, {
  id: string;
  updateSnippet: UpdateSnippet
}> => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<Snippet, Error, { id: string; updateSnippet: UpdateSnippet }>(
      ({id, updateSnippet}) => snippetOperations.updateSnippetById(id, updateSnippet),{
        onSuccess,
        onError,
    }
  );
};

export const useGetUsers = (name: string = "", page: number = 0, pageSize: number = 10) => {
  const snippetOperations = useSnippetsOperations()

  return useQuery<PaginatedUsers, Error>(['users',name,page,pageSize], () => snippetOperations.getUserFriends(name,page, pageSize));
};

export const useShareSnippet = ({onSuccess}: {onSuccess?: () => void} = {}) => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<Snippet, Error, { snippetId: string; userId: string }>(
      ({snippetId, userId}) => snippetOperations.shareSnippet(snippetId, userId),
      {onSuccess, onError}
  );
};


export const useGetTestCases = (snippetId: string) => {
  const snippetOperations = useSnippetsOperations()

  return useQuery<TestCase[] | undefined, Error>(['testCases', snippetId], () => snippetOperations.getTestCases(snippetId), {
    enabled: !!snippetId,
  });
};


export const usePostTestCase = (snippetId: string, {onSuccess}: {onSuccess?: () => void} = {}) => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<TestCase, Error, Partial<TestCase>>(
      (tc) => snippetOperations.postTestCase(snippetId, tc),
      {onSuccess, onError}
  );
};


export const useRemoveTestCase = (snippetId: string, {onSuccess}: {onSuccess: () => void}) => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<string, Error, string>(
      ['removeTestCase', snippetId],
      (id) => snippetOperations.removeTestCase(snippetId, id),
      {
        onSuccess,
        onError,
      }
  );
};

export type TestCaseResult = "success" | "fail"

export const useTestSnippet = (snippetId: string) => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<TestCaseResult, Error, Partial<TestCase>>(
      (tc) => snippetOperations.testSnippet(snippetId, tc),
      {onError}
  )
}



export const useGetFormatRules = () => {
  const snippetOperations = useSnippetsOperations()

  return useQuery<Rule[], Error>('formatRules', () => snippetOperations.getFormatRules());
}

export const useModifyFormatRules = ({onSuccess}: {onSuccess: () => void}) => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<Rule[], Error, Rule[]>(
      rule => snippetOperations.modifyFormatRule(rule),
      {onSuccess, onError}
  );
}


export const useGetLintingRules = () => {
  const snippetOperations = useSnippetsOperations()

  return useQuery<Rule[], Error>('lintingRules', () => snippetOperations.getLintingRules());
}


export const useModifyLintingRules = ({onSuccess}: {onSuccess: () => void}) => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<Rule[], Error, Rule[]>(
      rule => snippetOperations.modifyLintingRule(rule),
      {onSuccess, onError}
  );
}

export type FormatRequest = {
  content: string
  language?: string
  version?: string
}

export const useFormatSnippet = () => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<string, Error, FormatRequest>(
      ({content, language, version}) => snippetOperations.formatSnippet(content, language, version),
      {onError}
  );
}

export const useDeleteSnippet = ({onSuccess}: {onSuccess: () => void}) => {
  const snippetOperations = useSnippetsOperations()
  const onError = useErrorSnackbar()

  return useMutation<string, Error, string>(
      id => snippetOperations.deleteSnippet(id),
      {
        onSuccess,
        onError,
      }
  );
}


export const useGetFileTypes = () => {
  const snippetOperations = useSnippetsOperations()

  return useQuery<FileType[], Error>('fileTypes', () => snippetOperations.getFileTypes());
}

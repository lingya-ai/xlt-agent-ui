"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConversationQueryStatus } from "./use-conversation-operations";

import type {
  ConversationGroup,
  ConversationPageInput,
} from "./use-conversation-operations";

const PAGE_SIZE = 5;
const MAX_CONCURRENT_FOLDER_REQUESTS = 6;

function folderKey(groupId: number | null) {
  return groupId === null ? "ungrouped" : `group:${groupId}`;
}

/** 一个文件夹当前已经加载的会话页。 */
export interface ConversationFolderPage<T> {
  groupId: number | null;
  records: T[];
  current: number;
  total: number;
  loading: boolean;
  failed: boolean;
}

/** 按文件夹分别懒加载会话；未分组目录固定排在所有真实分组之后。 */
export function useConversationFolderPages<
  TGroup extends Pick<ConversationGroup, "id" | "name">,
  TConversation,
>({
  enabled,
  identityKey,
  status = ConversationQueryStatus.ACTIVE,
  getGroups,
  getPage,
  getConversationId,
}: {
  enabled: boolean;
  identityKey?: string | null;
  status?: ConversationQueryStatus;
  getGroups: () => Promise<{ records: TGroup[] }>;
  getPage: (input: ConversationPageInput) => Promise<{
    records: TConversation[];
    page: { current: number; size: number; total: number };
  }>;
  getConversationId: (conversation: TConversation) => string;
}) {
  const scopeKey = `${identityKey ?? ""}:${status}`;
  const [groups, setGroups] = useState<TGroup[]>([]);
  const [folders, setFolders] = useState<
    Record<string, ConversationFolderPage<TConversation>>
  >({});
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [directoryFailed, setDirectoryFailed] = useState(false);
  const [directoryLoaded, setDirectoryLoaded] = useState(false);
  const [directoryIdentityKey, setDirectoryIdentityKey] = useState<
    string | null
  >(null);
  const [loaded, setLoaded] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(new Set<string>());
  const hasLoadedOnce = useRef(false);
  const foldersSnapshot = useRef(folders);
  foldersSnapshot.current = folders;
  const groupsSnapshot = useRef(groups);
  groupsSnapshot.current = groups;
  const previousIdentity = useRef(scopeKey);

  const loadFolder = useCallback(
    async (
      groupId: number | null,
      current: number,
      requestGeneration: number,
      append: boolean,
    ) => {
      const key = folderKey(groupId);
      setFolders((existing) => ({
        ...existing,
        [key]: {
          groupId,
          records: existing[key]?.records ?? [],
          current: existing[key]?.current ?? 0,
          total: existing[key]?.total ?? 0,
          loading: true,
          failed: false,
        },
      }));
      try {
        const getFolderPage = (page: number) =>
          getPage({
            status,
            current: page,
            size: PAGE_SIZE,
            groupFilter: groupId === null ? "UNGROUPED" : "GROUP",
            groupId: groupId ?? undefined,
          });
        let result = await getFolderPage(append ? current : 0);
        const refreshedRecords = [...result.records];
        // 刷新完整的已展开范围，成功后一次性替换，避免退回第一页。
        if (!append) {
          for (let page = 1; page <= current; page += 1) {
            if (requestGeneration !== generation.current) return;
            if (page * PAGE_SIZE >= result.page.total) break;
            result = await getFolderPage(page);
            refreshedRecords.push(...result.records);
          }
        }
        if (requestGeneration !== generation.current) return;
        setFolders((existing) => {
          const prior = existing[key];
          const records = append
            ? [...(prior?.records ?? []), ...refreshedRecords]
            : refreshedRecords;
          const deduplicated = new Map<string, TConversation>();
          for (const record of records)
            deduplicated.set(getConversationId(record), record);
          return {
            ...existing,
            [key]: {
              groupId,
              records: [...deduplicated.values()],
              current: result.page.current,
              total: result.page.total,
              loading: false,
              failed: false,
            },
          };
        });
      } catch {
        if (requestGeneration !== generation.current) return;
        setFolders((existing) => ({
          ...existing,
          [key]: {
            groupId,
            records: existing[key]?.records ?? [],
            current: existing[key]?.current ?? 0,
            total: existing[key]?.total ?? 0,
            loading: false,
            failed: true,
          },
        }));
      }
    },
    [getConversationId, getPage, status],
  );

  const reload = useCallback(async () => {
    if (!enabled) return;
    const requestGeneration = ++generation.current;
    inFlight.current.clear();
    if (!hasLoadedOnce.current) setLoaded(false);
    setLoadingGroups(true);
    let nextGroups: TGroup[] = [];
    let failed = false;
    try {
      const result = await getGroups();
      nextGroups = result.records;
    } catch {
      failed = true;
      nextGroups = groupsSnapshot.current;
    } finally {
      if (requestGeneration === generation.current) {
        setGroups(nextGroups);
        setDirectoryFailed(failed);
        if (!failed) {
          setDirectoryLoaded(true);
          setDirectoryIdentityKey(scopeKey);
        }
        setLoadingGroups(false);
      }
    }
    if (requestGeneration !== generation.current) return;

    const groupIds = nextGroups.map((group) => group.id);
    const folderIds: Array<number | null> = [...groupIds, null];
    const initial: Record<string, ConversationFolderPage<TConversation>> = {};
    for (const groupId of folderIds) {
      const key = folderKey(groupId);
      const existing = foldersSnapshot.current[key];
      initial[key] = existing
        ? { ...existing, groupId, loading: true, failed: false }
        : {
            groupId,
            records: [],
            current: 0,
            total: 0,
            loading: true,
            failed: false,
          };
    }
    if (requestGeneration === generation.current)
      setFolders((existing) =>
        Object.fromEntries(
          Object.entries(initial).map(([key, folder]) => [
            key,
            existing[key]
              ? { ...existing[key], loading: true, failed: false }
              : folder,
          ]),
        ),
      );

    let cursor = 0;
    const worker = async () => {
      while (cursor < folderIds.length) {
        const groupId = folderIds[cursor++];
        if (groupId === undefined) return;
        await loadFolder(
          groupId,
          initial[folderKey(groupId)]?.current ?? 0,
          requestGeneration,
          false,
        );
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(MAX_CONCURRENT_FOLDER_REQUESTS, folderIds.length) },
        () => worker(),
      ),
    );
    if (requestGeneration === generation.current) {
      hasLoadedOnce.current = true;
      setLoaded(true);
    }
  }, [enabled, getGroups, scopeKey, loadFolder]);

  const loadMore = useCallback(
    async (groupId: number | null) => {
      const key = folderKey(groupId);
      const folder = folders[key];
      if (inFlight.current.has(key)) return;
      if (!folder || folder.loading) return;
      if (!folder.failed && folder.records.length >= folder.total) return;
      inFlight.current.add(key);
      try {
        const hasLoadedPage = folder.records.length > 0;
        const nextPage = hasLoadedPage ? folder.current + 1 : 0;
        await loadFolder(
          groupId,
          nextPage,
          generation.current,
          hasLoadedPage &&
            folder.records.length === (folder.current + 1) * PAGE_SIZE,
        );
      } finally {
        inFlight.current.delete(key);
      }
    },
    [folders, loadFolder],
  );

  const reloadDirectory = useCallback(async () => {
    if (!enabled) return;
    const requestGeneration = ++generation.current;
    inFlight.current.clear();
    setLoadingGroups(true);
    let nextGroups: TGroup[];
    try {
      nextGroups = (await getGroups()).records;
    } catch {
      if (requestGeneration === generation.current) {
        setDirectoryFailed(true);
        setLoadingGroups(false);
        setFolders((existing) =>
          Object.fromEntries(
            Object.entries(existing).map(([key, folder]) => [
              key,
              { ...folder, loading: false },
            ]),
          ),
        );
      }
      return;
    }
    if (requestGeneration !== generation.current) return;

    const previousIds = new Set(
      groupsSnapshot.current.map((group) => group.id),
    );
    const nextIds = new Set(nextGroups.map((group) => group.id));
    const newGroupIds = nextGroups
      .map((group) => group.id)
      .filter((id) => !previousIds.has(id));
    const removedAnyGroup = [...previousIds].some((id) => !nextIds.has(id));
    const foldersToReload: Array<number | null> = [
      ...newGroupIds,
      ...(removedAnyGroup ? [null] : []),
    ];
    setGroups(nextGroups);
    setDirectoryFailed(false);
    setDirectoryLoaded(true);
    setDirectoryIdentityKey(scopeKey);
    setLoadingGroups(false);
    setFolders((existing) => {
      const next: Record<string, ConversationFolderPage<TConversation>> = {};
      for (const groupId of [...nextIds, null]) {
        const key = folderKey(groupId);
        const folder = existing[key];
        next[key] = folder
          ? { ...folder, groupId, loading: foldersToReload.includes(groupId) }
          : {
              groupId,
              records: [],
              current: 0,
              total: 0,
              loading: foldersToReload.includes(groupId),
              failed: false,
            };
      }
      return next;
    });
    let cursor = 0;
    const worker = async () => {
      while (cursor < foldersToReload.length) {
        const groupId = foldersToReload[cursor++];
        if (groupId === undefined) return;
        await loadFolder(groupId, 0, requestGeneration, false);
      }
    };
    await Promise.all(
      Array.from(
        {
          length: Math.min(
            MAX_CONCURRENT_FOLDER_REQUESTS,
            foldersToReload.length,
          ),
        },
        () => worker(),
      ),
    );
  }, [enabled, getGroups, scopeKey, loadFolder]);

  const reloadFolder = useCallback(
    async (groupId: number | null) => {
      const current = foldersSnapshot.current[folderKey(groupId)]?.current ?? 0;
      await loadFolder(groupId, current, generation.current, false);
    },
    [loadFolder],
  );

  const updateConversation = useCallback(
    (
      conversationId: string,
      update: (current: TConversation) => TConversation,
    ) => {
      setFolders((existing) => {
        const next = { ...existing };
        for (const [key, folder] of Object.entries(existing)) {
          const index = folder.records.findIndex(
            (record) => getConversationId(record) === conversationId,
          );
          if (index < 0) continue;
          const records = [...folder.records];
          const record = records[index];
          if (record === undefined) continue;
          records[index] = update(record);
          next[key] = { ...folder, records };
        }
        return next;
      });
    },
    [getConversationId],
  );

  const removeConversation = useCallback(
    (conversationId: string) => {
      setFolders((existing) => {
        const next = { ...existing };
        for (const [key, folder] of Object.entries(existing)) {
          next[key] = {
            ...folder,
            total: Math.max(
              0,
              folder.total -
                (folder.records.some(
                  (record) => getConversationId(record) === conversationId,
                )
                  ? 1
                  : 0),
            ),
            records: folder.records.filter(
              (record) => getConversationId(record) !== conversationId,
            ),
          };
        }
        return next;
      });
    },
    [getConversationId],
  );

  useEffect(() => {
    if (previousIdentity.current !== scopeKey) {
      previousIdentity.current = scopeKey;
      generation.current += 1;
      hasLoadedOnce.current = false;
      groupsSnapshot.current = [];
      foldersSnapshot.current = {};
      setGroups([]);
      setFolders({});
      setDirectoryFailed(false);
      setDirectoryLoaded(false);
      setDirectoryIdentityKey(null);
      setLoadingGroups(false);
      setLoaded(false);
    }
    if (enabled) void reload();
    else {
      generation.current += 1;
      hasLoadedOnce.current = false;
      groupsSnapshot.current = [];
      foldersSnapshot.current = {};
      setGroups([]);
      setFolders({});
      setDirectoryFailed(false);
      setDirectoryLoaded(false);
      setDirectoryIdentityKey(null);
      setLoadingGroups(false);
      setLoaded(false);
    }
  }, [enabled, scopeKey, reload]);

  const orderedFolders = useMemo(
    () => [
      ...groups
        .map((group) => folders[folderKey(group.id)])
        .filter(
          (folder): folder is ConversationFolderPage<TConversation> =>
            folder !== undefined,
        ),
      folders.ungrouped ?? {
        groupId: null,
        records: [],
        current: 0,
        total: 0,
        loading: false,
        failed: false,
      },
    ],
    [folders, groups],
  );
  const records = useMemo(
    () => orderedFolders.flatMap((folder) => folder.records),
    [orderedFolders],
  );

  return {
    groups,
    folders: orderedFolders,
    records,
    directoryFailed,
    directoryLoaded: directoryLoaded && directoryIdentityKey === scopeKey,
    loading:
      (enabled && !loaded) ||
      loadingGroups ||
      orderedFolders.some((folder) => folder.loading),
    loaded,
    reload,
    reloadDirectory,
    loadMore,
    reloadFolder,
    updateConversation,
    removeConversation,
  };
}

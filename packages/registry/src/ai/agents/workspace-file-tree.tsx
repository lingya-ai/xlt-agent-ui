"use client";

import {Fragment, type ReactNode} from "react";
import {FileTree, FileTreeFolder} from "../components/file-tree";
import type {WorkspaceFile} from "../hooks/use-chat/use-workspace-files";

type WorkspaceFileTreeFolderNode = {
  type: "folder";
  name: string;
  path: string;
  children: WorkspaceFileTreeNode[];
};

type WorkspaceFileTreeFileNode = {
  type: "file";
  file: WorkspaceFile;
};

export type WorkspaceFileTreeNode = WorkspaceFileTreeFolderNode | WorkspaceFileTreeFileNode;

type MutableWorkspaceFileTreeFolder = {
  name: string;
  path: string;
  folders: Map<string, MutableWorkspaceFileTreeFolder>;
  files: WorkspaceFile[];
};

const compareText = (left: string, right: string) => left.localeCompare(right, "zh-CN");

function createFolder(name: string, path: string): MutableWorkspaceFileTreeFolder {
  return {
    name,
    path,
    folders: new Map(),
    files: [],
  };
}

function toTreeNodes(folder: MutableWorkspaceFileTreeFolder): WorkspaceFileTreeNode[] {
  const folders = [...folder.folders.values()]
    .sort((left, right) => compareText(left.name, right.name))
    .map((child) => ({
      type: "folder" as const,
      name: child.name,
      path: child.path,
      children: toTreeNodes(child),
    }));
  const files = [...folder.files]
    .sort((left, right) => compareText(left.fileName, right.fileName)
      || compareText(left.relativePath, right.relativePath))
    .map((file) => ({type: "file" as const, file}));

  return [...folders, ...files];
}

/**
 * 根据工作区文件相对路径生成目录树。目录优先于文件，并按名称排序。
 */
export function buildWorkspaceFileTree(files: WorkspaceFile[]): WorkspaceFileTreeNode[] {
  const root = createFolder("", "");

  for (const file of files) {
    const segments = file.relativePath
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);
    const folders = segments.slice(0, -1);
    let current = root;

    for (const name of folders) {
      const path = current.path ? `${current.path}/${name}` : name;
      let child = current.folders.get(name);
      if (!child) {
        child = createFolder(name, path);
        current.folders.set(name, child);
      }
      current = child;
    }

    current.files.push(file);
  }

  return toTreeNodes(root);
}

type WorkspaceFileTreeProps = {
  files: WorkspaceFile[];
  selectedPath?: string;
  onSelect: (file: WorkspaceFile) => void;
  renderFile: (file: WorkspaceFile) => ReactNode;
  className?: string;
};

/** 将路径型工作区制品渲染为可展开的文件目录。 */
export function WorkspaceFileTree({
  files,
  selectedPath,
  onSelect,
  renderFile,
  className,
}: WorkspaceFileTreeProps) {
  const nodes = buildWorkspaceFileTree(files);
  const expanded = new Set<string>();

  const collectFolderPaths = (items: WorkspaceFileTreeNode[]) => {
    for (const item of items) {
      if (item.type === "folder") {
        expanded.add(`folder:${item.path}`);
        collectFolderPaths(item.children);
      }
    }
  };
  collectFolderPaths(nodes);

  const filesByPath = new Map(files.map((file) => [file.relativePath, file]));

  const renderNodes = (items: WorkspaceFileTreeNode[]): ReactNode => items.map((item) => {
    if (item.type === "file") {
      return (
        <Fragment key={item.file.relativePath}>
          {renderFile(item.file)}
        </Fragment>
      );
    }

    return (
      <FileTreeFolder key={item.path} path={`folder:${item.path}`} name={item.name}>
        {renderNodes(item.children)}
      </FileTreeFolder>
    );
  });

  return (
    <FileTree
      className={className}
      defaultExpanded={expanded}
      selectedPath={selectedPath}
      onSelect={(path) => {
        const file = filesByPath.get(path);
        if (file) onSelect(file);
      }}
    >
      {renderNodes(nodes)}
    </FileTree>
  );
}

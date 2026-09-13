import { useCallback, useEffect, useState } from "react";
import type { BreadcrumbItem } from "../types";

const folderIdFromUrl = (): string | null =>
  new URLSearchParams(window.location.search).get("parentId");

const searchFromUrl = (): string => new URLSearchParams(window.location.search).get("search") ?? "";

export const useFolderNavigation = () => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderIdFromUrl);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", title: "Bookmarks" },
  ]);
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (searchTerm) {
      url.searchParams.set("search", searchTerm);
    } else {
      url.searchParams.delete("search");
    }
    window.history.replaceState({}, "", url.toString());
  }, [searchTerm]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentFolderId(folderIdFromUrl());
      setSearchTerm(searchFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToFolder = useCallback((folderId: string | null, folderTitle: string) => {
    setCurrentFolderId(folderId);

    const url = new URL(window.location.href);
    if (folderId !== null) {
      url.searchParams.set("parentId", folderId);
    } else {
      url.searchParams.delete("parentId");
    }
    window.history.pushState({ folderId }, "", url.toString());

    setBreadcrumbs((prev) =>
      folderId === null
        ? [{ id: "root", title: "Bookmarks" }]
        : [...prev, { id: folderId, title: folderTitle }],
    );
  }, []);

  const navigateToBreadcrumb = useCallback((id: string) => {
    const url = new URL(window.location.href);

    if (id === "root") {
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: "root", title: "Bookmarks" }]);
      url.searchParams.delete("parentId");
    } else {
      setCurrentFolderId(id);
      url.searchParams.set("parentId", id);
      setBreadcrumbs((prev) => prev.slice(0, prev.findIndex((crumb) => crumb.id === id) + 1));
    }

    window.history.pushState({ folderId: id === "root" ? null : id }, "", url.toString());
  }, []);

  return {
    currentFolderId,
    breadcrumbs,
    searchTerm,
    setSearchTerm,
    navigateToFolder,
    navigateToBreadcrumb,
  };
};

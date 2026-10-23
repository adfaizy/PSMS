import { startTransition, useEffect, useMemo, useState } from "react";
import { fetchPtbbBooks } from "./bookBankService.js";
import ptbbFallbackData from "./ptbbFallback.json";
import { ModulePageShell } from "@/components/ModulePageShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { BookOpen } from "lucide-react";

function normalize(text) {
  return (text || "").toLowerCase().trim();
}

const LAST_RESORT_THUMBNAIL = "https://placehold.co/320x420/e2e8f0/334155?text=Book";
const BOOK_BANK_URL = ptbbFallbackData.source || "https://pectaa.edu.pk/books-and-publications/";

function getThumbnailCandidates(book) {
  const candidates = [];
  if (Array.isArray(book.thumbnailCandidates)) candidates.push(...book.thumbnailCandidates);
  candidates.push(LAST_RESORT_THUMBNAIL);
  return [...new Set(candidates.filter(Boolean))];
}

function BookThumbnail({ book, title }) {
  const [idx, setIdx] = useState(0);
  const sources = useMemo(() => getThumbnailCandidates(book), [book]);
  const src = sources[idx] || LAST_RESORT_THUMBNAIL;

  return (
    <img
      src={src}
      alt={`${title} thumbnail`}
      className="aspect-[3/4] w-full rounded-md object-cover bg-muted"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        setIdx((current) => (current < sources.length - 1 ? current + 1 : current));
      }}
    />
  );
}

export function BookBankPage({ setBarSubtitle }) {
  const PAGE_SIZE = 24;
  const [classes, setClasses] = useState([]);
  const [activeClass, setActiveClass] = useState("");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setBarSubtitle?.("PECTAA books and publications");
    return () => setBarSubtitle?.("");
  }, [setBarSubtitle]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const failSafe = window.setTimeout(() => {
        if (cancelled) return;
        setLoading(false);
        setError("Could not load PECTAA books right now. Please try again later.");
      }, 18000);
      try {
        const data = await fetchPtbbBooks();
        if (cancelled) return;
        setClasses(data);
        setActiveClass(data[0]?.className || "");
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load books");
      } finally {
        window.clearTimeout(failSafe);
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentClass = useMemo(
    () => classes.find((item) => item.className === activeClass) || null,
    [classes, activeClass]
  );

  const visibleBooks = useMemo(() => {
    if (!currentClass) return [];
    const q = normalize(query);
    if (!q) return currentClass.books;
    return currentClass.books.filter((book) => normalize(book.title).includes(q));
  }, [currentClass, query]);

  const renderedBooks = useMemo(
    () => visibleBooks.slice(0, visibleCount),
    [visibleBooks, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeClass, query]);

  function openClassPlaylist() {
    if (!currentClass?.books?.length) return;
    currentClass.books.forEach((book, index) => {
      setTimeout(() => {
        window.open(book.url, "_blank", "noopener,noreferrer");
      }, index * 180);
    });
  }

  return (
    <ModulePageShell
      title="Book Bank"
      description="PECTAA books and publications"
      actions={
        <Input
          type="search"
          className="h-9 w-full min-w-0 sm:w-64"
          placeholder="Search selected class…"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            startTransition(() => setQuery(next));
          }}
          aria-label="Search books in selected class"
        />
      }
      bareContent
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {classes.length > 0 ? (
            <Tabs
              value={activeClass}
              onValueChange={(next) => startTransition(() => setActiveClass(next))}
              className="min-w-0 flex-1"
            >
              <ScrollArea className="w-full whitespace-nowrap">
                <TabsList className="inline-flex h-auto min-h-9 w-max max-w-none flex-wrap justify-start gap-1 bg-muted p-1">
                  {classes.map((item) => (
                    <TabsTrigger key={item.className} value={item.className} className="shrink-0 text-xs sm:text-sm">
                      {item.className}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Tabs>
          ) : null}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {renderedBooks.length} / {visibleBooks.length}
            </Badge>
            <Button asChild size="sm" variant="outline">
              <a href={BOOK_BANK_URL} target="_blank" rel="noreferrer">
                <BookOpen className="mr-1.5 size-3.5" />
                PECTAA catalog
              </a>
            </Button>
            {currentClass?.books?.length > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={openClassPlaylist}>
                Open playlist
              </Button>
            ) : null}
          </div>
        </div>

        {loading && (
          <p className="m-0 text-sm text-muted-foreground">Loading PECTAA class playlists…</p>
        )}
        {!loading && error && (
          <p className="m-0 text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {renderedBooks.map((book, index) => (
              <Card key={`${book.title}-${index}`} size="sm" className="overflow-hidden shadow-none">
                <CardHeader className="p-3 pb-0">
                  <BookThumbnail book={book} title={book.title} />
                </CardHeader>
                <CardContent className="space-y-1 p-3">
                  <CardTitle className="line-clamp-2 text-sm leading-snug">{book.title}</CardTitle>
                  <p className="m-0 text-xs text-muted-foreground">{currentClass?.className}</p>
                </CardContent>
                <CardFooter className="flex gap-2 p-3 pt-0">
                  <Button asChild size="sm" className="flex-1">
                    <a href={book.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <a href={book.downloadUrl} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {!loading && !error && renderedBooks.length < visibleBooks.length && (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              Load more books
            </Button>
          </div>
        )}
      </div>
    </ModulePageShell>
  );
}

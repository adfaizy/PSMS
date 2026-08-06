import { startTransition, useEffect, useMemo, useState } from "react";
import { fetchPtbbBooks } from "./bookBankService.js";
import "./BookBankPage.css";
import { Input } from "@/components/ui/input";

function normalize(text) {
  return (text || "").toLowerCase().trim();
}

function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5 5.054 5 3 5.954 3 7.132V19.5C3 20.328 3.672 21 4.5 21c1.746 0 3.332.477 4.5 1.253 1.168-.776 2.754-1.253 4.5-1.253.828 0 1.5-.672 1.5-1.5V7.132C15 5.954 12.946 5 10.5 5 8.754 5 7.168 5.477 6 6.253" />
    </svg>
  );
}

const LAST_RESORT_THUMBNAIL = "https://placehold.co/320x420/e2e8f0/334155?text=Book";

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
      className="book-card__thumb"
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
    setBarSubtitle("PTBB class-wise textbook playlists");
    return () => setBarSubtitle("");
  }, [setBarSubtitle]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const failSafe = window.setTimeout(() => {
        if (cancelled) return;
        setLoading(false);
        setError("Could not load PTBB books right now. Please try again later.");
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
    <div className="book-bank-layout">
      <section className="social-hero" aria-labelledby="book-bank-title">
        <p className="social-hero__eyebrow">Punjab textbook board</p>
        <h1 id="book-bank-title" className="social-hero__title">
          Book Bank - Class-wise playlist
        </h1>
        <form className="social-hero__form" onSubmit={(e) => e.preventDefault()}>
          <label className="sr-only" htmlFor="book-search">
            Search books in selected class
          </label>
          <Input
            id="book-search"
            type="search"
            className="social-hero__input h-10"
            placeholder="Search selected class books..."
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              startTransition(() => setQuery(next));
            }}
          />
        </form>
      </section>

      <section className="social-dir" aria-labelledby="book-playlists-title">
        <h2 id="book-playlists-title" className="sr-only">
          Class playlists
        </h2>

        <div className="social-bar">
          <div className="social-bar__cats" role="tablist" aria-label="Classes">
            {classes.map((item) => (
              <button
                key={item.className}
                type="button"
                role="tab"
                aria-selected={activeClass === item.className}
                className={activeClass === item.className ? "social-pill social-pill--on" : "social-pill"}
                onClick={() => {
                  const nextClass = item.className;
                  startTransition(() => setActiveClass(nextClass));
                }}
              >
                {item.className}
              </button>
            ))}
          </div>
          <div className="social-bar__meta">
            <span>
              Showing <strong>{renderedBooks.length}</strong> of <strong>{visibleBooks.length}</strong> books
            </span>
            {currentClass?.books?.length > 0 && (
              <button type="button" className="social-bar__mini-ai" onClick={openClassPlaylist}>
                <IconBook />
                Open full playlist
              </button>
            )}
          </div>
        </div>

        {loading && <p className="empty">Loading PTBB class playlists...</p>}
        {!loading && error && <p className="empty">{error}</p>}

        {!loading && !error && (
          <div className="directory-grid">
            {renderedBooks.map((book, index) => (
              <article key={`${book.title}-${index}`} className="book-card">
                <BookThumbnail book={book} title={book.title} />
                <div className="book-card__body">
                  <h3 className="book-card__title">{book.title}</h3>
                  <p className="book-card__class">{currentClass?.className}</p>
                  <div className="book-card__actions">
                    <a className="book-card__btn" href={book.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                    <a className="book-card__btn book-card__btn--alt" href={book.downloadUrl} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && !error && renderedBooks.length < visibleBooks.length && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "1.25rem" }}>
            <button
              type="button"
              className="social-bar__mini-ai"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              Load more books
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

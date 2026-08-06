import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "./xlsxClient.js";
import "./LibraryPage.css";
import { findStudentByRollInClass, resolveClass, formatClassDisplay, loadLibraryFromLocal, saveLibraryToLocal } from "./modules";
import { yieldToMain } from "./yieldToMain.js";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LIBRARY_EXCEL_HEADERS = ["Title", "Author", "Publisher", "ISBN", "Number of copies", "Cover URL", "Book ID"];
const LIBRARY_CLASSES = ["Nursery", "KG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function getAvailableCopies(book, borrowings) {
  const borrowedCount = borrowings.filter(b => b.bookId === book.id && !b.returnedAt).length;
  return Math.max(0, (book.copies || 1) - borrowedCount);
}

/** Local wall-clock time from an ISO date-time (issue or return). */
function formatBorrowTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

/** Merge Excel rows into library books; matches Book ID to update existing rows. */
function mergeBooksFromExcelRows(prevLibrary, matrix) {
  const headerRow = matrix[0].map((c) => String(c || "").trim().toLowerCase());
  const colIndex = (names) => {
    const list = Array.isArray(names) ? names : [names];
    const normalized = list.map((n) => String(n).trim().toLowerCase());
    for (let i = 0; i < headerRow.length; i++) {
      if (normalized.includes(headerRow[i])) return i;
    }
    return -1;
  };
  const iTitle = colIndex(["title", "book title"]);
  const iAuthor = colIndex(["author"]);
  const iPublisher = colIndex(["publisher"]);
  const iIsbn = colIndex(["isbn", "catalogue id", "catalog id"]);
  const iCopies = colIndex([
    "copies",
    "copy",
    "number of copies",
    "number of copy",
    "no of copies",
    "no. of copies",
    "qty",
    "quantity",
  ]);
  const iCover = colIndex(["cover url", "cover", "cover image url"]);
  const iId = colIndex(["book id", "id"]);
  if (iTitle < 0) {
    return { error: 'Missing a "Title" column. Export a template from this page first.' };
  }

  const byId = new Map((prevLibrary.books || []).map((b) => [b.id, { ...b }]));
  let added = 0;
  let updated = 0;
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    const title = String(row[iTitle] ?? "").trim();
    if (!title) continue;
    const author = iAuthor >= 0 ? String(row[iAuthor] ?? "").trim() : "";
    const publisher = iPublisher >= 0 ? String(row[iPublisher] ?? "").trim() : "";
    const isbn = iIsbn >= 0 ? String(row[iIsbn] ?? "").trim() : "";
    const copiesRaw = iCopies >= 0 ? row[iCopies] : 1;
    const copies = Math.max(1, parseInt(String(copiesRaw), 10) || 1);
    const coverUrl = iCover >= 0 ? String(row[iCover] ?? "").trim() : "";
    const idFromFile = iId >= 0 ? String(row[iId] ?? "").trim() : "";

    if (idFromFile && byId.has(idFromFile)) {
      const prev = byId.get(idFromFile);
      byId.set(idFromFile, {
        ...prev,
        title,
        author,
        publisher,
        isbn,
        copies,
        coverUrl,
      });
      updated++;
    } else {
      const newId = idFromFile && !byId.has(idFromFile) ? idFromFile : createId();
      byId.set(newId, {
        id: newId,
        title,
        author,
        publisher,
        isbn,
        copies,
        coverUrl,
        addedAt: new Date().toISOString(),
      });
      added++;
    }
  }
  return {
    nextLibrary: {
      ...prevLibrary,
      books: Array.from(byId.values()),
    },
    added,
    updated,
  };
}

export function LibraryPage({ setBarSubtitle, activeSchoolId, classes: classesProp = [], students: studentsProp = [] }) {
  const [library, setLibrary] = useState({ books: [], borrowings: [] });
  const [activeTab, setActiveTab] = useState("books");
  const [query, setQuery] = useState("");
  const [savedHint, setSavedHint] = useState(false);
  const [bookForm, setBookForm] = useState({ title: "", author: "", publisher: "", isbn: "", coverUrl: "", copies: "1" });
  const [borrowForm, setBorrowForm] = useState({ bookId: "", studentName: "", fatherName: "", roll: "", className: "" });
  const students = Array.isArray(studentsProp) ? studentsProp : [];
  const classes = Array.isArray(classesProp) ? classesProp : [];
  const coverInputRef = useRef(null);
  const editCoverInputRef = useRef(null);
  const excelImportRef = useRef(null);
  const [editBookId, setEditBookId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    author: "",
    publisher: "",
    isbn: "",
    coverUrl: "",
    copies: "1",
  });
  const [editBorrowingId, setEditBorrowingId] = useState(null);
  const [editBorrowForm, setEditBorrowForm] = useState({
    bookId: "",
    studentName: "",
    fatherName: "",
    roll: "",
    className: "",
    issuedAt: "",
  });

  useEffect(() => {
    setBarSubtitle("General school library management");
    return () => setBarSubtitle("");
  }, [setBarSubtitle]);

  useEffect(() => {
    const loaded = loadLibraryFromLocal(activeSchoolId);
    queueMicrotask(() => setLibrary(loaded));
  }, [activeSchoolId]);

  const visibleBooks = useMemo(() => {
    const books = library.books || [];
    const q = normalize(query);
    if (!q) return books;
    return books.filter((book) => {
      return (
        normalize(book.title).includes(q) ||
        normalize(book.author).includes(q) ||
        normalize(book.publisher).includes(q) ||
        normalize(book.isbn).includes(q)
      );
    });
  }, [library.books, query]);

  const currentBorrowings = useMemo(() => {
    return (library.borrowings || []).filter(b => !b.returnedAt);
  }, [library.borrowings]);

  const borrowingHistory = useMemo(() => {
    return (library.borrowings || []).filter(b => b.returnedAt);
  }, [library.borrowings]);

  const booksForEditBorrow = useMemo(() => {
    const all = library.books || [];
    if (!editBorrowingId) return all;
    const existing = (library.borrowings || []).find((b) => b.id === editBorrowingId);
    if (!existing || existing.returnedAt) return all;
    const others = (library.borrowings || []).filter((b) => b.id !== editBorrowingId);
    let list = all.filter((book) => {
      if (book.id === editBorrowForm.bookId) return true;
      return getAvailableCopies(book, others) > 0;
    });
    const selectedBook = all.find((b) => b.id === editBorrowForm.bookId);
    if (selectedBook && !list.some((b) => b.id === selectedBook.id)) {
      list = [selectedBook, ...list];
    }
    return list;
  }, [editBorrowingId, editBorrowForm.bookId, library.books, library.borrowings]);

  useEffect(() => {
    if (!savedHint) return undefined;
    const timer = window.setTimeout(() => setSavedHint(false), 1400);
    return () => window.clearTimeout(timer);
  }, [savedHint]);

  useEffect(() => {
    if (!editBookId) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setEditBookId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editBookId]);

  useEffect(() => {
    if (!editBorrowingId) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setEditBorrowingId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editBorrowingId]);

  function storeLibrary(nextLibrary) {
    setLibrary(nextLibrary);
    saveLibraryToLocal(activeSchoolId, nextLibrary);
    setSavedHint(true);
  }

  function updateBookForm(field, value) {
    setBookForm((current) => ({ ...current, [field]: value }));
  }

  function updateBorrowForm(field, value) {
    setBorrowForm((current) => ({ ...current, [field]: value }));
    
    // Auto-fetch student data when roll or className changes
    if (field === "roll" || field === "className") {
      const className = field === "className" ? value : borrowForm.className;
      const rollNo = field === "roll" ? value : borrowForm.roll;
      
      if (className && rollNo) {
        const classObj = resolveClass(classes, className);
        if (classObj) {
          const student = findStudentByRollInClass(students, classes, classObj.id, rollNo, null, {});
          if (student) {
            setBorrowForm((current) => ({
              ...current,
              studentName: student.name || "",
              fatherName: student.fatherName || "",
            }));
          }
        }
      }
    }
  }

  function handleCoverFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setBookForm((current) => ({ ...current, coverUrl: String(e.target?.result || "") }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  function handleEditCoverFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setEditForm((current) => ({ ...current, coverUrl: String(e.target?.result || "") }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function openEditBook(book) {
    setEditBookId(book.id);
    setEditForm({
      title: book.title || "",
      author: book.author || "",
      publisher: book.publisher || "",
      isbn: book.isbn || "",
      coverUrl: book.coverUrl || "",
      copies: String(book.copies ?? 1),
    });
  }

  function handleSaveEditBook(event) {
    event.preventDefault();
    if (!editBookId) return;
    const title = String(editForm.title || "").trim();
    if (!title) return;
    const copies = Math.max(1, parseInt(String(editForm.copies || "1").trim(), 10) || 1);
    const nextLibrary = {
      ...library,
      books: library.books.map((b) =>
        b.id === editBookId
          ? {
              ...b,
              title,
              author: String(editForm.author || "").trim(),
              publisher: String(editForm.publisher || "").trim(),
              isbn: String(editForm.isbn || "").trim(),
              coverUrl: String(editForm.coverUrl || "").trim(),
              copies,
            }
          : b
      ),
    };
    storeLibrary(nextLibrary);
    setEditBookId(null);
  }

  async function exportBooksExcel() {
    if (!activeSchoolId) {
      alert("Select an active school before exporting.");
      return;
    }
    await yieldToMain();
    const rows = (library.books || []).map((b) => [
      b.title || "",
      b.author || "",
      b.publisher || "",
      b.isbn || "",
      b.copies ?? 1,
      b.coverUrl || "",
      b.id || "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([LIBRARY_EXCEL_HEADERS, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Books");
    await yieldToMain();
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `library-books-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportExcelChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!activeSchoolId) {
      alert("Select an active school before importing.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const first = wb.SheetNames[0];
        if (!first) {
          alert("No sheets found in this file.");
          return;
        }
        const matrix = XLSX.utils.sheet_to_json(wb.Sheets[first], { header: 1, defval: "" });
        if (!matrix.length) {
          alert("The sheet is empty.");
          return;
        }
        const merged = mergeBooksFromExcelRows(library, matrix);
        if (merged.error) {
          alert(merged.error);
          return;
        }
        setLibrary(merged.nextLibrary);
        saveLibraryToLocal(activeSchoolId, merged.nextLibrary);
        setSavedHint(true);
        alert(`Import finished: ${merged.added} new book(s), ${merged.updated} updated.`);
      } catch (err) {
        alert(`Could not read this Excel file. ${err?.message || ""}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleAddBook(event) {
    event.preventDefault();
    const title = String(bookForm.title || "").trim();
    if (!title) return;

    const nextBook = {
      id: createId(),
      title,
      author: String(bookForm.author || "").trim(),
      publisher: String(bookForm.publisher || "").trim(),
      isbn: String(bookForm.isbn || "").trim(),
      coverUrl: String(bookForm.coverUrl || "").trim(),
      copies: parseInt(String(bookForm.copies || "1").trim()) || 1,
      addedAt: new Date().toISOString(),
    };

    const nextLibrary = {
      ...library,
      books: [...library.books, nextBook],
    };
    storeLibrary(nextLibrary);
    setBookForm({ title: "", author: "", publisher: "", isbn: "", coverUrl: "", copies: "1" });
    setQuery("");
  }

  function handleRemoveBook(bookId) {
    const nextLibrary = {
      ...library,
      books: library.books.filter(b => b.id !== bookId),
      borrowings: library.borrowings.filter(b => b.bookId !== bookId),
    };
    storeLibrary(nextLibrary);
  }

  function handleIssueBook(event) {
    event.preventDefault();
    const bookId = String(borrowForm.bookId || "").trim();
    const studentName = String(borrowForm.studentName || "").trim();
    if (!bookId || !studentName) return;

    const book = library.books.find(b => b.id === bookId);
    if (!book || getAvailableCopies(book, library.borrowings) <= 0) {
      alert("No copies available for this book");
      return;
    }

    const nextBorrowing = {
      id: createId(),
      bookId,
      studentName,
      fatherName: String(borrowForm.fatherName || "").trim(),
      roll: String(borrowForm.roll || "").trim(),
      className: String(borrowForm.className || "").trim(),
      issuedAt: new Date().toISOString(),
      returnedAt: null,
    };

    const nextLibrary = {
      ...library,
      borrowings: [...library.borrowings, nextBorrowing],
    };
    storeLibrary(nextLibrary);
    setBorrowForm({ bookId: "", studentName: "", fatherName: "", roll: "", className: "" });
  }

  function handleReturnBook(borrowingId) {
    const nextLibrary = {
      ...library,
      borrowings: library.borrowings.map(b =>
        b.id === borrowingId ? { ...b, returnedAt: new Date().toISOString() } : b
      ),
    };
    storeLibrary(nextLibrary);
  }

  function openEditBorrowing(borrowing) {
    setEditBorrowingId(borrowing.id);
    setEditBorrowForm({
      bookId: borrowing.bookId || "",
      studentName: borrowing.studentName || "",
      fatherName: borrowing.fatherName || "",
      roll: borrowing.roll != null ? String(borrowing.roll) : "",
      className: borrowing.className || "",
      issuedAt: borrowing.issuedAt ? new Date(borrowing.issuedAt).toISOString().slice(0, 10) : "",
    });
  }

  function updateEditBorrowForm(field, value) {
    setEditBorrowForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSaveEditBorrowing(event) {
    event.preventDefault();
    if (!editBorrowingId) return;
    const existing = library.borrowings.find((b) => b.id === editBorrowingId);
    if (!existing) return;

    const bookId = String(editBorrowForm.bookId || "").trim();
    const studentName = String(editBorrowForm.studentName || "").trim();
    if (!bookId || !studentName) {
      alert("Book and student name are required.");
      return;
    }
    const book = library.books.find((b) => b.id === bookId);
    if (!book) {
      alert("Selected book was not found.");
      return;
    }
    const isActive = !existing.returnedAt;
    if (isActive && bookId !== existing.bookId) {
      const others = library.borrowings.filter((b) => b.id !== editBorrowingId);
      if (getAvailableCopies(book, others) <= 0) {
        alert("No copies available for the selected book.");
        return;
      }
    }

    let issuedAt = existing.issuedAt;
    if (editBorrowForm.issuedAt?.trim()) {
      const d = new Date(`${editBorrowForm.issuedAt.trim()}T12:00:00`);
      if (!Number.isNaN(d.getTime())) issuedAt = d.toISOString();
    }

    const nextLibrary = {
      ...library,
      borrowings: library.borrowings.map((b) =>
        b.id === editBorrowingId
          ? {
              ...b,
              bookId,
              studentName,
              fatherName: String(editBorrowForm.fatherName || "").trim(),
              roll: String(editBorrowForm.roll || "").trim(),
              className: String(editBorrowForm.className || "").trim(),
              issuedAt,
            }
          : b
      ),
    };
    storeLibrary(nextLibrary);
    setEditBorrowingId(null);
  }

  const totalBooks = library.books.length;
  const totalBorrowings = currentBorrowings.length;

  return (
    <div className="library-page">
      <section className="library-hero" aria-labelledby="library-heading">
        <h1 id="library-heading" className="library-hero__title">
          General school library management
        </h1>
        <p className="library-hero__intro">
          Manage book inventory, track borrowings, and maintain records for students.
        </p>
      </section>

      <section className="library-controls">
        <div className="library-summary">
          <div>
            <strong>{totalBooks}</strong> books in catalog
          </div>
          <div>
            <strong>{totalBorrowings}</strong> books currently borrowed
          </div>
        </div>

        <div className="library-actions">
          <div className="library-actions__main">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="library-tabs" aria-label="Library sections">
              <TabsList>
                <TabsTrigger value="books">Books</TabsTrigger>
                <TabsTrigger value="borrowings">Borrowings</TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "books" ? (
              <div className="library-excel-actions" aria-label="Excel import and export">
                <button type="button" className="library-excel-btn" onClick={() => void exportBooksExcel()}>
                  Export Excel
                </button>
                <button
                  type="button"
                  className="library-excel-btn library-excel-btn--primary"
                  onClick={() => excelImportRef.current?.click()}
                >
                  Import Excel
                </button>
                <input
                  ref={excelImportRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="library-excel-input"
                  onChange={handleImportExcelChange}
                />
              </div>
            ) : null}
          </div>

          <div className="library-search">
            <input
              type="search"
              placeholder="Search books by title, author, publisher or ISBN"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="library-editor">
        {activeTab === "books" ? (
          <>
            <form className="library-form" onSubmit={handleAddBook}>
              <h2>Add new book</h2>
              <div className="library-form-grid">
                <label>
                  Title
                  <input
                    type="text"
                    value={bookForm.title}
                    onChange={(event) => updateBookForm("title", event.target.value)}
                    placeholder="Book title"
                    required
                  />
                </label>
                <label>
                  Author
                  <input
                    type="text"
                    value={bookForm.author}
                    onChange={(event) => updateBookForm("author", event.target.value)}
                    placeholder="Author name"
                  />
                </label>
                <label>
                  Publisher
                  <input
                    type="text"
                    value={bookForm.publisher}
                    onChange={(event) => updateBookForm("publisher", event.target.value)}
                    placeholder="Publisher"
                  />
                </label>
                <label>
                  ISBN
                  <input
                    type="text"
                    value={bookForm.isbn}
                    onChange={(event) => updateBookForm("isbn", event.target.value)}
                    placeholder="ISBN or catalogue ID"
                  />
                </label>
                <label>
                  Number of copies
                  <input
                    type="number"
                    min="1"
                    value={bookForm.copies}
                    onChange={(event) => updateBookForm("copies", event.target.value)}
                    placeholder="1"
                  />
                </label>
                <label className="library-form-full">
                  Cover image URL or gallery
                  <div className="library-cover-input-row">
                    <input
                      type="url"
                      value={bookForm.coverUrl}
                      onChange={(event) => updateBookForm("coverUrl", event.target.value)}
                      placeholder="Optional cover image URL"
                    />
                    <button
                      type="button"
                      className="library-cover-upload-btn"
                      onClick={() => coverInputRef.current?.click()}
                    >
                      Gallery
                    </button>
                  </div>
                  {bookForm.coverUrl ? (
                    <div className="library-cover-preview">
                      <img src={bookForm.coverUrl} alt="Cover preview" />
                    </div>
                  ) : null}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleCoverFileChange}
                  />
                </label>
              </div>
              <div className="library-form-actions">
                <button type="submit">Add book</button>
                <span className="library-saved-hint">{savedHint ? "Saved" : ""}</span>
              </div>
            </form>

            <div className="library-booklist">
              <div className="library-booklist__header">
                <h2>Book catalog</h2>
                <p>{visibleBooks.length} book{visibleBooks.length === 1 ? "" : "s"} found</p>
              </div>

              {visibleBooks.length === 0 ? (
                <div className="library-empty">
                  {library.books.length > 0 ? (
                    <p>No books match your search.</p>
                  ) : (
                    <p>No books added yet. Use the form to add the first entry.</p>
                  )}
                </div>
              ) : (
                <div className="library-catalog-table-wrap">
                  <table className="library-catalog-table">
                    <thead>
                      <tr>
                        <th scope="col">Cover</th>
                        <th scope="col">Title</th>
                        <th scope="col">Author</th>
                        <th scope="col">Publisher</th>
                        <th scope="col">ISBN</th>
                        <th scope="col">Number of copies</th>
                        <th scope="col">Book ID</th>
                        <th scope="col" className="library-catalog-table__th-actions">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleBooks.map((book) => (
                        <tr key={book.id}>
                          <td className="library-catalog-table__cover-cell">
                            <div className="library-catalog-table__thumb">
                              {book.coverUrl ? (
                                <img src={book.coverUrl} alt="" />
                              ) : (
                                <span className="library-catalog-table__thumb-placeholder">No cover</span>
                              )}
                            </div>
                          </td>
                          <td className="library-catalog-table__title">{book.title}</td>
                          <td>{book.author?.trim() ? book.author : "—"}</td>
                          <td>{book.publisher?.trim() ? book.publisher : "—"}</td>
                          <td>{book.isbn?.trim() ? book.isbn : "—"}</td>
                          <td>{book.copies ?? 1}</td>
                          <td className="library-catalog-table__id">
                            <span title={book.id}>{book.id}</span>
                          </td>
                          <td className="library-catalog-table__actions">
                            <button
                              type="button"
                              className="library-book-card__btn library-book-card__btn--edit"
                              onClick={() => openEditBook(book)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="library-book-card__btn library-book-card__btn--remove"
                              onClick={() => handleRemoveBook(book.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {editBookId ? (
              <div className="library-edit-modal" role="dialog" aria-modal="true" aria-labelledby="library-edit-heading">
                <button
                  type="button"
                  className="library-edit-modal__backdrop"
                  aria-label="Close edit dialog"
                  onClick={() => setEditBookId(null)}
                />
                <div className="library-edit-modal__panel">
                  <form className="library-form library-edit-modal__form" onSubmit={handleSaveEditBook}>
                    <h2 id="library-edit-heading">Edit book</h2>
                    <div className="library-form-grid">
                      <label>
                        Title
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(event) => updateEditForm("title", event.target.value)}
                          placeholder="Book title"
                          required
                        />
                      </label>
                      <label>
                        Author
                        <input
                          type="text"
                          value={editForm.author}
                          onChange={(event) => updateEditForm("author", event.target.value)}
                          placeholder="Author name"
                        />
                      </label>
                      <label>
                        Publisher
                        <input
                          type="text"
                          value={editForm.publisher}
                          onChange={(event) => updateEditForm("publisher", event.target.value)}
                          placeholder="Publisher"
                        />
                      </label>
                      <label>
                        ISBN
                        <input
                          type="text"
                          value={editForm.isbn}
                          onChange={(event) => updateEditForm("isbn", event.target.value)}
                          placeholder="ISBN or catalogue ID"
                        />
                      </label>
                      <label>
                        Number of copies
                        <input
                          type="number"
                          min="1"
                          value={editForm.copies}
                          onChange={(event) => updateEditForm("copies", event.target.value)}
                          placeholder="1"
                        />
                      </label>
                      <label className="library-form-full">
                        Cover image URL or gallery
                        <div className="library-cover-input-row">
                          <input
                            type="url"
                            value={editForm.coverUrl}
                            onChange={(event) => updateEditForm("coverUrl", event.target.value)}
                            placeholder="Optional cover image URL"
                          />
                          <button
                            type="button"
                            className="library-cover-upload-btn"
                            onClick={() => editCoverInputRef.current?.click()}
                          >
                            Gallery
                          </button>
                        </div>
                        {editForm.coverUrl ? (
                          <div className="library-cover-preview">
                            <img src={editForm.coverUrl} alt="Cover preview" />
                          </div>
                        ) : null}
                        <input
                          ref={editCoverInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={handleEditCoverFileChange}
                        />
                      </label>
                    </div>
                    <div className="library-form-actions">
                      <button type="submit">Save changes</button>
                      <button type="button" className="library-edit-modal__cancel" onClick={() => setEditBookId(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <form className="library-form" onSubmit={handleIssueBook}>
              <h2>Issue book to student</h2>
              <div className="library-form-grid">
                <label>
                  Class (required)
                  <select
                    value={borrowForm.className}
                    onChange={(event) => updateBorrowForm("className", event.target.value)}
                    required
                  >
                    <option value="">Select class</option>
                    {classes
                      .filter((cls) => cls && cls.id != null && String(cls.id).trim() !== "")
                      .map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {formatClassDisplay(cls) || cls.name || `${cls.grade}${cls.section ? `-${cls.section}` : ""}`}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Roll Number (required)
                  <input
                    type="text"
                    value={borrowForm.roll}
                    onChange={(event) => updateBorrowForm("roll", event.target.value)}
                    placeholder="Enter roll number"
                    required
                  />
                </label>
                <label>
                  Student Name
                  <input
                    type="text"
                    value={borrowForm.studentName}
                    readOnly
                    placeholder="Auto-populated from roll number"
                  />
                </label>
                <label>
                  Father Name
                  <input
                    type="text"
                    value={borrowForm.fatherName}
                    readOnly
                    placeholder="Auto-populated from roll number"
                  />
                </label>
                <label className="library-form-full">
                  Book (required)
                  <select
                    value={borrowForm.bookId}
                    onChange={(event) => updateBorrowForm("bookId", event.target.value)}
                    required
                  >
                    <option value="">Select a book</option>
                    {library.books
                      .filter(book => getAvailableCopies(book, library.borrowings) > 0)
                      .map((book) => (
                        <option key={book.id} value={book.id}>
                          {book.title} (Available: {getAvailableCopies(book, library.borrowings)})
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="library-form-actions">
                <button type="submit">Issue book</button>
                <span className="library-saved-hint">{savedHint ? "Saved" : ""}</span>
              </div>
            </form>

            <div className="library-booklist">
              <div className="library-booklist__header">
                <h2>Current borrowings</h2>
                <p>{currentBorrowings.length} book{currentBorrowings.length === 1 ? "" : "s"} borrowed</p>
              </div>

              {currentBorrowings.length === 0 ? (
                <div className="library-empty">
                  <p>No books currently borrowed.</p>
                </div>
              ) : (
                <div className="library-catalog-table-wrap">
                  <table className="library-catalog-table library-borrow-table">
                    <thead>
                      <tr>
                        <th scope="col">Cover</th>
                        <th scope="col">Book title</th>
                        <th scope="col">Student name</th>
                        <th scope="col">Father&apos;s name</th>
                        <th scope="col">Roll</th>
                        <th scope="col">Class</th>
                        <th scope="col">Issued date</th>
                        <th scope="col" className="library-borrow-table__th-time">
                          Issue time
                        </th>
                        <th scope="col" className="library-catalog-table__th-actions">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentBorrowings.map((borrowing) => {
                        const book = library.books.find((b) => b.id === borrowing.bookId);
                        const clsLabel =
                          formatClassDisplay(resolveClass(classes, borrowing.className)) || borrowing.className || "—";
                        return (
                          <tr key={borrowing.id}>
                            <td className="library-catalog-table__cover-cell">
                              <div className="library-catalog-table__thumb">
                                {book?.coverUrl ? (
                                  <img src={book.coverUrl} alt="" />
                                ) : (
                                  <span className="library-catalog-table__thumb-placeholder">No cover</span>
                                )}
                              </div>
                            </td>
                            <td className="library-catalog-table__title">{book?.title || "—"}</td>
                            <td>{borrowing.studentName || "—"}</td>
                            <td>{borrowing.fatherName?.trim() ? borrowing.fatherName : "—"}</td>
                            <td>{borrowing.roll != null && String(borrowing.roll).trim() !== "" ? borrowing.roll : "—"}</td>
                            <td>{clsLabel}</td>
                            <td>{borrowing.issuedAt ? new Date(borrowing.issuedAt).toLocaleDateString() : "—"}</td>
                            <td className="library-borrow-table__time-cell">{formatBorrowTime(borrowing.issuedAt)}</td>
                            <td className="library-catalog-table__actions">
                              <button
                                type="button"
                                className="library-book-card__btn library-book-card__btn--edit"
                                onClick={() => openEditBorrowing(borrowing)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="library-book-card__btn library-book-card__btn--return"
                                onClick={() => handleReturnBook(borrowing.id)}
                              >
                                Return
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {borrowingHistory.length > 0 && (
              <div className="library-booklist">
                <div className="library-booklist__header">
                  <h2>Borrowing history</h2>
                  <p>{borrowingHistory.length} returned book{borrowingHistory.length === 1 ? "" : "s"}</p>
                </div>
                <div className="library-catalog-table-wrap">
                  <table className="library-catalog-table library-borrow-table library-borrow-table--history">
                    <thead>
                      <tr>
                        <th scope="col">Cover</th>
                        <th scope="col">Book title</th>
                        <th scope="col">Student name</th>
                        <th scope="col">Father&apos;s name</th>
                        <th scope="col">Roll</th>
                        <th scope="col">Class</th>
                        <th scope="col">Issued date</th>
                        <th scope="col">Issue time</th>
                        <th scope="col">Returned date</th>
                        <th scope="col">Return time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borrowingHistory.map((borrowing) => {
                        const book = library.books.find((b) => b.id === borrowing.bookId);
                        const clsLabel =
                          formatClassDisplay(resolveClass(classes, borrowing.className)) || borrowing.className || "—";
                        return (
                          <tr key={borrowing.id} className="library-borrow-table__row--returned">
                            <td className="library-catalog-table__cover-cell">
                              <div className="library-catalog-table__thumb">
                                {book?.coverUrl ? (
                                  <img src={book.coverUrl} alt="" />
                                ) : (
                                  <span className="library-catalog-table__thumb-placeholder">No cover</span>
                                )}
                              </div>
                            </td>
                            <td className="library-catalog-table__title">{book?.title || "—"}</td>
                            <td>{borrowing.studentName || "—"}</td>
                            <td>{borrowing.fatherName?.trim() ? borrowing.fatherName : "—"}</td>
                            <td>{borrowing.roll != null && String(borrowing.roll).trim() !== "" ? borrowing.roll : "—"}</td>
                            <td>{clsLabel}</td>
                            <td>{borrowing.issuedAt ? new Date(borrowing.issuedAt).toLocaleDateString() : "—"}</td>
                            <td className="library-borrow-table__time-cell">{formatBorrowTime(borrowing.issuedAt)}</td>
                            <td>{borrowing.returnedAt ? new Date(borrowing.returnedAt).toLocaleDateString() : "—"}</td>
                            <td className="library-borrow-table__time-cell">{formatBorrowTime(borrowing.returnedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {editBorrowingId ? (
              <div className="library-edit-modal" role="dialog" aria-modal="true" aria-labelledby="library-edit-borrow-heading">
                <button
                  type="button"
                  className="library-edit-modal__backdrop"
                  aria-label="Close edit borrowing dialog"
                  onClick={() => setEditBorrowingId(null)}
                />
                <div className="library-edit-modal__panel library-edit-modal__panel--wide">
                  <form className="library-form library-edit-modal__form" onSubmit={handleSaveEditBorrowing}>
                    <h2 id="library-edit-borrow-heading">Edit borrowing</h2>
                    <div className="library-form-grid">
                      <label className="library-form-full">
                        Book
                        <select
                          value={editBorrowForm.bookId}
                          onChange={(event) => updateEditBorrowForm("bookId", event.target.value)}
                          required
                        >
                          <option value="">Select book</option>
                          {booksForEditBorrow.map((book) => (
                            <option key={book.id} value={book.id}>
                              {book.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Class
                        <select
                          value={editBorrowForm.className}
                          onChange={(event) => updateEditBorrowForm("className", event.target.value)}
                        >
                          <option value="">Select class</option>
                          {classes
                            .filter((cls) => cls && cls.id != null && String(cls.id).trim() !== "")
                            .map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {formatClassDisplay(cls) || cls.name || `${cls.grade}${cls.section ? `-${cls.section}` : ""}`}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Roll number
                        <input
                          type="text"
                          value={editBorrowForm.roll}
                          onChange={(event) => updateEditBorrowForm("roll", event.target.value)}
                          placeholder="Roll #"
                        />
                      </label>
                      <label>
                        Student name
                        <input
                          type="text"
                          value={editBorrowForm.studentName}
                          onChange={(event) => updateEditBorrowForm("studentName", event.target.value)}
                          required
                        />
                      </label>
                      <label className="library-form-full">
                        Father&apos;s name
                        <input
                          type="text"
                          value={editBorrowForm.fatherName}
                          onChange={(event) => updateEditBorrowForm("fatherName", event.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                      <label>
                        Issued date
                        <input
                          type="date"
                          value={editBorrowForm.issuedAt}
                          onChange={(event) => updateEditBorrowForm("issuedAt", event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="library-form-actions">
                      <button type="submit">Save changes</button>
                      <button type="button" className="library-edit-modal__cancel" onClick={() => setEditBorrowingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

const LIBRARY_STORAGE_PREFIX = "psms_library_";

export function buildLibraryStorageKey(schoolId) {
  return `${LIBRARY_STORAGE_PREFIX}${String(schoolId || "default")}`;
}

export function loadLibraryFromLocal(schoolId) {
  if (typeof window === "undefined") return { books: [], borrowings: [] };
  try {
    const raw = window.localStorage.getItem(buildLibraryStorageKey(schoolId));
    const data = raw ? JSON.parse(raw) : {};
    return {
      books: Array.isArray(data.books) ? data.books : [],
      borrowings: Array.isArray(data.borrowings) ? data.borrowings : [],
    };
  } catch {
    return { books: [], borrowings: [] };
  }
}

export function saveLibraryToLocal(schoolId, libraryData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(buildLibraryStorageKey(schoolId), JSON.stringify(libraryData));
  } catch {
    // ignore localStorage failures
  }
}

export function getAvailableCopies(book, borrowings) {
  const borrowedCount = borrowings.filter(b => b.bookId === book.id && !b.returnedAt).length;
  return Math.max(0, (book.copies || 1) - borrowedCount);
}

export function addBook(libraryData, book) {
  const newBook = { ...book, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, addedAt: new Date().toISOString() };
  return {
    ...libraryData,
    books: [...libraryData.books, newBook],
  };
}

export function removeBook(libraryData, bookId) {
  return {
    ...libraryData,
    books: libraryData.books.filter(b => b.id !== bookId),
    borrowings: libraryData.borrowings.filter(b => b.bookId !== bookId), // remove related borrowings
  };
}

export function issueBook(libraryData, borrowing) {
  const book = libraryData.books.find(b => b.id === borrowing.bookId);
  if (!book || getAvailableCopies(book, libraryData.borrowings) <= 0) {
    throw new Error("No copies available");
  }
  const newBorrowing = {
    ...borrowing,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    issuedAt: new Date().toISOString(),
    returnedAt: null,
  };
  return {
    ...libraryData,
    borrowings: [...libraryData.borrowings, newBorrowing],
  };
}

export function returnBook(libraryData, borrowingId) {
  return {
    ...libraryData,
    borrowings: libraryData.borrowings.map(b =>
      b.id === borrowingId ? { ...b, returnedAt: new Date().toISOString() } : b
    ),
  };
}

export function searchBooks(books, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return books;
  return books.filter((book) => {
    const title = String(book.title || "").toLowerCase();
    const author = String(book.author || "").toLowerCase();
    const publisher = String(book.publisher || "").toLowerCase();
    const isbn = String(book.isbn || "").toLowerCase();
    return title.includes(q) || author.includes(q) || publisher.includes(q) || isbn.includes(q);
  });
}

export function getCurrentBorrowings(borrowings) {
  return borrowings.filter(b => !b.returnedAt);
}

export function getBorrowingHistory(borrowings) {
  return borrowings.filter(b => b.returnedAt);
}

// Class-specific library operations (stub implementations)
export function getLibraryBooksForClass(schoolId, classId) {
  // Returns all books (class-specific filtering can be added when data model supports it)
  const libraryData = loadLibraryFromLocal(schoolId);
  return libraryData.books.filter(book => !book.classId || book.classId === classId);
}

export function addBookToClass(libraryData, book, classId) {
  const newBook = { ...book, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, addedAt: new Date().toISOString(), classId };
  return {
    ...libraryData,
    books: [...libraryData.books, newBook],
  };
}

export function removeBookFromClass(libraryData, bookId, classId) {
  return {
    ...libraryData,
    books: libraryData.books.filter(b => b.id !== bookId || b.classId !== classId),
    borrowings: libraryData.borrowings.filter(b => b.bookId !== bookId),
  };
}

export function searchLibraryBooks(schoolId, query) {
  const libraryData = loadLibraryFromLocal(schoolId);
  return searchBooks(libraryData.books, query);
}

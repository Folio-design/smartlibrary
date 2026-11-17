"use strict";

const STORAGE_KEY = "smartLibrary.books.v1";
const AVAILABLE = "DISPONIBLE";
const LOANED = "EMPRUNTE";
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const elements = {
	addForm: document.querySelector("#add-form"),
	title: document.querySelector("#title"),
	author: document.querySelector("#author"),
	category: document.querySelector("#category"),
	isbn: document.querySelector("#isbn"),
	categoryOptions: document.querySelector("#category-options"),
	totalCount: document.querySelector("#total-count"),
	statTotal: document.querySelector("#stat-total"),
	statAvailable: document.querySelector("#stat-available"),
	statLoaned: document.querySelector("#stat-loaned"),
	search: document.querySelector("#search-input"),
	statusFilter: document.querySelector("#status-filter"),
	categoryFilter: document.querySelector("#category-filter"),
	sortSelect: document.querySelector("#sort-select"),
	clearFilters: document.querySelector("#clear-filters"),
	visibleCount: document.querySelector("#visible-count"),
	bookList: document.querySelector("#book-list"),
	emptyState: document.querySelector("#empty-state"),
	emptyTitle: document.querySelector("#empty-title"),
	emptyDescription: document.querySelector("#empty-description"),
	emptyAdd: document.querySelector("#empty-add"),
	emptyClear: document.querySelector("#empty-clear"),
	notice: document.querySelector("#notice"),
	editDialog: document.querySelector("#edit-dialog"),
	loanDialog: document.querySelector("#loan-dialog"),
	editForm: document.querySelector("#edit-form"),
	loanForm: document.querySelector("#loan-form"),
	editId: document.querySelector("#edit-id"),
	editTitle: document.querySelector("#edit-title"),
	editAuthor: document.querySelector("#edit-author"),
	editCategory: document.querySelector("#edit-category"),
	editIsbn: document.querySelector("#edit-isbn"),
	editStatus: document.querySelector("#edit-status"),
	loanBookId: document.querySelector("#loan-book-id"),
	loanBookTitle: document.querySelector("#loan-book-title"),
	loanBorrower: document.querySelector("#loan-borrower"),
	loanDate: document.querySelector("#loan-date")
};

let storageReadFailed = false;
let noticeTimeout;
let pendingLoanEdit = null;
let books = loadBooks();

function isBook(value) {
	return value && typeof value === "object" &&
		typeof value.id === "string" && typeof value.title === "string" &&
		typeof value.author === "string" && typeof value.category === "string" &&
		typeof value.dateAdded === "string" &&
		(value.status === AVAILABLE || value.status === LOANED) &&
		(typeof value.isbn === "string" || value.isbn === undefined);
}

function loadBooks() {
	try {
		const storedValue = window.localStorage.getItem(STORAGE_KEY);
		if (storedValue === null) return [];
		const parsedBooks = JSON.parse(storedValue);
		if (!Array.isArray(parsedBooks)) throw new TypeError("Invalid library data");
		return parsedBooks.filter(isBook).map((book) => ({ ...book, isbn: book.isbn || "" }));
	} catch {
		storageReadFailed = true;
		return [];
	}
}

function saveBooks(nextBooks) {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBooks));
		books = nextBooks;
		return true;
	} catch {
		showNotice("Le stockage local est indisponible. Vos changements ne sont pas enregistrés.");
		return false;
	}
}

function normalizeIsbn(isbn) {
	return isbn.trim().replace(/[\s-]/g, "").toUpperCase();
}

function isValidIsbn(isbn) {
	if (/^\d{9}[\dX]$/.test(isbn)) {
		const checksum = [...isbn].reduce((sum, character, index) => {
			const value = character === "X" ? 10 : Number(character);
			return sum + value * (10 - index);
		}, 0);
		return checksum % 11 === 0;
	}

	if (/^\d{13}$/.test(isbn)) {
		const checksum = [...isbn.slice(0, 12)].reduce((sum, character, index) => {
			return sum + Number(character) * (index % 2 === 0 ? 1 : 3);
		}, 0);
		return (10 - (checksum % 10)) % 10 === Number(isbn[12]);
	}

	return false;
}

function createId() {
	if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
	return `book-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function localDateString() {
	const today = new Date();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${today.getFullYear()}-${month}-${day}`;
}

function showNotice(message, type = "error") {
	window.clearTimeout(noticeTimeout);
	elements.notice.textContent = message;
	elements.notice.classList.toggle("is-success", type === "success");
	elements.notice.hidden = false;
	noticeTimeout = window.setTimeout(() => { elements.notice.hidden = true; }, 5000);
}

function validateBookData({ title, author, category, isbn }, currentId = null) {
	if (!title || !author || !category) {
		showNotice("Le titre, l’auteur et la catégorie sont obligatoires.");
		return false;
	}

	const normalizedIsbn = normalizeIsbn(isbn);
	if (normalizedIsbn && !isValidIsbn(normalizedIsbn)) {
		showNotice("L’ISBN doit être un ISBN-10 ou ISBN-13 valide, avec une clé de contrôle correcte.");
		return false;
	}

	if (normalizedIsbn && books.some((book) =>
		book.id !== currentId && normalizeIsbn(book.isbn || "") === normalizedIsbn
	)) {
		showNotice("Cet ISBN est déjà associé à un autre livre.");
		return false;
	}

	return true;
}

function getFilteredBooks() {
	const query = elements.search.value.trim().toLocaleLowerCase("fr");
	const status = elements.statusFilter.value;
	const category = elements.categoryFilter.value;
	const sort = elements.sortSelect.value;

	const filteredBooks = books.filter((book) => {
		const searchableText = `${book.title} ${book.author} ${book.isbn || ""}`.toLocaleLowerCase("fr");
		return (!query || searchableText.includes(query)) &&
			(status === "all" || book.status === status) &&
			(category === "all" || book.category === category);
	});

	return filteredBooks.sort((first, second) => {
		if (sort === "date-asc") return first.dateAdded.localeCompare(second.dateAdded);
		if (sort === "title-asc") return first.title.localeCompare(second.title, "fr", { sensitivity: "base" });
		if (sort === "author-asc") return first.author.localeCompare(second.author, "fr", { sensitivity: "base" });
		return second.dateAdded.localeCompare(first.dateAdded);
	});
}

function updateCategoryControls() {
	const selectedCategory = elements.categoryFilter.value;
	const categories = [...new Set(books.map((book) => book.category))]
		.sort((first, second) => first.localeCompare(second, "fr", { sensitivity: "base" }));

	elements.categoryFilter.replaceChildren(new Option("Toutes les catégories", "all"));
	categories.forEach((category) => elements.categoryFilter.add(new Option(category, category)));
	elements.categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : "all";

	elements.categoryOptions.replaceChildren(...categories.map((category) => new Option(category, category)));
}

function createBookCard(book, index) {
	const card = document.createElement("article");
	card.className = "book-card";
	card.dataset.bookId = book.id;
	card.style.animationDelay = `${Math.min(index, 8) * 25}ms`;

	const top = document.createElement("div");
	top.className = "book-card-top";
	const category = document.createElement("span");
	category.className = "category-tag";
	category.textContent = book.category;
	const status = document.createElement("span");
	status.className = `status-tag ${book.status === LOANED ? "is-loaned" : "is-available"}`;
	status.textContent = book.status === LOANED ? "EMPRUNTÉ" : "DISPONIBLE";
	top.append(category, status);

	const title = document.createElement("h3");
	title.className = "book-title";
	title.textContent = book.title;
	const author = document.createElement("p");
	author.className = "book-author";
	author.textContent = `par ${book.author}`;

	const details = document.createElement("div");
	details.className = "book-details";
	const date = document.createElement("span");
	date.textContent = `Ajouté le ${dateFormatter.format(new Date(`${book.dateAdded}T00:00:00`))}`;
	details.append(date);
	if (book.isbn) {
		const isbn = document.createElement("span");
		isbn.textContent = `ISBN ${book.isbn}`;
		details.append(isbn);
	}
	if (book.status === LOANED && book.borrowerName) {
		const borrower = document.createElement("span");
		borrower.className = "loan-detail";
		borrower.textContent = `Emprunteur : ${book.borrowerName}`;
		details.append(borrower);
	}
	if (book.status === LOANED && book.borrowDate) {
		const borrowDate = document.createElement("span");
		borrowDate.className = "loan-detail";
		borrowDate.textContent = `Emprunté le ${dateFormatter.format(new Date(`${book.borrowDate}T00:00:00`))}`;
		details.append(borrowDate);
	}

	const actions = document.createElement("div");
	actions.className = "book-actions";
	const statusButton = document.createElement("button");
	statusButton.type = "button";
	statusButton.className = `button ${book.status === LOANED ? "button-return" : "button-borrow"}`;
	statusButton.dataset.action = "toggle-status";
	statusButton.textContent = book.status === LOANED ? "Retourner" : "Emprunter";
	const editButton = document.createElement("button");
	editButton.type = "button";
	editButton.className = "button button-quiet";
	editButton.dataset.action = "edit";
	editButton.textContent = "Modifier";
	const deleteButton = document.createElement("button");
	deleteButton.type = "button";
	deleteButton.className = "button button-quiet button-delete";
	deleteButton.dataset.action = "delete";
	deleteButton.textContent = "Supprimer";
	actions.append(statusButton, editButton, deleteButton);

	card.append(top, title, author, details, actions);
	return card;
}

function render() {
	const availableCount = books.filter((book) => book.status === AVAILABLE).length;
	const loanedCount = books.length - availableCount;
	const filteredBooks = getFilteredBooks();

	elements.totalCount.textContent = `${books.length} ${books.length > 1 ? "livres" : "livre"}`;
	elements.statTotal.textContent = String(books.length);
	elements.statAvailable.textContent = String(availableCount);
	elements.statLoaned.textContent = String(loanedCount);
	elements.visibleCount.textContent = `${filteredBooks.length} ${filteredBooks.length > 1 ? "livres affichés" : "livre affiché"}`;
	elements.bookList.replaceChildren(...filteredBooks.map(createBookCard));

	const hasBooks = books.length > 0;
	const hasVisibleBooks = filteredBooks.length > 0;
	elements.bookList.hidden = !hasVisibleBooks;
	elements.emptyState.hidden = hasVisibleBooks;
	elements.emptyState.classList.toggle("is-library-empty", !hasBooks);
	elements.emptyState.classList.toggle("is-no-results", hasBooks);
	elements.emptyAdd.hidden = hasBooks;
	elements.clearFilters.hidden = !hasBooks || !hasActiveFilters();
	elements.emptyClear.hidden = !hasBooks || !hasActiveFilters();

	if (!hasBooks) {
		elements.emptyTitle.textContent = "Bienvenue dans votre bibliothèque";
		elements.emptyDescription.textContent = "Votre collection est vide. Ajoutez un premier livre pour commencer.";
	} else {
		const query = elements.search.value.trim();
		elements.emptyTitle.textContent = query
			? `Aucun résultat pour « ${query} »`
			: "Aucun livre ne correspond aux filtres sélectionnés";
		elements.emptyDescription.textContent = "Essayez un autre terme ou effacez les filtres pour revoir votre collection.";
	}

	updateCategoryControls();
}

function hasActiveFilters() {
	return elements.search.value.trim() !== "" ||
		elements.statusFilter.value !== "all" || elements.categoryFilter.value !== "all";
}

function clearFilters() {
	elements.search.value = "";
	elements.statusFilter.value = "all";
	elements.categoryFilter.value = "all";
	render();
}

function handleAdd(event) {
	event.preventDefault();
	const bookData = {
		title: elements.title.value.trim(),
		author: elements.author.value.trim(),
		category: elements.category.value.trim(),
		isbn: elements.isbn.value.trim()
	};
	if (!validateBookData(bookData)) return;

	const newBook = { id: createId(), ...bookData, dateAdded: localDateString(), status: AVAILABLE };
	if (saveBooks([newBook, ...books])) {
		elements.addForm.reset();
		showNotice("Le livre a été ajouté à votre collection.", "success");
		render();
	}
}

function openEditDialog(book) {
	elements.editId.value = book.id;
	elements.editTitle.value = book.title;
	elements.editAuthor.value = book.author;
	elements.editCategory.value = book.category;
	elements.editIsbn.value = book.isbn || "";
	elements.editStatus.value = book.status;
	elements.editDialog.showModal();
	elements.editTitle.focus();
}

function handleEdit(event) {
	event.preventDefault();
	const id = elements.editId.value;
	const currentBook = books.find((book) => book.id === id);
	if (!currentBook) return;
	const bookData = {
		title: elements.editTitle.value.trim(),
		author: elements.editAuthor.value.trim(),
		category: elements.editCategory.value.trim(),
		isbn: elements.editIsbn.value.trim()
	};
	if (!validateBookData(bookData, id)) return;

	const nextStatus = elements.editStatus.value;
	if (nextStatus === LOANED && currentBook.status !== LOANED) {
		elements.editDialog.close();
		window.setTimeout(() => openLoanDialog({ ...currentBook, ...bookData }, { id, bookData }), 0);
		return;
	}

	const nextBooks = books.map((book) => {
		if (book.id !== id) return book;
		const updatedBook = { ...book, ...bookData, status: nextStatus };
		if (nextStatus === AVAILABLE) {
			delete updatedBook.borrowerName;
			delete updatedBook.borrowDate;
		}
		return updatedBook;
	});
	if (saveBooks(nextBooks)) {
		elements.editDialog.close();
		showNotice("Les modifications ont été enregistrées.", "success");
		render();
	}
}

function openLoanDialog(book, edit = null) {
	if (book.status !== AVAILABLE) {
		showNotice("Ce livre est déjà emprunté. Enregistrez son retour avant un nouvel emprunt.");
		return;
	}

	pendingLoanEdit = edit;
	elements.loanBookId.value = book.id;
	elements.loanBookTitle.textContent = book.title;
	elements.loanBorrower.value = book.borrowerName || "";
	elements.loanDate.value = book.borrowDate || localDateString();
	elements.loanDate.max = localDateString();
	elements.loanDialog.showModal();
	elements.loanBorrower.focus();
}

function handleLoan(event) {
	event.preventDefault();
	const id = elements.loanBookId.value;
	const currentBook = books.find((book) => book.id === id);
	if (!currentBook) return;
	if (currentBook.status !== AVAILABLE) {
		elements.loanDialog.close();
		showNotice("Ce livre est déjà emprunté. Enregistrez son retour avant un nouvel emprunt.");
		render();
		return;
	}

	const borrowerName = elements.loanBorrower.value.trim();
	const borrowDate = elements.loanDate.value;
	if (!borrowerName || !borrowDate || borrowDate > localDateString()) return;

	const editData = pendingLoanEdit?.id === id ? pendingLoanEdit.bookData : {};
	const nextBooks = books.map((book) => book.id === id
		? { ...book, ...editData, status: LOANED, borrowerName, borrowDate }
		: book);
	if (saveBooks(nextBooks)) {
		elements.loanDialog.close();
		showNotice("L’emprunt a été enregistré.", "success");
		render();
	}
}

function handleBookAction(event) {
	const button = event.target.closest("button[data-action]");
	if (!button) return;
	const card = button.closest("[data-book-id]");
	const book = books.find((item) => item.id === card?.dataset.bookId);
	if (!book) return;

	if (button.dataset.action === "toggle-status") {
		if (book.status === AVAILABLE) {
			openLoanDialog(book);
			return;
		}
		const nextBooks = books.map((item) => {
			if (item.id !== book.id) return item;
			const returnedBook = { ...item, status: AVAILABLE };
			delete returnedBook.borrowerName;
			delete returnedBook.borrowDate;
			return returnedBook;
		});
		if (saveBooks(nextBooks)) render();
		return;
	}

	if (button.dataset.action === "edit") {
		openEditDialog(book);
		return;
	}

	if (button.dataset.action === "delete" && window.confirm(`Supprimer « ${book.title} » de la collection ?`)) {
		if (saveBooks(books.filter((item) => item.id !== book.id))) {
			showNotice("Le livre a été supprimé.", "success");
			render();
		}
	}
}

elements.addForm.addEventListener("submit", handleAdd);
elements.editForm.addEventListener("submit", handleEdit);
elements.loanForm.addEventListener("submit", handleLoan);
elements.bookList.addEventListener("click", handleBookAction);
elements.search.addEventListener("input", render);
elements.statusFilter.addEventListener("change", render);
elements.categoryFilter.addEventListener("change", render);
elements.sortSelect.addEventListener("change", render);
elements.clearFilters.addEventListener("click", clearFilters);
elements.emptyClear.addEventListener("click", clearFilters);
elements.emptyAdd.addEventListener("click", () => elements.title.focus());
elements.editDialog.querySelectorAll("[data-close-dialog]").forEach((button) => {
	button.addEventListener("click", () => elements.editDialog.close());
});
elements.loanDialog.querySelectorAll("[data-close-loan]").forEach((button) => {
	button.addEventListener("click", () => elements.loanDialog.close());
});
elements.loanDialog.addEventListener("close", () => {
	elements.loanForm.reset();
	pendingLoanEdit = null;
});

render();
if (storageReadFailed) {
	showNotice("Les données enregistrées sont illisibles ou le stockage local est indisponible. Une collection vide est affichée.");
}

"use strict";

/* =========================================
   STUDYTASK - COMPLETE JAVASCRIPT
========================================= */

const USERS_KEY = "studyTaskUsers_v2";
const SESSION_KEY = "studyTaskSession_v2";

let currentUser = null;
let tasks = [];
let activeFilter = "all";
let editingTaskId = null;
let pendingDialogAction = null;

/* ---------- ELEMENT HELPERS ---------- */

const $ = id => document.getElementById(id);

function showMessage(element, message, type = "error") {
  if (!element) return;

  element.textContent = message;
  element.className = "message " + type;
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.error("Storage read error:", error);
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Storage write error:", error);
    alert("Unable to save data. Check your browser storage.");
    return false;
  }
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getUsers() {
  const users = readStorage(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

function getTasksKey() {
  return "studyTaskList_" + currentUser.email;
}

function makeId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return "No due date";

  const parts = dateString.split("-");

  if (parts.length !== 3) return dateString;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isOverdue(task) {
  return Boolean(
    task.dueDate &&
    task.dueDate < getToday() &&
    !task.completed
  );
}

/* ---------- PAGE NAVIGATION ---------- */

function showPage(pageId) {
  ["loginPage", "registerPage", "dashboardPage"].forEach(id => {
    $(id).hidden = id !== pageId;
  });

  window.scrollTo({ top: 0, behavior: "auto" });
}

document.querySelectorAll("[data-show]").forEach(button => {
  button.addEventListener("click", () => {
    const pageId = button.dataset.show;
    showPage(pageId);

    document.querySelectorAll(".message").forEach(message => {
      showMessage(message, "");
    });
  });
});

/* ---------- REGISTRATION ---------- */

$("registerForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("registerName").value.trim();
  const email = normalizeEmail($("registerEmail").value);
  const password = $("registerPassword").value;
  const confirmPassword = $("confirmPassword").value;
  const message = $("registerMessage");

  if (!name || !email || !password || !confirmPassword) {
    showMessage(message, "Please complete every required field.");
    return;
  }

  if (password.length < 8) {
    showMessage(message,
      "Your password must contain at least 8 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showMessage(message, "The passwords do not match.");
    return;
  }

  const users = getUsers();

  if (users.some(user => user.email === email)) {
    showMessage(message,
      "An account with this email already exists.");
    return;
  }

  /*
    Demo only: passwords are stored in browser storage.
    Use a secure backend for real authentication.
  */
  users.push({
    id: makeId(),
    name,
    email,
    password
  });

  if (!saveJSON(USERS_KEY, users)) return;

  $("registerForm").reset();

  showMessage(
    message,
    "Registration successful! You can now log in.",
    "success"
  );

  setTimeout(() => {
    showPage("loginPage");
    $("loginEmail").value = email;
    $("loginPassword").focus();
    showMessage($("loginMessage"),
      "Account created. Please log in.", "success");
    showMessage(message, "");
  }, 500);
});

/* ---------- LOGIN ---------- */

$("loginForm").addEventListener("submit", event => {
  event.preventDefault();

  const email = normalizeEmail($("loginEmail").value);
  const password = $("loginPassword").value;
  const message = $("loginMessage");

  const user = getUsers().find(item =>
    item.email === email && item.password === password
  );

  if (!user) {
    showMessage(message,
      "Incorrect email or password. Please try again.");
    return;
  }

  currentUser = user;

  if (!saveJSON(SESSION_KEY, { email: user.email })) {
    currentUser = null;
    return;
  }

  $("loginForm").reset();
  showMessage(message, "");
  openDashboard();
});

/* ---------- SESSION AND DASHBOARD ---------- */

function openDashboard() {
  if (!currentUser) {
    showPage("loginPage");
    return;
  }

  $("welcomeUser").textContent = "Hello, " + currentUser.name;

  showPage("dashboardPage");
  loadTasks();
  resetTaskForm();
  renderTasks();
}

function loadTasks() {
  const savedTasks = readStorage(getTasksKey(), []);
  tasks = Array.isArray(savedTasks) ? savedTasks : [];

  // Keep old saved tasks compatible with newer features.
  tasks = tasks.map(task => ({
    id: task.id || makeId(),
    title: String(task.title || ""),
    subject: String(task.subject || ""),
    dueDate: task.dueDate || "",
    priority: ["High", "Normal", "Low"].includes(task.priority)
      ? task.priority
      : "Normal",
    category: task.category || "Assignment",
    notes: task.notes || "",
    completed: Boolean(task.completed),
    createdAt: Number(task.createdAt) || Date.now()
  }));
}

function persistTasks() {
  return saveJSON(getTasksKey(), tasks);
}

/* ---------- TASK FORM ---------- */

function resetTaskForm() {
  $("taskForm").reset();
  editingTaskId = null;

  $("taskForm").querySelector('[type="submit"]').textContent =
    "+ Add Task";

  $("cancelEditBtn").hidden = true;
  showMessage($("taskMessage"), "");
}

$("taskForm").addEventListener("submit", event => {
  event.preventDefault();

  if (!currentUser) return;

  const title = $("taskTitle").value.trim();
  const subject = $("taskSubject").value.trim();
  const dueDate = $("taskDueDate").value;
  const priority = $("taskPriority").value;
  const category = $("taskCategory").value;
  const notes = $("taskNotes").value.trim();

  if (!title) {
    showMessage($("taskMessage"), "Please enter a task title.");
    $("taskTitle").focus();
    return;
  }

  if (!subject) {
    showMessage($("taskMessage"),
      "Please enter the subject or course name.");
    $("taskSubject").focus();
    return;
  }

  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    showMessage($("taskMessage"), "Please enter a valid due date.");
    return;
  }

  const previousTasks = tasks.map(task => ({ ...task }));

  if (editingTaskId) {
    const task = tasks.find(item => item.id === editingTaskId);

    if (!task) {
      showMessage($("taskMessage"),
        "This task could not be found. Please try again.");
      resetTaskForm();
      return;
    }

    task.title = title;
    task.subject = subject;
    task.dueDate = dueDate;
    task.priority = priority;
    task.category = category;
    task.notes = notes;

    if (!persistTasks()) {
      tasks = previousTasks;
      return;
    }

    showMessage($("taskMessage"),
      "Task updated successfully!", "success");
  } else {
    tasks.unshift({
      id: makeId(),
      title,
      subject,
      dueDate,
      priority,
      category,
      notes,
      completed: false,
      createdAt: Date.now()
    });

    if (!persistTasks()) {
      tasks = previousTasks;
      return;
    }

    showMessage($("taskMessage"),
      "Task added successfully!", "success");
  }

  const messageText = editingTaskId
    ? "Task updated successfully!"
    : "Task saved successfully!";

  // Keep the feedback clear after the task form is reset.
  resetTaskForm();
  showMessage($("taskMessage"), messageText, "success");

  renderTasks();
});

/* ---------- EDIT TASK ---------- */

function editTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  editingTaskId = id;

  $("taskTitle").value = task.title;
  $("taskSubject").value = task.subject;
  $("taskDueDate").value = task.dueDate;
  $("taskPriority").value = task.priority;
  $("taskCategory").value = task.category;
  $("taskNotes").value = task.notes;

  $("taskForm").querySelector('[type="submit"]').textContent =
    "Save Changes";

  $("cancelEditBtn").hidden = false;

  showMessage($("taskMessage"),
    "Editing task. Make your changes below.", "success");

  $("taskForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  $("taskTitle").focus({ preventScroll: true });
}

$("cancelEditBtn").addEventListener("click", resetTaskForm);

/* ---------- COMPLETE / REOPEN TASK ---------- */

function toggleTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  const previousStatus = task.completed;
  task.completed = !task.completed;

  if (!persistTasks()) {
    task.completed = previousStatus;
    renderTasks();
    return;
  }

  renderTasks();
}

/* ---------- CONFIRMATION DIALOG ---------- */

function askConfirmation(title, message, action) {
  const dialog = $("confirmDialog");

  $("dialogTitle").textContent = title;
  $("dialogMessage").textContent = message;

  pendingDialogAction = action;

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    const confirmed = window.confirm(message);
    const callback = pendingDialogAction;
    pendingDialogAction = null;

    if (confirmed && callback) callback();
  }
}

$("dialogCancel").addEventListener("click", () => {
  pendingDialogAction = null;
  $("confirmDialog").close();
});

$("dialogConfirm").addEventListener("click", () => {
  const callback = pendingDialogAction;
  pendingDialogAction = null;
  $("confirmDialog").close();

  if (callback) callback();
});

/* ---------- DELETE A TASK ---------- */

function deleteTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  askConfirmation(
    "Delete Task",
    `Delete "${task.title}"? This action cannot be undone.`,
    () => {
      const previousTasks = tasks;
      tasks = tasks.filter(item => item.id !== id);

      if (!persistTasks()) {
        tasks = previousTasks;
        return;
      }

      if (editingTaskId === id) resetTaskForm();

      renderTasks();
      showMessage($("taskMessage"),
        "Task deleted successfully.", "success");
    }
  );
}

/* ---------- SEARCH, FILTERS AND SORTING ---------- */

$("searchTasks").addEventListener("input", renderTasks);
$("sortTasks").addEventListener("change", renderTasks);

document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;

    document.querySelectorAll("[data-filter]").forEach(item => {
      const selected = item === button;

      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });

    renderTasks();
  });
});

function getVisibleTasks() {
  const searchTerm = $("searchTasks").value.trim().toLowerCase();

  const visible = tasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm) ||
      task.subject.toLowerCase().includes(searchTerm) ||
      task.category.toLowerCase().includes(searchTerm) ||
      task.notes.toLowerCase().includes(searchTerm);

    let matchesFilter = true;

    if (activeFilter === "pending") {
      matchesFilter = !task.completed;
    } else if (activeFilter === "completed") {
      matchesFilter = task.completed;
    } else if (activeFilter === "overdue") {
      matchesFilter = isOverdue(task);
    }

    return matchesSearch && matchesFilter;
  });

  const sort = $("sortTasks").value;

  const priorityOrder = {
    High: 1,
    Normal: 2,
    Low: 3
  };

  visible.sort((a, b) => {
    if (sort === "oldest") {
      return a.createdAt - b.createdAt;
    }

    if (sort === "dueDate") {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }

    if (sort === "priority") {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }

    return b.createdAt - a.createdAt;
  });

  return visible;
}

/* ---------- TASK DISPLAY ---------- */

// Create elements with textContent to avoid interpreting
// user-entered task titles or notes as HTML.
function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function createTaskCard(task) {
  const card = createElement(
    "article",
    "task-card" + (task.completed ? " completed" : "")
  );

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-check";
  checkbox.checked = task.completed;
  checkbox.setAttribute(
    "aria-label",
    "Mark " + task.title + " as complete"
  );

  checkbox.addEventListener("change", () => toggleTask(task.id));

  const content = createElement("div", "task-content");
  const title = createElement("h3", "task-title", task.title);
  content.appendChild(title);

  const meta = createElement("div", "task-meta");

  meta.appendChild(createElement("span", "", "📚 " + task.subject));
  meta.appendChild(
    createElement("span", "", "📅 " + formatDate(task.dueDate))
  );

  meta.appendChild(
    createElement("span", "priority " + task.priority,
      task.priority + " priority")
  );

  meta.appendChild(
    createElement("span", "category-badge", task.category)
  );

  if (isOverdue(task)) {
    meta.appendChild(
      createElement("span", "status-badge overdue", "Overdue")
    );
  } else if (
    task.dueDate === getToday() &&
    !task.completed
  ) {
    meta.appendChild(
      createElement("span", "status-badge overdue", "Due today")
    );
  }

  content.appendChild(meta);

  if (task.notes) {
    content.appendChild(
      createElement("p", "task-notes", task.notes)
    );
  }

  const actions = createElement("div", "task-actions");

  const editButton = createElement(
    "button", "task-action-btn", "Edit"
  );
  editButton.type = "button";
  editButton.setAttribute("aria-label", "Edit " + task.title);
  editButton.addEventListener("click", () => editTask(task.id));

  const deleteButton = createElement(
    "button", "task-action-btn delete", "Delete"
  );
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", "Delete " + task.title);
  deleteButton.addEventListener("click", () => deleteTask(task.id));

  actions.append(editButton, deleteButton);
  card.append(checkbox, content, actions);

  return card;
}

/* ---------- STATISTICS AND PROGRESS ---------- */

function updateStatistics() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const pending = total - completed;
  const overdue = tasks.filter(isOverdue).length;

  const percent = total === 0
    ? 0
    : Math.round((completed / total) * 100);

  $("totalTasks").textContent = total;
  $("completedTasks").textContent = completed;
  $("pendingTasks").textContent = pending;
  $("overdueTasks").textContent = overdue;

  $("progressPercent").textContent = percent + "%";
  $("progressFill").style.width = percent + "%";
  $("progressBar").setAttribute("aria-valuenow", String(percent));
}

/* ---------- RENDER THE TASK LIST ---------- */

function renderTasks() {
  if (!currentUser) return;

  updateStatistics();

  const list = $("taskList");
  const emptyMessage = $("emptyMessage");

  list.replaceChildren();

  const visibleTasks = getVisibleTasks();

  visibleTasks.forEach(task => {
    list.appendChild(createTaskCard(task));
  });

  emptyMessage.hidden = visibleTasks.length !== 0;

  if (visibleTasks.length === 0) {
    const heading = emptyMessage.querySelector("h3");
    const description = emptyMessage.querySelector("p");

    if (tasks.length === 0) {
      heading.textContent = "No tasks yet";
      description.textContent =
        "Add your first study task to get started!";
    } else {
      heading.textContent = "No matching tasks";
      description.textContent =
        "Try another search or filter to find your tasks.";
    }
  }

  $("taskCount").textContent =
    `${visibleTasks.length} of ${tasks.length} task(s) shown`;
}

/* ---------- CLEAR COMPLETED TASKS ---------- */

$("clearCompletedBtn").addEventListener("click", () => {
  const completed = tasks.filter(task => task.completed);

  if (completed.length === 0) {
    showMessage($("taskMessage"),
      "There are no completed tasks to clear.");
    return;
  }

  askConfirmation(
    "Clear Completed Tasks",
    `Delete all ${completed.length} completed task(s)?`,
    () => {
      const previousTasks = tasks;
      tasks = tasks.filter(task => !task.completed);

      if (!persistTasks()) {
        tasks = previousTasks;
        return;
      }

      if (editingTaskId &&
          previousTasks.some(task =>
            task.id === editingTaskId && task.completed
          )) {
        resetTaskForm();
      }

      renderTasks();
      showMessage($("taskMessage"),
        "Completed tasks cleared successfully.", "success");
    }
  );
});

/* ---------- LOGOUT ---------- */

$("logoutBtn").addEventListener("click", () => {
  currentUser = null;
  tasks = [];
  editingTaskId = null;

  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error("Could not clear session:", error);
  }

  $("loginForm").reset();
  $("registerForm").reset();
  resetTaskForm();
  showMessage($("loginMessage"), "");
  showPage("loginPage");
});

/* ---------- INITIALIZE APPLICATION ---------- */

function initializeApp() {
  const session = readStorage(SESSION_KEY, null);

  if (session && session.email) {
    const user = getUsers().find(
      item => item.email === session.email
    );

    if (user) {
      currentUser = user;
      openDashboard();
      return;
    }

    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.error(error);
    }
  }

  showPage("loginPage");
}

initializeApp();
<div align="center">
<img src="./assets/images/FT logo.png" width="350px"/>

![HTML](https://img.shields.io/badge/HTML-E34F26?logo=html&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-1572B6?logo=css&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![PHP](https://img.shields.io/badge/PHP-3f0452?logo=PHP&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-black?logo=MySQL&logoColor=white)
![No Framework](https://img.shields.io/badge/framework-none-lightgrey)
</div>

## 1. Introduction
**Fitness Tracker (FT)** is a web app for tracking meals, exercises, steps, and progress reports. It is the project for the Fundamentals of Web Programming course, made by Group (1):

### Roles of the members

---

| Name | Frontend | Backend | Else |
|---|---|---|---|
| Reda Alqatifi | welcome, home pages | database, home folder, includes(auth, db, response) | SRS, project architecture |
| Hassan Almomatten | reports page | reports folder, includes(helpers, formulas) | --- |
| Mohammed Alkhalifa | registration and profile pages | registraton, profile folders | --- |
| Ahmed Kouzi | exercises page | exercises folder | --- |
| Redwan Talib | diet page | diet folder | --- |

<br>

**Instructor:** Dr. Khalid Riadh

---

## 2. Features

| Page | What it does |
|---|---|
| **Welcome** | Landing page with its own navbar, and links to sign in or register. |
| **Login / Register** | Account forms. |
| **Home** | Daily summary of the user's fitness status. |
| **Diet** | Add, edit, and delete meals, choose a diet mode, and see the daily totals against the targets. |
| **Exercises** | Add, edit, and delete exercises with training days, choose an exercise mode, and enter today's steps (used for the burned calories). |
| **Reports** | Progress reports for a chosen period, including a custom From/To date range. |
| **Profile** | Edit the profile, change the password, or delete the account. |

All pages share a global header and footer, support **dark mode**, and have a **responsive layout**.

---

## 3. Project Structure

```
Fitness Tracker/
├── assets/
│   ├── ER_Diagram.png
│   ├── Logical_Schema.png
│   ├── icons/                      # GitHub, LinkedIn
│   └── images/                     # logo and card images
│
├── docs/
│   ├── SRS - FT (No IDs).docx / .pdf
│   ├── GitHub.docx / .pdf
│   ├── Notes.docx
│   └── edits.md                    # log of the backend-integration changes
│
├── src/
│   ├── Frontend/
│   │   ├── index.html
│   │   ├── global.css              # shared variables and styles
│   │   ├── navbar.css              # global header
│   │   ├── footer.css              # global footer
│   │   ├── main.js                 # dark mode, logout, getFromBackend(), sendToBackend()
│   │   └── Pages/
│   │       ├── welcome/            # welcome.html, welcome.css, welcome_navbar.css, welcome.js
│   │       ├── Forms/              # login.html, register.html, Form.css, Forms.js
│   │       ├── home/               # home.html, home.css, home.js
│   │       ├── diet/               # diet.html, diet.css, diet.js
│   │       ├── exercises/          # exercises.html, exercises.css, exercises.js
│   │       ├── reports/            # reports.html, reports.css, reports.js
│   │       └── profile/            # profile.html, profile.css, profile.js
│   │
│   ├── Backend/
│   │   ├── index.php
│   │   ├── config/
│   │   │   └── config.example.php  # copy to config.php (git-ignored)
│   │   ├── includes/               # db.php, auth.php, response.php, helpers.php, farmulas.php
│   │   ├── Registration/           # login.php, register.php, logout.php
│   │   ├── Home/                   # home.php
│   │   ├── Diet/                   # diet.php, diet_mode.php, meal_add.php, meal_edit.php, meal_delete.php
│   │   ├── Exercises/              # exercises.php, exercise_mode.php, exercise_add.php, exercise_edit.php, exercise_delete.php, steps.php
│   │   ├── Reports/                # reports.php
│   │   └── Profile/                # profile.php, edit_profile.php, change_password.php, delete_account.php
│   │
│   └── Database/
│       └── FT.SQL
│
├── .gitignore
└── README.md
```

---

## 4. How the Frontend Talks to the Backend

Each page calls the PHP files using two shared functions in `main.js`:

| Function | What it does |
|---|---|
| `getFromBackend(api)` | GET request. Returns the JSON, or `null` on 401 (and redirects to the login page). |
| `sendToBackend(api, formData, messageElement, { redirectOn401 })` | POST request. Returns `true`/`false` and shows the backend's `message` in `messageElement`. |

The API paths are written in brackets, for example `../../../Backend/Registration/[login.php]`. The brackets are removed as each PHP file is finished. Until then, the pages fall back to demo data (and `localStorage` for custom exercises), so the frontend works on its own.

See [`docs/edits.md`](./docs/edits.md) for the full list of endpoints and changes.

---

## 5. Running Locally

1. Install a local PHP + MySQL server (for example [XAMPP](https://www.apachefriends.org/)).
2. Put the project folder inside the server's web root (for example `xampp/htdocs/`).
3. Create the database by importing `src/Database/FT.SQL` in phpMyAdmin.
4. Copy `src/Backend/config/config.example.php` to `src/Backend/config/config.php` and fill in your database settings. `config.php` is git-ignored, so your password is never committed.
5. Open `http://localhost/<project-folder>/src/Frontend/Pages/welcome/welcome.html` in the browser.

> To work on the frontend only, open the HTML pages directly. They use demo data when the backend isn't available.

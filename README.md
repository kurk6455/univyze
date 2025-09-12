---

# 🎮 Gamified Learning App  

An interactive web application that enhances the educational journey of students through gamified learning, university admission support, expert counseling, and financial opportunities.  

## 🚀 Project Overview

The **Gamified Learning App** is built to make education more engaging and rewarding. Students can track their academic journey through a **game-like progress tracker**, get **personalized counseling**, explore **freelancer job opportunities**, and use an **AI-powered chatbot** for guidance.

Our goal is to blend **learning, motivation, and career support** into one seamless experience.

---

## ✨ Features

* 🎨 **Interactive Home Page** – Modern UI with navigation to core features.
* 🔐 **User Authentication** – Secure sign-up & sign-in with form validation.
* 🕹️ **Gamified Progress Tracker** – Game-inspired interface to track progress with local storage.
* 🤖 **AI Chatbot** – Smart chatbot for student assistance with a sleek UI.
* 💼 **Freelancer Opportunities** – Explore job listings for part-time and freelance work.
* 📱 **Responsive Design** – Mobile-first approach with Tailwind CSS.
* ⚡ **Loading Animations** – Smooth animations with motivational quotes.

---

## 🛠️ Tech Stack

**Frontend:**

* HTML, CSS, JavaScript
* Tailwind CSS
* jQuery
* LottieFiles (animations)

**Backend:**

* Node.js + Express.js
* MongoDB + Mongoose
* JWT Authentication
* Bcrypt (password hashing)
* Zod (input validation)

**Dependencies:**

* Axios (HTTP requests)
* dotenv (environment variables)

---

## 📂 File Structure

```
Gamified-learning-app/
├── node_modules/           # Dependencies
├── public/                 # Static assets
│   ├── index.html          # Landing page
│   ├── signup.html         # Sign-up page
│   ├── signin.html         # Sign-in page
│   ├── loading.html        # Animated loading page
├── package.json            # Metadata & dependencies
├── package-lock.json       # Dependency lock file
├── server.js               # Express server & routes
├── db.js                   # MongoDB schema & models
└── .gitignore              # Ignored files
```

---

## ⚙️ Prerequisites

* [Node.js](https://nodejs.org/) (v14+)
* [MongoDB](https://www.mongodb.com/atlas) (local or Atlas cloud)
* [Git](https://git-scm.com/)
* GitHub account

---

## 🚀 Setup Instructions

1️⃣ **Clone the Repository**

```bash
git clone https://github.com/your-username/Gamified-learning-app.git
cd Gamified-learning-app
```

2️⃣ **Install Dependencies**

```bash
npm install
```

3️⃣ **Configure Environment Variables**
Create a `.env` file in the root:

```env
JWT_SECRET=your_jwt_secret_key
MONGODB_URI=your_mongodb_connection_string
```

4️⃣ **Run the Application**

```bash
npm start
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎯 Usage

* 🏠 **Home Page** – Navigate across Home, Process, Freelancer, Game, Contact.
* 👤 **Sign Up / Sign In** – Register with academic details (.edu email required).
* 🕹️ **Progress Tracker** – Track your learning progress stage by stage.
* 🤖 **Chatbot** – Get answers & guidance from the AI assistant.
* 💼 **Freelancer Jobs** – Explore tutoring, freelance writing, part-time work.

---

## 🐞 Known Issues

* 🔗 **Broken Links** – `getStartedBtn` & `counsellingBtn` redirect incorrectly.
* 📜 **Chatbot Scrolling** – `scrollToBottom` function is not working.
* 📧 **Newsletter Form** – Lacks backend endpoint for subscription handling.

---

## 🔮 Future Improvements

* ✅ Fix navigation link redirects.
* ✅ Improve chatbot auto-scroll.
* ✅ Implement newsletter subscription API.
* ✅ Enhance chatbot with AI APIs (e.g., OpenAI).
* ✅ Add unit & integration tests.

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a new branch

   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes

   ```bash
   git commit -m "Add your feature"
   ```
4. Push your branch

   ```bash
   git push origin feature/your-feature
   ```
5. Open a Pull Request 🎉

---

## 📬 Contact

📧 Email: [support@univyze.com](mailto:support@univyze.com)
📞 Phone: +91 1234567890

---

Made with ❤️ by **The Univyze Team** • © 2025 All Rights Reserved

---

Would you like me to also design a **banner image** (like a hero section mockup) for your README so it looks even more professional on GitHub?

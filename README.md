# Arch Trainer (Sandbox & Test / Песочница и Тест)

**[EN]** Arch Trainer is an experimental sandbox environment designed to practice Arch Linux installation logic directly in the browser. This is a **testing and learning project** created to explore in-browser virtualization and interactive educational interfaces.

**[RU]** Arch Trainer — это экспериментальная песочница, предназначенная для практики логики установки Arch Linux прямо в браузере. Это **тестовый и учебный проект**, созданный для изучения виртуализации в браузере и интерактивных образовательных интерфейсов.

---

## 🚀 Live Demo / Живое демо
**[https://radik097.github.io/Arch_game/](https://radik097.github.io/Arch_game/)**

---

## 🏗️ Core Features / Основные возможности

- **V86 Virtual Machine Integration**: Boot a real Arch Linux 32-bit ISO directly in your browser using the `v86` emulator.
  **Интеграция ВМ V86**: Загрузка реального образа Arch Linux 32-bit прямо в браузере с помощью эмулятора `v86`.
- **Interactive Graph UI**: Navigate the installation stages via a premium, glowing node-based interface.
  **Интерактивный граф**: Навигация по этапам установки через премиальный интерфейс с узлами и эффектами свечения.
- **Automated CI/CD**: Seamless deployment to GitHub Pages with automated binary asset fetching during the build.
  **Автоматизированный CI/CD**: Бесшовный деплой на GitHub Pages с автоматическим получением бинарных файлов во время сборки.

---

## 🛠️ Local Development / Локальная разработка

```bash
# Clone the repository / Клонируйте репозиторий
git clone https://github.com/radik097/Arch_game.git
cd Arch_game

# Install dependencies / Установите зависимости
npm install --legacy-peer-deps

# Start dev server / Запустите сервер разработки
npm run dev
```

---

## 📜 Architecture / Архитектура

- `src/features/vm`: V86 engine integration and VM panel UI.
- `src/features/landing`: Interactive React-Flow based graph landing page.
- `src/features/simulator`: Command simulation and state validation core.
- `.github/workflows`: CI/CD pipeline for GitHub Pages deployment.

---

## ⚠️ Disclaimer / Дисклеймер

**[EN]** This project is currently in a **"test and try"** phase. It is a sandbox for architectural experimentation and is not intended for mission-critical training.
**[RU]** Этот проект находится в фазе **"тестирования и проб"**. Это песочница для архитектурных экспериментов, не предназначенная для критически важного обучения.

---
MIT License | Inspired by Arch Linux
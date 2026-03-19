# Project Update / Обновление проекта — Arch Trainer

This document summarizes the major innovations and technical improvements implemented in the Arch Trainer project.
Этот документ обобщает основные инновации и технические улучшения, реализованные в проекте Arch Trainer.

---

## 🏗️ 1. V86 Virtual Machine Integration / Интеграция виртуальной машины V86

**[EN]** We have integrated the real `v86` x86 emulator, allowing users to boot an Arch Linux 32-bit ISO directly in their web browser.
- **Bootable ISO**: Boots a full 834MB Arch Linux image.
- **Bios/VGA Support**: Includes bundled SeaBIOS and VGABIOS for a complete PC experience.
- **Performance**: Configured with 512MB RAM and asynchronous loading to optimize browser memory.
- **Controls**: Interactive PAUSE, REBOOT, and EXIT_TO_MAP functionality.

**[RU]** Мы интегрировали реальный эмулятор x86 `v86`, позволяющий пользователям загружать образ Arch Linux 32-bit прямо в веб-браузере.
- **Загрузочный ISO**: Загрузка полного образа Arch Linux размером 834 МБ.
- **Поддержка BIOS/VGA**: В комплект входят SeaBIOS и VGABIOS для полноценного опыта работы с ПК.
- **Производительность**: Настроено 512 МБ ОЗУ и асинхронная загрузка для оптимизации браузерной памяти.
- **Управление**: Интерактивные функции ПАУЗЫ, ПЕРЕЗАГРУЗКИ и ВЫХОДА_НА_КАРТУ.

![VM Booting Arch Linux](file:///C:/Users/Administrator/.gemini/antigravity/brain/cd2e0a5e-92be-4bf7-9d12-9329b7f0735b/vm_boot_final_stage_1773923561807.png)

---

## 🎨 2. Premium Graph UI Upgrade / Обновление премиального графического интерфейса

**[EN]** The main landing page has been rebuilt with a high-fidelity interactive graph.
- **Visual Style**: Sleek rectangular nodes with glowing effects and micro-animations.
- **Interaction**: Smoother drag-and-drop mechanics that distinguish between moving and clicking (navigation).
- **Dark Mode Aesthetics**: Implementation of a premium dark theme consistent with modern developer tools.

**[RU]** Главная страница была перестроена с использованием высококачественного интерактивного графа.
- **Визуальный стиль**: Элегантные прямоугольные узлы с эффектами свечения и микроанимациями.
- **Взаимодействие**: Улучшенная механика drag-and-drop, которая различает перетаскивание и клик (навигацию).
- **Эстетика Dark Mode**: Реализация премиальной темной темы в стиле современных инструментов разработки.

![Interactive Node Graph](file:///C:/Users/Administrator/.gemini/antigravity/brain/cd2e0a5e-92be-4bf7-9d12-9329b7f0735b/upgraded_graph_landing_page_1773922795846.png)

---

## 🚀 3. CI/CD & Deployment Optimization / Оптимизация CI/CD и деплоя

**[EN]** The application is now fully compatible with GitHub Pages and automated build pipelines.
- **Base Path Routing**: Configured React Router and Vite to support deployment into subdirectories (e.g., `/Arch_game/`).
- **Automated ISO Fetching**: The CI/CD workflow ([jekyll-gh-pages.yml](file:///c:/Users/Administrator/Python/Arch_game/.github/workflows/jekyll-gh-pages.yml)) now automatically downloads large binary assets during the build process, bypassing Git history limits.
- **Git History Cleanup**: Purged large binary files from the repository history to ensure successful pushes to GitHub without Git LFS.

**[RU]** Приложение теперь полностью совместимо с GitHub Pages и автоматизированными конвейерами сборки.
- **Роутинг базового пути**: React Router и Vite настроены для поддержки деплоя в поддиректории (например, `/Arch_game/`).
- **Автоматическое получение ISO**: Workflow CI/CD ([jekyll-gh-pages.yml](file:///c:/Users/Administrator/Python/Arch_game/.github/workflows/jekyll-gh-pages.yml)) теперь автоматически скачивает тяжелые бинарные файлы во время сборки, обходя ограничения истории Git.
- **Очистка истории Git**: Из истории репозитория удалены крупные бинарные файлы для обеспечения успешного пуша на GitHub без использования Git LFS.

---

## 🛠️ 4. Technical Stack Improvements / Технические улучшения стека

**[EN]**
- **TypeScript & React**: Strong typing for the `v86` emulator and system components.
- **Vite 7**: Upgraded build system for faster development and production cycles.
- **SPA 404 Trick**: Implemented `404.html` redirection on GitHub Pages to support deep-linking in the Single Page Application.

**[RU]**
- **TypeScript и React**: Строгая типизация для эмулятора `v86` и системных компонентов.
- **Vite 7**: Обновленная система сборки для ускорения циклов разработки и продакшена.
- **Трюк SPA 404**: Реализовано перенаправление через `404.html` на GitHub Pages для поддержки прямых ссылок в одностраничном приложении.

---

**Current Status:** Live at / Текущий статус: Доступно по адресу:
[https://radik097.github.io/Arch_game/](https://radik097.github.io/Arch_game/)

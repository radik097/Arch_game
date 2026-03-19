# 🏗️ Arch Trainer | Симулятор Установки Arch Linux

<div align="center">
  <img src="https://img.shields.io/badge/Status-Experimental-orange?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Framework-React-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Virtualization-V86-FF6C37?style=for-the-badge" alt="V86" />
</div>

---

## 🇺🇸 English Version

### 🌟 Project Overview
**Arch Trainer** is an interactive, browser-based sandbox designed to help users master the Arch Linux installation process. It combines a high-fidelity terminal simulator with a real 32-bit virtual machine (v86) to provide a safe, dependency-free learning environment.

### 🚀 Key Features
- **Deterministic Simulation**: A state-driven command engine that mimics real Arch commands (`pacstrap`, `genfstab`, `mkfs`, etc.).
- **Live V86 VM**: Boot a real Arch Linux ISO directly in your browser with optimized 9p filesystem support.
- **Interactive Graph Map**: Visualize the installation journey through a premium, glowing node-based architecture.
- **State Persistence**: Save and restore your VM progress at any time.

### 🛠️ Quick Start
1. **Explore the Map**: Choose your starting point (Simulated or Live VM).
2. **Follow the Flow**: Navigate through Partitioning, Base Install, and Configuration.
3. **Master the Terminal**: Practice real-world commands without risking your hardware.

---

## 🇷🇺 Русская Версия

### 🌟 О Проекте
**Arch Trainer** — это интерактивная браузерная песочница, созданная для того, чтобы помочь пользователям освоить процесс установки Arch Linux. Проект сочетает в себе высокоточный симулятор терминала и реальную 32-битную виртуальную машину (v86) для обеспечения безопасной среды обучения без установки дополнительных зависимостей.

### 🚀 Основные Возможности
- **Детерминированная Симуляция**: Движок команд на основе состояний, имитирующий реальные команды Arch (`pacstrap`, `genfstab`, `mkfs` и т.д.).
- **Живая ВМ V86**: Загрузка реального ISO-образа Arch Linux прямо в браузере с оптимизированной поддержкой файловой системы 9p.
- **Интерактивная Карта**: Визуализация процесса установки через премиальный интерфейс на основе узлов и эффектов свечения.
- **Сохранение Состояния**: Возможность сохранять и восстанавливать прогресс ВМ в любое время.

### 🛠️ Быстрый Старт
1. **Изучите Карту**: Выберите точку входа (Симулятор или Живая ВМ).
2. **Следуйте Потоку**: Пройдите этапы разметки диска, базовой установки и настройки.
3. **Освойте Терминал**: Практикуйте реальные команды, не рискуя своим оборудованием.

---

## 💻 Tech Stack / Технологии
- **Frontend**: React + Vite + TypeScript
- **Styling**: Vanilla CSS (Cyberpunk Aesthetic)
- **Virtualization**: [v86](https://github.com/copy/v86) (WebAssembly)
- **Deployment**: GitHub Pages (CI/CD via GitHub Actions)

---

## 🔧 Installation / Установка
```bash
git clone https://github.com/radik097/Arch_game.git
cd Arch_game
npm install --legacy-peer-deps
npm run dev
```

---
*Inspired by the Arch Linux passion. Built for the community.*
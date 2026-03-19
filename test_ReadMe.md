<div align="center">

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║      ▄▄▄   ██▀███   ▄████▄   ██░ ██     ▄▄▄█████▓ ██▀███        ║
║     ▒████▄ ▓██ ▒ ██▒▒██▀ ▀█  ▓██░ ██▒   ▓  ██▒ ▓▒▓██ ▒ ██▒      ║
║     ▒██  ▀█▄▓██ ░▄█ ▒▒▓█    ▄ ▒██▀▀██░   ▒ ▓██░ ▒░▓██ ░▄█ ▒      ║
║     ░██▄▄▄▄██▒██▀▀█▄  ▒▓▓▄ ▄██▒░▓█ ░██   ░ ▓██▓ ░ ▒██▀▀█▄        ║
║      ▓█   ▓██░██▓ ▒██▒▒ ▓███▀ ░░▓█▒░██▓    ▒██▒ ░ ░██▓ ▒██▒      ║
║      ▒▒   ▓▒█░ ▒▓ ░▒▓░░ ░▒ ▒  ░ ▒ ░░▒░▒    ▒ ░░   ░ ▒▓ ░▒▓░      ║
║                          T R A I N E R                            ║
╚═══════════════════════════════════════════════════════════════════╝
```

<br/>

[![Live Demo](https://img.shields.io/badge/🌐_LIVE_DEMO-radik097.github.io-00d4ff?style=for-the-badge&labelColor=0a0f1e)](https://radik097.github.io/Arch_game/)
[![License](https://img.shields.io/badge/LICENSE-MIT-7ed6b2?style=for-the-badge&labelColor=0a0f1e)](./LICENSE)
[![Vite](https://img.shields.io/badge/BUILD-VITE_8-a855f7?style=for-the-badge&labelColor=0a0f1e)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/REACT-18-61dafb?style=for-the-badge&labelColor=0a0f1e)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TYPESCRIPT-5-3178c6?style=for-the-badge&labelColor=0a0f1e)](https://typescriptlang.org/)

<br/>

**Navigate to your language / Перейти к своему языку / 跳转到您的语言 / Zur Sprache wechseln / Aller à votre langue / 言語に移動**

[🇬🇧 English](#-english) · [🇷🇺 Русский](#-русский) · [🇨🇳 中文](#-中文) · [🇩🇪 Deutsch](#-deutsch) · [🇫🇷 Français](#-français) · [🇯🇵 日本語](#-日本語)

</div>

---

<br/>

## 🇬🇧 English

<div align="center">

### 🖥️ Learn Arch Linux installation — right in your browser

**Arch Trainer** is an experimental browser-based sandbox that simulates the full Arch Linux installation workflow. It combines a realistic terminal emulator, a visual node-graph interface, and an optional v86 virtual machine so you can practice real installation commands without touching your hardware.

> *"I installed Arch the hard way."*

</div>

### 🚀 Live Demo

**[https://radik097.github.io/Arch_game/](https://radik097.github.io/Arch_game/)**

### ✨ Key Features

| Feature | Description |
|---|---|
| 🔧 **Terminal Simulator** | Real Arch commands — `fdisk`, `pacstrap`, `arch-chroot`, GRUB, and more |
| 💻 **V86 Virtual Machine** | Boot a genuine Arch Linux 32-bit ISO directly inside the browser |
| 🗺️ **Node Graph UI** | Interactive installation map — visualise every stage at a glance |
| 🎯 **Difficulty Modes** | Beginner → Experienced → Expert → God Mode |
| 🔗 **Anti-Cheat Replay** | SHA-256 hash chain + server-side replay validation |
| 🏆 **Leaderboard** | Verified speed-run rankings for official fork builds |
| 🌐 **Bilingual** | Russian and English as equal first-class languages |

### 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/radik097/Arch_game.git
cd Arch_game

# Install dependencies
npm install --legacy-peer-deps

# Start the development server
npm run dev
```

### 📂 Architecture Overview

```
src/
├── app/                     # Root application shell & routing
├── features/
│   ├── simulator/           # Command engine · state machine · objectives
│   ├── terminal/            # XTerm.js terminal component
│   ├── landing/             # React-Flow node graph
│   ├── vm/                  # V86 emulator panel
│   └── session/             # API layer · replay recording · identity
├── shared/                  # Shared types (replay, sessions, leaderboard)
└── styles/                  # Global CSS & theme tokens

server/                      # Node.js validation server
├── replayValidator.ts        # Server-side install simulation
├── verification.ts           # Fork / build-proof verification
└── storage/                  # JSON file store
```

### 🎮 Difficulty Modes

| Level | Description |
|---|---|
| 🟢 **Beginner** | Step-by-step hints, inline explanations in RU/EN |
| 🔵 **Experienced** | Timer active, minimal guidance |
| 🟠 **Expert** | Random failures — broken mirrors, driver issues |
| 🔴 **God Mode** | One mistake = full restart. No hints. Ever. |

### ⚠️ Disclaimer

This project is in a **"test and try"** phase — a sandbox for architectural experimentation, not a production-grade training platform.

---

<br/>

## 🇷🇺 Русский

<div align="center">

### 🖥️ Учись устанавливать Arch Linux — прямо в браузере

**Arch Trainer** — экспериментальная браузерная песочница, симулирующая полный процесс установки Arch Linux. Проект объединяет реалистичный терминальный эмулятор, визуальный граф-интерфейс и опциональную виртуальную машину v86, чтобы вы могли практиковаться без риска для реального железа.

> *«Я установил Arch по-настоящему сложным путём.»*

</div>

### 🚀 Живое демо

**[https://radik097.github.io/Arch_game/](https://radik097.github.io/Arch_game/)**

### ✨ Ключевые возможности

| Возможность | Описание |
|---|---|
| 🔧 **Терминальный симулятор** | Настоящие команды Arch — `fdisk`, `pacstrap`, `arch-chroot`, GRUB и другие |
| 💻 **Виртуальная машина V86** | Загрузка реального образа Arch Linux 32-bit прямо в браузере |
| 🗺️ **Граф-интерфейс** | Интерактивная карта установки — все этапы с первого взгляда |
| 🎯 **Режимы сложности** | Начинающий → Опытный → Эксперт → Режим бога |
| 🔗 **Защита от читерства** | Цепочка хэшей SHA-256 + валидация реплея на сервере |
| 🏆 **Таблица лидеров** | Рейтинг верифицированных спидранов для форк-сборок |
| 🌐 **Двуязычность** | Русский и английский — равноправные языки первого класса |

### 🛠️ Локальная разработка

```bash
# Клонировать репозиторий
git clone https://github.com/radik097/Arch_game.git
cd Arch_game

# Установить зависимости
npm install --legacy-peer-deps

# Запустить сервер разработки
npm run dev
```

### 📂 Обзор архитектуры

```
src/
├── app/                     # Корневой шелл и роутинг
├── features/
│   ├── simulator/           # Движок команд · машина состояний · цели
│   ├── terminal/            # Компонент XTerm.js
│   ├── landing/             # Граф на React-Flow
│   ├── vm/                  # Панель эмулятора V86
│   └── session/             # API · запись реплея · идентификация
├── shared/                  # Общие типы (replay, сессии, лидерборд)
└── styles/                  # Глобальный CSS и токены тем

server/                      # Сервер валидации на Node.js
├── replayValidator.ts        # Серверная симуляция установки
├── verification.ts           # Верификация форка и build-proof
└── storage/                  # JSON файловое хранилище
```

### 🎮 Режимы сложности

| Уровень | Описание |
|---|---|
| 🟢 **Начинающий** | Пошаговые подсказки, пояснения на RU/EN |
| 🔵 **Опытный** | Таймер активен, минимум подсказок |
| 🟠 **Эксперт** | Случайные сбои — сломанные зеркала, проблемы с драйверами |
| 🔴 **Режим бога** | Одна ошибка = полный рестарт. Никаких подсказок. Никогда. |

### ⚠️ Дисклеймер

Проект находится в фазе **«тестирования и проб»** — песочница для архитектурных экспериментов, а не продакшен-платформа для обучения.

---

<br/>

## 🇨🇳 中文

<div align="center">

### 🖥️ 在浏览器中学习 Arch Linux 安装

**Arch Trainer** 是一款基于浏览器的实验性沙箱，完整模拟 Arch Linux 的安装流程。它集成了逼真的终端模拟器、可视化节点图界面以及可选的 v86 虚拟机，让你无需触碰真实硬件即可练习安装命令。

> *"我用真正困难的方式安装了 Arch。"*

</div>

### 🚀 在线演示

**[https://radik097.github.io/Arch_game/](https://radik097.github.io/Arch_game/)**

### ✨ 核心功能

| 功能 | 描述 |
|---|---|
| 🔧 **终端模拟器** | 真实的 Arch 命令 — `fdisk`、`pacstrap`、`arch-chroot`、GRUB 等 |
| 💻 **V86 虚拟机** | 直接在浏览器中启动真实的 Arch Linux 32 位 ISO |
| 🗺️ **节点图界面** | 交互式安装地图 — 一目了然展示每个阶段 |
| 🎯 **难度模式** | 初学者 → 有经验者 → 专家 → 神级模式 |
| 🔗 **防作弊回放** | SHA-256 哈希链 + 服务器端回放验证 |
| 🏆 **排行榜** | 官方 Fork 构建的验证速通排名 |
| 🌐 **双语支持** | 俄语和英语同为一等语言 |

### 🛠️ 本地开发

```bash
# 克隆仓库
git clone https://github.com/radik097/Arch_game.git
cd Arch_game

# 安装依赖
npm install --legacy-peer-deps

# 启动开发服务器
npm run dev
```

### 🎮 难度模式

| 级别 | 描述 |
|---|---|
| 🟢 **初学者** | 逐步提示，俄/英双语内联说明 |
| 🔵 **有经验者** | 计时器开启，最少引导 |
| 🟠 **专家** | 随机故障 — 镜像损坏、驱动问题 |
| 🔴 **神级模式** | 一个错误 = 完全重启。没有提示。永远不会有。 |

### ⚠️ 免责声明

本项目处于**"测试和尝试"**阶段 — 这是一个用于架构实验的沙箱，而非生产级训练平台。

---

<br/>

## 🇩🇪 Deutsch

<div align="center">

### 🖥️ Lerne die Arch Linux-Installation — direkt im Browser

**Arch Trainer** ist eine experimentelle browserbasierte Sandbox, die den vollständigen Arch Linux-Installationsworkflow simuliert. Sie kombiniert einen realistischen Terminal-Emulator, eine visuelle Node-Graph-Oberfläche und eine optionale v86-VM, damit du echte Installationsbefehle übst — ohne deine Hardware anzufassen.

> *"Ich habe Arch auf die wirklich harte Tour installiert."*

</div>

### 🚀 Live-Demo

**[https://radik097.github.io/Arch_game/](https://radik097.github.io/Arch_game/)**

### ✨ Hauptfunktionen

| Funktion | Beschreibung |
|---|---|
| 🔧 **Terminal-Simulator** | Echte Arch-Befehle — `fdisk`, `pacstrap`, `arch-chroot`, GRUB und mehr |
| 💻 **V86 Virtuelle Maschine** | Ein echtes Arch Linux 32-Bit-ISO direkt im Browser booten |
| 🗺️ **Node-Graph-UI** | Interaktive Installationskarte — alle Phasen auf einen Blick |
| 🎯 **Schwierigkeitsgrade** | Anfänger → Erfahren → Experte → Gott-Modus |
| 🔗 **Anti-Cheat-Replay** | SHA-256-Hash-Kette + serverseitige Replay-Validierung |
| 🏆 **Bestenliste** | Verifizierte Speedrun-Rankings für offizielle Fork-Builds |
| 🌐 **Zweisprachig** | Russisch und Englisch als gleichwertige Erstsprachen |

### 🛠️ Lokale Entwicklung

```bash
# Repository klonen
git clone https://github.com/radik097/Arch_game.git
cd Arch_game

# Abhängigkeiten installieren
npm install --legacy-peer-deps

# Entwicklungsserver starten
npm run dev
```

### 🎮 Schwierigkeitsgrade

| Stufe | Beschreibung |
|---|---|
| 🟢 **Anfänger** | Schritt-für-Schritt-Hinweise, Erklärungen auf RU/EN |
| 🔵 **Erfahren** | Timer aktiv, minimale Anleitung |
| 🟠 **Experte** | Zufällige Fehler — defekte Spiegel, Treiberprobleme |
| 🔴 **Gott-Modus** | Ein Fehler = vollständiger Neustart. Keine Hinweise. Niemals. |

### ⚠️ Haftungsausschluss

Dieses Projekt befindet sich in einer **„Test and Try"**-Phase — eine Sandbox für architektonische Experimente, keine produktionsreife Trainingsplattform.

---

<br/>

## 🇫🇷 Français

<div align="center">

### 🖥️ Apprends l'installation d'Arch Linux — directement dans ton navigateur

**Arch Trainer** est un bac à sable expérimental basé sur le navigateur qui simule l'intégralité du processus d'installation d'Arch Linux. Il combine un émulateur de terminal réaliste, une interface visuelle en graphe de nœuds et une VM v86 optionnelle pour pratiquer de vraies commandes d'installation sans toucher ton matériel.

> *"J'ai installé Arch à la dure."*

</div>

### 🚀 Démo en direct

**[https://radik097.github.io/Arch_game/](https://radik097.github.io/Arch_game/)**

### ✨ Fonctionnalités clés

| Fonctionnalité | Description |
|---|---|
| 🔧 **Simulateur de terminal** | Vraies commandes Arch — `fdisk`, `pacstrap`, `arch-chroot`, GRUB et plus |
| 💻 **Machine virtuelle V86** | Démarrer un vrai ISO Arch Linux 32 bits directement dans le navigateur |
| 🗺️ **Interface en graphe** | Carte d'installation interactive — visualise chaque étape d'un coup d'œil |
| 🎯 **Modes de difficulté** | Débutant → Expérimenté → Expert → Mode Dieu |
| 🔗 **Anti-triche Replay** | Chaîne de hachages SHA-256 + validation côté serveur |
| 🏆 **Classement** | Classements de speedruns vérifiés pour les builds fork officiels |
| 🌐 **Bilingue** | Russe et anglais comme langues de première classe à égalité |

### 🛠️ Développement local

```bash
# Cloner le dépôt
git clone https://github.com/radik097/Arch_game.git
cd Arch_game

# Installer les dépendances
npm install --legacy-peer-deps

# Lancer le serveur de développement
npm run dev
```

### 🎮 Modes de difficulté

| Niveau | Description |
|---|---|
| 🟢 **Débutant** | Indices étape par étape, explications en RU/EN |
| 🔵 **Expérimenté** | Minuterie active, guidage minimal |
| 🟠 **Expert** | Pannes aléatoires — miroirs cassés, problèmes de pilotes |
| 🔴 **Mode Dieu** | Une erreur = redémarrage complet. Aucun indice. Jamais. |

### ⚠️ Avertissement

Ce projet est en phase **"test et essai"** — un bac à sable pour l'expérimentation architecturale, pas une plateforme de formation de niveau production.

---

<br/>

## 🇯🇵 日本語

<div align="center">

### 🖥️ ブラウザで Arch Linux インストールを学ぼう

**Arch Trainer** は、Arch Linux のインストールワークフロー全体をシミュレートする実験的なブラウザベースのサンドボックスです。リアルなターミナルエミュレータ、ビジュアルノードグラフUI、そしてオプションの v86 仮想マシンを組み合わせ、実際のハードウェアに触れることなく本物のインストールコマンドを練習できます。

> *「本当に大変な方法で Arch をインストールした。」*

</div>

### 🚀 ライブデモ

**[https://radik097.github.io/Arch_game/](https://radik097.github.io/Arch_game/)**

### ✨ 主な機能

| 機能 | 説明 |
|---|---|
| 🔧 **ターミナルシミュレータ** | 本物の Arch コマンド — `fdisk`、`pacstrap`、`arch-chroot`、GRUB など |
| 💻 **V86 仮想マシン** | 本物の Arch Linux 32ビット ISO をブラウザ上で直接起動 |
| 🗺️ **ノードグラフ UI** | インタラクティブなインストールマップ — 全ステージを一目で把握 |
| 🎯 **難易度モード** | 初心者 → 経験者 → エキスパート → ゴッドモード |
| 🔗 **不正防止リプレイ** | SHA-256 ハッシュチェーン + サーバーサイドリプレイ検証 |
| 🏆 **リーダーボード** | 公式フォークビルドの認証済みスピードランランキング |
| 🌐 **バイリンガル** | ロシア語と英語を同等のファーストクラス言語として採用 |

### 🛠️ ローカル開発

```bash
# リポジトリをクローン
git clone https://github.com/radik097/Arch_game.git
cd Arch_game

# 依存関係をインストール
npm install --legacy-peer-deps

# 開発サーバーを起動
npm run dev
```

### 🎮 難易度モード

| レベル | 説明 |
|---|---|
| 🟢 **初心者** | ステップバイステップのヒント、RU/EN インライン説明 |
| 🔵 **経験者** | タイマー有効、最小限のガイダンス |
| 🟠 **エキスパート** | ランダム障害 — 壊れたミラー、ドライバー問題 |
| 🔴 **ゴッドモード** | 1つのミスで完全リスタート。ヒントなし。永遠に。 |

### ⚠️ 免責事項

このプロジェクトは**「テストと試行」**フェーズにあります — アーキテクチャ実験のためのサンドボックスであり、プロダクションレベルのトレーニングプラットフォームではありません。

---

<br/>

<div align="center">

## 🔧 Tech Stack

```
╔══════════════╦══════════════╦══════════════╦══════════════╗
║   Frontend   ║   Runtime    ║    Build     ║   Testing    ║
╠══════════════╬══════════════╬══════════════╬══════════════╣
║ React 18     ║ Node.js 22   ║ Vite 8       ║ Vitest 4     ║
║ TypeScript 5 ║ V86 x86 Emu  ║ SWC Compiler ║ Playwright   ║
║ XTerm.js 6   ║ Express 5    ║ Rolldown     ║              ║
╚══════════════╩══════════════╩══════════════╩══════════════╝
```

<br/>

## 🤝 Contributing / Участие / 贡献 / Beitragen / Contribuer / 貢献

[![Fork](https://img.shields.io/badge/1._FORK-this_repo-00d4ff?style=for-the-badge&labelColor=0a0f1e)](https://github.com/radik097/Arch_game/fork)
[![Branch](https://img.shields.io/badge/2._CREATE-a_branch-7ed6b2?style=for-the-badge&labelColor=0a0f1e)](#)
[![PR](https://img.shields.io/badge/3._OPEN-a_pull_request-a855f7?style=for-the-badge&labelColor=0a0f1e)](https://github.com/radik097/Arch_game/pulls)

<br/>

---

<sub>MIT License · Inspired by the Arch Linux Installation Guide · Built with ❤️ and `pacstrap`</sub>

</div>
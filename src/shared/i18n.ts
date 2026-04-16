import type { Difficulty, ObjectiveId } from '../features/simulator/types';

export type AppLanguage = 'ru' | 'en';
export type AppThemeId = 'emerald' | 'amber' | 'ice';

export const APP_TEXT = {
  ru: {
    languages: {
      ru: 'Русский',
      en: 'English',
    },
    menu: {
      title: 'Главное меню',
      lead: 'Понятный старт без карты и без декоративного шума.',
      start: 'Старт',
      startTraining: 'Начать обучение',
      sandbox: 'Песочница',
      continueTerminal: 'Продолжить терминал',
      openTerminal: 'Открыть терминал',
      virtualMachine: 'Виртуальная машина',
      difficulty: 'Сложность',
      settings: 'Настройки',
      settingsLead: 'Только нужные параметры перед запуском.',
      compactBoot: 'Короткий журнал загрузки',
      sections: 'Разделы',
      sectionsLead: 'Быстрые переходы без лишних экранов.',
      language: 'Язык',
      languageLead: 'Автоматически определяется по браузеру при первом запуске.',
      about: 'О проекте',
      help: 'Помочь проекту',
      difficultyStatus: 'Сложность',
      themeStatus: 'Тема',
      compactBootStatus: 'Короткая загрузка',
      fullBootStatus: 'Полная загрузка',
    },
    simulation: {
      leaderboard: 'Рейтинг',
      menu: 'Меню',
      hint: 'Подсказка',
      steps: 'Шаги',
      state: 'Состояние',
      session: 'Сессия',
      checkpoints: 'Контрольные точки',
      currentGoal: 'Текущая цель',
      mode: 'Режим',
      commands: 'Команд',
      hash: 'Хеш',
      verdict: 'Статус',
      noCheckpoints: 'Пока нет',
      step: 'Шаг',
      message: 'Сообщение',
      waiting: 'Ожидание команды',
      backToMenu: 'Вернуться в меню',
    },
    pages: {
      backToMenu: '← Назад в меню',
      aboutTitle: 'О проекте',
      aboutSections: {
        simulatorTitle: 'Симулятор',
        simulatorBody:
          'Arch Trainer обучает логике установки Arch Linux в безопасной среде. Можно спокойно тренировать команды и понимать последовательность шагов без риска для реальной системы.',
        vmTitle: 'Виртуализация',
        vmBody:
          'Помимо симуляции, проект включает виртуальную машину на V86. Это позволяет перейти от учебного режима к запуску настоящего окружения прямо в браузере.',
        stackTitle: 'Технологии',
      },
      helpTitle: 'Помочь проекту',
      helpSections: {
        introTitle: 'Как помочь',
        introBody:
          'Arch Trainer остаётся open-source проектом, и в него можно вносить вклад кодом, документацией, тестами и улучшениями интерфейса.',
        stepsTitle: 'По шагам',
        steps: [
          'Сделайте fork репозитория на GitHub.',
          'Склонируйте fork локально.',
          'Создайте отдельную ветку под задачу.',
          'Сделайте понятные коммиты.',
          'Откройте Pull Request.',
        ],
        repoTitle: 'Репозиторий',
        repoButton: 'Открыть GitHub',
      },
    },
    vm: {
      pause: 'Пауза',
      reboot: 'Перезапуск',
      exportState: 'Экспорт состояния',
      importState: 'Импорт состояния',
      exit: 'В меню',
      configTitle: 'Настройка VM',
      memory: 'Память системы',
      bootMode: 'Режим загрузки',
      overview: 'Источник системы',
      cdrom: 'CD-ROM (ISO)',
      network: 'Сеть (9p)',
      start: 'Запустить систему',
      footer: 'Проверьте параметры перед запуском.',
      loadingHint: 'Инициализация V86 и выделение памяти...',
      retry: 'Повторить',
      clickToType: 'Нажмите на экран, чтобы печатать',
      buttonsReturnFocus: 'После кнопок фокус возвращается в VM',
      focusInput: 'Фокус на терминал',
      focused: 'Фокус активен',
      active: 'Активно',
      metrics: 'Параметры VM',
      resources: 'Ресурсы',
      specs: 'Конфигурация',
      tasks: 'Состояние запуска',
      saveState: 'Сохранить состояние',
      restoreState: 'Восстановить состояние',
      cpuLoad: 'Нагрузка CPU',
      ramAllocated: 'Выделено памяти',
      disk: 'Диск',
      memoryShort: 'Память',
      bootShort: 'Загрузка',
      initEngine: 'Запуск движка',
      loadKernel: 'Загрузка ядра',
      userLogin: 'Вход в систему',
      assetWarning:
        'Для режима 9p нужны дополнительные assets в /images/arch/fs.json. Пока используйте ISO-режим.',
      statuses: {
        systemIdle: 'Система ожидает запуска',
        loadingEngine: 'Загрузка движка V86...',
        initializing: 'Инициализация виртуальной машины...',
        booting: 'Загрузка Arch ISO...',
        running: 'Система запущена',
        paused: 'Пауза',
        stateSaved: 'Состояние сохранено',
        saveFailed: 'Не удалось сохранить состояние',
        restoring: 'Восстановление состояния...',
        restored: 'Состояние восстановлено',
        restoreFailed: 'Не удалось восстановить состояние',
        rebooting: 'Перезапуск...',
      },
    },
    shell: {
      liveIsoReady: 'Live ISO загружен. Root shell доступен.',
      installMedium: 'Это установочная среда Arch Linux.',
      overlayReady: (version: string) => `Оверлей Arch Trainer ${version} инициализирован.`,
      helpHint: 'Введите help для служебных команд или используйте обычные команды установки Arch.',
      welcomeShell: 'Добро пожаловать в управляющую оболочку Arch Trainer.',
      startWithDifficulty: 'Используйте sessionctl start <сложность> для запуска окружения установки.',
      helpForCommands: 'Используйте sessionctl help для служебных команд.',
      noVerifiedRuns: 'Пока нет подтверждённых прохождений',
      leaderboardTitle: (difficulty?: Difficulty) =>
        `официальный рейтинг${difficulty ? ` difficulty=${difficulty}` : ''}`,
    },
  },
  en: {
    languages: {
      ru: 'Russian',
      en: 'English',
    },
    menu: {
      title: 'Main Menu',
      lead: 'A clean starting point without the node map and extra visual noise.',
      start: 'Start',
      startTraining: 'Start Training',
      sandbox: 'Sandbox',
      continueTerminal: 'Continue Terminal',
      openTerminal: 'Open Terminal',
      virtualMachine: 'Virtual Machine',
      difficulty: 'Difficulty',
      settings: 'Settings',
      settingsLead: 'Only the essentials before launch.',
      compactBoot: 'Use short boot log',
      sections: 'Sections',
      sectionsLead: 'Quick navigation without extra clutter.',
      language: 'Language',
      languageLead: 'Detected automatically from the browser on first launch.',
      about: 'About Project',
      help: 'Help Project',
      difficultyStatus: 'Difficulty',
      themeStatus: 'Theme',
      compactBootStatus: 'Short boot',
      fullBootStatus: 'Full boot',
    },
    simulation: {
      leaderboard: 'Leaderboard',
      menu: 'Menu',
      hint: 'Hint',
      steps: 'Steps',
      state: 'State',
      session: 'Session',
      checkpoints: 'Checkpoints',
      currentGoal: 'Current Goal',
      mode: 'Mode',
      commands: 'Commands',
      hash: 'Hash',
      verdict: 'Verdict',
      noCheckpoints: 'No checkpoints yet',
      step: 'Step',
      message: 'Message',
      waiting: 'Waiting for command',
      backToMenu: 'Back to Menu',
    },
    pages: {
      backToMenu: '← Back to Menu',
      aboutTitle: 'About Project',
      aboutSections: {
        simulatorTitle: 'Simulator',
        simulatorBody:
          'Arch Trainer teaches the logic of an Arch Linux installation in a safe environment. You can practice commands and understand the order of steps without touching your real machine.',
        vmTitle: 'Virtualization',
        vmBody:
          'Alongside the simulator, the project includes a V86-powered virtual machine. It lets you move from guided training into a real bootable environment in the browser.',
        stackTitle: 'Tech Stack',
      },
      helpTitle: 'Help Project',
      helpSections: {
        introTitle: 'How to Help',
        introBody:
          'Arch Trainer is open source, so contributions can include code, docs, tests, polish, and usability improvements.',
        stepsTitle: 'Step by Step',
        steps: [
          'Fork the repository on GitHub.',
          'Clone your fork locally.',
          'Create a dedicated branch for the task.',
          'Commit changes with clear messages.',
          'Open a Pull Request.',
        ],
        repoTitle: 'Repository',
        repoButton: 'Open GitHub',
      },
    },
    vm: {
      pause: 'Pause',
      reboot: 'Reboot',
      exportState: 'Export State',
      importState: 'Import State',
      exit: 'Back to Menu',
      configTitle: 'VM Configuration',
      memory: 'System Memory',
      bootMode: 'Boot Mode',
      overview: 'System Source',
      cdrom: 'CD-ROM (ISO)',
      network: 'Network (9p)',
      start: 'Start System',
      footer: 'Verify the hardware settings before launch.',
      loadingHint: 'Initializing V86 and allocating memory...',
      retry: 'Retry',
      clickToType: 'Click the screen to type',
      buttonsReturnFocus: 'Buttons return focus to the VM',
      focusInput: 'Focus Terminal Input',
      focused: 'Focused',
      active: 'Active',
      metrics: 'VM Metrics',
      resources: 'Resources',
      specs: 'Configuration',
      tasks: 'Launch State',
      saveState: 'Save State',
      restoreState: 'Restore State',
      cpuLoad: 'CPU Load',
      ramAllocated: 'RAM Allocated',
      disk: 'Disk',
      memoryShort: 'Memory',
      bootShort: 'Boot',
      initEngine: 'Init Engine',
      loadKernel: 'Load Kernel',
      userLogin: 'User Login',
      assetWarning:
        '9p mode requires extra assets in /images/arch/fs.json. Use ISO mode unless those files are available.',
      statuses: {
        systemIdle: 'System is idle',
        loadingEngine: 'Loading V86 engine...',
        initializing: 'Initializing virtual machine...',
        booting: 'Booting Arch ISO...',
        running: 'System is running',
        paused: 'Paused',
        stateSaved: 'State saved',
        saveFailed: 'Failed to save state',
        restoring: 'Restoring state...',
        restored: 'State restored',
        restoreFailed: 'Failed to restore state',
        rebooting: 'Rebooting...',
      },
    },
    shell: {
      liveIsoReady: 'Live ISO loaded. Root shell is available.',
      installMedium: 'This is the Arch Linux installation medium.',
      overlayReady: (version: string) => `Arch Trainer ${version} overlay initialized.`,
      helpHint: 'Type help for trainer commands, or start typing real Arch install commands.',
      welcomeShell: 'Welcome to Arch Trainer control shell.',
      startWithDifficulty: 'Use sessionctl start <difficulty> to boot the installer environment.',
      helpForCommands: 'Use sessionctl help for pseudo-system commands.',
      noVerifiedRuns: 'No verified runs yet',
      leaderboardTitle: (difficulty?: Difficulty) =>
        `official leaderboard${difficulty ? ` difficulty=${difficulty}` : ''}`,
    },
  },
} as const;

const DIFFICULTY_COPY: Record<AppLanguage, Record<Difficulty, { label: string; note: string }>> = {
  ru: {
    beginner: { label: 'Новичок', note: 'Спокойный старт и больше подсказок.' },
    experienced: { label: 'Стандарт', note: 'Нормальный темп без лишнего давления.' },
    expert: { label: 'Эксперт', note: 'Меньше прощает ошибки и требует точности.' },
    god: { label: 'God', note: 'Жесткий режим для быстрого прохода.' },
  },
  en: {
    beginner: { label: 'Novice', note: 'A calmer start with more guidance.' },
    experienced: { label: 'Standard', note: 'Balanced pace without extra pressure.' },
    expert: { label: 'Expert', note: 'Less forgiving and more demanding.' },
    god: { label: 'God', note: 'A brutal mode for fast and exact runs.' },
  },
};

const THEME_COPY: Record<AppLanguage, Record<AppThemeId, string>> = {
  ru: {
    emerald: 'Зеленый',
    amber: 'Янтарный',
    ice: 'Ледяной',
  },
  en: {
    emerald: 'Emerald',
    amber: 'Amber',
    ice: 'Ice',
  },
};

const OBJECTIVE_COPY: Record<AppLanguage, Record<ObjectiveId, { title: string; detail: string }>> = {
  ru: {
    inspect: {
      title: 'Осмотреть систему',
      detail: 'Найдите правильный диск установки по устройствам и псевдофайловой системе.',
    },
    network: {
      title: 'Поднять сеть',
      detail: 'Исправьте сеть, драйверы или зеркала перед установкой пакетов.',
    },
    partition: {
      title: 'Разметить диск',
      detail: 'Выберите диск установки и создайте EFI и root разделы.',
    },
    format: {
      title: 'Отформатировать разделы',
      detail: 'Подготовьте EFI как FAT32, а root как ext4.',
    },
    mount: {
      title: 'Смонтировать систему',
      detail: 'Смонтируйте root в /mnt и EFI в /mnt/boot.',
    },
    install: {
      title: 'Установить базовую систему',
      detail: 'pacstrap должен выполниться по рабочей сети и на смонтированную цель.',
    },
    fstab: {
      title: 'Сделать fstab и chroot',
      detail: 'Сохраните монтирования через genfstab и войдите через arch-chroot.',
    },
    configure: {
      title: 'Настроить систему',
      detail: 'Укажите timezone, clock, locale, hostname и пароль root.',
    },
    bootloader: {
      title: 'Установить загрузку',
      detail: 'Включите сеть и поставьте GRUB перед выходом из live ISO.',
    },
    reboot: {
      title: 'Завершить установку',
      detail: 'Выйдите из chroot, размонтируйте систему и перезагрузитесь.',
    },
  },
  en: {
    inspect: {
      title: 'Inspect the machine',
      detail: 'Find the correct installation disk from the devices and pseudo-filesystem views.',
    },
    network: {
      title: 'Bring networking online',
      detail: 'Repair networking, drivers, or mirrors before installing packages.',
    },
    partition: {
      title: 'Partition the target disk',
      detail: 'Choose the installation disk and create EFI and root partitions.',
    },
    format: {
      title: 'Format the partitions',
      detail: 'Prepare the EFI partition as FAT32 and the root partition as ext4.',
    },
    mount: {
      title: 'Mount the target system',
      detail: 'Mount the root partition to /mnt and the EFI partition to /mnt/boot.',
    },
    install: {
      title: 'Install the base system',
      detail: 'pacstrap must succeed with working networking and the mounted target.',
    },
    fstab: {
      title: 'Generate fstab and chroot',
      detail: 'Persist mounts with genfstab and enter the system with arch-chroot.',
    },
    configure: {
      title: 'Configure the installed system',
      detail: 'Set timezone, clock, locale, hostname, and the root password.',
    },
    bootloader: {
      title: 'Install boot support',
      detail: 'Enable networking and install GRUB before leaving the live ISO.',
    },
    reboot: {
      title: 'Finish the installer',
      detail: 'Exit chroot, unmount the system, and reboot.',
    },
  },
};

export function detectAppLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const signals = [...(navigator.languages ?? []), navigator.language, navigator.userAgent]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (signals.includes('ru')) {
    return 'ru';
  }

  return 'en';
}

export function getDifficultyCopy(language: AppLanguage, difficulty: Difficulty) {
  return DIFFICULTY_COPY[language][difficulty];
}

export function getThemeLabel(language: AppLanguage, theme: AppThemeId): string {
  return THEME_COPY[language][theme];
}

export function getObjectiveCopy(language: AppLanguage, objectiveId: ObjectiveId) {
  return OBJECTIVE_COPY[language][objectiveId];
}

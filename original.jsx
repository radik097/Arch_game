import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO — hash chain для anti-cheat
// ═══════════════════════════════════════════════════════════════════════════════
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function chainHash(prevHash, cmd, tGame, sessionSecret) {
  return sha256(`${prevHash}:${cmd}:${tGame.toFixed(3)}:${sessionSecret}`);
}

function genSecret() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,"0")).join("");
}

// ═══════════════════════════════════════════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════════════════════════════════════════
const THEMES = {
  default: {
    name: "Default",
    bg: "#0a0a0a", sideBg: "#0f0f0f", topBg: "#111",
    border: "#1e1e1e", promptColor: "#00ff87", errorColor: "#ff5555",
    outputColor: "#e2e2e2", systemColor: "#b0b0b0", infoColor: "#00d4ff",
    inputColor: "#f0f0f0", cursorColor: "#f0f0f0", accentColor: "#00ff87",
    font: "'IBM Plex Mono','Courier New',monospace",
  },
  real_theme: {
    name: "Catppuccin Mocha",
    bg: "#1e1e2e", sideBg: "#181825", topBg: "#181825",
    border: "#313244", promptColor: "#cba6f7", errorColor: "#f38ba8",
    outputColor: "#cdd6f4", systemColor: "#a6adc8", infoColor: "#89dceb",
    inputColor: "#cdd6f4", cursorColor: "#cba6f7", accentColor: "#cba6f7",
    font: "'JetBrains Mono','Fira Code','Courier New',monospace",
  },
  hacker_typer: {
    name: "Hacker Typer",
    bg: "#000", sideBg: "#030303", topBg: "#050505",
    border: "#0d2b0d", promptColor: "#00ff00", errorColor: "#ff0000",
    outputColor: "#00cc00", systemColor: "#007700", infoColor: "#00ffff",
    inputColor: "#00ff00", cursorColor: "#00ff00", accentColor: "#00ff00",
    font: "'Courier New',monospace",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════════════════
const INITIAL_GAME = {
  difficulty: null,
  theme: "default",
  disks: { sda: { size: "512G", table: null, partitions: [] } },
  mounted: {},
  isChrooted: false,
  baseInstalled: false,
  fstabGenerated: false,
  bootloaderInstalled: false,
  networkConnected: false,
  localeSet: false,
  passwdSet: false,
  timezone: null,
  hostname: null,
  fdiskMode: null,
};

const STEPS = [
  { id: "network",    label: "Подключение к сети",     check: s => s.networkConnected },
  { id: "disk_table", label: "Таблица разделов (GPT)",  check: s => s.disks.sda.table === "gpt" },
  { id: "partitions", label: "Разделы созданы",         check: s => s.disks.sda.partitions.length >= 2 },
  { id: "formatted",  label: "Разделы отформатированы", check: s => s.disks.sda.partitions.some(p => p.fs) },
  { id: "mounted",    label: "/mnt смонтирован",        check: s => !!s.mounted["/mnt"] },
  { id: "pacstrap",   label: "Базовая система",         check: s => s.baseInstalled },
  { id: "fstab",      label: "fstab сгенерирован",      check: s => s.fstabGenerated },
  { id: "chroot",     label: "arch-chroot",             check: s => s.isChrooted },
  { id: "timezone",   label: "Часовой пояс",            check: s => !!s.timezone },
  { id: "locale",     label: "Локаль",                  check: s => s.localeSet },
  { id: "hostname",   label: "Hostname",                check: s => !!s.hostname },
  { id: "passwd",     label: "Пароль root",             check: s => s.passwdSet },
  { id: "bootloader", label: "Bootloader (GRUB)",       check: s => s.bootloaderInstalled },
  { id: "reboot",     label: "Перезагрузка",            check: () => false },
];

const HINTS = {
  network:    { step: "Подключись к сети",          cmd: "ping archlinux.org" },
  disk_table: { step: "Создай таблицу разделов",    cmd: "fdisk /dev/sda  (затем: g → GPT)" },
  partitions: { step: "Создай разделы в fdisk",     cmd: "n (EFI ~512M),  n (root),  w (сохранить)" },
  formatted:  { step: "Отформатируй разделы",       cmd: "mkfs.fat -F32 /dev/sda1   |   mkfs.ext4 /dev/sda2" },
  mounted:    { step: "Смонтируй корневой раздел",  cmd: "mount /dev/sda2 /mnt" },
  pacstrap:   { step: "Установи базовую систему",   cmd: "pacstrap /mnt base linux linux-firmware" },
  fstab:      { step: "Сгенерируй fstab",           cmd: "genfstab -U /mnt >> /mnt/etc/fstab" },
  chroot:     { step: "Войди в систему",            cmd: "arch-chroot /mnt" },
  timezone:   { step: "Установи часовой пояс",      cmd: "ln -sf /usr/share/zoneinfo/Europe/Moscow /etc/localtime" },
  locale:     { step: "Настрой локаль",             cmd: "nano /etc/locale.gen  →  locale-gen" },
  hostname:   { step: "Задай имя хоста",            cmd: "echo myhostname > /etc/hostname" },
  passwd:     { step: "Установи пароль root",       cmd: "passwd" },
  bootloader: { step: "Установи GRUB",              cmd: "pacman -S grub  →  grub-install  →  grub-mkconfig" },
  reboot:     { step: "Перезагрузись",              cmd: "exit  →  umount -R /mnt  →  reboot" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
  return `${String(m).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER-SIDE VALIDATOR (Anthropic API)
// ═══════════════════════════════════════════════════════════════════════════════
async function validateReplayOnServer(replay) {
  const { sessionId, difficulty, commands, finalHash, elapsedMs } = replay;

  const cmdList = commands.map((c, i) => `${i+1}. [t=${c.t_game.toFixed(1)}s] ${c.cmd}`).join("\n");

  const prompt = `You are a strict Arch Linux installation validator. Simulate this replay and return ONLY valid JSON.

SESSION: ${sessionId}
DIFFICULTY: ${difficulty}
TOTAL_TIME: ${(elapsedMs/1000).toFixed(1)}s
COMMANDS (${commands.length} total):
${cmdList}

Simulate the Arch Linux installation state machine:
- Track disk partitions, mounts, packages, chroot, bootloader
- Verify logical order (can't pacstrap before mount, can't arch-chroot before genfstab, etc.)
- Check minimum required steps are completed
- Detect suspicious timing (commands faster than humanly possible: <0.3s between consecutive commands)
- Check for macro spam (>10 commands/second sustained)

REQUIRED for valid install: network connected, 2+ partitions, formatted, /mnt mounted, pacstrap done, fstab, chroot, bootloader, reboot.

Return ONLY this JSON (no markdown, no explanation):
{
  "valid": true/false,
  "completed_steps": ["network","disk_table","partitions","formatted","mounted","pacstrap","fstab","chroot","timezone","locale","hostname","passwd","bootloader","reboot"],
  "missing_steps": [],
  "suspicious": false,
  "suspicious_reason": "",
  "commands_count": ${commands.length},
  "score_time_ms": ${elapsedMs},
  "verdict": "ACCEPTED" or "REJECTED",
  "rejection_reason": ""
}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  const data = await resp.json();
  const text = data.content.find(b => b.type === "text")?.text || "{}";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FDISK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
function handleFdisk(input, mode, currentDisk) {
  const cmd = input.trim().toLowerCase();
  if (cmd === "m" || cmd === "help") return { lines:[{ text:"  g   create GPT\n  n   new partition\n  d   delete partition\n  p   print table\n  w   write & exit\n  q   quit without saving", type:"output" }] };
  if (cmd === "q") return { lines:[], newFdiskMode:null };
  if (cmd === "g") return { lines:[{ text:`Created a new GPT disklabel (GUID: ${uuid().toUpperCase()}).`, type:"output" }], newFdiskMode:{ ...mode, tableType:"gpt" } };
  if (cmd === "p") {
    const parts = mode.pendingPartitions;
    let out = `Disk /dev/sda: 512 GiB\nDisklabel type: ${mode.tableType||"unknown"}\n\nDevice     Start    End    Size  Type`;
    parts.forEach((p,i) => { out += `\n/dev/sda${i+1}  2048     ...    ${p.size}  ${i===0?"EFI System":"Linux filesystem"}`; });
    if (!parts.length) out += "\n(no partitions)";
    return { lines:[{ text:out, type:"output" }] };
  }
  if (cmd === "n") {
    const num = mode.pendingPartitions.length + 1;
    const size = num === 1 ? "512M" : "511.5G";
    return {
      lines:[{ text:`Partition number (${num}-128, default ${num}): ${num}\nFirst sector (2048-1073741823, default 2048):\nLast sector ... : +${size}\n\nCreated a new partition ${num} of type 'Linux filesystem' and of size ${size}.`, type:"output" }],
      newFdiskMode:{ ...mode, pendingPartitions:[...mode.pendingPartitions, { size, fs:null }] },
    };
  }
  if (cmd === "d") {
    if (!mode.pendingPartitions.length) return { lines:[{ text:"No partition is defined yet!", type:"error" }] };
    const n = mode.pendingPartitions.length;
    return { lines:[{ text:`Selected partition ${n}\nPartition ${n} has been deleted.`, type:"output" }], newFdiskMode:{ ...mode, pendingPartitions:mode.pendingPartitions.slice(0,-1) } };
  }
  if (cmd === "w") return { lines:[{ text:"The partition table has been altered.\nCalling ioctl() to re-read partition table.\nSyncing disks.", type:"output" }], newFdiskMode:null, newDisk:{ ...currentDisk, table:mode.tableType||"gpt", partitions:mode.pendingPartitions } };
  return { lines:[{ text:`fdisk: invalid option -- '${cmd}'`, type:"error" }] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND PARSER
// ═══════════════════════════════════════════════════════════════════════════════
function parseCommand(rawInput, state) {
  const trimmed = rawInput.trim();
  if (!trimmed) return { lines:[] };
  const parts = trimmed.split(/\s+/), cmd = parts[0], args = parts.slice(1);

  if (state.difficulty === "EXPERT" && Math.random() < 0.12 && ["pacstrap","pacman"].includes(cmd)) {
    const e = ["error: failed to update core","error: target not found: linux-firmware","Network is unreachable",":: PGP signature verification failed"];
    return { lines:[{ text:e[Math.floor(Math.random()*e.length)], type:"error" }] };
  }

  if (state.fdiskMode) {
    const { lines, newFdiskMode, newDisk } = handleFdisk(trimmed, state.fdiskMode, state.disks.sda);
    return { lines, stateUpdater: s => ({ ...s, fdiskMode: newFdiskMode!==undefined?newFdiskMode:s.fdiskMode, disks: newDisk?{ ...s.disks, sda:newDisk }:s.disks }) };
  }

  switch (cmd) {
    case "clear": return { special:"clear" };
    case "fake_settings": {
      if (args[0] === "theme") {
        if (!args[1]) return { lines:[{ text:`Themes:\n${Object.entries(THEMES).map(([k,v])=>`  ${k.padEnd(16)} ${v.name}`).join("\n")}\n\nUsage: fake_settings theme <n>`, type:"info" }] };
        if (!THEMES[args[1]]) return { lines:[{ text:`Unknown theme '${args[1]}'`, type:"error" }] };
        return { lines:[{ text:`✓ Theme: ${THEMES[args[1]].name}`, type:"info" }], stateUpdater: s=>({ ...s, theme:args[1] }) };
      }
      return { lines:[{ text:"fake_settings theme <n>  — сменить тему\nfake_settings theme      — список тем", type:"info" }] };
    }
    case "help": return { lines:[{ text:"Arch Trainer — команды:\n  lsblk, fdisk /dev/sda, mkfs.ext4, mkfs.fat\n  mount, umount, pacstrap, genfstab, arch-chroot\n  pacman, passwd, locale-gen, ln, echo, cat, nano\n  grub-install, grub-mkconfig, ping, iwctl\n  reboot, exit, clear, difficulty\n  fake_settings theme <n>", type:"info" }] };
    case "difficulty": {
      const lv = args[0]?.toUpperCase(), valid = ["BEGINNER","EXPERIENCED","EXPERT","GOD"];
      if (!lv) return { lines:[{ text:`Текущая: ${state.difficulty}`, type:"info" }] };
      if (!valid.includes(lv)) return { lines:[{ text:`Неизвестный уровень: ${args[0]}`, type:"error" }] };
      return { lines:[{ text:`Сложность: ${lv}`, type:"info" }], stateUpdater: s=>({ ...s, difficulty:lv }) };
    }
    case "ping": {
      const t = args.find(a=>!a.startsWith("-"))||"";
      if (!t) return { lines:[{ text:"ping: Destination address required", type:"error" }] };
      if (!["archlinux.org","8.8.8.8","google.com","1.1.1.1"].includes(t)) return { lines:[{ text:`ping: ${t}: Name or service not known`, type:"error" }] };
      return { lines:[{ text:`PING ${t} (95.217.163.246) 56(84) bytes of data.\n64 bytes from ${t}: icmp_seq=1 ttl=50 time=42.3 ms\n64 bytes from ${t}: icmp_seq=2 ttl=50 time=41.8 ms\n64 bytes from ${t}: icmp_seq=3 ttl=50 time=43.1 ms\n\n--- ${t} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss`, type:"output" }], stateUpdater: s=>({ ...s, networkConnected:true }) };
    }
    case "iwctl": return { lines:[{ text:"[iwd]# station wlan0 scan\n[iwd]# station wlan0 get-networks\n    Network name   Security   Signal\n    ─────────────────────────────────\n    HomeNetwork    psk        ****\n[iwd]# station wlan0 connect HomeNetwork\nPassphrase: ••••••••\n[iwd]# exit\n✓ Connected to HomeNetwork", type:"output" }], stateUpdater: s=>({ ...s, networkConnected:true }) };
    case "lsblk": {
      const { table, partitions } = state.disks.sda;
      let out = `NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS\nsda      8:0    0   512G  0 disk`;
      partitions.forEach((p,i) => { const mp = Object.entries(state.mounted).find(([,v])=>v===`/dev/sda${i+1}`)?.[0]||""; out += `\n├─sda${i+1}   8:${i+1}    0  ${p.size.padEnd(6)}  0 part ${mp}`; });
      return { lines:[{ text:out, type:"output" }] };
    }
    case "fdisk": {
      if (!args[0]) return { lines:[{ text:"Usage: fdisk /dev/sdX", type:"error" }] };
      if (args[0]!=="/dev/sda") return { lines:[{ text:`fdisk: cannot open ${args[0]}: No such file or directory`, type:"error" }] };
      return { lines:[{ text:"Welcome to fdisk (util-linux 2.39.3).\nChanges will remain in memory only, until you decide to write them.\nBe careful before using the write command.", type:"output" }], stateUpdater: s=>({ ...s, fdiskMode:{ device:"sda", tableType:s.disks.sda.table, pendingPartitions:[...s.disks.sda.partitions] } }) };
    }
    case "mkfs.ext4": {
      const dev = args[0];
      if (!dev) return { lines:[{ text:"Usage: mkfs.ext4 /dev/sdXN", type:"error" }] };
      const m = dev.match(/^\/dev\/sda(\d+)$/);
      if (!m) return { lines:[{ text:`mke2fs: ${dev}: No such file or directory`, type:"error" }] };
      const idx = parseInt(m[1])-1;
      if (!state.disks.sda.partitions[idx]) return { lines:[{ text:`mke2fs: ${dev}: No such file or directory`, type:"error" }] };
      return { lines:[{ text:`mke2fs 1.47.0 (5-Feb-2023)\nCreating filesystem with 133955584 4k blocks\nFilesystem UUID: ${uuid()}\nAllocating group tables: done\nWriting inode tables: done\nCreating journal: done\ndone`, type:"output" }], stateUpdater: s=>{ const p=[...s.disks.sda.partitions]; p[idx]={ ...p[idx], fs:"ext4" }; return { ...s, disks:{ ...s.disks, sda:{ ...s.disks.sda, partitions:p } } }; } };
    }
    case "mkfs.fat": {
      const dev = args.find(a=>a.startsWith("/dev/"));
      if (!dev) return { lines:[{ text:"Usage: mkfs.fat -F32 /dev/sdXN", type:"error" }] };
      const m = dev.match(/^\/dev\/sda(\d+)$/);
      if (!m) return { lines:[{ text:`mkfs.fat: ${dev}: No such file or directory`, type:"error" }] };
      const idx = parseInt(m[1])-1;
      if (!state.disks.sda.partitions[idx]) return { lines:[{ text:`mkfs.fat: ${dev}: No such file or directory`, type:"error" }] };
      return { lines:[{ text:"mkfs.fat 4.2 (2021-01-31)", type:"output" }], stateUpdater: s=>{ const p=[...s.disks.sda.partitions]; p[idx]={ ...p[idx], fs:"fat32" }; return { ...s, disks:{ ...s.disks, sda:{ ...s.disks.sda, partitions:p } } }; } };
    }
    case "mount": {
      if (args.length<2) return { lines:[{ text:"Usage: mount /dev/sdXN /mountpoint", type:"error" }] };
      const [dev,mp] = args, m = dev.match(/^\/dev\/sda(\d+)$/);
      if (!m) return { lines:[{ text:`mount: special device ${dev} does not exist`, type:"error" }] };
      const idx = parseInt(m[1])-1, part = state.disks.sda.partitions[idx];
      if (!part) return { lines:[{ text:`mount: special device ${dev} does not exist`, type:"error" }] };
      if (!part.fs) return { lines:[{ text:`mount: ${dev}: can't read superblock`, type:"error" }] };
      return { lines:[], stateUpdater: s=>({ ...s, mounted:{ ...s.mounted, [mp]:dev } }) };
    }
    case "umount": {
      const flag = args[0]==="-R", target = flag?args[1]:args[0];
      if (!target) return { lines:[{ text:"Usage: umount [-R] /mountpoint", type:"error" }] };
      return { lines:[], stateUpdater: s=>{ const m={ ...s.mounted }; delete m[target]; return { ...s, mounted:m }; } };
    }
    case "mkdir": return { lines:[] };
    case "pacstrap": {
      if (!state.mounted["/mnt"]) return { lines:[{ text:"pacstrap: /mnt is not a mount point", type:"error" }] };
      if (args[0]!=="/mnt") return { lines:[{ text:`pacstrap: ${args[0]}: not a valid mount point`, type:"error" }] };
      if (!args.slice(1).length) return { lines:[{ text:"pacstrap: no packages specified", type:"error" }] };
      return { lines:[{ text:`:: Synchronizing package databases...\n core downloading...\n extra downloading...\n\nPackages (${args.slice(1).length+47}): base  linux  linux-firmware  systemd  ...\n\nTotal: 312.48 MiB\n\n:: Retrieving packages...\n(48/48) installing base\n(48/48) installing linux-firmware\n:: Running post-transaction hooks...\nInstallation complete.`, type:"output" }], stateUpdater: s=>({ ...s, baseInstalled:true }) };
    }
    case "genfstab": {
      if (!state.baseInstalled) return { lines:[{ text:"genfstab: /mnt: not a valid system root", type:"error" }] };
      return { lines:[{ text:`# Generated by genfstab\nUUID=${uuid()}   /          ext4   rw,relatime  0 1\nUUID=${uuid()}   /boot/efi  vfat   umask=0077   0 2`, type:"output" }], stateUpdater: s=>({ ...s, fstabGenerated:true }) };
    }
    case "arch-chroot": {
      if (!state.fstabGenerated) return { lines:[{ text:"arch-chroot: /mnt: failed sanity check. Run genfstab first.", type:"error" }] };
      return { lines:[{ text:"chroot: changing root to /mnt", type:"output" }], stateUpdater: s=>({ ...s, isChrooted:true }) };
    }
    case "ln": {
      if (args[0]==="-sf" && args[1]?.startsWith("/usr/share/zoneinfo/")) {
        const tz = args[1].replace("/usr/share/zoneinfo/","");
        return { lines:[], stateUpdater: s=>({ ...s, timezone:tz }) };
      }
      return { lines:[] };
    }
    case "locale-gen": return { lines:[{ text:"Generating locales...\n  en_US.UTF-8... done\n  ru_RU.UTF-8... done\nGeneration complete.", type:"output" }], stateUpdater: s=>({ ...s, localeSet:true }) };
    case "echo": {
      if (trimmed.includes(">") && trimmed.includes("/etc/hostname")) {
        const hostname = trimmed.match(/echo\s+(\S+)\s+>/)?.[1]||"archlinux";
        return { lines:[], stateUpdater: s=>({ ...s, hostname }) };
      }
      if (trimmed.includes(">")) return { lines:[] };
      return { lines:[{ text:args.join(" "), type:"output" }] };
    }
    case "cat": {
      if (args[0]==="/sys/firmware/efi/fw_platform_size") return { lines:[{ text:"64", type:"output" }] };
      if (args[0]==="/etc/fstab") { if (!state.fstabGenerated) return { lines:[{ text:"cat: /etc/fstab: No such file or directory", type:"error" }] }; return { lines:[{ text:`# /etc/fstab\nUUID=${uuid()}  /  ext4  defaults  0 1`, type:"output" }] }; }
      return { lines:[{ text:`cat: ${args[0]||"(missing operand)"}: No such file or directory`, type:"error" }] };
    }
    case "passwd": {
      if (!state.isChrooted) return { lines:[{ text:"passwd: Authentication token manipulation error", type:"error" }] };
      return { lines:[{ text:"New password: \nRetype new password: \npasswd: password updated successfully", type:"output" }], stateUpdater: s=>({ ...s, passwdSet:true }) };
    }
    case "nano": case "vim": case "vi": {
      if (args[0]==="/etc/locale.gen") return { lines:[{ text:"[Editing /etc/locale.gen]\nen_US.UTF-8 UTF-8  ← uncommented\nru_RU.UTF-8 UTF-8  ← uncommented\n[Saved]", type:"output" }], stateUpdater: s=>({ ...s, localeSet:true }) };
      return { lines:[{ text:`[Editing ${args[0]||"new file"}]\n[Saved and closed]`, type:"output" }] };
    }
    case "pacman": {
      if (!state.isChrooted) return { lines:[{ text:"error: you cannot perform this operation unless you are root", type:"error" }] };
      if (["-S","-Sy","-Syu"].includes(args[0])) return { lines:[{ text:`resolving dependencies...\ninstalling: ${args.slice(1).join(" ")}`, type:"output" }] };
      return { lines:[{ text:"Usage: pacman -S <package>", type:"info" }] };
    }
    case "grub-install": return { lines:[{ text:"Installing for x86_64-efi platform.\nInstallation finished. No error reported.", type:"output" }] };
    case "grub-mkconfig": {
      if (args[0]!=="-o") return { lines:[{ text:"Usage: grub-mkconfig -o /boot/grub/grub.cfg", type:"error" }] };
      return { lines:[{ text:"Generating grub configuration file ...\nFound linux image: /boot/vmlinuz-linux\nFound initrd image: /boot/initramfs-linux.img\ndone", type:"output" }], stateUpdater: s=>({ ...s, bootloaderInstalled:true }) };
    }
    case "exit": {
      if (state.isChrooted) return { lines:[{ text:"logout", type:"system" }], stateUpdater: s=>({ ...s, isChrooted:false }) };
      return { lines:[{ text:"logout", type:"system" }] };
    }
    case "reboot": {
      if (!state.bootloaderInstalled) return { lines:[{ text:"Rebooting...\n[ FAILED ] Kernel panic — not syncing: VFS: Unable to mount root fs\nGRUB не установлен!", type:"error" }] };
      return { special:"reboot" };
    }
    default: return { lines:[{ text:`-bash: ${cmd}: command not found`, type:"error" }] };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function LeaderboardScreen({ onBack, T }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("lb:entries", true);
        const data = res ? JSON.parse(res.value) : [];
        setEntries(data.sort((a,b) => a.timeMs - b.timeMs).slice(0,20));
      } catch { setEntries([]); }
      setLoading(false);
    })();
  }, []);

  const diffColor = { BEGINNER:"#00ff87", EXPERIENCED:"#00d4ff", EXPERT:"#ff9500", GOD:"#ff3b3b" };
  const medalColors = ["#ffd700","#c0c0c0","#cd7f32"];

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", padding:"32px", fontFamily:T.font, overflowY:"auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"32px" }}>
        <div>
          <div style={{ color:T.promptColor, fontSize:"18px", fontWeight:"bold", letterSpacing:"3px" }}>LEADERBOARD</div>
          <div style={{ color:"#555", fontSize:"10px", marginTop:"4px" }}>Verified runs only · Server-validated replays</div>
        </div>
        <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.systemColor, padding:"6px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:"11px", borderRadius:"3px" }}>← Назад</button>
      </div>

      {loading ? (
        <div style={{ color:T.systemColor, fontSize:"12px" }}>Загрузка...</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0" }}>
          <div style={{ color:"#333", fontSize:"48px", marginBottom:"16px" }}>🏆</div>
          <div style={{ color:T.systemColor, fontSize:"13px" }}>Таблица пуста. Стань первым!</div>
          <div style={{ color:"#444", fontSize:"10px", marginTop:"8px" }}>Завершите установку и отправьте результат</div>
        </div>
      ) : (
        <div>
          {/* Header */}
          <div style={{ display:"grid", gridTemplateColumns:"40px 1fr 100px 80px 80px 120px", gap:"8px", padding:"8px 12px", borderBottom:`1px solid ${T.border}`, marginBottom:"4px" }}>
            {["#","Игрок","Сложность","Команд","Время","Дата"].map(h => (
              <div key={h} style={{ color:"#444", fontSize:"9px", letterSpacing:"1px" }}>{h}</div>
            ))}
          </div>

          {entries.map((e, i) => (
            <div key={e.id} style={{ display:"grid", gridTemplateColumns:"40px 1fr 100px 80px 80px 120px", gap:"8px", padding:"10px 12px", borderBottom:`1px solid ${T.border}22`, alignItems:"center", background: i < 3 ? `${medalColors[i]}08` : "transparent" }}>
              <div style={{ color: i < 3 ? medalColors[i] : "#555", fontSize:"14px", fontWeight:"bold" }}>
                {i < 3 ? ["🥇","🥈","🥉"][i] : `${i+1}`}
              </div>
              <div>
                <div style={{ color:T.outputColor, fontSize:"11px" }}>{e.playerName}</div>
                <div style={{ color:"#444", fontSize:"9px", fontFamily:"monospace" }}>{e.sessionId}</div>
              </div>
              <div style={{ color: diffColor[e.difficulty]||"#888", fontSize:"10px", letterSpacing:"1px" }}>{e.difficulty}</div>
              <div style={{ color:T.systemColor, fontSize:"11px", fontFamily:"monospace" }}>{e.commandsCount}</div>
              <div style={{ color:T.promptColor, fontSize:"12px", fontFamily:"monospace", fontWeight:"bold" }}>{fmtTime(e.timeMs)}</div>
              <div style={{ color:"#444", fontSize:"9px" }}>{new Date(e.submittedAt).toLocaleDateString("ru-RU")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBMIT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function SubmitScreen({ replayData, onComplete, T }) {
  const [phase, setPhase] = useState("form"); // form | validating | result
  const [playerName, setPlayerName] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);
  const addLog = (msg, type="info") => setLog(l => [...l, { msg, type, t: Date.now() }]);

  const submit = async () => {
    if (!playerName.trim()) return;
    setPhase("validating");
    setLog([]);

    try {
      addLog(`Session: ${replayData.sessionId}`);
      addLog(`Commands: ${replayData.commands.length}`);
      addLog(`Time: ${fmtTime(replayData.elapsedMs)}`);
      addLog("Проверяем целостность hash-цепочки...");

      // Verify hash chain locally first
      let prevHash = replayData.sessionId;
      let chainValid = true;
      for (const c of replayData.commands) {
        const expected = await chainHash(prevHash, c.cmd, c.t_game, replayData.sessionSecret);
        if (expected !== c.hash) { chainValid = false; break; }
        prevHash = c.hash;
      }

      if (!chainValid) {
        addLog("❌ Hash chain broken — replay tampered!", "error");
        setPhase("result");
        setResult({ verdict:"REJECTED", rejection_reason:"Hash chain integrity check failed. Replay was tampered." });
        return;
      }
      addLog("✓ Hash chain intact");
      addLog("Отправляем replay на сервер...");

      const validation = await validateReplayOnServer(replayData);
      addLog(`Сервер: ${validation.verdict}`);

      if (validation.verdict === "ACCEPTED") {
        addLog(`✓ Установка валидна (${validation.completed_steps?.length||0} шагов)`);
        // Save to leaderboard
        const entry = {
          id: uuid(),
          playerName: playerName.trim(),
          sessionId: replayData.sessionId,
          difficulty: replayData.difficulty,
          timeMs: validation.score_time_ms || replayData.elapsedMs,
          commandsCount: validation.commands_count || replayData.commands.length,
          submittedAt: Date.now(),
          replayHash: replayData.commands[replayData.commands.length-1]?.hash || "",
        };

        try {
          let existing = [];
          try {
            const stored = await window.storage.get("lb:entries", true);
            if (stored) existing = JSON.parse(stored.value);
          } catch {}
          existing.push(entry);
          await window.storage.set("lb:entries", JSON.stringify(existing), true);
          addLog("✓ Результат сохранён в leaderboard!");
        } catch (e) {
          addLog("Leaderboard недоступен (локальный режим)", "warn");
        }
      } else {
        addLog(`✗ ${validation.rejection_reason||"Replay rejected"}`, "error");
      }

      setResult(validation);
      setPhase("result");
    } catch (err) {
      addLog(`Ошибка API: ${err.message}`, "error");
      setError(err.message);
      setPhase("result");
    }
  };

  const cols = { info:"#888", error:"#ff5555", warn:"#ff9500" };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", padding:"40px", fontFamily:T.font }}>
      <div style={{ width:"100%", maxWidth:"540px" }}>
        <div style={{ color:T.promptColor, fontSize:"16px", letterSpacing:"3px", marginBottom:"4px" }}>SUBMIT RUN</div>
        <div style={{ color:"#444", fontSize:"10px", marginBottom:"28px" }}>Replay будет валидирован на сервере</div>

        {/* Replay summary */}
        <div style={{ background:T.sideBg, border:`1px solid ${T.border}`, borderRadius:"6px", padding:"16px", marginBottom:"20px" }}>
          <div style={{ color:"#444", fontSize:"9px", letterSpacing:"2px", marginBottom:"10px" }}>REPLAY SUMMARY</div>
          {[
            ["Session ID",  replayData.sessionId],
            ["Сложность",   replayData.difficulty],
            ["Время",       fmtTime(replayData.elapsedMs)],
            ["Команд",      replayData.commands.length],
            ["Final hash",  (replayData.commands[replayData.commands.length-1]?.hash||"—").slice(0,16)+"..."],
          ].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", lineHeight:"2", borderBottom:`1px solid ${T.border}33`, paddingBottom:"2px" }}>
              <span style={{ color:"#555" }}>{k}</span>
              <span style={{ color:T.outputColor, fontFamily:"monospace", fontSize:"10px" }}>{v}</span>
            </div>
          ))}
        </div>

        {phase === "form" && (
          <>
            <div style={{ marginBottom:"16px" }}>
              <div style={{ color:T.systemColor, fontSize:"11px", marginBottom:"6px" }}>Имя игрока</div>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="root"
                maxLength={24}
                style={{ width:"100%", background:T.sideBg, border:`1px solid ${T.border}`, borderRadius:"4px", padding:"8px 12px", color:T.inputColor, fontFamily:T.font, fontSize:"12px", outline:"none", boxSizing:"border-box" }}
                autoFocus
              />
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={submit} disabled={!playerName.trim()}
                style={{ flex:1, background:"transparent", border:`1px solid ${T.promptColor}`, color:T.promptColor, padding:"10px", cursor:"pointer", fontFamily:"inherit", fontSize:"12px", borderRadius:"4px", opacity:playerName.trim()?1:0.4 }}>
                Отправить на валидацию →
              </button>
              <button onClick={() => onComplete("leaderboard")}
                style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.systemColor, padding:"10px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:"11px", borderRadius:"4px" }}>
                Пропустить
              </button>
            </div>
          </>
        )}

        {phase === "validating" && (
          <div style={{ background:T.sideBg, border:`1px solid ${T.border}`, borderRadius:"6px", padding:"16px" }}>
            <div style={{ color:"#444", fontSize:"9px", letterSpacing:"2px", marginBottom:"10px" }}>SERVER VALIDATION LOG</div>
            {log.map((l,i) => (
              <div key={i} style={{ color:cols[l.type]||cols.info, fontSize:"11px", fontFamily:"monospace", lineHeight:"1.8" }}>
                {l.type==="error"?"✗ ":l.type==="warn"?"⚠ ":"  "}{l.msg}
              </div>
            ))}
            <div style={{ color:T.promptColor, fontSize:"11px", marginTop:"8px" }}>
              <span style={{ animation:"blink 1s step-end infinite", display:"inline-block" }}>▌</span> Processing...
            </div>
          </div>
        )}

        {phase === "result" && result && (
          <div>
            <div style={{ background:T.sideBg, border:`1px solid ${result.verdict==="ACCEPTED"?T.promptColor:T.errorColor}`, borderRadius:"6px", padding:"16px", marginBottom:"16px" }}>
              <div style={{ color:"#444", fontSize:"9px", letterSpacing:"2px", marginBottom:"10px" }}>VALIDATION LOG</div>
              {log.map((l,i) => (
                <div key={i} style={{ color:cols[l.type]||cols.info, fontSize:"11px", fontFamily:"monospace", lineHeight:"1.8" }}>
                  {l.type==="error"?"✗ ":l.type==="warn"?"⚠ ":"  "}{l.msg}
                </div>
              ))}
            </div>

            <div style={{ textAlign:"center", padding:"20px 0" }}>
              {result.verdict === "ACCEPTED" ? (
                <>
                  <div style={{ fontSize:"40px", marginBottom:"8px" }}>🎉</div>
                  <div style={{ color:T.promptColor, fontSize:"16px", marginBottom:"4px" }}>ACCEPTED</div>
                  <div style={{ color:T.systemColor, fontSize:"11px" }}>Время: {fmtTime(result.score_time_ms||replayData.elapsedMs)}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:"40px", marginBottom:"8px" }}>❌</div>
                  <div style={{ color:T.errorColor, fontSize:"16px", marginBottom:"4px" }}>REJECTED</div>
                  <div style={{ color:T.systemColor, fontSize:"11px" }}>{result.rejection_reason||error||"Validation failed"}</div>
                </>
              )}
            </div>

            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => onComplete("leaderboard")}
                style={{ flex:1, background:"transparent", border:`1px solid ${T.promptColor}`, color:T.promptColor, padding:"10px", cursor:"pointer", fontFamily:"inherit", fontSize:"12px", borderRadius:"4px" }}>
                Таблица лидеров →
              </button>
              <button onClick={() => onComplete("restart")}
                style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.systemColor, padding:"10px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:"11px", borderRadius:"4px" }}>
                Заново
              </button>
            </div>
          </div>
        )}

        {phase === "result" && error && !result && (
          <div>
            <div style={{ color:T.errorColor, fontSize:"12px", marginBottom:"16px" }}>Ошибка: {error}</div>
            <button onClick={() => onComplete("leaderboard")} style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.systemColor, padding:"10px 20px", cursor:"pointer", fontFamily:"inherit", fontSize:"11px", borderRadius:"4px" }}>
              Leaderboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REBOOT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function RebootScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  const lines = ["[ OK ] Reached target System Shutdown.","[ OK ] Stopped target Basic System.","[ OK ] Unmounting /mnt...","[ OK ] Stopped target Local File Systems.","Sending SIGTERM to remaining processes...","Rebooting.","","SeaBIOS (version 1.14.0-2)",`Machine UUID: ${uuid()}`,"","Arch Linux 6.8.1-arch1-1 (tty1)","","myhostname login: root","Password: ••••••••","","✓ System boot successful!"];
  useEffect(() => {
    if (phase < lines.length) { const t = setTimeout(() => setPhase(p=>p+1), phase>10?300:100); return ()=>clearTimeout(t); }
    else { setTimeout(onDone, 800); }
  }, [phase]);
  return (
    <div style={{ height:"100%", display:"flex", justifyContent:"center", alignItems:"center", background:"#000", padding:"40px" }}>
      <div style={{ maxWidth:"600px", width:"100%" }}>
        {lines.slice(0,phase).map((l,i) => (
          <div key={i} style={{ color:l.startsWith("[ OK ]")?"#00ff87":l.includes("✓")?T?.promptColor||"#00ff87":l.startsWith("Arch")||l.startsWith("myhostname")||l.startsWith("[root@")?"#fff":"#666", fontSize:"12px", fontFamily:"monospace", lineHeight:"1.8" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIFFICULTY SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function DifficultyScreen({ onSelect, onLeaderboard }) {
  const levels = [
    { id:"BEGINNER",    label:"BEGINNER",    ru:"Начинающий",  desc:"Подсказки, объяснения, пошаговое руководство", color:"#00ff87" },
    { id:"EXPERIENCED", label:"EXPERIENCED", ru:"Опытный",     desc:"Таймер, минимум подсказок, leaderboard",        color:"#00d4ff" },
    { id:"EXPERT",      label:"EXPERT",      ru:"Знаток",      desc:"Случайные ошибки, сетевые проблемы",            color:"#ff9500" },
    { id:"GOD",         label:"GOD MODE",    ru:"Бог",         desc:"Хардкор. Одна ошибка = рестарт",               color:"#ff3b3b" },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:"40px", fontFamily:"'IBM Plex Mono','Courier New',monospace" }}>
      <div style={{ color:"#00ff87", fontSize:"11px", letterSpacing:"4px", marginBottom:"8px", opacity:0.7 }}>ARCH LINUX TRAINER v2.0</div>
      <pre style={{ color:"#00ff87", fontSize:"9px", lineHeight:"1.2", marginBottom:"28px", textAlign:"center" }}>{`  ████████╗██████╗  █████╗ ██╗███╗  ██╗███████╗██████╗ 
     ██╔══╝██╔══██╗██╔══██╗██║████╗ ██║██╔════╝██╔══██╗
     ██║   ██████╔╝███████║██║██╔██╗██║█████╗  ██████╔╝
     ██║   ██╔══██╗██╔══██║██║██║╚████║██╔══╝  ██╔══██╗
     ██║   ██║  ██║██║  ██║██║██║ ╚███║███████╗██║  ██║
     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚══╝╚══════╝╚═╝  ╚═╝`}</pre>
      <div style={{ display:"flex", gap:"12px", marginBottom:"28px" }}>
        <div style={{ color:"#333", fontSize:"10px", lineHeight:"1.5" }}>
          <div style={{ color:"#444", marginBottom:"4px" }}>🔒 Anti-cheat</div>
          <div>Hash chain validation</div>
          <div>Server-side replay simulation</div>
          <div>Timing anomaly detection</div>
        </div>
        <div style={{ width:"1px", background:"#1e1e1e" }} />
        <div style={{ color:"#333", fontSize:"10px", lineHeight:"1.5" }}>
          <div style={{ color:"#444", marginBottom:"4px" }}>🏆 Leaderboard</div>
          <div>Verified runs only</div>
          <div>Global shared ranking</div>
          <div>Replay storage</div>
        </div>
      </div>
      <div style={{ color:"#555", fontSize:"11px", marginBottom:"28px" }}>Выбери уровень сложности</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", maxWidth:"580px", width:"100%", marginBottom:"20px" }}>
        {levels.map(l => (
          <button key={l.id} onClick={() => onSelect(l.id)}
            style={{ background:"transparent", border:`1px solid ${l.color}33`, padding:"18px", cursor:"pointer", textAlign:"left", transition:"all 0.15s", borderRadius:"4px", fontFamily:"inherit" }}
            onMouseEnter={e => { e.currentTarget.style.background=`${l.color}11`; e.currentTarget.style.borderColor=l.color; }}
            onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=`${l.color}33`; }}>
            <div style={{ color:l.color, fontSize:"12px", fontWeight:"bold", marginBottom:"3px", letterSpacing:"2px" }}>{l.label}</div>
            <div style={{ color:"#666", fontSize:"10px" }}>{l.ru}</div>
            <div style={{ color:"#444", fontSize:"9px", marginTop:"6px", lineHeight:"1.4" }}>{l.desc}</div>
          </button>
        ))}
      </div>
      <button onClick={onLeaderboard}
        style={{ background:"transparent", border:"1px solid #333", color:"#555", padding:"8px 24px", cursor:"pointer", fontFamily:"inherit", fontSize:"11px", borderRadius:"4px", letterSpacing:"1px" }}>
        🏆 LEADERBOARD
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function ArchTrainer() {
  const [gameState, setGameState] = useState(INITIAL_GAME);
  const [history, setHistory]     = useState([{ text:"Arch Linux 6.8.1.arch1-1 (tty1)\n\nThis is the Arch Linux installation medium.\n\nTo install Arch Linux follow the installation guide at:\nhttps://wiki.archlinux.org/title/Installation_guide", type:"system" }]);
  const [input, setInput]         = useState("");
  const [cmdHist, setCmdHist]     = useState([]);
  const [cmdHistIdx, setCmdHistIdx] = useState(-1);
  const [screen, setScreen]       = useState("difficulty");
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed]     = useState(0);
  const [showHint, setShowHint]   = useState(false);
  const [ctxMenu, setCtxMenu]     = useState(null);

  // ── Session & Replay ──
  const sessionRef    = useRef(null); // { id, secret, startUnix }
  const replayRef     = useRef([]);   // array of { cmd, t_game, t_unix, hash }
  const prevHashRef   = useRef("");
  const replayDataRef = useRef(null); // final replay for submit screen

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const T = THEMES[gameState.theme] || THEMES.default;

  // ── Init session on game start ──
  const initSession = useCallback(async (difficulty) => {
    const id     = uuid().slice(0,8).toUpperCase();
    const secret = genSecret();
    sessionRef.current  = { id, secret, startUnix: Date.now() };
    prevHashRef.current = id; // genesis hash = session id
    replayRef.current   = [];
    setGameState(s => ({ ...INITIAL_GAME, difficulty, theme: s.theme }));
    setHistory([{ text:"Arch Linux 6.8.1.arch1-1 (tty1)\n\nThis is the Arch Linux installation medium.\n\nTo install Arch Linux follow the installation guide at:\nhttps://wiki.archlinux.org/title/Installation_guide", type:"system" }]);
    setInput("");
    setCmdHist([]);
    setStartTime(Date.now());
  }, []);

  useEffect(() => {
    if (screen !== "terminal") return;
    const t = setInterval(() => setElapsed(Date.now() - (startTime||Date.now())), 1000);
    return () => clearInterval(t);
  }, [screen, startTime]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [history]);
  useEffect(() => { if (screen === "terminal") inputRef.current?.focus(); }, [screen]);

  const getPrompt = useCallback(() => {
    if (gameState.fdiskMode) return "Command (m for help): ";
    if (gameState.isChrooted) return "(chroot) [root@archiso /]# ";
    return "[root@archiso ~]# ";
  }, [gameState.fdiskMode, gameState.isChrooted]);

  const promptColor = gameState.fdiskMode ? T.infoColor : T.promptColor;

  const currentStep = STEPS.find(s => !s.check(gameState));
  const hint = currentStep ? HINTS[currentStep.id] : null;
  const hintText = hint ? `${hint.step}: ${hint.cmd}` : null;

  // ── Command handler ──
  const handleCommand = useCallback(async (raw) => {
    const cmd = raw.trim();
    if (!cmd) return;

    setCmdHist(p => [cmd, ...p.slice(0,49)]);
    setCmdHistIdx(-1);

    // Record to replay with hash chain
    const tGame = (Date.now() - (startTime||Date.now())) / 1000;
    const tUnix = Date.now();
    const hash  = await chainHash(prevHashRef.current, cmd, tGame, sessionRef.current?.secret||"");
    prevHashRef.current = hash;
    replayRef.current.push({ cmd, t_game: tGame, t_unix: tUnix, hash });

    const { lines=[], stateUpdater, special } = parseCommand(cmd, gameState);

    // GOD mode
    if (gameState.difficulty === "GOD" && lines.some(l => l.type === "error")) {
      setHistory([{ text:`[GOD MODE] FATAL:\n${lines[0].text}\n\nSYSTEM HALTED — restarting...`, type:"error" }]);
      setTimeout(() => initSession("GOD").then(() => setScreen("terminal")), 2500);
      return;
    }

    if (stateUpdater) setGameState(p => stateUpdater(p));
    if (special === "clear") { setHistory([]); setInput(""); return; }
    if (special === "reboot") {
      // Freeze replay for submission
      replayDataRef.current = {
        sessionId:     sessionRef.current?.id || "UNKNOWN",
        sessionSecret: sessionRef.current?.secret || "",
        difficulty:    gameState.difficulty,
        commands:      [...replayRef.current],
        elapsedMs:     elapsed,
        finalHash:     prevHashRef.current,
      };
      setScreen("reboot");
      setInput("");
      return;
    }

    const inputEntry = { type:"input", prompt: getPrompt(), text: cmd };
    setHistory(h => [...h, inputEntry, ...lines]);
    setInput("");

    const hasError = lines.some(l => l.type === "error");
    const inFdisk  = !!gameState.fdiskMode;
    if (gameState.difficulty === "BEGINNER" && !hasError && !inFdisk) {
      setTimeout(() => {
        setGameState(curr => {
          const nextStep = STEPS.find(s => !s.check(curr));
          if (nextStep) {
            const h = HINTS[nextStep.id];
            if (h) setHistory(hs => [...hs, { text:`┌─ 💡 ${h.step}\n└─ $ ${h.cmd}`, type:"info" }]);
          }
          return curr;
        });
      }, 150);
    }
  }, [gameState, getPrompt, startTime, elapsed, initSession]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") { e.preventDefault(); handleCommand(input); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCmdHistIdx(i => { const n=Math.min(i+1,cmdHist.length-1); setInput(cmdHist[n]||""); return n; }); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setCmdHistIdx(i => { const n=Math.max(i-1,-1); setInput(n===-1?"":cmdHist[n]||""); return n; }); }
    else if (e.key === "Tab") {
      e.preventDefault();
      const cmds = ["lsblk","fdisk /dev/sda","mkfs.ext4 /dev/sda","mkfs.fat -F32 /dev/sda","mount /dev/sda","umount -R /mnt","pacstrap /mnt base linux linux-firmware","genfstab -U /mnt >> /mnt/etc/fstab","arch-chroot /mnt","grub-install /dev/sda","grub-mkconfig -o /boot/grub/grub.cfg","pacman -S","passwd","locale-gen","reboot","exit","ping archlinux.org","iwctl","nano /etc/","ln -sf /usr/share/zoneinfo/","fake_settings theme","difficulty","clear"];
      const m = cmds.find(c => c.startsWith(input) && c !== input);
      if (m) setInput(m);
    } else if (e.ctrlKey && e.key === "l") { e.preventDefault(); setHistory([]); }
    else if (e.ctrlKey && e.key === "c") { e.preventDefault(); setHistory(h => [...h, { type:"input", prompt:getPrompt(), text:input+"^C" }]); setInput(""); }
  }, [input, cmdHist, handleCommand, getPrompt]);

  // Context menu
  const onCtx     = e => { e.preventDefault(); setCtxMenu({ x:e.clientX, y:e.clientY }); };
  const onCopy    = () => { const s=window.getSelection()?.toString(); if (s) navigator.clipboard?.writeText(s); setCtxMenu(null); };
  const onPaste   = async () => { try { const t=await navigator.clipboard?.readText(); if(t){ setInput(p=>p+t); inputRef.current?.focus(); } } catch {} setCtxMenu(null); };
  const onSelAll  = () => { const el=document.getElementById("term-body"); if(el){ const r=document.createRange(); r.selectNodeContents(el); const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); } setCtxMenu(null); };

  const completedCount = STEPS.filter(s => s.check(gameState)).length;
  const progress = completedCount / STEPS.length * 100;
  const diffColor = { BEGINNER:"#00ff87", EXPERIENCED:"#00d4ff", EXPERT:"#ff9500", GOD:"#ff3b3b" };

  // ── Screens ──
  if (screen === "difficulty") return (
    <div style={{ background:"#0d0d0d", width:"100%", height:"100vh" }}>
      <DifficultyScreen
        onSelect={async d => { await initSession(d); setStartTime(Date.now()); setElapsed(0); setScreen("terminal"); }}
        onLeaderboard={() => setScreen("leaderboard")}
      />
    </div>
  );

  if (screen === "leaderboard") return (
    <div style={{ background:T.bg, width:"100%", height:"100vh", fontFamily:T.font }}>
      <LeaderboardScreen onBack={() => setScreen("difficulty")} T={T} />
    </div>
  );

  if (screen === "reboot") return (
    <div style={{ background:"#000", width:"100%", height:"100vh" }}>
      <RebootScreen onDone={() => setScreen("submit")} />
    </div>
  );

  if (screen === "submit") return (
    <div style={{ background:T.bg, width:"100%", height:"100vh", fontFamily:T.font }}>
      <SubmitScreen
        replayData={replayDataRef.current}
        T={T}
        onComplete={action => {
          if (action === "leaderboard") setScreen("leaderboard");
          else { initSession(gameState.difficulty).then(() => setScreen("terminal")); }
        }}
      />
    </div>
  );

  // ── Terminal ──
  return (
    <div style={{ background:T.bg, width:"100%", height:"100vh", display:"flex", flexDirection:"column", fontFamily:T.font, overflow:"hidden" }}>

      {/* TOP BAR */}
      <div style={{ display:"flex", alignItems:"center", padding:"5px 14px", background:T.topBg, borderBottom:`1px solid ${T.border}`, gap:"12px", flexShrink:0 }}>
        <span style={{ color:T.promptColor, fontSize:"11px", letterSpacing:"2px" }}>ARCH TRAINER</span>
        <span style={{ color:T.border }}>│</span>
        <span style={{ color: diffColor[gameState.difficulty]||"#888", fontSize:"10px" }}>{gameState.difficulty}</span>
        <span style={{ color:T.border }}>│</span>
        <span style={{ color:"#555", fontSize:"10px" }}>⏱ {fmtTime(elapsed)}</span>
        <span style={{ color:T.border }}>│</span>
        <span style={{ color:"#444", fontSize:"9px", fontFamily:"monospace" }}>
          🔗 {replayRef.current.length} cmds · #{(prevHashRef.current||"").slice(0,8)}
        </span>
        <div style={{ flex:1 }} />
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{ color:"#555", fontSize:"10px" }}>{completedCount}/{STEPS.length}</span>
          <div style={{ width:"80px", height:"3px", background:T.border, borderRadius:"2px" }}>
            <div style={{ width:`${progress}%`, height:"100%", background:T.accentColor, borderRadius:"2px", transition:"width 0.4s" }} />
          </div>
        </div>
        <button onClick={() => setScreen("leaderboard")}
          style={{ background:"transparent", border:`1px solid ${T.border}`, color:"#555", padding:"2px 8px", cursor:"pointer", fontSize:"9px", fontFamily:"inherit", borderRadius:"3px", letterSpacing:"1px" }}>
          🏆
        </button>
        {gameState.difficulty === "BEGINNER" && hintText && (
          <button onClick={() => setShowHint(v=>!v)}
            style={{ background:"transparent", border:`1px solid ${T.border}`, color:"#ffcc00", padding:"2px 8px", cursor:"pointer", fontSize:"10px", fontFamily:"inherit", borderRadius:"3px" }}>
            💡
          </button>
        )}
      </div>

      {showHint && hintText && (
        <div style={{ background:"#1a1500", borderBottom:"1px solid #332b00", padding:"6px 14px", flexShrink:0 }}>
          <span style={{ color:"#ffcc00", fontSize:"10px" }}>💡 </span>
          <span style={{ color:"#ff9500", fontSize:"11px" }}>{hintText}</span>
        </div>
      )}

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* TERMINAL BODY */}
        <div id="term-body"
          style={{ flex:1, overflow:"auto", padding:"14px 16px 6px", cursor:"text" }}
          onMouseUp={e => { const sel=window.getSelection(); if(!sel||sel.isCollapsed){ if(e.target===e.currentTarget||e.target.id==="term-bottom") inputRef.current?.focus(); } }}
          onContextMenu={onCtx}
        >
          {history.map((entry, i) => {
            if (entry.type === "input") return (
              <div key={i} style={{ fontSize:"12px", lineHeight:"1.75", whiteSpace:"pre-wrap" }}>
                <span style={{ color: entry.prompt?.includes("for help") ? T.infoColor : T.promptColor }}>{entry.prompt}</span>
                <span style={{ color:T.inputColor }}>{entry.text}</span>
              </div>
            );
            const color = entry.type==="error"?T.errorColor : entry.type==="system"?T.systemColor : entry.type==="info"?T.infoColor : T.outputColor;
            return <div key={i} style={{ fontSize:"12px", lineHeight:"1.75", whiteSpace:"pre-wrap", color, marginBottom:"1px" }}>{entry.text}</div>;
          })}

          <div style={{ display:"flex", alignItems:"center", fontSize:"12px", lineHeight:"1.75" }}>
            <span style={{ color:promptColor, whiteSpace:"pre", userSelect:"none", cursor:"text" }} onClick={() => inputRef.current?.focus()}>{getPrompt()}</span>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown}
              spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:T.inputColor, caretColor:T.cursorColor, fontSize:"12px", fontFamily:T.font, lineHeight:"1.75", padding:0, margin:0 }} />
          </div>
          <div ref={bottomRef} id="term-bottom" />
        </div>

        {/* SIDEBAR */}
        <div style={{ width:"210px", background:T.sideBg, borderLeft:`1px solid ${T.border}`, padding:"12px", overflow:"auto", flexShrink:0 }}>
          <div style={{ color:"#333", fontSize:"9px", letterSpacing:"2px", marginBottom:"10px" }}>INSTALLATION LOG</div>
          {STEPS.map(step => {
            const done = step.check(gameState);
            const isCurrent = !done && STEPS.find(s=>!s.check(gameState))?.id===step.id;
            return (
              <div key={step.id} style={{ display:"flex", gap:"8px", marginBottom:"6px", opacity:done?1:isCurrent?1:0.25 }}>
                <span style={{ color:done?T.accentColor:isCurrent?"#ffcc00":"#333", fontSize:"11px", flexShrink:0, marginTop:"1px" }}>{done?"✓":isCurrent?"▶":"○"}</span>
                <span style={{ color:done?T.accentColor:isCurrent?"#ffcc00":"#444", fontSize:"10px", lineHeight:"1.5" }}>{step.label}</span>
              </div>
            );
          })}

          <div style={{ marginTop:"12px", borderTop:`1px solid ${T.border}`, paddingTop:"10px" }}>
            <div style={{ color:"#333", fontSize:"9px", letterSpacing:"2px", marginBottom:"8px" }}>STATE</div>
            {[
              { k:"NET",   v:gameState.networkConnected?"UP":"DOWN",             ok:gameState.networkConnected, bad:!gameState.networkConnected },
              { k:"DISK",  v:gameState.disks.sda.table?.toUpperCase()||"—",      ok:!!gameState.disks.sda.table },
              { k:"PARTS", v:`${gameState.disks.sda.partitions.length} prt`,     ok:gameState.disks.sda.partitions.length>0 },
              { k:"/mnt",  v:gameState.mounted["/mnt"]||"—",                     ok:!!gameState.mounted["/mnt"] },
              { k:"BASE",  v:gameState.baseInstalled?"OK":"—",                   ok:gameState.baseInstalled },
              { k:"CHRT",  v:gameState.isChrooted?"YES":"NO",                    ok:gameState.isChrooted },
              { k:"GRUB",  v:gameState.bootloaderInstalled?"OK":"—",             ok:gameState.bootloaderInstalled },
            ].map(({ k,v,ok,bad }) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:"9px", lineHeight:"2.1" }}>
                <span style={{ color:"#444" }}>{k}</span>
                <span style={{ color:bad?T.errorColor:ok?T.accentColor:"#555" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Replay stats */}
          <div style={{ marginTop:"12px", borderTop:`1px solid ${T.border}`, paddingTop:"10px" }}>
            <div style={{ color:"#333", fontSize:"9px", letterSpacing:"2px", marginBottom:"8px" }}>REPLAY</div>
            <div style={{ fontSize:"9px", lineHeight:"2.1", color:"#444" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span>Commands</span><span style={{ color:T.accentColor, fontFamily:"monospace" }}>{replayRef.current.length}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span>Hash</span><span style={{ color:"#555", fontFamily:"monospace" }}>{(prevHashRef.current||"").slice(0,8)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span>Session</span><span style={{ color:"#555", fontFamily:"monospace" }}>{sessionRef.current?.id||"—"}</span></div>
            </div>
          </div>

          <div style={{ marginTop:"12px", borderTop:`1px solid ${T.border}`, paddingTop:"10px" }}>
            <div style={{ color:"#333", fontSize:"9px", letterSpacing:"2px", marginBottom:"8px" }}>THEMES</div>
            {Object.entries(THEMES).map(([k,v]) => (
              <div key={k} onClick={() => setGameState(s=>({ ...s, theme:k }))}
                style={{ fontSize:"9px", lineHeight:"2.2", cursor:"pointer", paddingLeft:"6px", color:gameState.theme===k?T.accentColor:"#555", borderLeft:`2px solid ${gameState.theme===k?T.accentColor:"transparent"}`, transition:"all 0.15s" }}>
                {k}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CONTEXT MENU */}
      {ctxMenu && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:998 }} onClick={()=>setCtxMenu(null)} onContextMenu={e=>{e.preventDefault();setCtxMenu(null);}} />
          <div style={{ position:"fixed", left:Math.min(ctxMenu.x,window.innerWidth-185), top:Math.min(ctxMenu.y,window.innerHeight-150), background:"#171717", border:`1px solid ${T.border}`, borderRadius:"6px", zIndex:999, overflow:"hidden", boxShadow:"0 10px 40px rgba(0,0,0,0.85)", minWidth:"175px", fontFamily:T.font }}>
            {[
              { label:"Копировать",   shortcut:"Ctrl+C", action:onCopy },
              { label:"Вставить",     shortcut:"Ctrl+V", action:onPaste },
              null,
              { label:"Выделить всё", shortcut:"Ctrl+A", action:onSelAll },
              null,
              { label:"Очистить",     shortcut:"Ctrl+L", action:()=>{setHistory([]);setCtxMenu(null);} },
            ].map((item,i) => !item?(
              <div key={i} style={{ height:"1px", background:T.border, margin:"2px 0" }} />
            ):(
              <button key={i} onClick={item.action}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"8px 14px", background:"transparent", border:"none", color:T.outputColor, fontSize:"11px", cursor:"pointer", fontFamily:"inherit" }}
                onMouseEnter={e=>e.currentTarget.style.background=`${T.accentColor}18`}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span>{item.label}</span><span style={{ color:"#555", fontSize:"10px" }}>{item.shortcut}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <style>{`* {box-sizing:border-box;} ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:${T.bg};} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;} input::selection{background:${T.accentColor}40;} @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}
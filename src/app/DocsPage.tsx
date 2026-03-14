export function DocsPage() {
  return (
    <main className="app-shell theme-emerald">
      <section className="terminal-stage bash-stage">
        <div className="terminal-frame">
          <header className="terminal-topbar">
            <div className="topbar-brand">
              <span className="topbar-title">ARCH TRAINER</span>
              <span className="topbar-divider">|</span>
              <span className="topbar-difficulty">DOCS</span>
            </div>
          </header>

          <article className="docs-page">
            <h1>Arch Trainer</h1>
            <p>Arch Game / Arch Trainer</p>
            <p>
              Have you ever wanted to try the Arch Linux installation process without touching your real system?
            </p>
            <p>
              Arch Trainer is a small browser-based terminal game inspired by the Arch installation flow. You type
              commands and progress through a simplified version of the install process.
            </p>
            <p>
              However, this project does not aim to fully virtualize Linux or perfectly reproduce the real
              installation process.
            </p>

            <h2>Important Disclaimer</h2>
            <div className="docs-note">
              <p>This project is primarily an educational and entertainment experiment, not a real system simulator.</p>
            </div>
            <ul>
              <li>The project does not aim for 100% accuracy of the real Arch Linux installation process.</li>
              <li>It is not a full virtualization environment.</li>
              <li>The main goal is memorizing commands and practicing the install flow as a timed challenge.</li>
              <li>The author may be inexperienced in some technical details of real-world Arch installs.</li>
              <li>For serious learning, Arch in VirtualBox (or another VM) will teach more accurately.</li>
            </ul>

            <h2>What The Game Is About</h2>
            <ul>
              <li>Go through a simplified Arch-like install process.</li>
              <li>Type commands in a terminal interface.</li>
              <li>Progress through installation stages.</li>
              <li>Try to complete the process as fast as possible.</li>
            </ul>
            <p>This is closer to a terminal challenge / command memory game than a real system simulator.</p>

            <h2>Gameplay</h2>
            <p>You move through stages similar to a typical Arch install:</p>
            <ul>
              <li>Disk preparation</li>
              <li>Partitioning</li>
              <li>Formatting</li>
              <li>Mounting</li>
              <li>Base installation</li>
              <li>Configuration</li>
              <li>Bootloader setup</li>
            </ul>
            <p>These stages are simplified and abstracted for gameplay.</p>

            <h2>Main Features</h2>
            <ul>
              <li>Terminal-style interface</li>
              <li>Command-based progression</li>
              <li>Time-based gameplay</li>
              <li>Multiple difficulty levels</li>
              <li>English and Russian hints</li>
            </ul>

            <h2>Why I Made It</h2>
            <p>
              I wanted to experiment with a terminal-based learning game where the player interacts with something
              that feels similar to Linux installation flow.
            </p>
            <p>
              The goal is not perfect realism, but creating something fun, interactive, and somewhat educational.
            </p>

            <h2>Current Status</h2>
            <p>This is a small MVP with a single simplified installation path.</p>
            <p>Future ideas include:</p>
            <ul>
              <li>More failure scenarios</li>
              <li>Harder modes</li>
              <li>Additional installation paths</li>
              <li>Better system simulation</li>
            </ul>
            <p>The project is still experimental.</p>

            <h2>Final Note</h2>
            <ul>
              <li>If you want to seriously learn Arch Linux, install it on real hardware.</li>
              <li>Or install it inside VirtualBox / QEMU / VMware.</li>
            </ul>
            <p>
              This project is closer to a game inspired by Arch installation than a full training environment.
            </p>
            <p>If you enjoy Linux, terminal interfaces, or experimental learning tools — feel free to try it.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

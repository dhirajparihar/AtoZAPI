const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const outDir = path.join(__dirname, '..', 'site');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Navigation structure
const nav = [
  {
    group: "Getting Started",
    items: [
      { id: "introduction", title: "Introduction", file: "introduction.mdx" },
      { id: "quickstart", title: "Quickstart", file: "quickstart.mdx" }
    ]
  },
  {
    group: "SDK Reference",
    items: [
      { id: "sdk-express", title: "Node.js (Express)", file: "sdk/express.mdx" },
      { id: "sdk-nextjs", title: "Next.js App Router", file: "sdk/nextjs.mdx" },
      { id: "sdk-gin", title: "Go (Gin)", file: "sdk/gin.mdx" },
      { id: "sdk-laravel", title: "PHP (Laravel)", file: "sdk/laravel.mdx" }
    ]
  },
  {
    group: "CLI Reference",
    items: [
      { id: "cli-reference", title: "CLI & Code Generation", file: "cli/reference.mdx" }
    ]
  }
];

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Minimal high-performance Markdown parser for MDX
function parseMarkdown(md) {
  // Strip frontmatter
  let text = md.replace(/^---[\s\S]*?---\s*/, '');

  // Strip Mintlify JSX components like <Note>, <CardGroup>, <Card>, etc.
  text = text.replace(/<Note>([\s\S]*?)<\/Note>/g, (m, p) => `> [!NOTE]\n> ${p.trim().replace(/\n/g, '\n> ')}`);
  text = text.replace(/<CardGroup[\s\S]*?>([\s\S]*?)<\/CardGroup>/g, '$1');
  text = text.replace(/<Card\s+title="([^"]+)"(?:\s+icon="([^"]*)")?(?:\s+href="([^"]*)")?>([\s\S]*?)<\/Card>/g, (m, title, icon, href, content) => {
    return `### ${title}\n${content.trim()}\n${href ? `[Read more →](${href})` : ''}\n`;
  });

  // Extract code blocks first to protect them
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)(?:[^\n]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: lang || 'text', code: escapeHtml(code.trim()) });
    return id;
  });

  // Tables
  const lines = text.split('\n');
  const resultLines = [];
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      inTable = true;
      tableRows.push(line);
    } else {
      if (inTable) {
        resultLines.push(renderTable(tableRows));
        tableRows = [];
        inTable = false;
      }
      resultLines.push(lines[i]);
    }
  }
  if (inTable) {
    resultLines.push(renderTable(tableRows));
  }
  text = resultLines.join('\n');

  // Headers
  text = text.replace(/^#### (.*$)/gim, '<h4 id="$1">$1</h4>');
  text = text.replace(/^### (.*$)/gim, '<h3 id="$1">$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2 id="$1">$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1 id="$1">$1</h1>');

  // Blockquotes / Alerts
  text = text.replace(/^>\s*\[!NOTE\]\s*\n((?:>.*\n?)+)/gim, (m, p) => {
    const inner = p.replace(/^>\s?/gm, '');
    return `<div class="callout callout-note"><strong>Note:</strong> ${parseInline(inner)}</div>`;
  });
  text = text.replace(/^>\s+(.*$)/gim, '<blockquote>$1</blockquote>');

  // Inline styling
  text = parseInline(text);

  // Paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  text = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<div') || p.startsWith('<table') || p.startsWith('__CODE_BLOCK_') || p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<blockquote') || p.startsWith('<hr')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n\n');

  // Restore code blocks
  text = text.replace(/__CODE_BLOCK_(\d+)__/g, (m, idx) => {
    const block = codeBlocks[parseInt(idx, 10)];
    return `<div class="code-wrapper"><div class="code-header"><span>${block.lang}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><pre><code class="language-${block.lang}">${block.code}</code></pre></div>`;
  });

  return text;
}

function parseInline(str) {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
      let target = url;
      if (url.startsWith('/')) {
        target = url.substring(1) + '.html';
      }
      return `<a href="${target}">${text}</a>`;
    });
}

function renderTable(rows) {
  if (rows.length < 2) return rows.join('\n');
  const parseRow = r => r.split('|').slice(1, -1).map(c => c.trim());
  const headers = parseRow(rows[0]);
  const dataRows = rows.slice(2).map(parseRow);

  let html = '<div class="table-container"><table><thead><tr>';
  headers.forEach(h => html += `<th>${parseInline(h)}</th>`);
  html += '</tr></thead><tbody>';
  dataRows.forEach(row => {
    html += '<tr>';
    row.forEach(c => html += `<td>${parseInline(c)}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

// Render complete site layout
function renderPage(title, contentHtml, currentId, basePath = '') {
  let navHtml = '';
  nav.forEach(section => {
    navHtml += `<div class="nav-section"><div class="nav-section-title">${section.group}</div><ul class="nav-links">`;
    section.items.forEach(item => {
      const activeClass = item.id === currentId ? 'active' : '';
      const href = `${basePath}${item.file.replace('.mdx', '.html')}`;
      navHtml += `<li><a class="${activeClass}" href="${href}">${item.title}</a></li>`;
    });
    navHtml += `</ul></div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | Fastapify Documentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --surface: #101726;
      --border: #1e293b;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --primary: #00b4d8;
      --primary-glow: rgba(0, 180, 216, 0.15);
      --accent: #10b981;
      --code-bg: #050811;
      --sidebar-width: 280px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      display: flex;
      min-height: 100vh;
    }
    a { color: var(--primary); text-decoration: none; transition: color 0.15s ease; }
    a:hover { color: #38bdf8; text-decoration: underline; }
    
    /* Topbar */
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; height: 64px;
      background: rgba(9, 13, 22, 0.85); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 2rem; z-index: 100;
    }
    .brand { display: flex; align-items: center; gap: 0.75rem; font-weight: 700; font-size: 1.25rem; color: #fff; }
    .brand span.badge {
      background: var(--primary-glow); color: var(--primary);
      border: 1px solid rgba(0, 180, 216, 0.3); font-size: 0.75rem;
      padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 600;
    }
    .top-links { display: flex; align-items: center; gap: 1.5rem; }
    .github-link {
      background: var(--surface); border: 1px solid var(--border);
      color: var(--text); padding: 0.4rem 0.9rem; border-radius: 8px;
      font-size: 0.875rem; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;
    }
    .github-link:hover { border-color: var(--primary); text-decoration: none; }

    /* Layout */
    .sidebar {
      position: fixed; top: 64px; left: 0; bottom: 0; width: var(--sidebar-width);
      background: var(--surface); border-right: 1px solid var(--border);
      padding: 2rem 1.5rem; overflow-y: auto;
    }
    .nav-section { margin-bottom: 2rem; }
    .nav-section-title {
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.75rem;
    }
    .nav-links { list-style: none; }
    .nav-links li { margin-bottom: 0.25rem; }
    .nav-links a {
      display: block; padding: 0.45rem 0.75rem; border-radius: 6px;
      color: var(--text-muted); font-size: 0.9rem; font-weight: 500;
      transition: all 0.15s ease;
    }
    .nav-links a:hover { color: #fff; background: rgba(255,255,255,0.03); text-decoration: none; }
    .nav-links a.active {
      color: var(--primary); background: var(--primary-glow);
      font-weight: 600; border-left: 2px solid var(--primary);
    }

    .main-content {
      margin-left: var(--sidebar-width);
      margin-top: 64px;
      padding: 3.5rem 4rem;
      max-width: 950px;
      width: 100%;
    }

    /* Content Typography */
    h1 { font-size: 2.25rem; font-weight: 700; color: #fff; margin-bottom: 1.5rem; letter-spacing: -0.02em; }
    h2 { font-size: 1.5rem; font-weight: 600; color: #fff; margin-top: 2.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h3 { font-size: 1.2rem; font-weight: 600; color: #f1f5f9; margin-top: 1.75rem; margin-bottom: 0.75rem; }
    p { margin-bottom: 1.25rem; color: #cbd5e1; }
    ul, ol { margin-left: 1.5rem; margin-bottom: 1.25rem; color: #cbd5e1; }
    li { margin-bottom: 0.4rem; }
    hr { border: 0; border-top: 1px solid var(--border); margin: 2.5rem 0; }

    /* Inline Code & Code Blocks */
    code {
      font-family: 'JetBrains Mono', monospace; font-size: 0.875em;
      background: rgba(255,255,255,0.06); padding: 0.15rem 0.4rem;
      border-radius: 4px; color: #38bdf8;
    }
    .code-wrapper {
      background: var(--code-bg); border: 1px solid var(--border);
      border-radius: 8px; margin: 1.5rem 0; overflow: hidden;
    }
    .code-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.4rem 1rem; background: #0c1222; border-bottom: 1px solid var(--border);
      font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;
    }
    .copy-btn {
      background: transparent; border: 1px solid var(--border);
      color: var(--text-muted); font-size: 0.75rem; padding: 0.2rem 0.6rem;
      border-radius: 4px; cursor: pointer; transition: all 0.15s ease;
    }
    .copy-btn:hover { color: #fff; border-color: var(--primary); }
    pre { padding: 1.25rem; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; line-height: 1.6; color: #e2e8f0; }
    pre code { background: none; padding: 0; color: inherit; }

    /* Tables */
    .table-container { overflow-x: auto; margin: 1.5rem 0; border: 1px solid var(--border); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
    th { background: #0c1222; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); color: #fff; font-weight: 600; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); color: #cbd5e1; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.015); }

    /* Callouts */
    .callout {
      padding: 1rem 1.25rem; border-radius: 8px; margin: 1.5rem 0;
      border-left: 4px solid var(--primary); background: rgba(0, 180, 216, 0.08);
      color: #e2e8f0;
    }

    @media (max-width: 850px) {
      .sidebar { display: none; }
      .main-content { margin-left: 0; padding: 2rem 1.5rem; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      FastAPIfy <span class="badge">v1.0.0</span>
    </div>
    <div class="top-links">
      <a class="github-link" href="https://github.com/dhirajparihar/FastAPIfy" target="_blank" rel="noopener">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        GitHub
      </a>
    </div>
  </header>

  <aside class="sidebar">
    ${navHtml}
  </aside>

  <main class="main-content">
    ${contentHtml}
  </main>

  <script>
    function copyCode(btn) {
      const pre = btn.closest('.code-wrapper').querySelector('pre code');
      navigator.clipboard.writeText(pre.innerText).then(() => {
        const orig = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = orig, 1500);
      });
    }
  </script>
</body>
</html>`;
}

// Build all pages
const pages = [
  { file: 'introduction.mdx', id: 'introduction', out: 'index.html', title: 'Fastapify Overview', base: '' },
  { file: 'introduction.mdx', id: 'introduction', out: 'introduction.html', title: 'Fastapify Overview', base: '' },
  { file: 'quickstart.mdx', id: 'quickstart', out: 'quickstart.html', title: 'Quickstart Guide', base: '' },
  { file: 'cli/reference.mdx', id: 'cli-reference', out: 'cli/reference.html', title: 'CLI Reference', base: '../' },
  { file: 'sdk/express.mdx', id: 'sdk-express', out: 'sdk/express.html', title: 'Express SDK', base: '../' },
  { file: 'sdk/nextjs.mdx', id: 'sdk-nextjs', out: 'sdk/nextjs.html', title: 'Next.js App Router SDK', base: '../' },
  { file: 'sdk/gin.mdx', id: 'sdk-gin', out: 'sdk/gin.html', title: 'Go (Gin) SDK', base: '../' },
  { file: 'sdk/laravel.mdx', id: 'sdk-laravel', out: 'sdk/laravel.html', title: 'PHP (Laravel) SDK', base: '../' }
];

pages.forEach(p => {
  const sourcePath = path.join(docsDir, p.file);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Source not found: ${sourcePath}`);
    return;
  }
  const rawMdx = fs.readFileSync(sourcePath, 'utf8');
  const bodyHtml = parseMarkdown(rawMdx);
  const fullHtml = renderPage(p.title, bodyHtml, p.id, p.base);

  const targetPath = path.join(outDir, p.out);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, fullHtml, 'utf8');
  console.log(`Generated: ${p.out}`);
});

console.log('Documentation build completed successfully.');

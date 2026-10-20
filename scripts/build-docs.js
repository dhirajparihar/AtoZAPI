const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const outDir = path.join(__dirname, '..', 'site');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Navigation schema
const nav = [
  {
    group: "Getting Started",
    items: [
      { id: "overview", title: "Overview", file: "introduction.mdx", href: "introduction.html" },
      { id: "quickstart", title: "Quickstart", file: "quickstart.mdx", href: "quickstart.html" }
    ]
  },
  {
    group: "Framework SDKs",
    items: [
      { id: "sdk-express", title: "Express (Node.js)", file: "sdk/express.mdx", href: "sdk/express.html", badge: "npm" },
      { id: "sdk-nextjs", title: "Next.js App Router", file: "sdk/nextjs.mdx", href: "sdk/nextjs.html", badge: "npm" },
      { id: "sdk-gin", title: "Go (Gin)", file: "sdk/gin.mdx", href: "sdk/gin.html", badge: "Go 1.20+" },
      { id: "sdk-laravel", title: "PHP (Laravel)", file: "sdk/laravel.mdx", href: "sdk/laravel.html", badge: "PHP 8.2+" }
    ]
  },
  {
    group: "CLI & Tooling",
    items: [
      { id: "cli-reference", title: "CLI Reference", file: "cli/reference.mdx", href: "cli/reference.html" }
    ]
  }
];

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Extract table of contents (h2, h3) and parse markdown
function parseMarkdown(md, currentBasePath = '') {
  // Strip frontmatter
  let text = md.replace(/^---[\s\S]*?---\s*/, '');

  // Custom components: HeroBadges, HeroActions, FrameworkGrid, CardGrid
  text = text.replace(/<HeroBadges>([\s\S]*?)<\/HeroBadges>/g, (m, content) => {
    return `<div class="hero-badges">${content.trim()}</div>`;
  });

  text = text.replace(/<Badge\s+text="([^"]+)"(?:\s+type="([^"]*)")?\s*\/>/g, (m, text, type) => {
    return `<span class="pill pill-${type || 'neutral'}">${escapeHtml(text)}</span>`;
  });

  text = text.replace(/<HeroActions>([\s\S]*?)<\/HeroActions>/g, (m, content) => {
    return `<div class="hero-actions">${content.trim()}</div>`;
  });

  text = text.replace(/<Button\s+text="([^"]+)"\s+href="([^"]+)"(?:\s+type="([^"]*)")?(?:\s+external="([^"]*)")?\s*\/>/g, (m, text, href, type, ext) => {
    let resolvedHref = href;
    if (resolvedHref.startsWith('/') && !resolvedHref.startsWith('//')) {
      resolvedHref = currentBasePath + resolvedHref.substring(1) + '.html';
    }
    const target = ext === 'true' ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${resolvedHref}" class="btn btn-${type || 'primary'}"${target}>${escapeHtml(text)}</a>`;
  });

  text = text.replace(/<FrameworkGrid>([\s\S]*?)<\/FrameworkGrid>/g, (m, content) => {
    return `<div class="framework-grid">${content.trim()}</div>`;
  });

  text = text.replace(/<FrameworkCard([\s\S]*?)\/>/g, (m, attrs) => {
    const getAttr = name => {
      const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return match ? match[1] : '';
    };
    const title = getAttr('title');
    const subtitle = getAttr('subtitle');
    const badge = getAttr('badge');
    const badgeUrl = getAttr('badgeUrl');
    const description = getAttr('description');
    let href = getAttr('href');
    if (href.startsWith('/')) {
      href = currentBasePath + href.substring(1) + '.html';
    }
    const tag = getAttr('tag');

    return `<div class="framework-card">
      <div class="card-top">
        <span class="card-tag">${escapeHtml(tag)}</span>
        ${badge ? `<a href="${badgeUrl}" target="_blank" rel="noopener" class="card-badge">${escapeHtml(badge)}</a>` : ''}
      </div>
      <h3 class="card-title">${escapeHtml(title)}</h3>
      <div class="card-subtitle">${escapeHtml(subtitle)}</div>
      <p class="card-desc">${escapeHtml(description)}</p>
      <a href="${href}" class="card-link">View Documentation <span class="arrow">&rarr;</span></a>
    </div>`;
  });

  text = text.replace(/<CardGrid(?:\s+cols="(\d+)")?>([\s\S]*?)<\/CardGrid>/g, (m, cols, content) => {
    return `<div class="feature-grid cols-${cols || 2}">${content.trim()}</div>`;
  });

  text = text.replace(/<FeatureCard\s+title="([^"]+)"(?:\s+icon="([^"]*)")?>([\s\S]*?)<\/FeatureCard>/g, (m, title, icon, content) => {
    return `<div class="feature-card">
      <div class="feature-icon">${getIconSvg(icon)}</div>
      <h4>${escapeHtml(title)}</h4>
      <p>${content.trim()}</p>
    </div>`;
  });

  // Callouts
  text = text.replace(/<Note>([\s\S]*?)<\/Note>/g, (m, p) => `> [!NOTE]\n> ${p.trim().replace(/\n/g, '\n> ')}`);

  // Extract Code blocks
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)(?:[^\n]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: lang || 'text', code: escapeHtml(code.trim()) });
    return id;
  });

  // Parse lines & Tables
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
        resultLines.push(renderTable(tableRows, currentBasePath));
        tableRows = [];
        inTable = false;
      }
      resultLines.push(lines[i]);
    }
  }
  if (inTable) {
    resultLines.push(renderTable(tableRows, currentBasePath));
  }
  text = resultLines.join('\n');

  // Headers & TOC extraction
  const toc = [];
  text = text.replace(/^(#{1,4})\s+(.*$)/gim, (match, hashes, headingText) => {
    const level = hashes.length;
    const cleanText = headingText.replace(/<[^>]*>/g, '').trim();
    const id = slugify(cleanText);

    if (level === 2 || level === 3) {
      toc.push({ level, text: cleanText, id });
    }
    return `<h${level} id="${id}">${parseInline(headingText, currentBasePath)}</h${level}>`;
  });

  // Callouts
  text = text.replace(/^>\s*\[!NOTE\]\s*\n((?:>.*\n?)+)/gim, (m, p) => {
    const inner = p.replace(/^>\s?/gm, '');
    return `<div class="callout callout-note"><div class="callout-indicator"></div><div class="callout-body"><strong>Note:</strong> ${parseInline(inner, currentBasePath)}</div></div>`;
  });
  text = text.replace(/^>\s+(.*$)/gim, '<blockquote class="quote">$1</blockquote>');

  // Inline formatting
  text = parseInline(text, currentBasePath);

  // Paragraph wrapping
  const paragraphs = text.split(/\n\s*\n/);
  text = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (
      p.startsWith('<h') ||
      p.startsWith('<div') ||
      p.startsWith('<table') ||
      p.startsWith('__CODE_BLOCK_') ||
      p.startsWith('<ul') ||
      p.startsWith('<ol') ||
      p.startsWith('<blockquote') ||
      p.startsWith('<hr')
    ) {
      return p;
    }
    // Check if it's an unordered list
    if (p.startsWith('- ') || p.startsWith('* ')) {
      const items = p.split('\n').filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* '));
      return `<ul class="doc-list">${items.map(it => `<li>${parseInline(it.replace(/^[-*]\s+/, ''), currentBasePath)}</li>`).join('')}</ul>`;
    }
    return `<p>${p.replace(/\n/g, ' ')}</p>`;
  }).join('\n\n');

  // Restore Code blocks with language badge and copy button
  text = text.replace(/__CODE_BLOCK_(\d+)__/g, (m, idx) => {
    const block = codeBlocks[parseInt(idx, 10)];
    let displayLang = block.lang.toLowerCase();
    if (displayLang === 'js') displayLang = 'javascript';
    if (displayLang === 'ts') displayLang = 'typescript';
    if (displayLang === 'sh') displayLang = 'bash';

    return `<div class="code-wrapper">
      <div class="code-header">
        <div class="code-meta">
          <span class="code-dot red"></span>
          <span class="code-dot yellow"></span>
          <span class="code-dot green"></span>
          <span class="code-lang">${displayLang}</span>
        </div>
        <button class="copy-btn" onclick="copyCode(this)" aria-label="Copy code to clipboard">
          <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span class="btn-text">Copy</span>
        </button>
      </div>
      <pre class="line-numbers"><code class="language-${displayLang}">${block.code}</code></pre>
    </div>`;
  });

  return { html: text, toc };
}

function parseInline(str, currentBasePath) {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
      let target = url;
      if (url.startsWith('/') && !url.startsWith('//')) {
        target = currentBasePath + url.substring(1) + '.html';
      }
      const isExternal = target.startsWith('http');
      const extAttr = isExternal ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${target}"${extAttr}>${text}</a>`;
    });
}

function renderTable(rows, currentBasePath) {
  if (rows.length < 2) return rows.join('\n');
  const parseRow = r => r.split('|').slice(1, -1).map(c => c.trim());
  const headers = parseRow(rows[0]);
  const dataRows = rows.slice(2).map(parseRow);

  let html = '<div class="table-container"><table><thead><tr>';
  headers.forEach(h => html += `<th>${parseInline(h, currentBasePath)}</th>`);
  html += '</tr></thead><tbody>';
  dataRows.forEach(row => {
    html += '<tr>';
    row.forEach(c => html += `<td>${parseInline(c, currentBasePath)}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function getIconSvg(icon) {
  switch (icon) {
    case 'code':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
    case 'shield':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
    case 'browser':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    case 'cpu':
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`;
    default:
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>`;
  }
}

// Build Search Index
const searchItems = [];

// Main Layout Renderer
function renderFullPage({ title, description, contentHtml, toc, currentId, groupTitle, basePath = '' }) {
  // Navigation sidebar items
  let navHtml = '';
  nav.forEach(section => {
    navHtml += `<div class="nav-group">
      <div class="nav-group-title">${section.group}</div>
      <ul class="nav-list">`;
    section.items.forEach(item => {
      const activeClass = item.id === currentId ? 'active' : '';
      const href = `${basePath}${item.href}`;
      const badgeHtml = item.badge ? `<span class="nav-badge">${item.badge}</span>` : '';
      navHtml += `<li><a class="nav-link ${activeClass}" href="${href}"><span>${item.title}</span>${badgeHtml}</a></li>`;
    });
    navHtml += `</ul></div>`;
  });

  // Table of contents items
  let tocHtml = '';
  if (toc && toc.length > 0) {
    tocHtml = `<div class="toc-title">On this page</div><ul class="toc-list">`;
    toc.forEach(item => {
      const indentClass = item.level === 3 ? 'indent' : '';
      tocHtml += `<li><a href="#${item.id}" class="toc-link ${indentClass}">${escapeHtml(item.text)}</a></li>`;
    });
    tocHtml += `</ul>`;
  }

  // Breadcrumbs
  const breadcrumbHtml = `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="${basePath}introduction.html" class="crumb">Docs</a>
      <span class="crumb-separator">/</span>
      <span class="crumb">${escapeHtml(groupTitle)}</span>
      <span class="crumb-separator">/</span>
      <span class="crumb current">${escapeHtml(title)}</span>
    </nav>
  `;

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | FastAPIfy Documentation</title>
  <meta name="description" content="${escapeHtml(description || 'Consistent request validation and automated OpenAPI documentation for your favorite backend frameworks.')}">
  
  <!-- Fonts: Inter & JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  
  <!-- Prism Syntax Highlighting -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
  
  <style>
    :root {
      --bg: #FFFFFF;
      --bg-subtle: #F9FAFB;
      --surface: #FFFFFF;
      --border: #E5E7EB;
      --border-subtle: #F3F4F6;
      --text: #111827;
      --text-muted: #64748B;
      --text-soft: #94A3B8;
      --accent: #3159D9;
      --accent-hover: #2343B8;
      --accent-light: #EFF4FF;
      --accent-border: #C7D7FE;
      --success: #10B981;
      --success-light: #ECFDF5;
      --code-bg: #0F172A;
      --code-header: #1E293B;
      --sidebar-w: 260px;
      --toc-w: 230px;
      --article-max-w: 740px;
      --header-h: 60px;
      --radius: 8px;
    }

    [data-theme="dark"] {
      --bg: #0B0F19;
      --bg-subtle: #111827;
      --surface: #111827;
      --border: #1F2937;
      --border-subtle: #1A2234;
      --text: #F9FAFB;
      --text-muted: #9CA3AF;
      --text-soft: #6B7280;
      --accent: #4F75F2;
      --accent-hover: #6385FF;
      --accent-light: rgba(79, 117, 242, 0.12);
      --accent-border: rgba(79, 117, 242, 0.25);
      --code-bg: #050811;
      --code-header: #0E1424;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      font-size: 15px;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    a { color: var(--accent); text-decoration: none; transition: all 0.15s ease; }
    a:hover { color: var(--accent-hover); }

    /* ================= Topbar ================= */
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; height: var(--header-h);
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 1.5rem; z-index: 50;
      backdrop-filter: blur(8px);
    }
    .topbar-left { display: flex; align-items: center; gap: 1rem; }
    .brand-logo {
      display: flex; align-items: center; gap: 0.6rem;
      font-weight: 700; font-size: 1.15rem; color: var(--text);
      letter-spacing: -0.02em;
    }
    .brand-logo:hover { color: var(--text); text-decoration: none; }
    .brand-icon {
      width: 26px; height: 26px; border-radius: 6px;
      background: linear-gradient(135deg, var(--accent), #10B981);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 800; font-size: 13px;
    }
    .version-tag {
      font-size: 11px; font-weight: 600; padding: 2px 7px;
      border-radius: 999px; background: var(--border-subtle);
      color: var(--text-muted); border: 1px solid var(--border);
    }

    .topbar-center { flex: 1; max-width: 420px; margin: 0 1.5rem; }
    .search-btn {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      background: var(--bg-subtle); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 0.4rem 0.75rem;
      color: var(--text-muted); font-size: 13px; cursor: pointer;
      transition: all 0.15s ease;
    }
    .search-btn:hover { border-color: var(--accent); color: var(--text); }
    .search-prompt { display: flex; align-items: center; gap: 0.5rem; }
    .kbd-shortcut {
      font-size: 11px; font-family: inherit; font-weight: 600;
      background: var(--surface); border: 1px solid var(--border);
      padding: 2px 5px; border-radius: 4px; color: var(--text-soft);
    }

    .topbar-right { display: flex; align-items: center; gap: 0.75rem; }
    .top-nav-link {
      font-size: 13.5px; font-weight: 500; color: var(--text-muted);
      padding: 0.35rem 0.65rem; border-radius: 6px;
    }
    .top-nav-link:hover { color: var(--text); background: var(--bg-subtle); text-decoration: none; }
    .github-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: var(--surface); border: 1px solid var(--border);
      color: var(--text); font-size: 13px; font-weight: 500;
      padding: 0.35rem 0.75rem; border-radius: 6px; transition: all 0.15s;
    }
    .github-btn:hover { border-color: var(--text-muted); text-decoration: none; }
    .theme-toggle-btn {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-muted); transition: all 0.15s;
    }
    .theme-toggle-btn:hover { color: var(--text); border-color: var(--text-muted); }
    .mobile-menu-btn {
      display: none; background: none; border: none; color: var(--text);
      cursor: pointer; padding: 4px;
    }

    /* ================= Layout ================= */
    .docs-container {
      display: flex; justify-content: center;
      margin-top: var(--header-h);
      min-height: calc(100vh - var(--header-h));
    }

    /* Left Sidebar */
    .sidebar {
      position: fixed; top: var(--header-h); left: 0; bottom: 0;
      width: var(--sidebar-w); background: var(--bg);
      border-right: 1px solid var(--border);
      padding: 1.75rem 1.25rem 2rem 1.25rem;
      overflow-y: auto; z-index: 30;
    }
    .nav-group { margin-bottom: 1.75rem; }
    .nav-group-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 0.6rem;
      padding-left: 0.65rem;
    }
    .nav-list { list-style: none; }
    .nav-list li { margin-bottom: 2px; }
    .nav-link {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.45rem 0.65rem; border-radius: 6px;
      color: var(--text-muted); font-size: 13.5px; font-weight: 500;
      transition: all 0.12s ease;
    }
    .nav-link:hover { color: var(--text); background: var(--bg-subtle); text-decoration: none; }
    .nav-link.active {
      color: var(--accent); background: var(--accent-light);
      font-weight: 600;
    }
    .nav-badge {
      font-size: 10px; font-weight: 600; padding: 1px 5px;
      border-radius: 4px; background: var(--border-subtle);
      color: var(--text-soft); border: 1px solid var(--border);
    }

    /* Article Content */
    .article-wrapper {
      margin-left: var(--sidebar-w);
      margin-right: var(--toc-w);
      padding: 2.5rem 3.5rem 5rem 3.5rem;
      max-width: var(--article-max-w);
      width: 100%;
    }

    /* Breadcrumbs */
    .breadcrumbs {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 13px; color: var(--text-muted); margin-bottom: 1.75rem;
    }
    .crumb { color: var(--text-muted); }
    .crumb.current { color: var(--text); font-weight: 500; }
    .crumb-separator { color: var(--text-soft); }

    /* Right TOC */
    .toc-container {
      position: fixed; top: var(--header-h); right: 0; bottom: 0;
      width: var(--toc-w); padding: 2.5rem 1.5rem 2rem 0;
      overflow-y: auto; font-size: 13px;
    }
    .toc-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 0.75rem;
    }
    .toc-list { list-style: none; border-left: 1px solid var(--border); padding-left: 0.75rem; }
    .toc-list li { margin-bottom: 0.5rem; }
    .toc-link {
      display: block; color: var(--text-muted); font-size: 12.5px;
      line-height: 1.4; transition: all 0.12s;
    }
    .toc-link:hover { color: var(--accent); text-decoration: none; }
    .toc-link.active { color: var(--accent); font-weight: 600; }
    .toc-link.indent { padding-left: 0.75rem; font-size: 12px; }

    /* ================= Content Typography ================= */
    h1 {
      font-size: 2.25rem; font-weight: 700; color: var(--text);
      letter-spacing: -0.03em; line-height: 1.25; margin-bottom: 0.75rem;
    }
    h2 {
      font-size: 1.4rem; font-weight: 600; color: var(--text);
      letter-spacing: -0.02em; margin-top: 2.5rem; margin-bottom: 0.85rem;
      padding-top: 0.5rem;
    }
    h3 {
      font-size: 1.1rem; font-weight: 600; color: var(--text);
      letter-spacing: -0.01em; margin-top: 1.75rem; margin-bottom: 0.5rem;
    }
    p { margin-bottom: 1.25rem; color: var(--text); }
    hr { border: 0; border-top: 1px solid var(--border); margin: 2.5rem 0; }
    .doc-list { margin-left: 1.25rem; margin-bottom: 1.25rem; color: var(--text); }
    .doc-list li { margin-bottom: 0.4rem; }

    /* Hero Badges & Actions */
    .hero-badges { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1.25rem 0 1.5rem 0; }
    .pill {
      font-size: 12px; font-weight: 600; padding: 3px 10px;
      border-radius: 999px; display: inline-flex; align-items: center;
    }
    .pill-primary { background: var(--accent-light); color: var(--accent); border: 1px solid var(--accent-border); }
    .pill-neutral { background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border); }
    .pill-success { background: var(--success-light); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2); }

    .hero-actions { display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0 2rem 0; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0.6rem 1.25rem; border-radius: var(--radius);
      font-size: 14px; font-weight: 600; transition: all 0.15s ease;
    }
    .btn-primary {
      background: var(--accent); color: #FFFFFF !important;
      border: 1px solid transparent; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .btn-primary:hover { background: var(--accent-hover); text-decoration: none; }
    .btn-secondary {
      background: var(--surface); color: var(--text) !important;
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { border-color: var(--text-muted); background: var(--bg-subtle); text-decoration: none; }

    /* Framework Cards Grid */
    .framework-grid {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem; margin: 1.5rem 0 2.5rem 0;
    }
    .framework-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 1.5rem;
      display: flex; flex-direction: column; transition: all 0.18s ease;
    }
    .framework-card:hover {
      border-color: var(--accent-border);
      box-shadow: 0 4px 12px rgba(49, 89, 217, 0.06);
      transform: translateY(-2px);
    }
    .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; }
    .card-tag { font-size: 11px; font-weight: 700; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.05em; }
    .card-badge {
      font-size: 11px; font-family: 'JetBrains Mono', monospace; font-weight: 500;
      color: var(--accent); background: var(--accent-light);
      padding: 2px 6px; border-radius: 4px; border: 1px solid var(--accent-border);
    }
    .card-title { font-size: 1.15rem; font-weight: 700; color: var(--text); margin-top: 0; margin-bottom: 0.2rem; }
    .card-subtitle { font-size: 12.5px; color: var(--text-muted); margin-bottom: 0.75rem; }
    .card-desc { font-size: 13.5px; color: var(--text-muted); line-height: 1.5; margin-bottom: 1.25rem; flex: 1; }
    .card-link {
      font-size: 13px; font-weight: 600; color: var(--accent);
      display: inline-flex; align-items: center; gap: 0.3rem;
    }
    .card-link .arrow { transition: transform 0.15s; }
    .card-link:hover .arrow { transform: translateX(3px); }

    /* Feature Grid */
    .feature-grid { display: grid; gap: 1.25rem; margin: 1.5rem 0 2.5rem 0; }
    .feature-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
    .feature-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 1.25rem;
    }
    .feature-icon {
      color: var(--accent); width: 36px; height: 36px; border-radius: 8px;
      background: var(--accent-light); display: flex; align-items: center;
      justify-content: center; margin-bottom: 0.75rem;
    }
    .feature-card h4 { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 0.4rem; }
    .feature-card p { font-size: 13px; color: var(--text-muted); margin-bottom: 0; line-height: 1.55; }

    /* Callout / Note */
    .callout {
      display: flex; gap: 1rem; border-radius: var(--radius);
      padding: 1rem 1.25rem; margin: 1.5rem 0;
      background: var(--accent-light); border: 1px solid var(--accent-border);
    }
    .callout-body { font-size: 14px; color: var(--text); line-height: 1.6; }
    .callout-body strong { color: var(--accent); }

    /* Code Block Formatting (Dark Theme inside) */
    .inline-code {
      font-family: 'JetBrains Mono', monospace; font-size: 0.88em;
      background: var(--bg-subtle); color: var(--accent);
      border: 1px solid var(--border); padding: 0.15rem 0.35rem;
      border-radius: 4px;
    }
    .code-wrapper {
      background: var(--code-bg); border-radius: var(--radius);
      margin: 1.5rem 0; overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--border);
    }
    .code-header {
      background: var(--code-header); padding: 0.5rem 0.9rem;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .code-meta { display: flex; align-items: center; gap: 0.5rem; }
    .code-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .code-dot.red { background: #FF5F56; }
    .code-dot.yellow { background: #FFBD2E; }
    .code-dot.green { background: #27C93F; }
    .code-lang {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      font-weight: 600; text-transform: uppercase; color: #94A3B8; margin-left: 0.3rem;
    }
    .copy-btn {
      background: transparent; border: 1px solid rgba(255, 255, 255, 0.15);
      color: #94A3B8; font-size: 11.5px; font-weight: 500;
      padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 0.35rem;
      transition: all 0.15s ease;
    }
    .copy-btn:hover { background: rgba(255, 255, 255, 0.1); color: #FFFFFF; }
    pre {
      padding: 1.15rem !important; margin: 0 !important; background: transparent !important;
      overflow-x: auto; font-family: 'JetBrains Mono', monospace !important;
      font-size: 13.5px !important; line-height: 1.6 !important;
    }
    code[class*="language-"] { font-family: 'JetBrains Mono', monospace !important; font-size: inherit !important; }

    /* Tables */
    .table-container {
      margin: 1.5rem 0; border: 1px solid var(--border);
      border-radius: var(--radius); overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    th {
      background: var(--bg-subtle); text-align: left; padding: 0.65rem 0.9rem;
      border-bottom: 1px solid var(--border); font-weight: 600; color: var(--text);
    }
    td {
      padding: 0.65rem 0.9rem; border-bottom: 1px solid var(--border-subtle);
      color: var(--text); vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }

    /* Search Modal */
    .search-modal-backdrop {
      display: none; position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
      z-index: 100; align-items: flex-start; justify-content: center;
      padding-top: 15vh;
    }
    .search-modal-backdrop.open { display: flex; }
    .search-modal {
      width: 100%; max-width: 580px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
      overflow: hidden; animation: modalPop 0.15s ease-out;
    }
    @keyframes modalPop {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-input-wrapper {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--border);
    }
    .modal-input {
      flex: 1; border: none; background: transparent; font-size: 15px;
      color: var(--text); outline: none; font-family: inherit;
    }
    .search-results { max-height: 340px; overflow-y: auto; padding: 0.5rem; }
    .search-result-item {
      display: block; padding: 0.6rem 0.85rem; border-radius: 6px;
      color: var(--text); font-size: 13.5px; transition: all 0.1s;
    }
    .search-result-item:hover, .search-result-item.selected {
      background: var(--accent-light); color: var(--accent); text-decoration: none;
    }
    .result-group { font-size: 11px; font-weight: 600; color: var(--text-soft); text-transform: uppercase; margin-bottom: 2px; }
    .result-title { font-weight: 600; }
    .search-footer {
      display: flex; justify-content: space-between; padding: 0.6rem 1.25rem;
      background: var(--bg-subtle); border-top: 1px solid var(--border);
      font-size: 11.5px; color: var(--text-muted);
    }

    /* Responsive */
    @media (max-width: 1100px) {
      .toc-container { display: none; }
      .article-wrapper { margin-right: 0; padding-right: 2.5rem; }
    }
    @media (max-width: 820px) {
      .sidebar {
        transform: translateX(-100%); transition: transform 0.2s ease;
        background: var(--surface); box-shadow: 4px 0 12px rgba(0,0,0,0.1);
      }
      .sidebar.open { transform: translateX(0); }
      .mobile-menu-btn { display: block; }
      .article-wrapper { margin-left: 0; padding: 2rem 1.5rem; }
      .framework-grid, .feature-grid.cols-2 { grid-template-columns: 1fr; }
      .topbar-center { display: none; }
    }
  </style>
</head>
<body>
  <!-- Topbar -->
  <header class="topbar">
    <div class="topbar-left">
      <button class="mobile-menu-btn" onclick="toggleSidebar()" aria-label="Toggle menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <a href="${basePath}introduction.html" class="brand-logo">
        <div class="brand-icon">F</div>
        <span>FastAPIfy</span>
      </a>
      <span class="version-tag">v1.0.0</span>
    </div>

    <div class="topbar-center">
      <button class="search-btn" onclick="openSearchModal()">
        <span class="search-prompt">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Search docs...</span>
        </span>
        <kbd class="kbd-shortcut">Ctrl K</kbd>
      </button>
    </div>

    <div class="topbar-right">
      <a href="${basePath}quickstart.html" class="top-nav-link">Quickstart</a>
      <a href="https://github.com/dhirajparihar/FastAPIfy" target="_blank" rel="noopener" class="github-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        <span>GitHub</span>
      </a>
      <button class="theme-toggle-btn" onclick="toggleTheme()" aria-label="Toggle light/dark theme">
        <svg class="sun-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
      </button>
    </div>
  </header>

  <!-- Docs Container -->
  <div class="docs-container">
    <!-- Left Navigation Sidebar -->
    <aside class="sidebar" id="sidebar">
      ${navHtml}
    </aside>

    <!-- Main Content -->
    <main class="article-wrapper">
      ${breadcrumbHtml}
      ${contentHtml}
    </main>

    <!-- Right Table of Contents -->
    <aside class="toc-container">
      ${tocHtml}
    </aside>
  </div>

  <!-- Search Modal -->
  <div class="search-modal-backdrop" id="searchModal" onclick="closeSearchModal(event)">
    <div class="search-modal" onclick="event.stopPropagation()">
      <div class="modal-input-wrapper">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" class="modal-input" id="searchInput" placeholder="Search documentation..." oninput="handleSearch(this.value)">
      </div>
      <div class="search-results" id="searchResults">
        <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 13px;">Type to search documentation...</div>
      </div>
      <div class="search-footer">
        <span>Navigate with <kbd>↑</kbd> <kbd>↓</kbd></span>
        <span>Select with <kbd>Enter</kbd></span>
        <span>Close with <kbd>ESC</kbd></span>
      </div>
    </div>
  </div>

  <!-- Prism Syntax Highlighter Scripts -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-go.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-php.min.js"></script>

  <script>
    // Copy code block to clipboard
    function copyCode(btn) {
      const code = btn.closest('.code-wrapper').querySelector('pre code').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const textSpan = btn.querySelector('.btn-text');
        const orig = textSpan.innerText;
        textSpan.innerText = 'Copied!';
        btn.style.color = '#10B981';
        setTimeout(() => {
          textSpan.innerText = orig;
          btn.style.color = '';
        }, 1800);
      });
    }

    // Toggle theme
    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('fastapify-theme', next);
    }
    const savedTheme = localStorage.getItem('fastapify-theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Toggle mobile sidebar
    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
    }

    // Table of contents active scrollspy
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          document.querySelectorAll('.toc-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '0px 0px -70% 0px' });

    document.querySelectorAll('h2[id], h3[id]').forEach(h => observer.observe(h));

    // Client-side Search Modal
    const searchIndex = ${JSON.stringify(searchItems)};
    const modal = document.getElementById('searchModal');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    function openSearchModal() {
      modal.classList.add('open');
      searchInput.value = '';
      searchInput.focus();
      handleSearch('');
    }
    function closeSearchModal(e) {
      modal.classList.remove('open');
    }
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
      }
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeSearchModal();
      }
    });

    function handleSearch(query) {
      query = query.toLowerCase().trim();
      if (!query) {
        searchResults.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 13px;">Type to search documentation...</div>';
        return;
      }
      const matches = searchIndex.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.content.toLowerCase().includes(query)
      ).slice(0, 8);

      if (matches.length === 0) {
        searchResults.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 13px;">No results found for "' + escapeHtml(query) + '"</div>';
        return;
      }

      let html = '';
      matches.forEach(m => {
        const targetUrl = '${basePath}' + m.url;
        html += '<a href="' + targetUrl + '" class="search-result-item">' +
          '<div class="result-group">' + escapeHtml(m.group) + '</div>' +
          '<div class="result-title">' + escapeHtml(m.title) + '</div>' +
        '</a>';
      });
      searchResults.innerHTML = html;
    }

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  </script>
</body>
</html>`;
}

// Pages to generate
const pages = [
  { file: 'introduction.mdx', id: 'overview', out: 'index.html', title: 'Overview', group: 'Getting Started', base: '' },
  { file: 'introduction.mdx', id: 'overview', out: 'introduction.html', title: 'Overview', group: 'Getting Started', base: '' },
  { file: 'quickstart.mdx', id: 'quickstart', out: 'quickstart.html', title: 'Quickstart', group: 'Getting Started', base: '' },
  { file: 'sdk/express.mdx', id: 'sdk-express', out: 'sdk/express.html', title: 'Express (Node.js)', group: 'Framework SDKs', base: '../' },
  { file: 'sdk/nextjs.mdx', id: 'sdk-nextjs', out: 'sdk/nextjs.html', title: 'Next.js App Router', group: 'Framework SDKs', base: '../' },
  { file: 'sdk/gin.mdx', id: 'sdk-gin', out: 'sdk/gin.html', title: 'Go (Gin)', group: 'Framework SDKs', base: '../' },
  { file: 'sdk/laravel.mdx', id: 'sdk-laravel', out: 'sdk/laravel.html', title: 'PHP (Laravel)', group: 'Framework SDKs', base: '../' },
  { file: 'cli/reference.mdx', id: 'cli-reference', out: 'cli/reference.html', title: 'CLI Reference', group: 'CLI & Tooling', base: '../' }
];

// Pre-fill search index from markdown files
pages.forEach(p => {
  if (p.out === 'index.html') return; // avoid duplicate index entry
  const sourcePath = path.join(docsDir, p.file);
  if (fs.existsSync(sourcePath)) {
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const cleanContent = raw.replace(/^---[\s\S]*?---/, '').replace(/```[\s\S]*?```/g, '').replace(/[#*`]/g, '');
    searchItems.push({
      title: p.title,
      group: p.group,
      url: p.out,
      content: cleanContent.substring(0, 500)
    });
  }
});

// Render all pages
pages.forEach(p => {
  const sourcePath = path.join(docsDir, p.file);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Source not found: ${sourcePath}`);
    return;
  }
  const rawMdx = fs.readFileSync(sourcePath, 'utf8');
  const { html, toc } = parseMarkdown(rawMdx, p.base);

  const fullHtml = renderFullPage({
    title: p.title,
    description: 'Consistent request validation and automated OpenAPI documentation for Express, Next.js, Go (Gin), and Laravel.',
    contentHtml: html,
    toc: toc,
    currentId: p.id,
    groupTitle: p.group,
    basePath: p.base
  });

  const targetPath = path.join(outDir, p.out);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, fullHtml, 'utf8');
  console.log(`✓ Compiled: ${p.out}`);
});

console.log('Documentation build completed successfully with modern developer platform design.');

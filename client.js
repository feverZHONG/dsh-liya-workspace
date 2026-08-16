// 莉娅工作区插件 —— Client 半（dsh client bundle）
// 功能：设置里注册「莉娅工作区」子设置页；页面通过 fetch 调用 host 的
// /liya-workspace/summary 路由展示工作区档案统计（host↔client 数据链路）。
window.__ModuleLoader__.load({
  id: 'liya-workspace-plugin',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    var react = require('react');

    // ── 极简 markdown 渲染（零依赖）：支持 #/## 标题、| 表格（跳过 :--- 分隔行）、`行内代码`。
    function inlineCode(text) {
      var parts = String(text).split('`');
      var els = [];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i] === '') continue;
        if (i % 2 === 1) {
          els.push(react.createElement('code', {
            key: i,
            style: { background: 'var(--dsw-alias-bg-layer-1)', padding: '1px 5px', borderRadius: 5, fontFamily: 'var(--ds-font-family-code)', fontSize: 12 }
          }, parts[i]));
        } else {
          els.push(parts[i]);
        }
      }
      return els;
    }

    function renderMarkdown(md) {
      var lines = String(md || '').split('\n');
      var nodes = [];
      var i = 0;
      while (i < lines.length) {
        var trimmed = lines[i].trim();
        if (trimmed.startsWith('## ')) {
          nodes.push(react.createElement('h4', { key: 'h' + i, style: { margin: '10px 0 4px', fontSize: 13, fontWeight: 600 } }, inlineCode(trimmed.slice(3))));
          i++; continue;
        }
        if (trimmed.startsWith('# ')) {
          nodes.push(react.createElement('h3', { key: 'h' + i, style: { margin: '12px 0 6px', fontSize: 14, fontWeight: 600 } }, inlineCode(trimmed.slice(2))));
          i++; continue;
        }
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          while (i < lines.length && lines[i].trim().startsWith('|')) {
            var cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (s) { return s.trim(); });
            if (!cells.some(function (c) { return /^:?-{2,}:?$/.test(c); })) {
              nodes.push(react.createElement('div', { key: 't' + i, style: { display: 'flex', gap: 10, padding: '4px 0', fontSize: 13, lineHeight: '20px' } },
                react.createElement('span', { style: { flex: 'none', color: 'var(--dsw-alias-label-tertiary)' } }, inlineCode(cells[0] || '')),
                react.createElement('span', { style: { color: 'var(--dsw-alias-label-primary)' } }, inlineCode((cells[1] || '').replace(/\s+/g, ' ')))
              ));
            }
            i++;
          }
          continue;
        }
        if (trimmed === '') { i++; continue; }
        nodes.push(react.createElement('div', { key: 'p' + i, style: { padding: '2px 0', fontSize: 13, lineHeight: '20px' } }, inlineCode(trimmed)));
        i++;
      }
      return nodes;
    }

    function row(label, value) {
      return react.createElement(
        'div',
        { style: { display: 'flex', gap: 10, justifyContent: 'space-between', padding: '5px 0', fontSize: 13, lineHeight: '20px' } },
        react.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, label),
        react.createElement('span', { style: { color: 'var(--dsw-alias-label-primary)' } }, String(value))
      );
    }

    function LiyaSection() {
      var state = react.useState('loading'); // loading | ok | error
      var phase = state[0];
      var setPhase = state[1];
      var data = react.useState(null);
      var summary = data[0];
      var setSummary = data[1];
      var err = react.useState('');
      var errorText = err[0];
      var setErrorText = err[1];

      react.useEffect(function () {
        var cancelled = false;
        fetch('/liya-workspace/summary')
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(function (json) {
            if (cancelled) return;
            setSummary(json);
            setPhase('ok');
          })
          .catch(function (e) {
            if (cancelled) return;
            setErrorText(String((e && e.message) || e));
            setPhase('error');
          });
        return function () { cancelled = true; };
      }, []);

      var body = null;
      if (phase === 'loading') {
        body = react.createElement('div', { style: { padding: '10px 0', fontSize: 13, color: 'var(--dsw-alias-label-tertiary)' } }, '加载工作区数据中…');
      } else if (phase === 'error') {
        body = react.createElement('div', { style: { padding: '10px 0', fontSize: 13, color: 'var(--dsw-alias-state-error-primary)' } },
          '⚠️ host 数据链路不可用：' + errorText);
      } else {
        body = react.createElement('div', { style: { marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--dsw-alias-bg-layer-1)' } },
          row('工作区', summary.root),
          row('memory 档案', summary.memoryCount + ' 个文件'),
          row('records 条目', summary.recordsCount + ' 项'),
          row('日记', summary.diaryCount + ' 篇'),
          summary.recentDiary && summary.recentDiary.length
            ? row('最近日记', summary.recentDiary.join('、'))
            : null,
          react.createElement('div', { style: { marginTop: 8 } }, renderMarkdown(summary.map))
        );
      }

      return react.createElement(
        'div',
        { style: { padding: '4px 0', color: 'var(--dsw-alias-label-primary)' } },
        react.createElement(
          'h2',
          { style: { margin: '0 0 8px', fontSize: 16, fontWeight: 600 } },
          '莉娅工作区'
        ),
        react.createElement(
          'p',
          { style: { margin: '0 0 12px', fontSize: 14, lineHeight: '22px', color: 'var(--dsw-alias-label-secondary)' } },
          '工作区档案速览：数据由插件 host 半实时读取（webServer 路由 /liya-workspace/summary），client 半 fetch 展示。'
        ),
        body
      );
    }

    exports.inject = ['slots'];
    exports.apply = function (ctx) {
      var slots = ctx.get('slots');
      if (slots === undefined) return;
      slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'liya',
            order: 100,
            label: function () { return '莉娅工作区'; }
          },
          LiyaSection
        );
      });
    };

    module.exports = exports;
    return module.exports;
  }
});

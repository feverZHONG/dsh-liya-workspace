// 莉娅工作区插件 —— Client 半（dsh client bundle）
// 功能：设置里注册「莉娅工作区」子设置页；页面通过 fetch 调用 host 的
// /dsh-liya-workspace/summary 路由展示工作区档案统计（host↔client 数据链路）；
// 顶部提供 workspaceRoot 配置编辑（settingsScope 持久化，保存即时生效）。
window.__ModuleLoader__.load({
  id: 'dsh-liya-workspace-plugin',
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

    // ── 工作区根目录配置编辑（settingsScope）
    // 姿势照抄 dsh-liya-ui（官方 ui-theme 同款）：
    //   apply 期 bind 一次复用 controller；subscribe/getSnapshot 必须包函数绑定 this（React 裸调会丢 this）。
    function WorkspaceRootEditor(props) {
      var bound = props.bound;
      var stagedState = react.useState(null); // null=未编辑，''=清空
      var staged = stagedState[0];
      var setStaged = stagedState[1];
      var savingState = react.useState(false);
      var saving = savingState[0];
      var setSaving = savingState[1];
      var failedState = react.useState(false);
      var failed = failedState[0];
      var setFailed = failedState[1];

      var snap = null;
      if (bound !== null) {
        try {
          snap = react.useSyncExternalStore(
            function (listener) { return bound.subscribe(listener); },
            function () { return bound.getSnapshot(); }
          );
        } catch (e) { snap = null; }
      }
      var available = bound !== null && snap !== null && snap.status === 'ready';
      var loading = bound !== null && snap !== null && snap.status === 'loading';
      var user = (snap && snap.user && typeof snap.user === 'object') ? snap.user : {};
      var userRoot = (typeof user.workspaceRoot === 'string') ? user.workspaceRoot : '';
      var text = staged !== null ? staged : userRoot;
      var dirty = staged !== null;
      var blocked = !dirty || saving;

      function onEdit(ev) { setStaged(ev.target.value); setFailed(false); }
      function onSave() {
        if (bound === null || !dirty) return;
        setSaving(true);
        setFailed(false);
        var op = (staged.trim() === '') ? bound.unset('workspaceRoot') : bound.set('workspaceRoot', staged.trim());
        op.then(function () { setSaving(false); setStaged(null); }).catch(function () { setSaving(false); setFailed(true); });
      }
      function onDiscard() { setStaged(null); setFailed(false); }

      var inputStyle = {
        flex: '1', minWidth: 0, padding: '6px 8px', borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-strong, rgba(128,128,128,.35))',
        background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'var(--ds-font-family-code)', fontSize: 12, boxSizing: 'border-box'
      };
      var btnBase = {
        padding: '6px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-strong, rgba(128,128,128,.35))',
        background: 'transparent', color: 'var(--dsw-alias-label-primary)'
      };

      return react.createElement(
        'div',
        { style: { marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--dsw-alias-bg-layer-1)' } },
        react.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
          react.createElement('strong', { style: { fontSize: 13, fontWeight: 600 } }, '工作区根目录'),
          dirty ? react.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-primary)' } }, '未保存')
            : react.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } },
                react.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--dsw-alias-state-success-primary)', display: 'inline-block' } }),
                '已生效')
        ),
        loading ? react.createElement('p', { style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, '配置加载中…')
        : !available ? react.createElement('p', { style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', lineHeight: '18px' } },
            'settingsScope 不可用，无法在此修改；可改 cordis.yml 的 config.workspaceRoot。')
        : react.createElement(
            'div',
            { style: { marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' } },
            react.createElement('input', {
              type: 'text', value: text, onChange: onEdit, placeholder: '工作区根目录绝对路径，如 E:/workspace',
              spellCheck: false, style: inputStyle
            }),
            react.createElement('button', {
              type: 'button', onClick: onSave, disabled: blocked,
              style: Object.assign({}, btnBase, { opacity: blocked ? .45 : 1 })
            }, '保存'),
            react.createElement('button', {
              type: 'button', onClick: onDiscard, disabled: !dirty,
              style: Object.assign({}, btnBase, { opacity: !dirty ? .45 : 1 })
            }, '撤销')
          ),
        react.createElement('p', { style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', lineHeight: '18px' } },
          '留空 = 使用 DSH host 进程当前工作目录；保存即时生效（host 每次请求实时读取）。'),
        failed ? react.createElement('p', { role: 'status', style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-state-danger-primary)' } }, '保存失败，请重试') : null
      );
    }

    function LiyaSection(props) {
      var bound = props.bound;
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
        fetch('/dsh-liya-workspace/summary')
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
          '工作区档案速览：数据由插件 host 半实时读取（webServer 路由 /dsh-liya-workspace/summary），client 半 fetch 展示。'
        ),
        react.createElement(WorkspaceRootEditor, { bound: bound }),
        body
      );
    }

    exports.inject = ['slots', 'settingsScope'];
    exports.apply = function (ctx) {
      var slots = ctx.get('slots');
      if (slots === undefined) return;
      // settingsScope 在 apply 期 bind 一次复用（每次 bind 都是新 controller，重复 bind 永远 loading）
      var bound = null;
      try {
        var ss = ctx.get('settingsScope');
        if (ss !== undefined) bound = ss.bind({ namespace: 'dsh-liya-workspace' });
      } catch (e) { bound = null; }
      slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'liya',
            order: 100,
            label: function () { return '莉娅工作区'; }
          },
          function (props) { return react.createElement(LiyaSection, { bound: bound }); }
        );
      });
    };

    module.exports = exports;
    return module.exports;
  }
});

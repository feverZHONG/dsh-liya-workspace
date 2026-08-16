// 莉娅工作区插件 —— Client 半（dsh client bundle）
// 功能：
//   1. settings.section「莉娅工作区」页：fetch /dsh-liya-workspace/summary 展示档案速览 + workspaceRoot 编辑区
//   2. settings.plugin.item「dsh-liya-workspace」卡：workspaceRoot 配置编辑（原生插件卡风格，走 settingsScope）
// settingsScope 姿势照抄 dsh-liya-ui / dsh-liya-skin（已验证可用）：
//   apply 期 bind 一次复用；组件内 fallback 渲染期再 bind；subscribe/getSnapshot 包函数绑定 this。
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

    // ── settingsScope 绑定（apply 期一次 + 渲染期兜底，dsh-liya-ui/skin 同款）
    function bindScope(ctx, bound) {
      if (bound !== null && bound !== undefined) return bound;
      try {
        var ss = ctx.get('settingsScope');
        if (ss !== undefined) return ss.bind({ namespace: 'dsh-liya-workspace' });
      } catch (e) { /* settings 服务缺失时静默 */ }
      return null;
    }

    // ── workspaceRoot 编辑区（卡 body 与 section 页共用）
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
            '配置编辑暂不可用：请到 设置 → 插件 → 插件配置 → dsh-liya-workspace 卡修改，或改 cordis.yml 的 config.workspaceRoot。')
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

    // ── 设置 → 插件 → 插件配置 卡（原生风格，照 dsh-liya-ui LiyaUiCard）
    var CARD_BTN = {
      font: 'inherit', fontSize: 13, borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
      border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)',
      color: 'var(--dsw-alias-label-primary)'
    };

    function LiyaWorkspaceCard(props) {
      var ctx = props.ctx;
      var bound = bindScope(ctx, props.bound);
      var openState = react.useState(false);
      var open = openState[0];
      var setOpen = openState[1];

      var snap = null;
      var dirty = false;
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
      var hasOverride = Object.prototype.hasOwnProperty.call(user, 'workspaceRoot');

      var titleRow = react.createElement(
        'button',
        {
          type: 'button',
          'aria-expanded': open,
          onClick: function () { setOpen(!open); },
          style: {
            display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, padding: '10px 12px', border: 0, background: 'transparent',
            color: 'var(--dsw-alias-label-primary)', font: 'inherit', cursor: 'pointer', textAlign: 'left'
          }
        },
        react.createElement(
          'span',
          { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
          react.createElement('strong', { style: { fontSize: 13, fontWeight: 600 } }, 'dsh-liya-workspace-plugin'),
          react.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, '工作区档案速览，配置工作区根目录')
        ),
        react.createElement(
          'span',
          { style: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, flex: 'none' } },
          hasOverride ? react.createElement('span', { style: { fontSize: 12 } }, '已配置') : null,
          react.createElement('span', { 'aria-hidden': 'true', style: { transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', fontSize: 10 } }, '▾')
        )
      );

      var body = null;
      if (open) {
        var content;
        if (loading) {
          content = react.createElement('p', { key: 'loading', style: { margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-tertiary)' } }, '配置加载中…');
        } else if (!available) {
          content = react.createElement(
            'div',
            { key: 'unavailable' },
            react.createElement('p', { style: { margin: '0 0 8px', fontSize: 13, color: 'var(--dsw-alias-label-secondary)', lineHeight: '20px' } },
              '工作区档案速览：host 半实时读取工作区根目录下的 FILE-MAP / memory / records / diary 统计，client 半 fetch 展示。配置暂不可用。'
            ),
            react.createElement('p', { style: { margin: '0 0 8px', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', lineHeight: '18px' } },
              '可改 cordis.yml 的 config.workspaceRoot 指定工作区根目录。'
            )
          );
        } else {
          content = [
            react.createElement('p', { key: 'desc', style: { margin: '0 0 4px', fontSize: 13, color: 'var(--dsw-alias-label-secondary)', lineHeight: '20px' } },
              '工作区根目录（其下应包含 workspace/、diary/ 等目录），留空 = 使用 DSH host 进程当前工作目录：'),
            react.createElement(WorkspaceRootEditor, { key: 'editor', bound: bound }),
            react.createElement('div', { key: 'footer', style: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, alignItems: 'center' } },
              react.createElement('button', { type: 'button', onClick: function () { setOpen(false); }, style: CARD_BTN }, '收起')
            )
          ];
        }
        body = react.createElement('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l2)', padding: '10px 12px' } }, content);
      }

      return react.createElement(
        'li',
        { style: { listStyle: 'none' } },
        react.createElement(
          'div',
          { style: { border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)', borderRadius: 10, overflow: 'hidden', minWidth: 0 } },
          titleRow,
          body
        )
      );
    }

    // ── 设置 → 莉娅工作区 页（数据展示 + 编辑区）
    function LiyaSection(props) {
      var ctx = props.ctx;
      var bound = bindScope(ctx, props.bound);
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
      // 配置卡：设置 → 插件 → 插件配置（settingsScope 可用位置，dsh-liya-ui/skin 同款）
      slots.inject('settings.plugin.item', function () {
        return slots.register(
          {
            name: 'settings.plugin.item',
            id: 'dsh-liya-workspace',
            order: 40,
            label: function () { return 'dsh-liya-workspace'; }
          },
          function (props) { return react.createElement(LiyaWorkspaceCard, { ctx: ctx, bound: bound }); }
        );
      });
      // 档案页：设置 → 莉娅工作区（数据展示 + 编辑区）
      slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'liya',
            order: 100,
            label: function () { return '莉娅工作区'; }
          },
          function (props) { return react.createElement(LiyaSection, { ctx: ctx, bound: bound }); }
        );
      });
    };

    module.exports = exports;
    return module.exports;
  }
});

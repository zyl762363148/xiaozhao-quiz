/* ============================================================
   小赵勇争第一 · 刷题逻辑
   零依赖，单文件可离线运行
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  var TYPE_LABEL = { judge: '判断题', single: '单选题', multiple: '多选题', blank: '填空题', short: '简答题' };
  var TYPE_SHORT = { judge: '判断', single: '单选', multiple: '多选', blank: '填空', short: '简答' };
  // 游客用旧版全局键；登录用户数据按昵称隔离（全在本机 localStorage）
  var GUEST_KEYS = { set: 'xz_set_v1', stats: 'xz_stats_v1', seen: 'xz_seen_v1', prog: 'xz_prog_v2' };
  var LS = {
    bank: 'xz_bank_v1',
    users: 'xz_users_v1', session: 'xz_session_v1', migrated: 'xz_migrated_v1',
    set: GUEST_KEYS.set, stats: GUEST_KEYS.stats, seen: GUEST_KEYS.seen, prog: GUEST_KEYS.prog
  };
  function setUserKeys(name) {
    var k = name
      ? { set: 'xz_u_' + name + '_set_v1', stats: 'xz_u_' + name + '_stats_v1', seen: 'xz_u_' + name + '_seen_v1', prog: 'xz_u_' + name + '_prog_v2' }
      : GUEST_KEYS;
    LS.set = k.set; LS.stats = k.stats; LS.seen = k.seen; LS.prog = k.prog;
  }
  var DEFAULT_SET = {
    count: 10,            // 每局题数
    seconds: 180,         // 限时秒数（默认 3 分钟 / 10 题）
    timerOn: true,        // 是否开倒计时
    layout: 'single',     // single 逐题 | paper 整卷
    reveal: 'each',       // each 每题答完就出 | end 全部答完再出
    mask: false,          // 出答案时先遮住，点眼睛才看
    expl: true,           // 是否显示解析
    shuffleOpts: false,   // 选项打乱
    pick: 'smart',        // smart 错题优先 | random 完全随机
    autoWrong: true,      // 答错自动收进错题本
    autoRemove: true,     // 答对自动移出错题本
    mascot: 'deer',       // 吉祥物：仅小鹿
    checkin: true,        // 首页是否显示打卡卡
    sound: true,
    theme: 'light',       // light 白天默认 | dark 黑夜 | auto 跟随系统
    filters: []           // 练习题型（可多选），空数组=全部题型
  };
  var CHEER = ['答对了', '漂亮', '稳', '一击命中', '就是这样', '这题你熟', '没跑了'];
  var MEDALS = [
    { d: 3, n: '三天打鱼', e: '🥉' },
    { d: 7, n: '一周不断', e: '🥈' },
    { d: 14, n: '半月之约', e: '🥇' },
    { d: 30, n: '勇争第一', e: '🏆', big: true },
    { d: 60, n: '打卡狂魔', e: '👑' }
  ];

  /* ---------------- 小工具 ---------------- */
  function $(id) { return document.getElementById(id); }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function fmtTime(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return pad(m) + ':' + pad(s); }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function yesterdayKey() { var d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // 断签后不能继续显示上次的「连续 N 天」；昨天打过卡则今天之内仍算有效
  function effectiveStreak(st) {
    var d = (st && st.lastDay) || '';
    if (d !== todayKey() && d !== yesterdayKey()) return 0;
    return Math.max(0, +(st && st.streak) || 0);
  }
  function uid() { return 'q' + Math.random().toString(36).slice(2, 9); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
  }

  /* ---------------- 音效（纯合成，无音频文件） ---------------- */
  var Audio2 = {
    ctx: null,
    on: true,
    init: function () {
      if (!this.on) return;
      try {
        if (!this.ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { }
    },
    tone: function (freq, dur, delay, type, vol) {
      if (!this.on) return;
      this.init();
      if (!this.ctx) return;
      var t0 = this.ctx.currentTime + (delay || 0);
      var osc = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol == null ? 0.06 : vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    },
    correct: function (combo) {
      var base = 620 + Math.min(combo || 0, 6) * 40;
      this.tone(base, 0.1, 0, 'sine', 0.055);
      this.tone(base * 1.5, 0.14, 0.07, 'sine', 0.045);
    },
    wrong: function () { this.tone(190, 0.18, 0, 'triangle', 0.05); this.tone(140, 0.22, 0.1, 'triangle', 0.04); },
    click: function () { this.tone(420, 0.04, 0, 'sine', 0.03); },
    combo: function (n) { [0, 0.07, 0.14].forEach(function (d, i) { Audio2.tone(520 + i * 160 + n * 12, 0.12, d, 'sine', 0.05); }); },
    finish: function (good) {
      var seq = good ? [523, 659, 784, 1047] : [523, 494, 440];
      seq.forEach(function (f, i) { Audio2.tone(f, 0.26, i * 0.11, 'sine', 0.05); });
    }
  };

  /* ---------------- 状态 ---------------- */
  var state = {
    user: null,
    bank: null,
    settings: Object.assign({}, DEFAULT_SET),
    stats: null,
    prog: {},
    quiz: null,
    paper: null,
    pendingImport: null
  };

  function defaultStats() {
    return {
      totalAnswered: 0, totalCorrect: 0,
      bestScore: null, playCount: 0,
      streak: 0, lastDay: '', todayDay: '', todayCount: 0,
      checkin: { days: [] },
      wrong: [], history: []
    };
  }

  /* ---------------- 本机档案（不要密码，只存这台设备） ----------------
     理由：数据本来就在本机，没有服务器；密码唯一作用是防别人看，
     但代价是每次打开都要过一道墙。真正需要的是：
     ① 一台机器能分几个人/几套进度 → 档案切换
     ② 换设备、清缓存不丢 → 备份导出
     ------------------------------------------------ */
  function profiles() { return load(LS.users, {}) || {}; }
  function sessionName() { return load(LS.session, null); }

  function claimLegacy(name) {
    // 第一位注册的用户，自动继承登录前（游客/旧版）攒下的记录
    if (load(LS.migrated, false)) return;
    ['stats', 'seen', 'prog'].forEach(function (k) {
      try {
        var v = localStorage.getItem(GUEST_KEYS[k]);
        if (v != null) localStorage.setItem('xz_u_' + name + '_' + k + '_v' + (k === 'prog' ? '2' : '1'), v);
      } catch (e) { }
    });
    try {
      var s = localStorage.getItem(GUEST_KEYS.set);
      if (s != null) localStorage.setItem('xz_u_' + name + '_set_v1', s);
    } catch (e) { }
    save(LS.migrated, true);
  }

  function createProfile(name) {
    name = String(name || '').trim();
    if (!/^[\u4e00-\u9fa5A-Za-z0-9_\- ]{1,12}$/.test(name)) return '档案名 1-12 位，中文、英文、数字都行';
    var all = profiles();
    if (all[name]) return '「' + name + '」已经在了，点它直接切换';
    all[name] = { created: Date.now() };
    save(LS.users, all);
    claimLegacy(name);
    switchProfile(name);
    return null;
  }
  function switchProfile(name) {
    abandonActiveSessions();
    save(LS.session, name);
    state.user = name;
    setUserKeys(name);
    loadAll();
    applyTheme(); applyMascot(); // 每个档案有自己的主题/外观设置
    renderUser(); renderHome(); renderSettings(); showView('home');
  }
  function useGuest() {
    abandonActiveSessions();
    try { localStorage.removeItem(LS.session); } catch (e) { }
    state.user = null;
    setUserKeys(null);
    loadAll();
    applyTheme(); applyMascot();
    renderUser(); renderHome(); renderSettings(); showView('home');
  }
  function profileStorageKeys(name) {
    return ['xz_u_' + name + '_set_v1', 'xz_u_' + name + '_stats_v1',
      'xz_u_' + name + '_seen_v1', 'xz_u_' + name + '_prog_v2'];
  }
  function deleteProfile(name) {
    var all = profiles();
    delete all[name];
    save(LS.users, all);
    profileStorageKeys(name).forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { } });
    // 档案全删光后允许下一个新建档案重新继承游客数据
    if (!Object.keys(all).length) { try { localStorage.removeItem(LS.migrated); } catch (e) { } }
    if (state.user === name) useGuest();
    else { renderUser(); renderProfileSheet(); }
  }
  function startSession(name) {
    abandonActiveSessions();
    save(LS.session, name);
    state.user = name;
    setUserKeys(name);
    loadAll();
    applyTheme(); applyMascot();
    renderUser();
    renderHome();
  }
  function renderProfileSheet() {
    var all = profiles();
    var names = Object.keys(all).sort(function (a, b) { return (all[a].created || 0) - (all[b].created || 0); });
    var list = $('profList');
    if (!list) return;

    var rows = ['<button class="prof-row' + (!state.user ? ' cur' : '') + '" data-prof="__guest__">' +
      '<span class="avatar">游</span>' +
      '<span class="p-body"><span class="p-name">游客</span>' +
      '<span class="p-meta">不建档案，随手刷</span></span>' +
      (!state.user ? '<span class="p-cur">当前</span>' : '') +
      '</button>'];

    rows = rows.concat(names.map(function (n) {
      var st = load('xz_u_' + n + '_stats_v1', {}) || {};
      var total = st.bestScore == null ? '还没刷过' : ('最佳 ' + st.bestScore + ' 分 · ' + (st.playCount || 0) + ' 局');
      var cur = state.user === n;
      return '<div class="prof-row' + (cur ? ' cur' : '') + '">' +
        '<span class="avatar">' + esc(n.charAt(0).toUpperCase()) + '</span>' +
        '<button class="p-body" style="text-align:left" data-prof="' + esc(n) + '">' +
        '<span class="p-name">' + esc(n) + '</span>' +
        '<span class="p-meta">' + esc(total) + '</span></button>' +
        (cur ? '<span class="p-cur">当前</span>' : '') +
        '<button class="p-del" data-del="' + esc(n) + '" aria-label="删除档案">' +
        '<svg class="ico" aria-hidden="true"><use href="#i-trash"/></svg></button>' +
        '</div>';
    }));

    list.innerHTML = rows.join('');
  }

  function openProfileSheet() {
    $('profMsg').textContent = '';
    $('profMsg').className = 'sheet-note';
    renderProfileSheet();
    $('profWrap').hidden = false;
    document.body.classList.add('locked');
  }
  function closeProfileSheet() {
    $('profWrap').hidden = true;
    document.body.classList.remove('locked');
  }

  /* ---------------- 练题档案 ---------------- */
  function loadProgress() {
    var p = load(LS.prog, null);
    if (p && typeof p === 'object' && !Array.isArray(p)) return p;
    // 从旧版 seen 数组迁移
    var out = {};
    var seen = load(LS.seen, []) || [];
    if (Array.isArray(seen)) seen.forEach(function (id) { out[id] = { n: 1, w: 0, last: 1, t: 0 }; });
    return out;
  }
  function saveProgress() { save(LS.prog, state.prog); }

  function progressOf(id) { return state.prog[id] || null; }

  function markProgress(q, ok) {
    var p = state.prog[q.id] || { n: 0, w: 0, last: 1, t: 0 };
    p.n++;
    if (ok === false) p.w++;
    if (ok === true || ok === false) p.last = ok ? 1 : 0;
    p.t = Date.now();
    state.prog[q.id] = p;
  }

  // 0 = 上次答错（最该重来）｜1 = 没练过｜2 = 练过且答对
  function levelOf(id) {
    var p = state.prog[id];
    if (!p || !p.n) return 1;
    if (p.last === 0) return 0;
    return 2;
  }

  function roundStats() {
    var all = state.bank ? state.bank.questions.length : 0;
    var done = 0, wrong = 0;
    state.bank && state.bank.questions.forEach(function (q) {
      var p = state.prog[q.id];
      if (p && p.n) { done++; if (p.last === 0) wrong++; }
    });
    return { all: all, done: done, wrong: wrong, fresh: Math.max(0, all - done) };
  }

  function markHtml(id) {
    var p = state.prog[id];
    if (!p || !p.n) return '<span class="qmark new">新题</span>';
    if (p.last === 0) {
      var ww = p.w > 0 ? p.w : 1;
      return '<span class="qmark bad">错过 ' + ww + ' 次</span>';
    }
    if (p.n >= 2) return '<span class="qmark hard">练过 ' + p.n + ' 次</span>';
    return '<span class="qmark">练过</span>';
  }

  // 错题本列表：一律展示「错过 N 次」（与答题页练过标记分开）
  function wrongMarkHtml(id) {
    var p = state.prog[id];
    var w = (p && p.w > 0) ? p.w : 1;
    return '<span class="qmark bad">错过 ' + w + ' 次</span>';
  }

  function confirmLeaveSession() {
    return confirm('确认退出吗？本局进度不保留');
  }

  // 换档案 / 恢复备份前先收掉当前局：否则旧的倒计时归零后
  // 会把这一局的成绩、错题、练题记录写进新档案里
  function abandonActiveSessions() {
    if (state.quiz) stopTimer(state.quiz);
    if (state.paper) stopTimer(state.paper);
    state.quiz = null;
    state.paper = null;
    state.lastResult = null;
    state.lastOnlyWrong = false;
  }

  function loadAll() {
    var rawSet = load(LS.set, null);
    var s = (rawSet && typeof rawSet === 'object' && !Array.isArray(rawSet)) ? rawSet : {};
    var base = Object.assign({}, DEFAULT_SET, s);
    state.settings = Object.assign({}, base);
    // 旧版 mode:instant/exam → 新版 layout:single/paper
    if (!s.layout && s.mode) state.settings.layout = (s.mode === 'exam' ? 'paper' : 'single');
    if (state.settings.layout !== 'paper') state.settings.layout = 'single';
    if (state.settings.reveal !== 'end') state.settings.reveal = 'each';
    if (state.settings.pick !== 'random') state.settings.pick = 'smart';
    // 旧版 filter（单选）→ 新版 filters（多选数组）
    if (!Array.isArray(s.filters)) {
      var oldF = s.filter;
      state.settings.filters = (oldF && oldF !== 'all' && TYPE_LABEL[oldF]) ? [oldF] : [];
    }
    state.settings.filters = state.settings.filters.filter(function (t) { return !!TYPE_LABEL[t]; });
    if ('filter' in state.settings) delete state.settings.filter;
    if (!state.settings.theme || ['auto','light','dark'].indexOf(state.settings.theme) < 0) state.settings.theme = 'auto';
    // v37：只保留小鹿；旧 bear/dragon/fish 设置一律迁移到 deer
    try {
      var m = state.settings.mascot;
      if (!m || m === 'bear' || m === 'dragon' || m === 'fish' || !((window.XZ_SKINS || {})[m])) state.settings.mascot = 'deer';
      localStorage.setItem('xz_brand_mascot_deer_only', '1');
    } catch (e) { state.settings.mascot = 'deer'; }
    // 布尔开关必须真归一化：旧备份里 "false" 字符串用 !! 判断会变成「开」
    ['timerOn','mask','expl','shuffleOpts','autoWrong','autoRemove','checkin','sound'].forEach(function (k) {
      state.settings[k] = state.settings[k] === true || state.settings[k] === 1 || state.settings[k] === 'true';
    });
    state.settings.count = Math.max(1, Math.min(200, +state.settings.count || 10));
    state.settings.seconds = Math.max(0, Math.min(3600, +state.settings.seconds || 0));
    // 设置页按整分钟显示，奇数秒会让首页写「45 秒」、设置页写「1 分钟」
    if (state.settings.seconds && state.settings.seconds % 60) {
      state.settings.seconds = Math.max(60, Math.round(state.settings.seconds / 60) * 60);
    }
    // 限时开但 0 秒 = 不限时（旧备份可能出现这种矛盾值），文案和计时器要一致
    if (state.settings.timerOn && !state.settings.seconds) state.settings.timerOn = false;
    // 归一化结果落盘，别让内存和存储长期不一致
    if (JSON.stringify(state.settings) !== JSON.stringify(base)) persistSet();

    state.stats = Object.assign(defaultStats(), load(LS.stats, {}) || {});
    state.prog = loadProgress();

    var custom = load(LS.bank, null);
    state.bank = (custom && custom.questions && custom.questions.length) ? custom : (window.__BANK__ || { title: '题库', questions: [] });

    // 今日计数跨天重置
    var tk = todayKey();
    if (state.stats.todayDay !== tk) { state.stats.todayDay = tk; state.stats.todayCount = 0; }
    if (!state.stats.checkin || !Array.isArray(state.stats.checkin.days)) state.stats.checkin = { days: [] };
    if (!Array.isArray(state.stats.wrong)) state.stats.wrong = [];
    // 题库换过后清掉已经不在题库里的错题 id，设置页/首页/错题本三处计数才对得上
    var inBank = {};
    (state.bank.questions || []).forEach(function (q) { inBank[q.id] = 1; });
    var cleaned = state.stats.wrong.filter(function (id) { return !!inBank[id]; });
    if (cleaned.length !== state.stats.wrong.length) { state.stats.wrong = cleaned; persistStats(); }
    // 断签后把旧的连续天数归零，别一直显示上次的值
    if (state.stats.streak && !effectiveStreak(state.stats)) { state.stats.streak = 0; persistStats(); }
    Audio2.on = !!state.settings.sound;
  }

  function persistStats() { save(LS.stats, state.stats); }
  function persistSet() { save(LS.set, state.settings); }

  /* ---------------- 题库归一化 ---------------- */
  function detectType(q) {
    var t = (q.type || q['类型'] || q['题型'] || '').toString().toLowerCase();
    if (/判断|judge|true|bool|^tf$/.test(t)) return 'judge';
    if (/多选|multiple|multi|checkbox/.test(t)) return 'multiple';
    if (/单选|single|choice|radio/.test(t)) return 'single';
    if (/填空|blank|fill/.test(t)) return 'blank';
    if (/简答|问答|short|essay|qa/.test(t)) return 'short';
    // 未标注 type，靠字段推断
    var ans = q.answer != null ? q.answer : (q['答案'] != null ? q['答案'] : q['正确答案']);
    var opts = q.options || q['选项'] || [];
    if (typeof opts === 'string') opts = splitOptionText(opts);
    if (opts && opts.length >= 2) {
      if (Array.isArray(ans) && ans.length > 1) return 'multiple';
      if (typeof ans === 'string' && /[,，、]/.test(ans) && ans.replace(/[^A-Za-z]/g, '').length > 1) return 'multiple';
      return 'single';
    }
    if (typeof ans === 'boolean') return 'judge';
    if (typeof ans === 'string' && /^(对|错|正确|错误|√|×|T|F|true|false)$/i.test(ans.trim())) return 'judge';
    if (Array.isArray(ans) && ans.length > 1) return 'blank';
    return 'blank';
  }

  function splitOptionText(text) {
    text = String(text || '').replace(/\r/g, '');
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);

    // 有的表格把两个选项挤在一行：A.1 年B.6 个月 —— 按「字母连续递增」的标记再切一次
    var expanded = [];
    lines.forEach(function (l) {
      var parts = l.split(/(?=[A-Ha-h]\s*[.、．)）:：])/).map(function (s) { return s.trim(); }).filter(Boolean);
      var ok = parts.length > 1;
      for (var i = 1; ok && i < parts.length; i++) {
        if (parts[i].toUpperCase().charCodeAt(0) !== parts[i - 1].toUpperCase().charCodeAt(0) + 1) ok = false;
      }
      if (ok) parts.forEach(function (p) { expanded.push(p); });
      else expanded.push(l);
    });
    lines = expanded;

    var prefixed = lines.filter(function (l) { return /^[A-Ha-h]\s*[.、．)）:：]/.test(l); }).length;
    // 一行前缀都没有：每行就是一个选项；否则带字母前缀的行开新选项，其余行是上一选项的续行
    if (prefixed === 0) return lines;
    var out = [];
    lines.forEach(function (l) {
      var m = l.match(/^([A-Ha-h])\s*[.、．)）:：]\s*(.*)$/);
      if (m) out.push(m[2].trim());
      else if (out.length) out[out.length - 1] += ' ' + l;
      else out.push(l);
    });
    return out;
  }

  function toBool(v) {
    if (typeof v === 'boolean') return v;
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (/^(对|正确|是|真|√|✓|t|true|1|y|yes)$/.test(s)) return true;
    if (/^(错|错误|否|假|×|✗|x|f|false|0|n|no)$/.test(s)) return false;
    return null;
  }

  function lettersOf(v) {
    var s = Array.isArray(v) ? v.map(function (x) { return String(x); }).join(',') : String(v == null ? '' : v);
    // 全角字母转半角再提取
    s = s.replace(/[Ａ-Ｈａ-ｈ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    return (s.toUpperCase().match(/[A-H]/g) || []);
  }

  function normAnswer(raw, type, optCount) {
    if (type === 'judge') {
      var arr = Array.isArray(raw) ? raw[0] : raw;
      var b = toBool(arr);
      return [b === null ? true : b];
    }
    if (type === 'single') return [lettersOf(raw)[0] || 'A'];
    if (type === 'multiple') {
      var ls = lettersOf(raw);
      ls = ls.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
      return ls.length ? ls : ['A'];
    }
    // blank：数组的每一项是一个空的答案；字符串用 | 或 分隔
    var v = raw;
    if (Array.isArray(v)) return v.map(function (x) { return Array.isArray(x) ? x.join('/') : String(x); });
    if (typeof v === 'string') {
      var parts = v.split(/\s*[|｜]\s*/);
      return parts.length ? parts : [v];
    }
    return [String(v == null ? '' : v)];
  }

  function hashId(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // 去重 / 进度迁移的统一键：同题干的单选和多选是两道不同的题，不能合并
  function questionKey(q) {
    return normText(q.stem) + '#' + q.type;
  }

  function mkQuestion(stem, type, options, answer, raw) {
    var key = normText(stem) + '#' + type;
    return {
      id: 'k' + hashId(key),
      type: type,
      stem: stem,
      options: options,
      answer: answer,
      explanation: String(raw.explanation || raw.analysis || raw['解析'] || raw['答案解析'] || raw['试题解析'] || raw['说明'] || '').trim(),
      tag: String(raw.tag || raw['标签'] || raw['章节'] || raw['知识点'] || '').trim()
    };
  }

  /**
   * 单题构建：识别 + 自愈 + 说清为什么被丢
   * 返回 { q } 或 { drop: 原因 }，附带 fixes 说明做过哪些修正
   */
  function buildQuestion(raw) {
    if (!raw || typeof raw !== 'object') return { drop: '不是一条有效数据' };

    var stem = raw.stem || raw.question || raw.title || raw['题干'] || raw['题目'] || raw['试题'] || raw['问题'] || raw['内容'] || '';
    stem = String(stem).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
    if (!stem) return { drop: '题干为空' };

    var type = detectType(raw);
    var rawOpts = raw.options || raw['选项'] || raw['选项内容'] || raw.choices || [];
    if (typeof rawOpts === 'string') rawOpts = splitOptionText(rawOpts);
    var options = (Array.isArray(rawOpts) ? rawOpts : []).map(function (o) {
      if (o && typeof o === 'object') return String(o.text || o.label || o.value || '');
      return String(o == null ? '' : o).replace(/^[A-Ha-h]\s*[.、．)）:：]\s*/, '').trim();
    });
    while (options.length && options[options.length - 1] === '') options.pop();

    var rawAns = raw.answer != null ? raw.answer
      : (raw['答案'] != null ? raw['答案']
        : (raw['正确答案'] != null ? raw['正确答案']
          : (raw['参考答案'] != null ? raw['参考答案'] : null)));
    if (rawAns == null || String(rawAns).trim() === '') return { drop: '缺少答案' };

    var fixes = [];

    if (type === 'judge') {
      var jv = Array.isArray(rawAns) ? rawAns[0] : rawAns;
      var jb = toBool(jv);
      // 答案写成 A/B、选项是「正确/错误」时按选项翻译
      if (jb === null && /^[A-Ba-b]$/.test(String(jv).trim()) && options.length >= 2) {
        var oi = String(jv).trim().toUpperCase().charCodeAt(0) - 65;
        var ob = toBool(options[oi]);
        if (ob !== null) { jb = ob; fixes.push('判断题答案由选项 ' + String(jv).trim().toUpperCase() + ' 还原为对错'); }
      }
      if (jb === null) return { drop: '判断题答案无法识别' };
      return { q: mkQuestion(stem, 'judge', [], [jb], raw), fixes: fixes };
    }

    if (type === 'single' || type === 'multiple') {
      if (options.length < 2) return { drop: '选择题缺少选项' };
      if (options.some(function (o) { return o === ''; })) return { drop: '选项中间有空缺' };
      var rawLetters = lettersOf(rawAns);
      var ls = rawLetters.filter(function (v) { return v.charCodeAt(0) - 65 < options.length; });
      // 答案里有选项范围外的字母（例如答案写 C、选项却只有 A/B）：
      // 静默裁剪会留下一道界面上永远选不到正确答案的题，宁可丢弃并说明原因
      if (ls.length !== rawLetters.length) {
        return { drop: '答案字母超出选项范围，选项可能漏了' };
      }
      if (!ls.length) return { drop: '答案字母与选项对不上' };
      ls = ls.filter(function (v, k, a) { return a.indexOf(v) === k; }).sort();
      if (type === 'single' && ls.length > 1) { type = 'multiple'; fixes.push('单选改判为多选（答案有 ' + ls.length + ' 项）'); }
      if (type === 'multiple' && ls.length === 1) { type = 'single'; fixes.push('多选改判为单选（答案只有 1 项）'); }
      return { q: mkQuestion(stem, type, options, type === 'single' ? [ls[0]] : ls, raw), fixes: fixes };
    }

    var ans = normAnswer(rawAns, type, 0);
    if (type === 'blank') {
      // 题干只有 1 个空、答案却被 | 拆成多份：多半是「多个可接受写法」而不是多个空，
      // 不合并的话这题永远判错（空位数和答案数对不上）
      var blanks = (stem.match(/[（(]\s*[　\s]*\s*[)）]/g) || []).length;
      if (blanks === 1 && ans.length > 1) {
        ans = [ans.join('/')];
        fixes.push('答案的多个写法合并为一空的多种可接受形式');
      } else if (blanks > 1 && ans.length === 1 && /[;；,，、]/.test(String(ans[0]))) {
        // 多空答案只认 | 时，写成「资产;负债;权益」会变成一整串、永远答不对
        var more = String(ans[0]).split(/\s*[;；,，、]\s*/).filter(function (v) { return v.trim() !== ''; });
        if (more.length > 1) {
          ans = more.slice(0, blanks);
          fixes.push('答案里的分号/逗号按多个空拆开');
        }
      }
    }
    if (!ans.length || !ans.some(function (v) { return String(v).trim(); })) return { drop: '答案为空' };
    return { q: mkQuestion(stem, type, [], ans, raw), fixes: fixes };
  }

  function normalizeQuestion(raw, i) {
    var r = buildQuestion(raw, i);
    return r.q || null;
  }

  /**
   * 整份题库分析：逐条构建 → 去重 → 汇总统计
   */
  function analyzeBank(rawList, fallbackTitle) {
    if (!Array.isArray(rawList)) throw new Error('没找到题目数组');

    var questions = [], seen = {}, types = {};
    var dups = 0;
    var drops = { total: 0, list: [] };
    var fixes = { total: 0, list: [] };

    rawList.forEach(function (raw, i) {
      var at = (raw && raw.__from) || ('第 ' + (i + 1) + ' 条');
      var r = buildQuestion(raw);
      if (!r.q) {
        drops.total++;
        if (drops.list.length < 80) {
          drops.list.push({
            at: at,
            reason: r.drop,
            preview: String((raw && (raw.stem || raw['题干'] || raw['题目'] || '')) || '').slice(0, 28)
          });
        }
        return;
      }
      var key = questionKey(r.q);
      if (seen[key]) { dups++; return; }
      seen[key] = 1;
      questions.push(r.q);
      types[r.q.type] = (types[r.q.type] || 0) + 1;
      if (r.fixes && r.fixes.length) {
        fixes.total++;
        if (fixes.list.length < 80) fixes.list.push({ at: at, text: r.fixes.join('；') });
      }
    });

    if (!questions.length) {
      var why = drops.list.length ? drops.list[0].reason : '';
      throw new Error('一条可用的题都没解析出来' + (why ? '（' + why + '）' : '') + '，检查表头是否为「题干」和「答案」');
    }

    return {
      questions: questions,
      dups: dups,
      drops: drops,
      fixes: fixes,
      types: types,
      total: rawList.length,
      title: (fallbackTitle || '我的题库')
    };
  }

  /* ---------------- 抽题：每种题型都要有，且按"该练的优先" ---------------- */
  function takeOne(arr, used) {
    var buckets = [[], [], []];
    for (var i = 0; i < arr.length; i++) {
      if (used[arr[i].id]) continue;
      buckets[levelOf(arr[i].id)].push(arr[i]);
    }
    if (state.settings.pick === 'random') {
      var all = buckets[0].concat(buckets[1], buckets[2]);
      if (!all.length) return null;
      return all[Math.floor(Math.random() * all.length)];
    }
    var pool = null;
    if (buckets[0].length) pool = buckets[0];              // 错过的先重来
    else if (buckets[1].length) pool = buckets[1];         // 没练过的其次
    else if (buckets[2].length) {                          // 都练过：挑练得最少的，别老撞同一批
      pool = buckets[2].slice().sort(function (x, y) {
        return (progressOf(x.id).n || 0) - (progressOf(y.id).n || 0);
      }).slice(0, Math.max(1, Math.ceil(buckets[2].length * 0.35)));
    }
    if (!pool || !pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickQuestions(pool, count) {
    // 同题干同题型的重复题（内置库历史数据里有一组）一局只出一道
    var seenK = {}, uniq = [];
    pool.forEach(function (q) { var k = questionKey(q); if (!seenK[k]) { seenK[k] = 1; uniq.push(q); } });
    pool = uniq;
    var byType = {};
    pool.forEach(function (q) { (byType[q.type] = byType[q.type] || []).push(q); });
    var types = Object.keys(byType).sort(function (a, b) { return byType[b].length - byType[a].length; });
    if (!types.length) return [];

    count = Math.min(count, pool.length);
    var picked = [];
    var used = {};
    // 局题数少于题型数时随机轮转起点，否则永远只出题数最多的那几类
    var ordered = types.slice();
    if (count < ordered.length) {
      var off = Math.floor(Math.random() * ordered.length);
      ordered = ordered.slice(off).concat(ordered.slice(0, off));
    }
    var seed = ordered.slice(0, Math.min(ordered.length, count));

    // 第一轮：每个题型先来一道，保证"什么题型都练到"
    seed.forEach(function (t) {
      var q = takeOne(byType[t], used);
      if (q) { used[q.id] = 1; picked.push(q); }
    });

    // 之后轮转补齐，让各题型占比均衡
    var guard = 0;
    while (picked.length < count && guard++ < 1000) {
      var added = false;
      for (var i = 0; i < seed.length && picked.length < count; i++) {
        var q2 = takeOne(byType[seed[i]], used);
        if (q2) { used[q2.id] = 1; picked.push(q2); added = true; }
      }
      if (!added) break;
    }

    // 仍不足（题库比要求的题数少）：从全池补
    if (picked.length < count) {
      var rest = pool.filter(function (q) { return !used[q.id]; });
      shuffle(rest).slice(0, count - picked.length).forEach(function (q) { picked.push(q); });
    }
    return shuffle(picked);
  }

  var TYPE_ORDER = ['judge', 'single', 'multiple', 'blank', 'short'];
  function sortTypes(fs) {
    return TYPE_ORDER.filter(function (t) { return fs.indexOf(t) >= 0; });
  }
  // 把选中的题型说成人话：单选+多选 → 全是选择题
  function filtersName(fs) {
    if (!fs || !fs.length) return '全部题型';
    if (fs.length === 2 && fs.indexOf('single') >= 0 && fs.indexOf('multiple') >= 0) return '全是选择题';
    return sortTypes(fs).map(function (t) { return TYPE_LABEL[t] || t; }).join(' + ');
  }

  // 换题库后错题本可能残留旧题 id；角标和抽题池都只认当前题库里还存在的
  function validWrongIds() {
    var ids = {};
    (state.bank.questions || []).forEach(function (q) { ids[q.id] = 1; });
    return (state.stats.wrong || []).filter(function (id) { return !!ids[id]; });
  }

  function buildPool(onlyWrong) {
    var all = state.bank.questions;
    var fs = state.settings.filters;
    if (fs && fs.length) all = all.filter(function (q) { return fs.indexOf(q.type) >= 0; });
    if (onlyWrong) {
      var wrong = validWrongIds();
      return all.filter(function (q) { return wrong.indexOf(q.id) >= 0; });
    }
    return all.slice();
  }

  // 选项打乱：复制一份题，选项重排、答案字母跟着换算，原题库不动
  function shuffleOptions(qs) {
    return qs.map(function (q) {
      if (!q.options || q.options.length < 2) return q;
      if (q.type !== 'single' && q.type !== 'multiple') return q;
      var idx = q.options.map(function (_, i) { return i; });
      shuffle(idx);
      var opts = idx.map(function (i) { return q.options[i]; });
      var ans = q.answer.map(function (a) {
        if (typeof a !== 'string' || a.length !== 1) return a;
        var k = a.toUpperCase().charCodeAt(0) - 65;
        if (k < 0 || k >= idx.length) return a;
        return String.fromCharCode(65 + idx.indexOf(k));
      }).sort();
      return Object.assign({}, q, { options: opts, answer: ans });
    });
  }

  /* ---------------- 判分 ---------------- */
  function normText(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[\s\u3000]/g, '')
      .replace(/[，,。.、；;：:！!？?（）()【】\[\]{}"'“”‘’《》<>~～\-—_]/g, '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  }

  function isCorrect(q, picked) {
    if (picked == null) return false;
    if (q.type === 'judge' || q.type === 'single') return picked === q.answer[0];
    if (q.type === 'multiple') {
      if (!Array.isArray(picked)) return false;
      var a = q.answer.slice().sort().join(','), b = picked.slice().sort().join(',');
      return a === b && picked.length > 0;
    }
    if (q.type === 'blank') {
      var arr = Array.isArray(picked) ? picked : [picked];
      if (arr.length !== q.answer.length) return false;
      for (var i = 0; i < q.answer.length; i++) {
        var accepts = String(q.answer[i]).split(/\s*[\/／]\s*/).map(normText);
        if (accepts.indexOf(normText(arr[i])) < 0) return false;
      }
      return true;
    }
    return false;
  }

  function answerText(q) {
    if (q.type === 'judge') return q.answer[0] ? '正确' : '错误';
    if (q.type === 'single' || q.type === 'multiple') {
      return q.answer.map(function (l) {
        var idx = l.charCodeAt(0) - 65;
        var opt = q.options[idx];
        return opt ? l + '. ' + opt : l;
      }).join('；');
    }
    return q.answer.join(' ｜ ');
  }

  function pickedText(q, picked) {
    if (q.type === 'judge') return picked === null || picked === undefined ? '未作答' : (picked ? '正确' : '错误');
    if (q.type === 'single') {
      if (!picked) return '未作答';
      var idx = picked.charCodeAt(0) - 65;
      return q.options[idx] ? picked + '. ' + q.options[idx] : picked;
    }
    if (q.type === 'multiple') return (picked && picked.length) ? picked.join('') : '未作答';
    if (Array.isArray(picked)) return picked.join(' ｜ ') || '未作答';
    return picked || '未作答';
  }

  /* ---------------- 打卡日历 + 勋章 ---------------- */
  function medalsOf(st) {
    var days = (st && st.checkin && Array.isArray(st.checkin.days)) ? st.checkin.days.length : 0;
    return MEDALS.map(function (m) {
      return { d: m.d, n: m.n, e: m.e, big: !!m.big, got: days >= m.d, p: Math.min(days, m.d) };
    });
  }

  function checkinCheer(st) {
    var tk = todayKey();
    var days = (st.checkin && st.checkin.days) || [];
    var didToday = days.indexOf(tk) >= 0;
    var s = effectiveStreak(st);
    if (didToday) return '今天已点亮 · 连续 ' + (s || 1) + ' 天';
    return '今日未点亮 · 再刷完 1 局就亮';
  }

  function renderCheckin() {
    var days = state.stats.checkin.days || [];
    var set = {};
    days.forEach(function (d) { set[d] = 1; });
    var today = todayKey();

    // 首页是否显示打卡卡
    var card = $('checkinCard');
    if (card) card.hidden = !state.settings.checkin;

    var meta = $('ckMeta');
    if (meta) meta.textContent = checkinCheer(state.stats);

    // 下一个还没拿到的勋章
    var nx = $('ckNext');
    if (nx) {
      var next = MEDALS.filter(function (m) { return days.length < m.d; })[0];
      if (next) {
        nx.textContent = '下一个：' + next.n + ' · 再 ' + (next.d - days.length) + ' 天';
        nx.hidden = false;
      } else {
        nx.textContent = '勋章全收齐了';
        nx.hidden = false;
      }
    }

    // 最近 28 天的格子，按星期对齐
    var cells = [];
    var t = new Date(); t.setHours(12, 0, 0, 0);
    var start = new Date(t); start.setDate(start.getDate() - 27);
    for (var b = 0; b < start.getDay(); b++) cells.push('<span class="ck-day blank"></span>');
    for (var i = 27; i >= 0; i--) {
      var d = new Date(t); d.setDate(d.getDate() - i);
      var k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      var cls = 'ck-day' + (set[k] ? ' on' : '') + (k === today ? ' today' : '');
      cells.push('<span class="' + cls + '" title="' + k + '">' + d.getDate() + '</span>');
    }
    var cal = $('ckCal');
    if (cal) cal.innerHTML = cells.join('');

    var ms = medalsOf(state.stats);
    var wrap = $('ckMedals');
    if (wrap) {
      wrap.innerHTML = ms.map(function (m) {
        return '<div class="medal' + (m.got ? ' got' : '') + (m.big ? ' big' : '') + '">' +
          '<span class="m-ring"><svg class="ico" aria-hidden="true"><use href="#' + (m.big ? 'i-trophy' : 'i-medal') + '"/></svg></span>' +
          '<b>' + esc(m.n) + '</b>' +
          '<i>' + (m.got ? '已达成' : m.p + '/' + m.d + ' 天') + '</i>' +
          '<span class="m-bar"><i style="width:' + Math.round(m.p / m.d * 100) + '%"></i></span>' +
          '</div>';
      }).join('');
    }
  }

  function renderUser() {
    var name = state.user || '游客';
    $('userAvatar').textContent = name.charAt(0).toUpperCase();
    $('userName').textContent = name;
    $('btnUser').title = state.user ? '当前档案：' + name : '游客模式，点开可建档案';
  }

  /* ---------------- 视图切换 ---------------- */
  var TAB_VIEWS = ['home', 'wrong', 'data', 'settings'];
  // 仅答题/整卷进行中：顶栏左侧「返回」= 唯一退出入口（需确认）
  var SESSION_VIEWS = ['quiz', 'paper'];
  // 非 Tab、需要顶栏返回但不走答题确认：题库 / 结算
  var BACK_VIEWS = ['quiz', 'paper', 'bank', 'result'];

  function syncHdrChrome(name) {
    var back = $('btnHdrBack');
    var bank = $('btnBank');
    var brand = $('brandHome');
    var showBack = BACK_VIEWS.indexOf(name) >= 0;
    // Boss: 全站不展示品牌顶栏（logo+名称）；答题/整卷/题库/结算只留左侧「返回」
    if (brand) {
      brand.hidden = true;
      brand.setAttribute('aria-hidden', 'true');
      brand.tabIndex = -1;
    }
    if (back) back.hidden = !showBack;
    // 书本钮不再出现在顶栏（易被当成离开）；题库从首页「题库」格进入
    if (bank) bank.hidden = true;
  }

  function leaveViaHdrBack() {
    var name = document.body.getAttribute('data-view') || '';
    if (name === 'quiz' && state.quiz && !state.quiz.finished) {
      if (!confirmLeaveSession()) return;
      stopTimer(state.quiz); state.quiz = null;
      showView('home'); renderHome();
      return;
    }
    if (name === 'paper' && state.paper && !state.paper.finished) {
      if (!confirmLeaveSession()) return;
      stopTimer(state.paper); state.paper = null;
      showView('home'); renderHome();
      return;
    }
    // 已交卷的整卷 / 结算 / 题库：直接回
    if (name === 'paper' && state.paper && state.paper.finished) {
      paperToResult();
      return;
    }
    state.quiz = null;
    if (name !== 'result') state.paper = null;
    showView('home'); renderHome();
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === 'view-' + name);
    });
    document.body.setAttribute('data-view', name);
    // Boss: 品牌顶栏全站隐藏；仅非 Tab 页（quiz/paper/bank/result）显示极简「返回」条
    var hdr = $('hdr');
    var needBackBar = BACK_VIEWS.indexOf(name) >= 0;
    if (hdr) hdr.hidden = !needBackBar;
    var btnUser = $('btnUser');
    if (btnUser) btnUser.hidden = true; // 自用：无登录/档案入口
    syncHdrChrome(name);
    // 底部导航：只在四个主页面显示，并点亮当前页
    var bar = $('tabbar');
    var isTab = TAB_VIEWS.indexOf(name) >= 0;
    if (bar) {
      bar.hidden = !isTab;
      bar.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.dataset.tab === name);
      });
    }
    if (name === 'data') renderData();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ---------------- 首页 ---------------- */
  function greeting() {
    var h = new Date().getHours();
    if (h < 6) return '这个点还在刷，卷王。';
    if (h < 11) return '早上这一局，记得最牢。';
    if (h < 14) return '午后来十道，醒醒脑子。';
    if (h < 19) return '今天还差几道？';
    return '睡前十分钟，稳稳收工。';
  }

  function cfgText() {
    var s = state.settings;
    var t = (s.timerOn && s.seconds) ? (s.seconds >= 60 ? Math.round(s.seconds / 60) + ' 分钟' : s.seconds + ' 秒') : '不限时';
    var mode = s.layout === 'paper' ? '整卷' : (s.reveal === 'end' ? '逐题 · 最后对答案' : '逐题');
    return s.count + ' 题 · ' + t + ' · ' + mode;
  }

  function renderHome() {
    var b = state.bank, st = state.stats;
    if ($('brandSub')) $('brandSub').textContent = (b.title || '题库').slice(0, 18);
    $('homeTitle').textContent = '小赵加油';
    $('homeSub').textContent = '吃饭、睡觉、刷会儿题';

    var fsNow = state.settings.filters || [];
    var filterName = fsNow.length === 1 ? (TYPE_SHORT[fsNow[0]] || '')
      : (fsNow.length === 2 && fsNow.indexOf('single') >= 0 && fsNow.indexOf('multiple') >= 0 ? '选择题'
        : (fsNow.length ? fsNow.length + ' 类' : ''));
    $('startLabel').textContent = (filterName ? filterName + ' · ' : '') + '开始刷题';
    $('startMeta').textContent = cfgText();

    // 今日概览
    if ($('stBank')) $('stBank').textContent = b.questions.length;
    $('stToday').textContent = st.todayCount || 0;
    $('stBest').textContent = st.bestScore == null ? '–' : st.bestScore;
    $('stAcc').textContent = st.totalAnswered ? Math.round(st.totalCorrect / st.totalAnswered * 100) + '%' : '–';

    // 横幅连击
    var bs = $('bannerStreak');
    if (effectiveStreak(st) > 0) { bs.hidden = false; $('bsNum').textContent = effectiveStreak(st); }
    else bs.hidden = true;

    renderCheckin();

    var wc = validWrongIds().length;
    var ws = $('btnWrongHome');
    if (wc > 0) {
      if (ws) ws.hidden = false;
      if ($('wrongCount')) $('wrongCount').textContent = wc;
      var whm = $('wrongHomeMeta');
      if (whm) {
        var s = state.settings;
        if (s.autoWrong && s.autoRemove) whm.textContent = '答对一次就自动移出 · 点这里直接开刷';
        else if (s.autoWrong) whm.textContent = '答错自动收进 · 点这里直接开刷';
        else whm.textContent = '点这里直接刷错题 · 右侧进列表';
      }
          } else {
      if (ws) ws.hidden = true;
          }

    // 底部导航的错题角标
    var tbBadge = $('tabWrongBadge');
    if (tbBadge) {
      if (wc > 0) { tbBadge.hidden = false; tbBadge.textContent = wc > 99 ? '99+' : wc; }
      else tbBadge.hidden = true;
    }

    // V40: 最近成绩移出首页 bento（数据页仍有走势）；保留节点供兼容
    var tb = $('trendBox');
    if (tb) { tb.hidden = true; tb.setAttribute('aria-hidden', 'true'); }
    var h = st.history || [];
    if (tb && h.length && $('trendBars') && $('trendMeta')) {
      var recent = h.slice(0, 12).reverse();
      var avg = Math.round(h.reduce(function (s, x) { return s + x.score; }, 0) / h.length);
      var acc = st.totalAnswered ? Math.round(st.totalCorrect / st.totalAnswered * 100) : 0;
      $('trendMeta').textContent = '近 ' + h.length + ' 局平均 ' + avg + ' 分 · 正确率 ' + acc + '%';
      $('trendBars').innerHTML = recent.map(function (x) {
        var d = new Date(x.ts);
        var tip = (d.getMonth() + 1) + '/' + d.getDate() + ' · ' + x.correct + '/' + x.total;
        return '<div class="tbar' + (x.score < 60 ? ' low' : '') + '" title="' + tip + '">' +
          '<i style="height:' + Math.max(6, x.score) + '%"></i><em>' + x.score + '</em></div>';
      }).join('');
    }
  }

  /* ---------------- 数据分析页 ---------------- */
  function renderData() {
    var st = state.stats, h = st.history || [];

    $('dvAnswered').textContent = st.totalAnswered || 0;
    $('dvAcc').textContent = st.totalAnswered ? Math.round(st.totalCorrect / st.totalAnswered * 100) + '%' : '--';
    $('dvAvg').textContent = h.length ? Math.round(h.reduce(function (s, x) { return s + x.score; }, 0) / h.length) : '--';
    $('dvStreak').textContent = effectiveStreak(st);

    // 每日节奏：最近 14 天每天答题数（按历史记录聚合）
    var perDay = {};
    h.forEach(function (x) {
      var d = new Date(x.ts);
      var k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      perDay[k] = (perDay[k] || 0) + x.total;
    });
    var t = new Date(); t.setHours(12, 0, 0, 0);
    var days = [], maxDay = 1;
    for (var i = 13; i >= 0; i--) {
      var d = new Date(t); d.setDate(d.getDate() - i);
      var k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      var n = perDay[k] || 0;
      maxDay = Math.max(maxDay, n);
      days.push({ k: k, n: n, label: (d.getMonth() + 1) + '/' + d.getDate(), today: i === 0 });
    }
    $('dvDays').innerHTML = days.map(function (x) {
      return '<div class="dv-day' + (x.today ? ' today' : '') + (x.n ? ' has' : '') + '" title="' + x.k + (x.n ? ' · ' + x.n + ' 题' : '') + '">' +
        '<i style="height:' + Math.max(x.n ? 12 : 4, Math.round(x.n / maxDay * 100)) + '%"></i>' +
        '<em>' + (x.n || '') + '</em><span>' + x.label + '</span></div>';
    }).join('');
    var activeDays = days.filter(function (x) { return x.n > 0; }).length;
    $('dvDaysMeta').textContent = '最近 14 天有 ' + activeDays + ' 天在刷题，每天答多少题一目了然';

    // 成绩走势
    if (h.length) {
      var recent = h.slice(0, 12).reverse();
      $('dvTrendMeta').textContent = '最近 ' + h.length + ' 局 · 平均 ' +
        Math.round(h.reduce(function (s, x) { return s + x.score; }, 0) / h.length) + ' 分';
      $('dvTrendBars').innerHTML = recent.map(function (x) {
        var d = new Date(x.ts);
        var tip = (d.getMonth() + 1) + '/' + d.getDate() + ' · ' + x.correct + '/' + x.total;
        return '<div class="tbar' + (x.score < 60 ? ' low' : '') + '" title="' + tip + '">' +
          '<i style="height:' + Math.max(6, x.score) + '%"></i><em>' + x.score + '</em></div>';
      }).join('');
    } else {
      $('dvTrendMeta').textContent = '还没有成绩，先刷一局';
      $('dvTrendBars').innerHTML = '';
    }

    // 题型掌握度：按题型聚合练题档案
    var byType = {};
    state.bank.questions.forEach(function (q) {
      var p = state.prog[q.id];
      if (!p || !p.n) return;
      var o = byType[q.type] || (byType[q.type] = { n: 0, c: 0, qs: 0 });
      o.n += p.n;
      o.c += Math.max(0, p.n - (p.w || 0));
      o.qs++;
    });
    var box = $('dvTypes');
    var keys = ['judge', 'single', 'multiple', 'blank', 'short'].filter(function (t) { return byType[t]; });
    if (!keys.length) {
      box.innerHTML = '<p class="muted">还没有练习记录。刷几局，这里会告诉你哪类题型最需要补。</p>';
    } else {
      var totalN = keys.reduce(function (s, t) { return s + byType[t].n; }, 0);
      var totalC = keys.reduce(function (s, t) { return s + byType[t].c; }, 0);
      var overall = totalN ? totalC / totalN : 0;
      box.innerHTML = keys.map(function (t) {
        var o = byType[t];
        var acc = o.n ? Math.round(o.c / o.n * 100) : 0;
        var weak = acc < overall - 8;
        return '<div class="dv-type">' +
          '<div class="dvt-head"><b>' + (TYPE_LABEL[t] || t) + '</b>' +
          '<span>' + o.qs + ' 题练过 · ' + o.n + ' 次作答</span>' +
          '<em' + (weak ? ' class="weak"' : '') + '>' + acc + '%</em></div>' +
          '<div class="track"><i class="' + (weak ? 'weak' : '') + '" style="width:' + acc + '%"></i></div>' +
          (weak ? '<p class="dvt-tip">这类比整体低 ' + Math.round((overall - acc) * 10) / 10 + ' 个百分点，建议在设置里单独练它</p>' : '') +
          '</div>';
      }).join('');
    }
  }

  /* ---------------- 设置页 ---------------- */
  function renderSettings() {
    var s = state.settings, b = state.bank;

    // 作答方式
    document.querySelectorAll('#segLayout .layout').forEach(function (n) {
      n.classList.toggle('on', n.dataset.v === s.layout);
    });
    $('layoutHint').textContent = s.layout === 'paper'
      ? '当前：整卷一次，交卷后统一看答案'
      : '当前：一题一题，' + (s.reveal === 'end' ? '全部答完再对答案' : '答完就出答案');

    // 练习范围：可多选，一个都不选 = 全部题型
    var typeCnt = {};
    b.questions.forEach(function (q) { typeCnt[q.type] = (typeCnt[q.type] || 0) + 1; });
    // 只渲染，不改 state：题库换了不该把用户选的题型筛选静默清空
    var visible = sortTypes((s.filters || []).filter(function (t) { return typeCnt[t]; }));
    var hiddenTypes = (s.filters || []).length - visible.length;
    var segType = $('segType');
    segType.innerHTML = '';
    var btAll = document.createElement('button');
    btAll.type = 'button'; btAll.dataset.v = 'all';
    btAll.textContent = '全部 ' + b.questions.length;
    btAll.classList.toggle('on', visible.length === 0);
    segType.appendChild(btAll);
    Object.keys(TYPE_LABEL).filter(function (t) { return typeCnt[t]; }).forEach(function (t) {
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.dataset.v = t;
      bt.textContent = TYPE_SHORT[t] + ' ' + typeCnt[t];
      bt.classList.toggle('on', visible.indexOf(t) >= 0);
      segType.appendChild(bt);
    });

    var fPool = buildPool(false);
    $('filterHint').textContent = filtersName(s.filters) +
      ' · 共 ' + fPool.length + ' 题可选' +
      (s.filters.length > 1 ? '（可多选）' : '') +
      (hiddenTypes > 0 ? ' · 其中有 ' + hiddenTypes + ' 类当前题库没有，点「全部」可清除' : '');

    document.querySelectorAll('#segCount button').forEach(function (n) { n.classList.toggle('on', +n.dataset.v === s.count); });
    var types = {};
    fPool.forEach(function (q) { types[q.type] = 1; });
    $('countHint').textContent = fPool.length
      ? '自动覆盖 ' + Object.keys(types).map(function (t) { return TYPE_SHORT[t] || t; }).join(' / ')
      : '该范围内没有题';

    document.querySelectorAll('#segPick button').forEach(function (n) { n.classList.toggle('on', n.dataset.v === s.pick); });

    // 倒计时
    $('swTimer').checked = !!s.timerOn;
    $('timerBox').hidden = !s.timerOn;
    $('timerOffHint').hidden = !!s.timerOn;
    document.querySelectorAll('#segTime button').forEach(function (n) { n.classList.toggle('on', +n.dataset.v === s.seconds); });
    var mins = Math.max(1, Math.round(s.seconds / 60));
    $('timeVal').textContent = mins;
    $('timeMinus').disabled = mins <= 1;
    $('timePlus').disabled = mins >= 60;
    var per = s.count ? Math.round(s.seconds / s.count) : 0;
    $('timeHint').textContent = s.timerOn
      ? (s.count + ' 题 ' + mins + ' 分钟' + (per ? '，平均每题 ' + per + ' 秒' : ''))
      : '';

    // 答案与解析
    document.querySelectorAll('#segReveal button').forEach(function (n) { n.classList.toggle('on', n.dataset.v === s.reveal); });
    $('swMask').checked = !!s.mask;
    $('swExpl').checked = !!s.expl;
    $('swShuffle').checked = !!s.shuffleOpts;
    $('revealHint').textContent = s.layout === 'paper'
      ? '整卷模式下答案一律交卷后出，这条只在「一题一题」里生效。'
      : (s.reveal === 'end'
        ? '一题一题，但答完不告诉你对错，交卷时统一揭晓。'
        : (s.mask ? '答完先遮住，点眼睛才展开答案和解析。' : '答完立刻显示正确答案和解析。'));

    // 错题本
    $('swAutoWrong').checked = !!s.autoWrong;
    $('swAutoRemove').checked = !!s.autoRemove;
    $('wrongSetCount').textContent = validWrongIds().length;
    $('wrongSetHint').textContent = s.autoWrong
      ? (s.autoRemove
        ? '答错自动收进来，答对一次自动移出去 —— 错题本只留你还没攻下来的。'
        : '答错自动收进来，答对也留着，直到你手动移出。')
      : (s.autoRemove
        ? '不收错题，但答对时仍会清掉旧错题。想留错题就在结果页手动收。'
        : '不进也不出，错题本完全由你手动管。');

    // 吉祥物：仅小鹿，不再展示多皮肤选择
    var cur = 'deer'; // 只做渲染，别顺手改写 state（loadAll 已负责迁移）
    if ($('skinNow')) $('skinNow').textContent = '小鹿';
    if ($('skinGrid')) {
      $('skinGrid').innerHTML = '';
      $('skinGrid').hidden = true;
    }

    // 体验
    $('swSound').checked = !!s.sound;
    $('swCheckin').checked = !!s.checkin;
    var th = s.theme || 'auto';
    Array.prototype.forEach.call(document.querySelectorAll('#segTheme [data-theme]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-theme') === th);
      b.setAttribute('aria-pressed', b.getAttribute('data-theme') === th ? 'true' : 'false');
    });
  }
  /* ---------------- 开始一局 ---------------- */
  function startQuiz(onlyWrong) {
    var count = state.settings.count;
    var pool = buildPool(onlyWrong);
    // 用户意图先记下：即使本局因错题为空没开成，「再来一局」也别沿用上一局的模式
    state.lastOnlyWrong = !!onlyWrong;

    if (onlyWrong && !pool.length) {
      var fs = state.settings.filters || [];
      toast(fs.length && (state.stats.wrong || []).length
        ? '错题里没有当前筛选题型的题，去设置里放宽题型'
        : '错题本是空的，先刷一局吧');
      return;
    }
    if (!pool.length) { toast('题库是空的，先去题库页导入'); return; }

    var qs = pickQuestions(pool, count);
    if (qs.length < count) toast('题库只剩 ' + qs.length + ' 题');
    if (state.settings.shuffleOpts) qs = shuffleOptions(qs);

    if (state.settings.layout === 'paper') { startPaper(qs, onlyWrong); return; }

    var secs = state.settings.timerOn ? state.settings.seconds : 0;
    if (state.quiz) stopTimer(state.quiz);  // 同模式连开两局也要停掉旧表，否则旧表到点会把新局强制交卷
    if (state.paper) stopTimer(state.paper); // 换模式开新局时别留下上一局的倒计时
    state.quiz = null; state.paper = null;
    state.quiz = {
      list: qs,
      idx: 0,
      records: qs.map(function () { return { picked: null, submitted: false, ok: null, revealAt: null, masked: false }; }),
      seconds: secs,
      remain: secs,
      startedAt: Date.now(),
      combo: 0,
      maxCombo: 0,
      finished: false,
      timerId: null,
      onlyWrong: !!onlyWrong
    };

    showView('quiz');
    renderQuestion();
    startTimer(state.quiz, 'timer', 'timerText');
  }

  /* ---------------- 计时 ---------------- */
  function startTimer(qz, boxId, textId) {
    stopTimer(qz);
    var box = $(boxId), txt = $(textId);
    if (!qz.seconds) { box.classList.add('off'); txt.textContent = '不限时'; return; }
    box.classList.remove('off');
    var endAt = Date.now() + qz.seconds * 1000;
    qz.endAt = endAt;
    tick();
    qz.timerId = setInterval(tick, 200);

    function tick() {
      // 被丢弃的旧局 timer 不能再去改新局的倒计时，更不能替新局交卷
      if (qz !== state.quiz && qz !== state.paper) { stopTimer(qz); return; }
      if (qz.finished) { stopTimer(qz); return; }
      var left = (endAt - Date.now()) / 1000;
      qz.remain = Math.max(0, left);
      txt.textContent = fmtTime(left);
      var warn = left <= Math.max(10, qz.seconds * 0.12);
      box.classList.toggle('warn', warn);
      if (left <= 0) {
        stopTimer(qz);
        toast('时间到，自动交卷');
        if (qz === state.paper) submitPaper(true); else finishQuiz(true);
      }
    }
  }
  function stopTimer(qz) {
    qz = qz || state.quiz;
    if (qz && qz.timerId) { clearInterval(qz.timerId); qz.timerId = null; }
  }

  /* ---------------- 渲染题目 ---------------- */
  function renderQuestion() {
    var qz = state.quiz;
    var q = qz.list[qz.idx];
    var rec = qz.records[qz.idx];

    $('qNum').textContent = pad(qz.idx + 1);
    $('qTotal').textContent = '/ ' + qz.list.length;
    $('qType').textContent = TYPE_LABEL[q.type] || '题目';
    $('qMark').innerHTML = markHtml(q.id);
    $('progBar').style.width = ((rec.submitted ? qz.idx + 1 : qz.idx) / qz.list.length * 100) + '%';
    renderDots();
    $('comboChip').hidden = !(qz.combo >= 2);
    $('comboNum').textContent = qz.combo;

    var stem = q.stem;
    if (q.type === 'judge') stem = stem.replace(/[（(]\s*[　\s]*\s*[)）]\s*$/, '');
    $('qStem').textContent = stem;

    var area = $('qAnswers');
    area.innerHTML = '';
    var answered = rec.submitted;
    // 只有"该揭晓 + 没遮住"时才画正误色；否则只标出用户选了什么
    var showTruth = answered && rec.revealAt === 'now' && !rec.masked;

    if (q.type === 'judge') {
      var grid = document.createElement('div');
      grid.className = 'judge-grid';
      [true, false].forEach(function (v) {
        var btn = document.createElement('button');
        btn.className = 'judge';
        btn.type = 'button';
        btn.dataset.v = v ? '1' : '0';
        btn.innerHTML = (v
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>')
          + '<span>' + (v ? '正确' : '错误') + '</span>';
        if (rec.picked === v) btn.classList.add('sel');
        if (answered) {
          btn.disabled = true;
          if (showTruth) {
            if (v === q.answer[0]) btn.classList.add('correct');
            else if (rec.picked === v) btn.classList.add('wrong');
          }
        }
        btn.addEventListener('click', function () { pickJudge(v, btn); });
        grid.appendChild(btn);
      });
      area.appendChild(grid);
    } else if (q.type === 'single' || q.type === 'multiple') {
      var wrap = document.createElement('div');
      wrap.className = 'answers';
      q.options.forEach(function (opt, i) {
        var L = String.fromCharCode(65 + i);
        var btn = document.createElement('button');
        btn.className = 'opt';
        btn.type = 'button';
        btn.dataset.k = L;
        btn.innerHTML = '<span class="k">' + L + '</span><span class="t">' + esc(opt) + '</span>';
        var isPicked = q.type === 'multiple'
          ? (Array.isArray(rec.picked) && rec.picked.indexOf(L) >= 0)
          : rec.picked === L;
        if (isPicked) btn.classList.add('sel');
        if (answered) {
          btn.disabled = true;
          if (showTruth) {
            if (q.answer.indexOf(L) >= 0) btn.classList.add('correct');
            else if (isPicked) btn.classList.add('wrong');
            else btn.classList.add('dim');
          }
        }
        btn.addEventListener('click', function () { pickOption(L); });
        wrap.appendChild(btn);
      });
      area.appendChild(wrap);
    } else if (q.type === 'blank') {
      // 输入框数必须等于答案数：少一个空会让 isCorrect 的长度校验永远失败，
      // 出现「每个空都标绿、整题却判错」的怪事
      var n = Math.max(1, q.answer.length);
      var list = document.createElement('div');
      list.className = 'blank-list';
      for (var i = 0; i < n; i++) {
        var f = document.createElement('div');
        f.className = 'field';
        var lab = document.createElement('label');
        lab.textContent = n > 1 ? '第 ' + (i + 1) + ' 空' : '你的答案';
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.autocomplete = 'off';
        inp.placeholder = '输入答案';
        inp.dataset.i = i;
        if (Array.isArray(rec.picked) && rec.picked[i] != null) inp.value = rec.picked[i];
        if (answered) {
          inp.disabled = true;
          if (showTruth) {
            var ok = isCorrect({ type: 'blank', answer: [q.answer[i]] }, [inp.value]);
            inp.classList.add(ok ? 'right' : 'bad');
            var truth = document.createElement('div');
            truth.className = 'truth';
            truth.textContent = '正确答案：' + q.answer[i];
            f.appendChild(lab); f.appendChild(inp); f.appendChild(truth);
          } else {
            f.appendChild(lab); f.appendChild(inp);
          }
        } else {
          f.appendChild(lab); f.appendChild(inp);
        }
        list.appendChild(f);
      }
      area.appendChild(list);
    } else {
      var f2 = document.createElement('div');
      f2.className = 'field';
      var lab2 = document.createElement('label');
      lab2.textContent = '简答';
      var ta = document.createElement('textarea');
      ta.rows = 4;
      ta.placeholder = '写下你的答案（提交后对照参考答案自评）';
      if (rec.picked) ta.value = rec.picked;
      if (answered) ta.disabled = true;
      f2.appendChild(lab2); f2.appendChild(ta);
      area.appendChild(f2);
    }

    // 已有答案时更新按钮
    var btn = $('btnAction');
    if (answered) {
      btn.textContent = qz.idx === qz.list.length - 1 ? '查看成绩' : '下一题';
      btn.dataset.act = 'next';
    } else {
      btn.textContent = '提交答案';
      btn.dataset.act = 'submit';
    }

    $('answerPanel').hidden = true;
    $('answerPanel').innerHTML = '';
    if (answered) showPanel(q, rec);
  }

  /* ---------------- 答题卡 ---------------- */
  function renderDots() {
    var qz = state.quiz, p = state.paper;
    var boxId = qz ? 'qDots' : (p ? 'pDots' : null);
    if (!boxId) return;
    var list = qz ? qz.list : p.list;
    var records = qz ? qz.records : p.records;
    var cur = qz ? qz.idx : -1;
    var wrap = $(boxId);
    wrap.innerHTML = '';
    list.forEach(function (q, i) {
      var rec = records[i];
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'dot';
      d.textContent = i + 1;
      var answered = qz ? rec.submitted : paperHasAnswer(rec);
      if (qz) {
        if (rec.submitted) {
          // 未自评的简答题对错还没定，不能提前标红
          if (rec.revealAt === 'now') d.classList.add(rec.ok === true ? 'ok' : (rec.ok == null ? 'picked' : 'no'));
          else d.classList.add('picked');
        }
        else if (rec.picked != null && !(Array.isArray(rec.picked) && !rec.picked.length)) d.classList.add('picked');
      } else {
        if (p.finished) d.classList.add(rec.ok ? 'ok' : 'no');
        else if (rec.revealed) d.classList.add(rec.ok === true ? 'ok' : (rec.ok == null ? 'picked' : 'no'));
        else if (answered) d.classList.add('picked');
      }
      if (i === cur) d.classList.add('cur');
      d.addEventListener('click', function () {
        if (qz) {
          if (i !== qz.idx) { qz.idx = i; renderQuestion(); Audio2.click(); }
        } else {
          var card = $('paperList').querySelector('[data-i="' + i + '"]');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      wrap.appendChild(d);
    });
  }

  function pickJudge(v) {
    var qz = state.quiz, rec = qz.records[qz.idx];
    if (rec.submitted) return;
    rec.picked = v;
    // 只作用于当前逐题答案区：整卷页的残留卡片 DOM 也在 document 里，
    // 全局选择器会误改它们的选中态（填空/简答更会把值混进本题判分）
    var area = $('qAnswers');
    if (!area) return;
    area.querySelectorAll('.judge').forEach(function (b) {
      b.classList.toggle('sel', (b.dataset.v === '1') === v);
    });
  }

  function pickOption(L) {
    var qz = state.quiz, rec = qz.records[qz.idx], q = qz.list[qz.idx];
    if (rec.submitted) return;
    if (q.type === 'multiple') {
      var arr = Array.isArray(rec.picked) ? rec.picked.slice() : [];
      var i = arr.indexOf(L);
      if (i >= 0) arr.splice(i, 1); else arr.push(L);
      arr.sort();
      rec.picked = arr;
    } else {
      rec.picked = L;
    }
    var area = $('qAnswers');
    if (!area) return;
    area.querySelectorAll('.opt').forEach(function (b) {
      var k = b.dataset.k;
      var on = q.type === 'multiple' ? (rec.picked || []).indexOf(k) >= 0 : rec.picked === k;
      b.classList.toggle('sel', on);
    });
  }

  /* ---------------- 提交 ---------------- */
  function currentPicked() {
    var qz = state.quiz, q = qz.list[qz.idx], rec = qz.records[qz.idx];
    // 必须限定在当前逐题答案区内取值。整卷页即使切走了也还留在 DOM 里，
    // 用全局选择器会把上一局的填空框/文本框一起算进来 → 答案明明对却判错
    var area = $('qAnswers');
    if (q.type === 'blank') {
      if (!area) return null;
      var inputs = Array.prototype.slice.call(area.querySelectorAll('.blank-list input'));
      if (!inputs.length) return null;
      var vals = inputs.map(function (i) { return i.value; });
      return vals.some(function (v) { return v.trim() !== ''; }) ? vals : null;
    }
    if (q.type === 'short') {
      if (!area) return null;
      var ta = area.querySelector('.field textarea');
      return ta && ta.value.trim() ? ta.value.trim() : null;
    }
    return rec.picked;
  }

  // 简答题没有客观答案：列出已作答、但还没自评的题（收卷前必须评完）
  function pendingShortEvals(qz) {
    var out = [];
    qz.list.forEach(function (q, i) {
      if (q.type === 'short' && qz.records[i].submitted && qz.records[i].ok == null) out.push(i);
    });
    return out;
  }

  function submitAnswer() {
    var qz = state.quiz;
    var q = qz.list[qz.idx];
    var rec = qz.records[qz.idx];
    if (rec.submitted) { nextQuestion(); return; }

    var picked = currentPicked();
    if (picked == null || (Array.isArray(picked) && !picked.length)) {
      toast('先选一个答案');
      return;
    }
    rec.picked = picked;
    rec.submitted = true;

    if (q.type === 'short') {
      // 简答题没有客观答案，必须人工自评。
      // 设置「最后对答案」时也要遵守揭晓时机：先只记下作答，收卷时再统一自评
      rec.ok = null;
      if (state.settings.reveal === 'end') {
        rec.revealAt = 'later';
        rec.masked = true;
        qz.combo = 0; // 对错未知，不参与连对
        var cs = $('qCard');
        cs.classList.add('sent');
        setTimeout(function () { cs.classList.remove('sent'); }, 240);
        nextQuestion();
        return;
      }
      rec.masked = !!state.settings.mask;
      showShortSelfEval(q, rec);
      return;
    }

    rec.ok = isCorrect(q, picked);

    var instant = state.settings.reveal !== 'end';
    rec.revealAt = instant ? 'now' : 'later';
    rec.masked = instant ? !!state.settings.mask : true;

    if (!instant) {
      // 统一揭晓模式：不判对错、不给提示，直接进下一题（对错留到交卷）
      var c0 = $('qCard');
      c0.classList.add('sent');
      setTimeout(function () { c0.classList.remove('sent'); }, 240);
      qz.combo = rec.ok ? qz.combo + 1 : 0;
      qz.maxCombo = Math.max(qz.maxCombo, qz.combo);
      nextQuestion();
      return;
    }

    if (rec.ok) {
      qz.combo++;
      qz.maxCombo = Math.max(qz.maxCombo, qz.combo);
      // 连对数照常累计，但遮答案时不能让音效/提示/彩带先把对错剧透出去
      if (!rec.masked) {
        Audio2.correct(qz.combo);
        if (qz.combo >= 3) { Audio2.combo(qz.combo); toast('连对 ' + qz.combo + ' 题'); }
        if (qz.combo === 5) confetti(28);
      }
    } else {
      qz.combo = 0;
      if (!rec.masked) {
        Audio2.wrong();
        var card = $('qCard');
        card.classList.add('shake');
        setTimeout(function () { card.classList.remove('shake'); }, 460);
      }
    }

    renderQuestion(); // 就地带上正误标记和答案面板

    // 卡通贴纸反馈（遮答案模式不弹，避免剧透对错）
    if (!rec.masked) fxCheer(rec.ok);
  }


  /* ---------------- 外观主题 ---------------- */
  var _themeMql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function resolvedTheme() {
    var t = state.settings.theme || 'auto';
    if (t === 'light' || t === 'dark') return t;
    return (_themeMql && _themeMql.matches) ? 'dark' : 'light';
  }
  function applyTheme() {
    var mode = resolvedTheme();
    document.documentElement.setAttribute('data-theme', mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#16131F' : '#F6F4FF');
    applySkinTheme(); // 主题变了，皮肤内联变量要跟着让位或恢复
  }
  function onSystemTheme() {
    if ((state.settings.theme || 'auto') === 'auto') applyTheme();
  }

  /* ---------------- 吉祥物皮肤 ---------------- */
  function skinList() { return window.XZ_SKINS || {}; }
  function skinId() {
    var all = skinList();
    if (!all.deer) return 'deer';
    if (state.settings.mascot !== 'deer') state.settings.mascot = 'deer';
    return 'deer';
  }
  function skinArt(s) {
    if (!s) return '';
    if (s.img) return '<img src="' + s.img + '" alt="" draggable="false">';
    return s.svg || '';
  }
  function skinSvg(id) {
    var all = skinList();
    return skinArt(all[id] || all.deer);
  }
  function skinName(id) {
    var all = skinList();
    return (all[id] || all.deer || {}).name || '小鹿';
  }
  function applySkinTheme() {
    var id = skinId();
    document.documentElement.setAttribute('data-skin', id);
    var root = document.documentElement.style;
    var SKIN_VARS = ['--purple', '--purple-deep', '--yellow', '--accent', '--accent-2', '--banner', '--banner-2'];
    // 暗色主题在 CSS 里另有一套配色；内联变量优先级更高，不撤掉会把暗色顶回亮色
    if (resolvedTheme() === 'dark') {
      SKIN_VARS.forEach(function (v) { root.removeProperty(v); });
      return;
    }
    var cur = skinList()[id] || {};
    var th = cur.theme || {};
    if (th.primary) root.setProperty('--purple', th.primary);
    if (th.deep) root.setProperty('--purple-deep', th.deep);
    if (th.accent) { root.setProperty('--yellow', th.accent); root.setProperty('--accent', th.accent); }
    if (th.accent2) root.setProperty('--accent-2', th.accent2);
    if (th.banner) root.setProperty('--banner', th.banner);
    if (th.banner2) root.setProperty('--banner-2', th.banner2);
  }

  function bindPeekShy() {
    var el = document.getElementById('pondMascotPeek') || document.querySelector('.pond-mascot');
    if (!el || el.dataset.peekClickBound) return;
    el.dataset.peekClickBound = '1';
    el.addEventListener('click', function () {
      var g = el.querySelector('.peek-body, .peek-anim');
      if (!g) return;
      g.style.animation = 'none';
      // force reflow
      void g.offsetWidth;
      g.style.animation = 'shyHide 0.3s ease forwards';
      setTimeout(function () { g.style.animation = ''; }, 320);
    });
  }
  function applyMascot() {
    applySkinTheme();
    var box = $('bannerMascot');
    if (box) box.innerHTML = skinSvg(skinId());
    var cur = skinList()[skinId()] || {};
    var pondImg = document.querySelector('img.pond-mascot');
    if (pondImg) {
      if (cur.peek) {
        var wrap = pondImg.parentNode;
        var el = document.getElementById('pondMascotPeek');
        if (!el) {
          el = document.createElement('div');
          el.id = 'pondMascotPeek';
          el.className = 'pond-mascot';
          el.setAttribute('aria-hidden', 'true');
          wrap.insertBefore(el, pondImg);
        }
        el.innerHTML = cur.peek;
        el.hidden = false;
        el.removeAttribute('hidden');
        el.style.display = 'block';
        if (pondImg) { pondImg.hidden = true; pondImg.style.display = 'none'; }
        bindPeekShy();
      } else if (cur.img) {
        var el2 = document.getElementById('pondMascotPeek');
        if (el2) el2.hidden = true;
        pondImg.hidden = false;
        pondImg.src = cur.img;
      } else if (cur.svg) {
        var el3 = document.getElementById('pondMascotPeek');
        if (!el3) {
          el3 = document.createElement('div');
          el3.id = 'pondMascotPeek';
          el3.className = 'pond-mascot';
          el3.setAttribute('aria-hidden', 'true');
          pondImg.parentNode.insertBefore(el3, pondImg);
        }
        el3.innerHTML = cur.svg;
        el3.hidden = false;
        pondImg.hidden = true;
      }
    }
  }

  /* 贴纸：牌子 + 当前皮肤，按需拼成 data URI（换皮肤即刻生效） */
  function stickerSvg(good) {
    // 皮肤自带成套贴纸时（小鹿的粗描边套件），直接用整图，不再拼接
    var cur = skinList()[skinId()];
    if (cur && cur.stickers) return good ? cur.stickers.good : cur.stickers.bad;
    var inner;
    if (cur && cur.img) {
      inner = '<image href="' + cur.img + '" x="0" y="58" width="164" height="164" preserveAspectRatio="xMidYMid meet"/>';
    } else {
      inner = skinArt(cur).replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    }
    var grad = good
      ? '<linearGradient id="xzOkB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd75e"/><stop offset="1" stop-color="#f79f1f"/></linearGradient>'
      : '<linearGradient id="xzNoB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d4fb"/><stop offset="1" stop-color="#8fb2f2"/></linearGradient>';
    var fill = good ? 'url(#xzOkB)' : 'url(#xzNoB)';
    var label = good ? '答对了！' : '再接再厉！';
    var labelColor = good ? '#f78f1e' : '#5b45c9';
    var mark = good
      ? '<path d="M252 176 l12 12 20 -26" fill="none" stroke="#e0472e" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<g stroke="#3a2e5c" stroke-width="5" stroke-linecap="round" opacity=".5"><path d="M286 104 h26"/><path d="M292 120 h20"/></g>';
    var deco = good
      ? '<g><rect x="150" y="18" width="10" height="14" rx="3" fill="#f27d93" transform="rotate(24 155 25)"/>' +
        '<rect x="300" y="26" width="9" height="13" rx="3" fill="#5fc7b8" transform="rotate(-30 304 32)"/>' +
        '<circle cx="186" cy="12" r="5" fill="#5fc7b8"/><circle cx="46" cy="150" r="5" fill="#f79f1f"/>' +
        '<path d="M312 62 l4.5 9.5 9.5 4.5 -9.5 4.5 -4.5 9.5 -4.5 -9.5 -9.5 -4.5 9.5 -4.5 z" fill="#ffd75e" stroke="#3a2e5c" stroke-width="3" stroke-linejoin="round"/></g>'
      : '<g fill="#6db9f5" stroke="#3a2e5c" stroke-width="3" stroke-linejoin="round">' +
        '<path d="M150 24 q7 12 0 18 q-7 -6 0 -18 z"/><path d="M36 168 q6 10 0 15 q-6 -5 0 -15 z"/></g>' +
        '<text x="282" y="42" font-size="22" font-weight="900" fill="#e0472e" stroke="#fff" stroke-width="6" paint-order="stroke" stroke-linejoin="round" transform="rotate(8 282 42)" font-family="\'PingFang SC\',sans-serif">加油</text>' +
        '<path d="M40 96 l3.5 7.5 7.5 3.5 -7.5 3.5 -3.5 7.5 -3.5 -7.5 -7.5 -3.5 7.5 -3.5 z" fill="#a594f9" stroke="#3a2e5c" stroke-width="2.6" stroke-linejoin="round"/>';

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 240">' +
      '<defs>' + grad + '</defs>' + deco +
      '<g transform="rotate(-4 200 128)">' +
      '<rect x="96" y="62" width="226" height="122" rx="28" fill="' + fill + '" stroke="#3a2e5c" stroke-width="8"/>' +
      '<ellipse cx="130" cy="86" rx="14" ry="6.5" fill="#fff" opacity=".35" transform="rotate(-28 130 86)"/>' +
      '<ellipse cx="300" cy="166" rx="12" ry="5.5" fill="#fff" opacity=".28"/>' +
      '<text x="209" y="140" font-size="42" font-weight="900" text-anchor="middle" fill="' + labelColor + '" stroke="#ffffff" stroke-width="11" paint-order="stroke" stroke-linejoin="round" font-family="\'PingFang SC\',\'Hiragino Sans GB\',\'Microsoft YaHei\',sans-serif">' + label + '</text>' +
      mark + '</g>' +
      (cur && cur.img ? inner : '<g transform="translate(-26 76) scale(.56)">' + inner + '</g>') +
      '</svg>';
  }

  /* ---------------- 卡通贴纸反馈 ---------------- */
  var fxT1 = null, fxT2 = null;
  function fxCheer(good) {
    var w = $('fxWrap'), im = $('fxImg');
    if (!w || !im) return;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(stickerSvg(good));
    w.hidden = false;
    w.classList.remove('bye');
    // 强制重启动画
    im.style.animation = 'none';
    void im.offsetWidth;
    im.style.animation = '';
    w.classList.add('show');
    clearTimeout(fxT1); clearTimeout(fxT2);
    fxT1 = setTimeout(function () { w.classList.add('bye'); }, 1400);
    fxT2 = setTimeout(function () { w.hidden = true; w.classList.remove('show', 'bye'); }, 1800);
  }

  function cheerFor(combo) {
    if (combo >= 7) return '连对 ' + combo + ' 题，收不住了';
    if (combo >= 5) return '连对 ' + combo + ' 题，稳得一批';
    if (combo >= 3) return '连对 ' + combo + ' 题，接着来';
    return CHEER[Math.floor(Math.random() * CHEER.length)];
  }

  function eyeBtn(masked) {
    return '<button type="button" class="eye-btn" data-eye="1" aria-label="' + (masked ? '显示答案' : '遮住答案') + '">' +
      '<svg class="ico" aria-hidden="true"><use href="#' + (masked ? 'i-eye' : 'i-eye-off') + '"/></svg>' +
      (masked ? '看答案' : '遮住') + '</button>';
  }

  function tutorStrategy(q) {
    switch (q.type) {
      case 'judge': return '判断题先盯「绝对化」字眼——出现“必须、一律、只能、所有”大概率是错的；再拿不准，就回忆教材或准则里有没有这句话的原文。';
      case 'single': return '先把明显不对的选项划掉，剩下两个再抠题干关键词（“最”“首先”“主要”）——单选的答案常常就藏在限定词上。';
      case 'multiple': return '多选漏选、错选都不得分：把每个选项单独当一道判断题，逐个问「这句话对吗」，全对的才选。';
      case 'blank': return '先回忆准则原文的关键词，按原文写，别自己换词——填空题是踩点给分的。';
      case 'short': return '按点作答：先给结论，再写依据（准则/规定），最后补一句实际怎么做。';
      default: return '先读清题干问的是什么，再回想对应的知识点，最后对着选项验证。';
    }
  }

  /* 导师式详解：题库解析 + 解题思路，像老师讲题一样讲清楚 */
  function tutorHtml(q) {
    if (!state.settings.expl) return '';
    var why = q.explanation
      ? '<p class="t-p">' + esc(q.explanation) + '</p>'
      : '<p class="t-p dim">题库里没附这道题的解析。思路照下面对照，回头可以把「解析」列补上再导入。</p>';
    return '<div class="tutor">' +
      '<div class="tutor-head"><svg class="ico" aria-hidden="true"><use href="#i-bulb"/></svg>导师详解</div>' +
      '<div class="t-row"><span class="t-tag">为什么</span><div class="t-body">' + why + '</div></div>' +
      '<div class="t-row"><span class="t-tag how">怎么想</span><div class="t-body"><p class="t-p">' + esc(tutorStrategy(q)) + '</p></div></div>' +
      '</div>';
  }

  function explHtml(q) { return tutorHtml(q); }

  function showShortSelfEval(q, rec) {
    var panel = $('answerPanel');
    rec.revealAt = 'now';
    panel.hidden = false;
    panel.className = 'panel';
    if (rec.masked) {
      // 自评必须看参考答案，但不能一提交就摊开：先遮住，点一下再展开
      panel.innerHTML =
        '<div class="panel-head"><b>参考答案先遮住</b></div>' +
        '<p class="masked-note">这题要对照参考答案自评，展开后再给自己判分。</p>' +
        '<div class="self-eval"><button class="btn-ghost sm" data-showref="1">看参考答案</button></div>';
      panel.querySelector('[data-showref]').addEventListener('click', function () {
        rec.masked = false;
        showShortSelfEval(q, rec);
      });
      var lastM = state.quiz.idx === state.quiz.list.length - 1;
      $('btnAction').textContent = lastM ? '查看成绩' : '下一题';
      $('btnAction').dataset.act = 'next';
      return;
    }
    rec.masked = false;
    panel.innerHTML =
      '<div class="panel-head"><b>参考答案</b></div>' +
      '<div class="ans-card"><p class="ans-line">参考答案 <b>' + esc(q.answer.join(' ｜ ')) + '</b></p></div>' +
      explHtml(q) +
      '<div class="self-eval"><button class="btn-ghost sm" data-ok="1">算我答对</button><button class="btn-ghost sm" data-ok="0">没答对</button></div>';
    panel.querySelectorAll('[data-ok]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ok = b.dataset.ok === '1';
        rec.ok = ok;
        // 收卷后的统一自评阶段已经答完所有题，不该再接着累计「连对」
        if (!state.quiz.selfEvalPhase) {
          if (ok) { state.quiz.combo++; state.quiz.maxCombo = Math.max(state.quiz.maxCombo, state.quiz.combo); }
          else state.quiz.combo = 0;
        }
        panel.querySelector('.self-eval').innerHTML = '<span class="muted">已记录：' + (ok ? '答对' : '答错') + '</span>';
        renderDots();
        var last = state.quiz.idx === state.quiz.list.length - 1;
        $('btnAction').textContent = last ? '查看成绩' : '下一题';
        $('btnAction').dataset.act = 'next';

        // 「最后对答案」收卷后的统一自评阶段：评完这道自动跳下一道，全评完再结算
        if (state.quiz && state.quiz.selfEvalPhase) {
          var pend = pendingShortEvals(state.quiz);
          if (pend.length) {
            state.quiz.idx = pend[0];
            renderQuestion();
          } else {
            state.quiz.selfEvalPhase = false;
            finishQuiz(false);
          }
        }
      });
    });
    var lastQ = state.quiz.idx === state.quiz.list.length - 1;
    $('btnAction').textContent = lastQ ? '查看成绩' : '下一题';
    $('btnAction').dataset.act = 'next';
  }

  function showPanel(q, rec) {
    var panel = $('answerPanel');
    panel.hidden = false;

    // 还没到揭晓时机（统一交卷模式）
    if (rec.revealAt !== 'now') {
      panel.className = 'panel mask';
      panel.innerHTML =
        '<div class="panel-head"><b>答案先留着</b></div>' +
        '<p class="masked-note"><svg class="ico" aria-hidden="true"><use href="#i-eye-off"/></svg>' +
        '已经记下了。按你的设置，对错和解析留到交卷时一起看。</p>';
      return;
    }

    // 简答题没有客观答案：切到别的题再切回来时，自评入口也得跟着回来
    if (q.type === 'short') {
      if (rec.ok === null) { showShortSelfEval(q, rec); return; }
      panel.className = 'panel ' + (rec.ok ? 'ok' : 'no');
      panel.innerHTML =
        '<div class="panel-head"><span class="mark">' + (rec.ok ? '✓' : '×') + '</span><b>' +
        (rec.ok ? '答对了' : '答错了') + '</b></div>' +
        '<div class="ans-card"><p class="ans-line">参考答案 <b>' + esc(q.answer.join(' ｜ ')) + '</b></p></div>' +
        explHtml(q) +
        '<div class="self-eval"><span class="muted">已记录：' + (rec.ok ? '答对' : '答错') + '</span></div>';
      return;
    }

    var masked = !!rec.masked;
    panel.className = 'panel ' + (masked ? 'mask' : (rec.ok ? 'ok' : 'no'));

    if (masked) {
      panel.innerHTML =
        '<div class="panel-head"><span class="mark">?</span><b>先自己想想</b>' + eyeBtn(true) + '</div>' +
        '<p class="masked-note"><svg class="ico" aria-hidden="true"><use href="#i-eye"/></svg>' +
        '答案遮住了。在心里过一遍，再看对得上不。</p>';
      panel.querySelector('[data-eye]').addEventListener('click', function () {
        rec.masked = false;
        Audio2.click();
        renderQuestion();
      });
      return;
    }

    var head = rec.ok ? cheerFor(state.quiz ? state.quiz.combo : 1) : '答错了';
    var lines = '';
    if (!rec.ok) {
      var yt = pickedText(q, rec.picked);
      if (yt && yt !== '未作答') lines += '<p class="ans-line">你答的是 <s>' + esc(yt) + '</s></p>';
    }
    lines += '<p class="ans-line">正确答案 <b>' + esc(answerText(q)) + '</b></p>';

    panel.innerHTML =
      '<div class="panel-head"><span class="mark">' + (rec.ok ? '✓' : '×') + '</span><b>' + esc(head) + '</b>' + eyeBtn(false) + '</div>' +
      '<div class="ans-card">' + lines + '</div>' +
      explHtml(q);

    var eye = panel.querySelector('[data-eye]');
    if (eye) eye.addEventListener('click', function () {
      rec.masked = true;
      Audio2.click();
      renderQuestion();
    });
  }

  function nextQuestion() {
    var qz = state.quiz;
    if (qz.idx >= qz.list.length - 1) { finishQuiz(false); return; }
    qz.idx++;
    renderQuestion();
    var card = $('qCard');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    $('answerPanel').hidden = true;
  }

  /* ============================================================
     整卷模式：题目一次铺开，交卷后统一揭晓
     ============================================================ */
  function startPaper(qs, onlyWrong) {
    if (state.quiz) stopTimer(state.quiz);
    if (state.paper) stopTimer(state.paper); // 同模式连开两局同样要停旧表
    state.quiz = null; state.paper = null;
    state.paper = {
      list: qs,
      records: qs.map(function () { return { picked: null, ok: null, revealed: false }; }),
      seconds: state.settings.timerOn ? state.settings.seconds : 0,
      remain: state.settings.timerOn ? state.settings.seconds : 0,
      startedAt: Date.now(),
      finished: false,
      graded: false,
      timerId: null,
      onlyWrong: !!onlyWrong
    };
    showView('paper');
    renderPaper();
    updatePaperHead();
    // 复位交卷按钮：上一局交卷后按钮被改成「查看成绩」(data-act=result)，
    // 不复位的话第二局点「交卷」会走 paperToResult 被拦截，永远无法提交
    var pb = $('btnPaperSubmit');
    if (pb) { pb.textContent = '交卷'; pb.dataset.act = 'submit'; }
    startTimer(state.paper, 'pTimer', 'pTimerText');
  }

  function renderPaper() {
    var p = state.paper;
    var list = $('paperList');
    list.innerHTML = '';
    p.list.forEach(function (q, i) { list.appendChild(buildPaperCard(q, i)); });
  }

  function buildPaperCard(q, i) {
    var card = document.createElement('article');
    card.className = 'pq';
    card.dataset.i = i;

    var head = document.createElement('div');
    head.className = 'pq-head';
    head.innerHTML = '<span class="pq-no">' + pad(i + 1) + '</span>' +
      '<span class="type-pill">' + (TYPE_LABEL[q.type] || '题目') + '</span>' + markHtml(q.id);

    var peek = document.createElement('button');
    peek.type = 'button';
    peek.className = 'pq-peek';
    peek.textContent = '看答案';
    peek.addEventListener('click', function () { revealPaper(i); });
    head.appendChild(peek);

    var stem = document.createElement('p');
    stem.className = 'stem';
    stem.textContent = q.type === 'judge'
      ? q.stem.replace(/[（(]\s*[　\s]*\s*[)）]\s*$/, '')
      : q.stem;

    var area = document.createElement('div');
    area.className = 'answers';
    fillPaperAnswer(area, q, i);

    var fb = document.createElement('div');
    fb.className = 'pq-fb';
    fb.hidden = true;

    card.appendChild(head);
    card.appendChild(stem);
    card.appendChild(area);
    card.appendChild(fb);
    return card;
  }

  function fillPaperAnswer(area, q, i) {
    var p = state.paper;
    var rec = p.records[i];
    var locked = p.finished || rec.revealed;
    area.innerHTML = '';

    if (q.type === 'judge') {
      var grid = document.createElement('div');
      grid.className = 'judge-grid';
      [true, false].forEach(function (v) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'judge';
        btn.dataset.v = v ? '1' : '0';
        btn.innerHTML = (v
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>')
          + '<span>' + (v ? '正确' : '错误') + '</span>';
        if (rec.picked === v) btn.classList.add('sel');
        if (locked) btn.disabled = true;
        btn.addEventListener('click', function () {
          if (p.finished || rec.revealed) return;
          rec.picked = v;
          Audio2.click();
          grid.querySelectorAll('.judge').forEach(function (b) {
            b.classList.toggle('sel', (b.dataset.v === '1') === rec.picked);
          });
          updatePaperHead();
        });
        grid.appendChild(btn);
      });
      area.appendChild(grid);

    } else if (q.type === 'single' || q.type === 'multiple') {
      var wrap = document.createElement('div');
      wrap.className = 'answers';
      q.options.forEach(function (opt, k) {
        var L = String.fromCharCode(65 + k);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'opt';
        btn.dataset.k = L;
        btn.innerHTML = '<span class="k">' + L + '</span><span class="t">' + esc(opt) + '</span>';
        var on = q.type === 'multiple'
          ? (Array.isArray(rec.picked) && rec.picked.indexOf(L) >= 0)
          : rec.picked === L;
        if (on) btn.classList.add('sel');
        if (locked) btn.disabled = true;
        btn.addEventListener('click', function () {
          if (p.finished || rec.revealed) return;
          if (q.type === 'multiple') {
            var arr = Array.isArray(rec.picked) ? rec.picked.slice() : [];
            var k2 = arr.indexOf(L);
            if (k2 >= 0) arr.splice(k2, 1); else arr.push(L);
            arr.sort();
            rec.picked = arr.length ? arr : null;
          } else {
            rec.picked = L;
          }
          Audio2.click();
          wrap.querySelectorAll('.opt').forEach(function (b) {
            var kk = b.dataset.k;
            var on2 = q.type === 'multiple'
              ? (Array.isArray(rec.picked) && rec.picked.indexOf(kk) >= 0)
              : rec.picked === kk;
            b.classList.toggle('sel', on2);
          });
          updatePaperHead();
        });
        wrap.appendChild(btn);
      });
      area.appendChild(wrap);

    } else if (q.type === 'blank') {
      var n = Math.max(1, q.answer.length); // 与逐题模式、isCorrect 保持同一口径
      var list = document.createElement('div');
      list.className = 'blank-list';
      for (var b2 = 0; b2 < n; b2++) {
        var f = document.createElement('div');
        f.className = 'field';
        var lab = document.createElement('label');
        lab.textContent = n > 1 ? '第 ' + (b2 + 1) + ' 空' : '你的答案';
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.autocomplete = 'off';
        inp.placeholder = '输入答案';
        inp.dataset.i = b2;
        if (Array.isArray(rec.picked) && rec.picked[b2] != null) inp.value = rec.picked[b2];
        if (locked) inp.disabled = true;
        inp.addEventListener('input', function () {
          if (p.finished || rec.revealed) return;
          var vals = Array.prototype.map.call(list.querySelectorAll('input'), function (x) { return x.value; });
          rec.picked = vals.some(function (v) { return v.trim() !== ''; }) ? vals : null;
          updatePaperHead();
        });
        f.appendChild(lab); f.appendChild(inp);
        list.appendChild(f);
      }
      area.appendChild(list);

    } else {
      var f2 = document.createElement('div');
      f2.className = 'field';
      var lab2 = document.createElement('label');
      lab2.textContent = '简答 · 交卷后对照参考答案自评';
      var ta = document.createElement('textarea');
      ta.rows = 3;
      ta.placeholder = '写下要点';
      if (rec.picked) ta.value = rec.picked;
      if (locked) ta.disabled = true;
      ta.addEventListener('input', function () {
        if (p.finished || rec.revealed) return;
        rec.picked = ta.value.trim() || null;
        updatePaperHead();
      });
      f2.appendChild(lab2); f2.appendChild(ta);
      area.appendChild(f2);
    }
  }

  function paperHasAnswer(rec) {
    var v = rec.picked;
    return v != null && !(Array.isArray(v) && !v.length);
  }

  function updatePaperHead() {
    var p = state.paper;
    if (!p) return;
    var done = 0;
    // 只算真的作答；点过「看答案」但没写答案的题不能算已答，否则交卷少报未答题数
    p.records.forEach(function (r) { if (paperHasAnswer(r)) done++; });
    $('pDone').textContent = done;
    $('pTotal').textContent = '/ ' + p.list.length + ' 已答';
    $('pProgBar').style.width = (p.list.length ? done / p.list.length * 100 : 0) + '%';
    $('pState').textContent = p.finished ? '已交卷' : '答题中';
    renderDots();
  }

  function revealPaper(i) {
    var p = state.paper, q = p.list[i], rec = p.records[i];
    if (!p || p.finished || rec.revealed) return;
    rec.revealed = true;
    // 防作弊只针对「没答就偷看」：已经锁定答案的题，偷看改不了结果，
    // 按实际作答判分 —— 否则答对的人点一下「看答案」会被误判成错
    if (q.type === 'short') {
      // 简答题没有客观答案，只能对照参考答案自评；钉成 false 会让待自评数永远是 0
      rec.ok = paperHasAnswer(rec) ? null : false;
      toast(paperHasAnswer(rec) ? '答案已展开，对照参考答案自评一下' : '这题还没作答，按没答出来算');
    } else if (paperHasAnswer(rec)) {
      rec.ok = isCorrect(q, rec.picked);
      toast('答案已展开，按你已选的答案判分');
    } else {
      rec.ok = false;
      toast('这题还没作答，按没答出来算');
    }
    paintPaperFeedback(i);
    updatePaperHead();
  }

  function paintPaperFeedback(i) {
    var p = state.paper, q = p.list[i], rec = p.records[i];
    var card = $('paperList').querySelector('[data-i="' + i + '"]');
    if (!card) return;

    var ok = rec.ok === true;
    var has = paperHasAnswer(rec);
    card.classList.toggle('ok', ok);
    card.classList.toggle('no', !ok);
    card.classList.add('done');

    var area = card.querySelector('.answers');
    if (q.type === 'judge') {
      area.querySelectorAll('.judge').forEach(function (b) {
        b.disabled = true;
        var v = b.dataset.v === '1';
        if (v === q.answer[0]) b.classList.add('correct');
        else if (rec.picked === v) b.classList.add('wrong');
      });
    } else if (q.type === 'single' || q.type === 'multiple') {
      area.querySelectorAll('.opt').forEach(function (b) {
        b.disabled = true;
        var L = b.dataset.k;
        var picked = q.type === 'multiple' ? (rec.picked || []).indexOf(L) >= 0 : rec.picked === L;
        if (q.answer.indexOf(L) >= 0) b.classList.add('correct');
        else if (picked) b.classList.add('wrong');
        else b.classList.add('dim');
      });
    } else if (q.type === 'blank') {
      area.querySelectorAll('input').forEach(function (inp) {
        inp.disabled = true;
        var idx = +inp.dataset.i;
        var got = isCorrect({ type: 'blank', answer: [q.answer[idx]] }, [inp.value]);
        inp.classList.add(got ? 'right' : 'bad');
      });
    } else {
      var ta = area.querySelector('textarea');
      if (ta) ta.disabled = true;
    }

    var peek = card.querySelector('.pq-peek');
    if (peek) peek.disabled = true;

    // 简答题没有客观对错：交卷后对照参考答案自评，评完才定对错（判分在「查看成绩」时统一做）
    if (q.type === 'short') {
      var fbs = card.querySelector('.pq-fb');
      fbs.hidden = false;
      if (!has) {
        card.classList.add('no');
        fbs.innerHTML =
          '<div class="fb-head"><span class="fb-mark">×</span>这题没答</div>' +
          '<p class="fb-truth">参考答案：<b>' + esc(q.answer.join(' ｜ ')) + '</b></p>' +
          (state.settings.expl
            ? '<p class="fb-expl"><b>为什么</b>' + (q.explanation ? esc(q.explanation) : '题库没附解析，先记结论。') + '</p>' +
              '<p class="fb-expl how"><b>怎么想</b>' + esc(tutorStrategy(q)) + '</p>'
            : '');
      } else {
        card.classList.remove('ok', 'no'); // 还没自评，先不亮对错色
        fbs.innerHTML =
          '<div class="fb-head">对照参考答案，给自己判一下</div>' +
          '<p class="fb-truth">参考答案：<b>' + esc(q.answer.join(' ｜ ')) + '</b></p>' +
          (state.settings.expl
            ? '<p class="fb-expl"><b>为什么</b>' + (q.explanation ? esc(q.explanation) : '题库没附解析，先记结论。') + '</p>' +
              '<p class="fb-expl how"><b>怎么想</b>' + esc(tutorStrategy(q)) + '</p>'
            : '') +
          '<div class="self-eval"><button class="btn-ghost sm" data-se="1">算我答对</button>' +
          '<button class="btn-ghost sm" data-se="0">没答对</button></div>';
        fbs.querySelectorAll('[data-se]').forEach(function (b) {
          b.addEventListener('click', function () {
            var ok2 = b.dataset.se === '1';
            rec.ok = ok2;
            card.classList.toggle('ok', ok2);
            card.classList.toggle('no', !ok2);
            fbs.querySelector('.self-eval').innerHTML = '<span class="muted">已记录：' + (ok2 ? '答对' : '答错') + '</span>';
            updatePaperHead();
            toast('已记录：' + (ok2 ? '答对' : '答错'));
          });
        });
      }
      return;
    }

    var headTxt = ok ? '答对了' : (has ? '答错了' : '这题没答');
    var fb = card.querySelector('.pq-fb');
    fb.hidden = false;
    fb.innerHTML =
      '<div class="fb-head"><span class="fb-mark">' + (ok ? '✓' : '×') + '</span>' + headTxt + '</div>' +
      (ok ? '' : '<p class="fb-truth">正确答案：<b>' + esc(answerText(q)) + '</b></p>') +
      (state.settings.expl
        ? '<p class="fb-expl"><b>为什么</b>' + (q.explanation ? esc(q.explanation) : '题库没附解析，先记结论。') + '</p>' +
          '<p class="fb-expl how"><b>怎么想</b>' + esc(tutorStrategy(q)) + '</p>'
        : '');
  }

  function submitPaper(timeUp) {
    var p = state.paper;
    if (!p || p.finished) return;

    // 看过答案但没作答的题仍然算未答，否则 confirm 会少报、甚至静默交卷
    var left = p.records.filter(function (r) { return !paperHasAnswer(r); }).length;
    if (!timeUp && left > 0 && !confirm('还有 ' + left + ' 题没答，确定交卷？')) return;

    p.finished = true;
    p.timeUp = !!timeUp;
    stopTimer(p);
    $('pTimer').classList.add('off');

    p.records.forEach(function (rec, i) {
      // 偷看或已自评过的题在 revealPaper 时就绘制并锁定过了；
      // 再重绘会把「已记录：答对」冲掉、还把自评按钮重新弹出来
      if (rec.revealed) return;
      var qq = p.list[i];
      if (qq.type === 'short') rec.ok = paperHasAnswer(rec) ? null : false;
      else rec.ok = paperHasAnswer(rec) ? isCorrect(qq, rec.picked) : false;
      paintPaperFeedback(i);
    });
    updatePaperHead();

    var btn = $('btnPaperSubmit');
    btn.textContent = '查看成绩';
    btn.dataset.act = 'result';

    var firstWrong = -1;
    p.records.forEach(function (r, i) { if (firstWrong < 0 && r.ok !== true) firstWrong = i; });
    if (firstWrong >= 0) {
      var card = $('paperList').querySelector('[data-i="' + firstWrong + '"]');
      if (card) setTimeout(function () { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 280);
    }

    // 简答题还要人工自评，分数未定，此时不报「对了 X/Y」以免和最终成绩对不上
    var pendingEval = p.records.filter(function (r, i) {
      return p.list[i].type === 'short' && r.ok == null;
    }).length;
    var correct = p.records.filter(function (r) { return r.ok === true; }).length;
    toast(timeUp ? '时间到，已自动交卷'
      : (pendingEval ? '交卷了，还有 ' + pendingEval + ' 道简答题待自评'
        : '交卷了，对了 ' + correct + ' / ' + p.list.length));
    if (!pendingEval && correct === p.list.length) confetti(50);
  }

  function paperToResult() {
    var p = state.paper;
    if (!p || !p.finished) return;
    if (p.graded) { showView('result'); return; }
    // 简答题还没自评就出成绩：一旦 grade 写入统计/错题本就再也改不回来了，先拦住
    var pend = [];
    p.list.forEach(function (q, i) { if (q.type === 'short' && p.records[i].ok == null) pend.push(i); });
    if (pend.length) {
      var card = $('paperList').querySelector('[data-i="' + pend[0] + '"]');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('还有 ' + pend.length + ' 道简答题没自评，评完再出成绩');
      return;
    }
    var r = grade(p.list, p.records, p.startedAt, p.seconds, !!p.timeUp);
    p.graded = true;
    renderResult(r);
    showView('result');
  }

  /* ---------------- 判分与记录（两种模式共用） ---------------- */
  function grade(list, records, startedAt, seconds, timeUp, endedAt) {
    var correct = 0, wrongList = [];
    list.forEach(function (q, i) {
      var rec = records[i];
      if (rec.ok === true) correct++;
      else wrongList.push({ q: q, rec: rec });
    });

    var total = list.length;
    var score = Math.round(correct / total * 100);
    // 统一只取一个交卷时刻；自评阶段的时间不算进本局用时，跨夜久置也不写荒谬数字
    var elapsed = Math.max(0, Math.min(24 * 3600, ((endedAt || Date.now()) - startedAt) / 1000));
    var usedSec = seconds ? Math.min(seconds, elapsed) : elapsed;

    var combo = 0, maxCombo = 0;
    records.forEach(function (rec) {
      if (rec.ok === true) { combo++; maxCombo = Math.max(maxCombo, combo); }
      else combo = 0;
    });

    // 记录
    state.stats.playCount++;
    state.stats.totalAnswered += total;
    state.stats.totalCorrect += correct;
    // 跨零点保护：App 开着过夜时今日计数先归零再累计
    var tk = todayKey();
    if ((state.stats.todayDay || '') !== tk) { state.stats.todayDay = tk; state.stats.todayCount = 0; }
    state.stats.todayCount = (state.stats.todayCount || 0) + total;

    var isBest = state.stats.bestScore == null || score > state.stats.bestScore;
    if (isBest) state.stats.bestScore = score;

    // 错题本：两个动作都由设置控制
    var s = state.settings, addedWrong = 0;
    if (s.autoWrong) {
      wrongList.forEach(function (w) {
        if (state.stats.wrong.indexOf(w.q.id) < 0) { state.stats.wrong.push(w.q.id); addedWrong++; }
      });
    }
    if (s.autoRemove) {
      list.forEach(function (q, i) {
        if (records[i].ok === true) {
          var k = state.stats.wrong.indexOf(q.id);
          if (k >= 0) state.stats.wrong.splice(k, 1);
        }
      });
    }

    // 打卡
    var beforeMedals = medalsOf(state.stats);
    if (state.stats.lastDay !== tk) {
      if (state.stats.lastDay === yesterdayKey()) state.stats.streak = (state.stats.streak || 0) + 1;
      else state.stats.streak = 1;
      state.stats.lastDay = tk;
    }
    var newMedal = null;
    if (state.stats.checkin.days.indexOf(tk) < 0) {
      state.stats.checkin.days.push(tk);
      if (state.stats.checkin.days.length > 400) state.stats.checkin.days = state.stats.checkin.days.slice(-400);
      // 刚跨过的新勋章
      var after = medalsOf(state.stats);
      for (var mi = 0; mi < after.length; mi++) {
        if (after[mi].got && !beforeMedals[mi].got) newMedal = after[mi];
      }
    }

    state.stats.history.unshift({ ts: Date.now(), score: score, correct: correct, total: total, seconds: Math.round(usedSec) });
    state.stats.history = state.stats.history.slice(0, 30);
    persistStats();

    // 练题档案：哪些题练过、错过几次
    list.forEach(function (q, i) { markProgress(q, records[i].ok); });
    saveProgress();

    return {
      score: score, correct: correct, total: total, usedSec: usedSec,
      wrongList: wrongList, isBest: isBest, timeUp: timeUp,
      maxCombo: maxCombo, seconds: seconds, list: list, records: records,
      newMedal: newMedal, addedWrong: addedWrong
    };
  }

  /* ---------------- 交卷（逐题模式） ---------------- */
  function finishQuiz(timeUp) {
    var qz = state.quiz;
    if (!qz || qz.finished) return;
    if (!timeUp) {
      var un = qz.records.filter(function (r) { return !r.submitted; }).length;
      if (un > 0 && !confirm('还有 ' + un + ' 题没答，没答的按错误计，确定交卷？')) return;
    }

    // 「最后对答案」模式下简答题还没自评：先逐题对照参考答案评完再出成绩
    var pend = pendingShortEvals(qz);
    if (pend.length && !timeUp) {
      qz.selfEvalPhase = true;
      // 已经交卷进入自评：停表、冻结用时，别让对照参考答案的时间算进成绩
      qz.endedAt = Date.now();
      stopTimer(qz);
      $('timer').classList.add('off');
      qz.list.forEach(function (q, i) {
        if (q.type === 'short' && qz.records[i].submitted) {
          qz.records[i].revealAt = 'now';
          qz.records[i].masked = false; // 收卷统一自评时参考答案要直接可见
        }
      });
      qz.idx = pend[0];
      renderQuestion();
      toast('还有 ' + pend.length + ' 道简答题，对照参考答案自评后出成绩');
      return;
    }

    qz.finished = true;
    stopTimer(qz);
    $('timer').classList.add('off');

    // 没答的按错误计：先把 ok 落成 false，保证判分、错题本、练题档案三方一致
    // （否则这些题进了错题本，练题档案却只记「练过」不记「答错」，抽题优先级会乱）
    qz.records.forEach(function (r) { if (!r.submitted || r.ok == null) r.ok = false; });
    if (timeUp && pend.length) toast('时间到，没自评的简答题按答错计');

    var r = grade(qz.list, qz.records, qz.startedAt, qz.seconds, timeUp, qz.endedAt);
    // 连对以题目顺序重算为准，跳题/自评阶段的点击顺序不再顶高数值
    renderResult(r);
    showView('result');
  }

  /* ---------------- 结算 ---------------- */
  function rankOf(score) {
    if (score === 100) return { title: '勇争第一', line: '满分。这题库对你来说没什么难度了。' };
    if (score >= 90) return { title: '稳进前三', line: '就差一口气，错的那道正好补上。' };
    if (score >= 75) return { title: '渐入佳境', line: '基本盘稳了，剩下的都是细节。' };
    if (score >= 60) return { title: '还差口气', line: '及格了，但离稳还差一遍错题。' };
    return { title: '从头再来', line: '这局当摸底，错题过一遍就是你的了。' };
  }

  function tutorMiniHtml(q) {
    // 结算/错题本里的紧凑版详解：题库解析 + 解题思路
    if (!state.settings.expl) return '';
    return '<div class="rv-expl"><b>为什么</b>' + (q.explanation ? esc(q.explanation) : '题库没附解析，先记结论。') + '</div>' +
      '<div class="rv-expl how"><b>怎么想</b>' + esc(tutorStrategy(q)) + '</div>';
  }

  function renderResult(r) {
    state.lastResult = r;
    var rank = rankOf(r.score);
    $('rScore').textContent = r.score;
    $('rRank').textContent = rank.title;
    $('rLine').textContent = r.timeUp ? '时间到，自动交卷。' + rank.line : rank.line;
    $('rCorrect').textContent = r.correct + '/' + r.total;
    $('rTime').textContent = fmtTime(r.usedSec);
    $('rCombo').textContent = r.maxCombo;
    $('rBest').textContent = state.stats.bestScore == null ? '--' : state.stats.bestScore;

    // 分数环
    var ring = $('ringFg');
    var C = 2 * Math.PI * 60;
    ring.style.strokeDasharray = C;
    ring.style.strokeDashoffset = C;
    ring.style.stroke = r.score >= 60 ? '#7a5af5' : '#e2554d';
    setTimeout(function () { ring.style.strokeDashoffset = C * (1 - r.score / 100); }, 60);

    // 徽章
    var badges = [];
    if (r.score === 100) badges.push({ t: '满分王', hot: true });
    else if (r.score >= 90) badges.push({ t: '九十分俱乐部', hot: true });
    if (r.maxCombo >= 5) badges.push({ t: '连对 ' + r.maxCombo });
    if (r.seconds && r.usedSec < r.seconds * 0.5 && r.score >= 80) badges.push({ t: '闪电手' });
    if (r.isBest && state.stats.playCount > 1) badges.push({ t: '新纪录' });
    if (state.stats.playCount === 1) badges.push({ t: '开张大吉' });
    if (r.wrongList.length === 0 && r.total >= 10) badges.push({ t: '零失误' });
    if (effectiveStreak(state.stats) >= 3) badges.push({ t: '连续 ' + effectiveStreak(state.stats) + ' 天' });
    if (r.newMedal) badges.push({ t: '解锁勋章 ' + r.newMedal.e + ' ' + r.newMedal.n, hot: true });
    if (!badges.length) badges.push({ t: '继续加油' });

    $('rBadges').innerHTML = badges.map(function (b, i) {
      return '<span class="badge' + (b.hot ? ' hot' : '') + '" style="animation-delay:' + (i * 60) + 'ms">' + esc(b.t) + '</span>';
    }).join('');

    // 错题回顾
    var rv = $('rReview');
    if (!r.wrongList.length) {
      rv.innerHTML = '<h3>本局回顾</h3><div class="rv ok"><p class="rv-q">一题没错，可以收工了。</p><p class="rv-a">下一局换一批题，看看是不是真的记住了。</p></div>';
    } else {
      rv.innerHTML = '<h3>没答对的 ' + r.wrongList.length + ' 道</h3>' + r.wrongList.map(function (w) {
        var q = w.q, rec = w.rec;
        return '<div class="rv">' +
          '<p class="rv-q"><span class="rv-tag">' + (TYPE_SHORT[q.type] || '') + '</span>' + esc(q.stem) + '</p>' +
          '<p class="rv-a">你答：<s>' + esc(pickedText(q, rec.picked)) + '</s>　正确：<b>' + esc(answerText(q)) + '</b></p>' +
          tutorMiniHtml(q) +
          '</div>';
      }).join('');
    }

    $('btnOnlyWrong').hidden = validWrongIds().length === 0;

    // 自动收错题关着：给个手动入口，别让这局的错题白错
    var addBar = $('rvAddWrong');
    if (!state.settings.autoWrong && r.wrongList.length) {
      var pend = r.wrongList.filter(function (w) { return state.stats.wrong.indexOf(w.q.id) < 0; }).length;
      $('rvAddN').textContent = pend;
      addBar.hidden = pend === 0;
    } else {
      addBar.hidden = true;
    }

    // 整卷原题 + 答案
    var allWrap = $('rAllWrap');
    if (r.list && r.list.length) {
      allWrap.hidden = false;
      // 统一交卷模式：用户一题答案都没见过，直接展开给他看
      if (state.settings.reveal === 'end') allWrap.open = true;
      $('rAll').innerHTML = r.list.map(function (q, i) {
        var rec = r.records[i];
        var ok = rec.ok === true;
        return '<div class="rv-mini ' + (ok ? 'ok' : 'no') + '">' +
          '<p class="mq">' + pad(i + 1) + '. ' + esc(q.stem) + '</p>' +
          '<p class="ma">你答：' + esc(pickedText(q, rec.picked)) +
          ' ｜ 正确：<b>' + esc(answerText(q)) + '</b></p>' +
          tutorMiniHtml(q) +
          '</div>';
      }).join('');
    } else {
      allWrap.hidden = true;
    }

    // 庆祝
    var good = r.score >= 90;
    if (good) { confetti(r.score === 100 ? 90 : 50); }
    if (r.newMedal) {
      confetti(120);
      toast('🎉 解锁勋章「' + r.newMedal.n + '」！连续打卡别断哦');
    }
    Audio2.finish(good);
  }

  /* ---------------- 彩纸 ---------------- */
  var confettiRAF = null;
  function confetti(count) {
    var cv = $('confetti');
    var ctx = cv.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cv.classList.add('on');
    var colors = ['#7a5af5', '#b09cf9', '#fbc64e', '#f27d93', '#ffffff'];
    var parts = [];
    for (var i = 0; i < count; i++) {
      parts.push({
        x: innerWidth * (0.2 + Math.random() * 0.6),
        y: innerHeight * 0.28 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 7,
        vy: -Math.random() * 9 - 3,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: colors[Math.floor(Math.random() * colors.length)],
        life: 1
      });
    }
    cancelAnimationFrame(confettiRAF);
    var t0 = performance.now();
    (function loop(t) {
      var dt = Math.min(32, t - t0) / 16.67; t0 = t;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      var alive = 0;
      parts.forEach(function (p) {
        p.vy += 0.28 * dt; p.vx *= 0.995;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > innerHeight + 40) { p.life = 0; } else alive++;
        if (!p.life) return;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive > 0) confettiRAF = requestAnimationFrame(loop);
      else { ctx.clearRect(0, 0, innerWidth, innerHeight); cv.classList.remove('on'); }
    })(t0);
  }

  /* ---------------- 错题本页 ---------------- */
  function renderWrong() {
    var ids = state.stats.wrong || [];
    var byId = {};
    state.bank.questions.forEach(function (q) { byId[q.id] = q; });
    var qs = ids.map(function (id) { return byId[id]; }).filter(Boolean);

    $('wrongHead').innerHTML = '共 <b>' + qs.length + '</b> 道等着你说「下次不会错」';
    $('btnDrillWrong').hidden = qs.length === 0;
    $('btnClearWrong').hidden = qs.length === 0;
    $('drillLabel').textContent = '开始刷错题（' + Math.min(state.settings.count, qs.length) + ' 题起）';
    $('drillSub').textContent = state.settings.autoRemove ? '答对一次自动移出' : '答对也留着，手动移出';

    var list = $('wrongList');
    if (!qs.length) {
      list.innerHTML = state.settings.autoWrong
        ? '<div class="w-empty">错题本是空的。<br>答错过的题都会自动收进来，'
          + (state.settings.autoRemove ? '答对一次就自动移出。' : '答对也留着，你自己决定什么时候移出。') + '</div>'
        : '<div class="w-empty">错题本是空的。<br>「答错自动收进错题本」现在是关着的 —— '
          + '去设置里打开，或者在每局结束的回顾里手动收。</div>';
      return;
    }
    list.innerHTML = qs.map(function (q) {
      return '<div class="witem" data-id="' + esc(q.id) + '">' +
        '<div class="witem-head"><span class="type-pill">' + (TYPE_LABEL[q.type] || '题目') + '</span>' + wrongMarkHtml(q.id) +
        '<button type="button" class="w-remove" data-remove="' + esc(q.id) + '">移出</button></div>' +
        '<p class="wq">' + esc(q.stem) + '</p>' +
        '<p class="wa">正确答案：<b>' + esc(answerText(q)) + '</b></p>' +
        (state.settings.expl
          ? (q.explanation ? '<p class="wexpl">' + esc(q.explanation) + '</p>' : '') +
            '<p class="wexpl how"><b>怎么想</b>' + esc(tutorStrategy(q)) + '</p>'
          : '') +
        '</div>';
    }).join('');
  }

  /* ---------------- 题库页 ---------------- */
  function renderBankPage() {
    var b = state.bank;
    $('bTotal').textContent = b.questions.length;
    $('bTitle').textContent = b.title || '题库';
    $('bSub').textContent = (b.subtitle || '') + ' · ' + b.questions.length + ' 题';

    var rs = roundStats();
    $('bProgress').innerHTML =
      '<div class="bp-row"><span>没练过</span><b>' + rs.fresh + '</b></div>' +
      '<div class="bp-row"><span>练过</span><b>' + rs.done + '</b></div>' +
      '<div class="bp-row"><span>上次答错</span><b class="' + (rs.wrong ? 'red' : '') + '">' + rs.wrong + '</b></div>';

    var cnt = {}; b.questions.forEach(function (q) { cnt[q.type] = (cnt[q.type] || 0) + 1; });
    var max = Math.max.apply(null, Object.keys(cnt).map(function (k) { return cnt[k]; }).concat([1]));
    $('bBars').innerHTML = ['judge', 'single', 'multiple', 'blank', 'short'].filter(function (t) { return cnt[t]; }).map(function (t) {
      return '<div class="bar-row"><span>' + TYPE_LABEL[t] + '</span><div class="track"><i style="width:' + (cnt[t] / max * 100) + '%"></i></div><em>' + cnt[t] + '</em></div>';
    }).join('');
  }

  /* ============================================================
     导入流水线：读取 → 识别 → 清洗 → 预览 → 落地
     ============================================================ */

  /* ---- 1. 文本表格：按引号规则切分 ---- */
  function parseDelimited(text) {
    text = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var lines = text.split('\n');
    var probe = lines[0] || '';
    // 中文表格常在第一行放标题，只看首行会把 TSV / 分号文件误判成逗号文件
    for (var li = 0; li < Math.min(lines.length, 12); li++) {
      var ln = lines[li] || '';
      if (/(题干|题目|试题|问题|内容|question|stem)/i.test(ln) &&
          /(答案|answer|key)/i.test(ln)) { probe = ln; break; }
    }
    function cnt(ch) { return probe.split(ch).length - 1; }
    var delim = ',';
    if (cnt('\t') > cnt(',')) delim = '\t';
    else if (cnt(';') > cnt(',')) delim = ';';

    var rows = [], row = [], cell = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === delim) { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
      }
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* ---- 2. 表头识别：列名认不全也能对上 ---- */
  function mapHeaderRow(row) {
    var map = {};
    (row || []).forEach(function (h, i) {
      var k = String(h == null ? '' : h).replace(/[\s\u3000]/g, '').toLowerCase();
      if (!k) return;
      var m;
      if (map.type == null && /^(题型|类型|题目类型|试题类型|type)$/.test(k)) map.type = i;
      else if (map.stem == null && /^(题干|题目|试题|问题|内容|question|stem|title)$/.test(k)) map.stem = i;
      else if (map.answer == null && /^(正确答案|参考答案|答案|answer|key)$/.test(k)) map.answer = i;
      else if (map.explanation == null && /^(解析|答案解析|试题解析|说明|explanation|analysis)$/.test(k)) map.explanation = i;
      else if (map.tag == null && /^(标签|章节|知识点|分类|tag|chapter)$/.test(k)) map.tag = i;
      else if ((m = k.match(/^(?:选项|备选)?[\(\[（]?([a-h1-8一二三四五六七八])[\s.\、．)）:：\]\）]?(?:选项)?$/))) {
        // 兼容 A. / A、/（A）/ A选项 / 选项1 / 选项一 等常见写法
        var c = m[1], oi;
        if (/[a-h]/.test(c)) oi = c.toUpperCase().charCodeAt(0) - 65;
        else if (/[1-8]/.test(c)) oi = +c - 1;
        else oi = '一二三四五六七八'.indexOf(c);
        if (oi >= 0 && oi < 8) {
          var L = 'opt' + String.fromCharCode(65 + oi);
          if (map[L] == null) map[L] = i;
        }
      } else if (map.options == null && /^(选项|选项内容|选项列表|options|choices|answers|答案选项)$/.test(k)) map.options = i;
    });
    return map;
  }

  function parseCSV(text) {
    var rows = parseDelimited(text);
    if (rows.length < 2) throw new Error('CSV 至少要有表头和一行数据');
    var map = mapHeaderRow(rows[0]);
    if (map.stem == null) throw new Error('CSV 缺少「题干」列');
    if (map.answer == null) throw new Error('CSV 缺少「答案」列');

    return rows.slice(1).filter(function (r) { return r.join('').trim(); }).map(function (r) {
      var o = {
        type: map.type != null ? (r[map.type] || '') : '',
        stem: r[map.stem] || '',
        answer: r[map.answer] || '',
        explanation: map.explanation != null ? (r[map.explanation] || '') : ''
      };
      var opts = [];
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (L) {
        // 按位置保留：中间空一格就左移会让答案字母指到错误的选项上
        if (map['opt' + L] != null && r[map['opt' + L]] != null) opts.push(String(r[map['opt' + L]]).trim());
      });
      if (opts.length) o.options = opts;
      else if (map.options != null && (r[map.options] || '').trim()) o.options = r[map.options];
      return o;
    });
  }

  /* ---- 3. 二进制解码：自动识别 UTF-8 / GBK（Excel 存的中文 CSV 常是 GBK） ---- */
  function decodeBytes(buf) {
    var u8 = new Uint8Array(buf);
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(u8);
    } catch (e) {
      try { return new TextDecoder('gbk').decode(u8); }
      catch (e2) { return new TextDecoder('utf-8').decode(u8); }
    }
  }

  /* ---- 4. 表格行 → 原始题目（自动跳过标题行、找表头） ---- */
  function rowsToRaw(rows, sheetName) {
    if (!rows || !rows.length) return [];
    var hi = -1, map = null;
    for (var i = 0; i < Math.min(10, rows.length); i++) {
      var m = mapHeaderRow(rows[i]);
      if (m.stem != null && m.answer != null) { hi = i; map = m; break; }
    }
    if (hi < 0) return [];

    var out = [];
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var at = (sheetName ? sheetName + ' · ' : '') + '第 ' + (r + 1) + ' 行';
      var get = function (idx) { return idx == null ? '' : String(row[idx] == null ? '' : row[idx]).trim(); };
      var stem = get(map.stem);
      if (!stem) continue;

      var item = {
        type: get(map.type),
        stem: stem,
        answer: get(map.answer),
        explanation: get(map.explanation),
        tag: get(map.tag),
        __from: at
      };
      var opts = [];
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (L) {
        if (map['opt' + L] != null) opts.push(get(map['opt' + L]));
      });
      while (opts.length && opts[opts.length - 1] === '') opts.pop();
      if (opts.length) item.options = opts;
      else if (map.options != null && get(map.options)) item.options = get(map.options);
      out.push(item);
    }
    return out;
  }

  /* ---- 5. xlsx：纯前端解 ZIP + 读 XML，不依赖任何库 ---- */
  function zipEntries(buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf);
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 xlsx（ZIP 结构损坏）');
    var count = dv.getUint16(eocd + 10, true);
    var p = dv.getUint32(eocd + 16, true);
    var out = {};
    for (var k = 0; k < count; k++) {
      if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var csize = dv.getUint32(p + 20, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var cmtLen = dv.getUint16(p + 32, true);
      var local = dv.getUint32(p + 42, true);
      var name = new TextDecoder('utf-8').decode(u8.subarray(p + 46, p + 46 + nameLen));
      var lNameLen = dv.getUint16(local + 26, true);
      var lExtraLen = dv.getUint16(local + 28, true);
      var start = local + 30 + lNameLen + lExtraLen;
      out[name] = { method: method, bytes: u8.subarray(start, start + csize) };
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return out;
  }

  function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('当前浏览器不支持自动解压，请把表格另存为 CSV 再导入'));
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function unzipText(files, name) {
    var f = files[name];
    if (!f) return Promise.resolve('');
    if (f.method === 0) return Promise.resolve(new TextDecoder('utf-8').decode(f.bytes));
    return inflateRaw(f.bytes).then(function (u8) { return new TextDecoder('utf-8').decode(u8); });
  }

  function xmlDoc(text) { return new DOMParser().parseFromString(text, 'application/xml'); }

  function colIndex(ref) {
    var m = String(ref || '').match(/^([A-Z]+)/);
    if (!m) return 0;
    var n = 0;
    for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }

  function parseSharedStrings(xml) {
    var out = [];
    if (!xml) return out;
    var doc = xmlDoc(xml);
    var sis = doc.getElementsByTagName('si');
    for (var i = 0; i < sis.length; i++) {
      var ts = sis[i].getElementsByTagName('t');
      var s = '';
      for (var j = 0; j < ts.length; j++) {
        // 富文本注音 <rPh>/<phoneticPr> 里的 <t> 不是正文，拼进去会把内容重复一遍
        var anc = ts[j].parentNode, phonetic = false;
        while (anc && anc !== sis[i]) {
          if (anc.nodeName === 'rPh' || anc.nodeName === 'phoneticPr') { phonetic = true; break; }
          anc = anc.parentNode;
        }
        if (!phonetic) s += ts[j].textContent;
      }
      out.push(s);
    }
    return out;
  }

  function sheetToRows(xml, shared) {
    var doc = xmlDoc(xml);
    var rowEls = doc.getElementsByTagName('row');
    var rows = [];
    for (var r = 0; r < rowEls.length; r++) {
      var cells = [];
      var cEls = rowEls[r].getElementsByTagName('c');
      var autoIdx = -1;
      for (var c = 0; c < cEls.length; c++) {
        var el = cEls[c];
        // 有些导出工具不写 r 属性，此时按单元格出现顺序排；
        // 直接 colIndex('')=0 会把整行都挤进第 0 列
        var ref = el.getAttribute('r');
        var idx;
        if (ref) { idx = colIndex(ref); autoIdx = idx; }
        else { idx = ++autoIdx; }
        var t = el.getAttribute('t');
        var val = '';
        if (t === 's') {
          var v = el.getElementsByTagName('v')[0];
          val = v ? (shared[+v.textContent] || '') : '';
        } else if (t === 'inlineStr') {
          var isEl = el.getElementsByTagName('t');
          val = isEl.length ? isEl[0].textContent : '';
        } else {
          var v2 = el.getElementsByTagName('v')[0];
          if (v2) {
            val = v2.textContent;
            if (t === 'b') val = val === '1' ? '正确' : '错误';
          }
        }
        while (cells.length < idx) cells.push('');
        cells[idx] = String(val == null ? '' : val).trim();
      }
      if (cells.length) rows.push(cells);
    }
    return rows;
  }

  function sheetOrder(wbXml, relsXml) {
    var out = [], rels = {};
    if (relsXml) {
      var rd = xmlDoc(relsXml);
      var rs = rd.getElementsByTagName('Relationship');
      for (var i = 0; i < rs.length; i++) {
        var id = rs[i].getAttribute('Id');
        var tgt = rs[i].getAttribute('Target') || '';
        if (id) rels[id] = 'xl/worksheets/' + tgt.split('/').pop();
      }
    }
    if (!wbXml) return out;
    var doc = xmlDoc(wbXml);
    var shs = doc.getElementsByTagName('sheet');
    for (var k = 0; k < shs.length; k++) {
      var rid = shs[k].getAttribute('r:id') || shs[k].getAttribute('id');
      out.push({
        name: shs[k].getAttribute('name') || ('工作表' + (k + 1)),
        file: rels[rid] || ('xl/worksheets/sheet' + (k + 1) + '.xml')
      });
    }
    return out;
  }

  function readXlsx(buf) {
    var files = zipEntries(buf);
    if (!files['xl/workbook.xml']) throw new Error('这不是 Excel 文件，或者文件已损坏');
    return Promise.all([
      unzipText(files, 'xl/sharedStrings.xml'),
      unzipText(files, 'xl/workbook.xml'),
      unzipText(files, 'xl/_rels/workbook.xml.rels')
    ]).then(function (res) {
      var shared = parseSharedStrings(res[0]);
      var order = sheetOrder(res[1], res[2]).filter(function (s) { return files[s.file]; });
      if (!order.length) {
        order = Object.keys(files)
          .filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); })
          .sort(function (a, b) { return (+a.replace(/\D/g, '')) - (+b.replace(/\D/g, '')); })
          .map(function (n, i) { return { name: '工作表' + (i + 1), file: n }; });
      }
      if (!order.length) throw new Error('工作簿里没有工作表');

      return order.reduce(function (p, s) {
        return p.then(function (acc) {
          return unzipText(files, s.file).then(function (xml) {
            acc.push({ name: s.name, rows: sheetToRows(xml, shared) });
            return acc;
          });
        });
      }, Promise.resolve([]));
    });
  }

  /* ---- 6. 预览与落地 ---- */
  function failImport(e) {
    var msg = $('importMsg');
    msg.className = 'msg no';
    msg.textContent = '导入失败：' + ((e && e.message) || '格式无法识别');
    $('importPreview').hidden = true;
  }

  function previewFromRaw(raw, title, fileName) {
    var r;
    try { r = analyzeBank(raw, title); } catch (e) { return failImport(e); }
    state.pendingImport = { questions: r.questions, stat: r, title: title || '我的题库', source: fileName || '' };
    renderPreview();
    var msg = $('importMsg');
    msg.className = 'msg';
    msg.textContent = '';
  }

  function previewFromText(text, title, fileName) {
    try {
      var t = String(text || '').trim();
      if (!t) throw new Error('内容是空的');
      if (t[0] === '[' || t[0] === '{' || /^window\.\w+\s*=/.test(t)) {
        var body = t;
        var m = body.match(/=\s*([\[{][\s\S]*[\]}])\s*;?\s*$/);
        if (m) body = m[1];
        var raw = JSON.parse(body);
        var carriedProg = null;
        if (raw && !Array.isArray(raw)) {
          carriedProg = raw.progress || null;
          raw = raw.questions || raw.data || raw.list;
        }
        if (!Array.isArray(raw)) throw new Error('JSON 里没找到题目数组');
        raw = raw.map(function (r, i) { return Object.assign({}, r, { __from: '第 ' + (i + 1) + ' 题' }); });
        previewFromRaw(raw, title, fileName);
        // 「导出题库」会带上练题记录，导入时按确定性 id 接回来
        if (state.pendingImport && carriedProg) state.pendingImport.progress = carriedProg;
        return;
      }
      var rows = parseDelimited(t);
      if (rows.length > 20001) throw new Error('一次最多导入 2 万行，请拆成几份');
      var list = rowsToRaw(rows, '');
      if (!list.length) throw new Error('没识别到题目：表头里要有「题干」和「答案」两列');
      previewFromRaw(list, title, fileName);
    } catch (e) { failImport(e); }
  }

  function renderPreview() {
    var p = state.pendingImport;
    var box = $('importPreview');
    if (!p) { box.hidden = true; box.innerHTML = ''; return; }
    var s = p.stat;

    var chips = ['judge', 'single', 'multiple', 'blank', 'short']
      .filter(function (t) { return s.types[t]; })
      .map(function (t) { return '<span class="pv-chip">' + TYPE_SHORT[t] + ' <b>' + s.types[t] + '</b></span>'; })
      .join('');

    var extras = [];
    if (s.dups) extras.push('去重 ' + s.dups + ' 条');
    if (s.fixes.total) extras.push('自动修正 ' + s.fixes.total + ' 条');
    if (s.drops.total) extras.push('跳过 ' + s.drops.total + ' 条');

    var detail = '';
    if (s.fixes.total || s.drops.total) {
      detail = '<details class="pv-detail"><summary>看处理明细</summary>';
      if (s.fixes.total) {
        detail += '<div class="pv-sec">自动修正</div><ul class="pv-list">' +
          s.fixes.list.map(function (f) { return '<li><em>' + esc(f.at) + '</em>' + esc(f.text) + '</li>'; }).join('') +
          '</ul>';
      }
      if (s.drops.total) {
        detail += '<div class="pv-sec">跳过的记录</div><ul class="pv-list">' +
          s.drops.list.map(function (d) {
            return '<li><em>' + esc(d.at) + '</em>' + esc(d.reason) + (d.preview ? ' · ' + esc(d.preview) : '') + '</li>';
          }).join('') + '</ul>';
      }
      detail += '</details>';
    }

    box.innerHTML =
      '<div class="pv-head"><b>' + esc(p.title || '题库') + '</b><span>' + esc(p.source || '') + '</span></div>' +
      '<div class="pv-count"><b>' + s.questions.length + '</b> 道可用题目</div>' +
      '<div class="pv-chips">' + chips + '</div>' +
      (extras.length ? '<div class="pv-note">' + extras.join(' · ') + '</div>' : '') +
      detail +
      '<div class="pv-actions">' +
        '<button class="btn-primary sm" data-import="replace">替换现有题库</button>' +
        '<button class="btn-ghost sm" data-import="merge">追加合并</button>' +
        '<button class="btn-ghost sm" data-import="cancel">取消</button>' +
      '</div>' +
      '<p class="pv-tip">替换＝整份换成新的（同一道题的练题记录会跟着走）；追加＝把新题并到现有题库后面。</p>';
    box.hidden = false;
  }

  /**
   * 换题库时把练题记录/错题本跟着题干走，不因为重新导入而清零
   */
  function carryProgress(newQuestions) {
    var oldBank = (state.bank && state.bank.questions) || [];
    var oldStem = {}, stemToOld = {};
    oldBank.forEach(function (q) {
      var k = questionKey(q);
      oldStem[q.id] = k;
      if (!(k in stemToOld)) stemToOld[k] = q.id;
    });
    // 同题干的多道重复题只认第一道，一道错题不能被扇成好几道
    var firstNewId = {};
    newQuestions.forEach(function (q) {
      var k = questionKey(q);
      if (!(k in firstNewId)) firstNewId[k] = q.id;
    });

    // 题库是全局键、所有档案共用：必须逐个档案迁移，不能只迁当前档案
    var names = [null].concat(Object.keys(profiles() || {}));
    var kept = 0;
    names.forEach(function (name) {
      var pk = name
        ? { prog: 'xz_u_' + name + '_prog_v2', stats: 'xz_u_' + name + '_stats_v1' }
        : { prog: GUEST_KEYS.prog, stats: GUEST_KEYS.stats };
      var isCurrent = name === state.user || (!name && !state.user);
      var oldProg = isCurrent ? (state.prog || {}) : (load(pk.prog, {}) || {});
      var oldStats = isCurrent ? state.stats : (load(pk.stats, null) || defaultStats());
      var wrongStem = {};
      (oldStats.wrong || []).forEach(function (id) {
        if (oldStem[id] != null) wrongStem[oldStem[id]] = 1;
      });
      var prog = {}, wrong = [], usedWrong = {};
      newQuestions.forEach(function (q) {
        var k = questionKey(q);
        var oldId = oldProg[q.id] ? q.id : stemToOld[k];
        var p = oldId ? oldProg[oldId] : null;
        // 复制一份，别让同题干的几道题共用同一个练题记录对象
        if (p && typeof p === 'object') prog[q.id] = Object.assign({}, p);
        if (wrongStem[k] && firstNewId[k] === q.id && !usedWrong[q.id]) {
          wrong.push(q.id); usedWrong[q.id] = 1;
        }
      });
      if (isCurrent) {
        kept += Object.keys(prog).length;
        state.prog = prog;
        state.stats.wrong = wrong;
      } else {
        save(pk.prog, prog);
        var saved = load(pk.stats, null) || defaultStats();
        saved.wrong = wrong;
        save(pk.stats, saved);
      }
    });
    saveProgress();
    persistStats();
    return kept;
  }

  function applyImport(mode) {
    var p = state.pendingImport;
    if (!p) return;
    if (mode === 'cancel') {
      state.pendingImport = null;
      renderPreview();
      $('importMsg').className = 'msg';
      $('importMsg').textContent = '已取消，题库没有变动';
      return;
    }

    var list = mode === 'merge' ? (state.bank.questions || []).slice() : [];
    var keys = {};
    list.forEach(function (q) { keys[questionKey(q)] = 1; });
    var added = 0;
    p.questions.forEach(function (q) {
      var k = questionKey(q);
      if (keys[k]) return;
      keys[k] = 1;
      list.push(q);
      added++;
    });

    var kept = carryProgress(list);

    // 导出题库里自带的练题记录：题 id 由题干哈希生成，换设备后仍然对得上
    var ip = p.progress;
    if (ip && typeof ip === 'object') {
      var validIds = {};
      list.forEach(function (q) { validIds[q.id] = 1; });
      Object.keys(ip).forEach(function (id) {
        if (validIds[id] && !state.prog[id] && ip[id] && typeof ip[id] === 'object') {
          state.prog[id] = Object.assign({}, ip[id]);
        }
      });
      saveProgress();
    }

    state.bank = {
      title: mode === 'merge' ? (state.bank.title || p.title) : p.title,
      subtitle: '导入于 ' + todayKey() + ' · 共 ' + list.length + ' 题',
      questions: list
    };
    save(LS.bank, state.bank);

    state.pendingImport = null;
    renderPreview();
    renderBankPage();
    renderHome();

    var msg = $('importMsg');
    msg.className = 'msg ok';
    msg.textContent = '已' + (mode === 'merge' ? '追加' : '替换') + '，现有 ' + list.length + ' 题'
      + (mode === 'merge' ? '（新增 ' + added + '）' : '')
      + (p.stat.dups ? '，去重 ' + p.stat.dups + ' 条' : '')
      + (p.stat.drops.total ? '，跳过 ' + p.stat.drops.total + ' 条' : '')
      + (kept ? '，沿用 ' + kept + ' 道题的练习记录' : '');
    toast('题库已更新：' + list.length + ' 题');
    $('pasteBox').value = '';
    $('fileName').textContent = '未选择文件';
  }

  function handleFile(file) {
    var msg = $('importMsg');
    if (file && file.size > 10 * 1024 * 1024) {
      msg.className = 'msg';
      msg.textContent = '文件超过 10MB，手机上容易卡住；请拆成几份或另存为 CSV 再导入';
      return;
    }
    $('fileName').textContent = file.name;
    $('importPreview').hidden = true;
    state.pendingImport = null;
    msg.className = 'msg';
    msg.textContent = '正在读取 ' + file.name + ' …';

    var title = file.name.replace(/\.[^.]+$/, '');
    var rd = new FileReader();
    rd.onload = function () {
      var buf = rd.result;
      var u8 = new Uint8Array(buf);
      try {
        if (u8[0] === 0x50 && u8[1] === 0x4B) {
          msg.textContent = '正在解析表格 …';
          readXlsx(buf).then(function (sheets) {
            var raw = [];
            sheets.forEach(function (sh) {
              rowsToRaw(sh.rows, sheets.length > 1 ? sh.name : '').forEach(function (r) { raw.push(r); });
            });
            if (!raw.length) throw new Error('表格里没识别到题目：需要「题干」「答案」两列');
            previewFromRaw(raw, title, file.name);
          }).catch(failImport);
        } else if (u8[0] === 0xD0 && u8[1] === 0xCF) {
          throw new Error('这是旧版 .xls，请在 Excel / WPS 里另存为 .xlsx 或 CSV 再导入');
        } else {
          previewFromText(decodeBytes(buf), title, file.name);
        }
      } catch (e) { failImport(e); }
    };
    rd.onerror = function () { failImport(new Error('读不出这个文件')); };
    rd.readAsArrayBuffer(file);
  }

  function exportBank() {
    var data = {
      title: state.bank.title,
      subtitle: state.bank.subtitle,
      exportedAt: new Date().toISOString(),
      questions: state.bank.questions,
      progress: state.prog
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.bank.title || '题库') + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
    toast('已导出题库 JSON');
  }

  /* ---------------- 数据备份 / 恢复 ---------------- */
  function exportBackup() {
    var keys = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('xz_') === 0) keys[k] = localStorage.getItem(k);
    }
    var payload = { app: 'xiaozhao', v: 1, at: Date.now(), user: state.user || null, keys: keys };
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '小赵刷题-备份-' + todayKey() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    toast('备份已导出，收好这个文件');
  }

  function importBackup(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var p;
      try { p = JSON.parse(fr.result); } catch (e) { toast('这个文件打不开'); return; }
      if (!p || p.app !== 'xiaozhao' || p.v !== 1 || !p.keys || typeof p.keys !== 'object' || Array.isArray(p.keys)) {
        toast('这不是本 App 的备份文件'); return;
      }
      // 语义非法的「合法 JSON」会把数据悄悄打回默认值，必须先整单校验再写
      var incoming = {}, bad = false;
      Object.keys(p.keys).forEach(function (k) {
        if (k.indexOf('xz_') !== 0) return;
        var v = p.keys[k];
        if (typeof v !== 'string') { bad = true; return; }
        try { JSON.parse(v); } catch (e) { bad = true; return; }
        incoming[k] = v;
      });
      if (bad) { toast('备份文件内容不完整，已取消恢复'); return; }
      var n = Object.keys(incoming).length;
      if (!n) { toast('备份里没有可恢复的数据'); return; }
      // 先清掉本机多余的 xz_ 键，别让备份名单之外的旧档案日后串档
      var stale = [];
      for (var li = 0; li < localStorage.length; li++) {
        var lk = localStorage.key(li);
        if (lk && lk.indexOf('xz_') === 0 && !(lk in incoming)) stale.push(lk);
      }
      stale.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { } });
      Object.keys(incoming).forEach(function (k) {
        try { localStorage.setItem(k, incoming[k]); } catch (e) { }
      });
      abandonActiveSessions();
      state.user = sessionName();
      if (state.user && !profiles()[state.user]) state.user = null;
      setUserKeys(state.user);
      loadAll();
      applyTheme(); applyMascot(); // 备份里的主题/外观要立刻生效，不能等重启
      renderUser(); renderHome(); renderSettings(); renderWrong(); showView('home');
      toast('已恢复 ' + n + ' 项数据');
    };
    fr.readAsText(file);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    // ---- 设置页：改完即时保存，下一局生效 ----
    $('segLayout').addEventListener('click', function (e) {
      var b = e.target.closest('.layout'); if (!b) return;
      state.settings.layout = b.dataset.v;
      persistSet(); renderSettings(); renderHome(); Audio2.click();
    });
    $('segType').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !b.dataset.v) return;
      var v = b.dataset.v;
      if (v === 'all') {
        state.settings.filters = [];
      } else {
        var fs = (state.settings.filters || []).slice();
        var i = fs.indexOf(v);
        if (i >= 0) fs.splice(i, 1); else fs.push(v);
        state.settings.filters = sortTypes(fs);
      }
      persistSet(); renderSettings(); renderHome(); Audio2.click();
    });
    $('segCount').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.settings.count = +b.dataset.v;
      persistSet(); renderSettings(); renderHome(); Audio2.click();
    });
    $('segPick').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.settings.pick = b.dataset.v;
      persistSet(); renderSettings(); Audio2.click();
    });
    $('segTime').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.settings.seconds = +b.dataset.v;
      state.settings.timerOn = true;
      persistSet(); renderSettings(); renderHome(); Audio2.click();
    });
    $('segReveal').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.settings.reveal = b.dataset.v;
      persistSet(); renderSettings(); Audio2.click();
    });
    $('swTimer').addEventListener('change', function () {
      state.settings.timerOn = this.checked;
      if (this.checked && !state.settings.seconds) state.settings.seconds = 180;
      persistSet(); renderSettings(); renderHome();
    });
    function stepMin(d) {
      var m = Math.max(1, Math.min(60, Math.round(state.settings.seconds / 60) + d));
      state.settings.seconds = m * 60;
      state.settings.timerOn = true;
      persistSet(); renderSettings(); renderHome(); Audio2.click();
    }
    $('timeMinus').addEventListener('click', function () { stepMin(-1); });
    $('timePlus').addEventListener('click', function () { stepMin(1); });
    $('swMask').addEventListener('change', function () {
      state.settings.mask = this.checked; persistSet(); renderSettings(); Audio2.click();
    });
    $('swExpl').addEventListener('change', function () {
      state.settings.expl = this.checked; persistSet(); renderSettings(); Audio2.click();
    });
    $('swShuffle').addEventListener('change', function () {
      state.settings.shuffleOpts = this.checked; persistSet(); renderSettings(); Audio2.click();
    });
    $('swAutoWrong').addEventListener('change', function () {
      state.settings.autoWrong = this.checked; persistSet(); renderSettings(); Audio2.click();
    });
    $('swAutoRemove').addEventListener('change', function () {
      state.settings.autoRemove = this.checked; persistSet(); renderSettings(); Audio2.click();
    });
    $('btnGoWrong').addEventListener('click', function () { renderWrong(); showView('wrong'); });
    var segTheme = $('segTheme');
    if (segTheme) segTheme.addEventListener('click', function (e) {
      var b = e.target.closest('[data-theme]');
      if (!b) return;
      state.settings.theme = b.getAttribute('data-theme');
      persistSet(); applyTheme(); renderSettings(); Audio2.click();
      toast(state.settings.theme === 'auto' ? '已跟随系统外观' : (state.settings.theme === 'dark' ? '已切换黑夜' : '已切换白天'));
    });
    $('skinGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-skin]');
      if (!b) return;
      state.settings.mascot = b.dataset.skin;
      persistSet(); applyMascot(); renderSettings(); Audio2.click();
      toast('换成「' + skinName(b.dataset.skin) + '」了');
    });
    $('btnAddWrongNow').addEventListener('click', function () {
      var r = state.lastResult;
      if (!r || !r.wrongList) return;
      var n = 0;
      r.wrongList.forEach(function (w) {
        if (state.stats.wrong.indexOf(w.q.id) < 0) { state.stats.wrong.push(w.q.id); n++; }
      });
      if (n) { persistStats(); renderHome(); }
      $('rvAddWrong').hidden = true;
      toast(n ? '这 ' + n + ' 道已收进错题本' : '这些题已经在错题本里了');
    });
    $('swSound').addEventListener('change', function () {
      state.settings.sound = this.checked;
      Audio2.on = this.checked;
      persistSet();
      if (this.checked) Audio2.click();
    });
    $('swCheckin').addEventListener('change', function () {
      state.settings.checkin = this.checked; persistSet(); renderHome();
    });
    $('btnBackup').addEventListener('click', exportBackup);
    $('btnImportBackup').addEventListener('click', function () { $('backupInput').click(); });
    $('backupInput').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (f) importBackup(f);
      this.value = '';
    });

    $('btnStart').addEventListener('click', function () { Audio2.init(); startQuiz(false); });
    var btnWrongStart = $('btnWrongStart');
    if (btnWrongStart) {
      btnWrongStart.addEventListener('click', function () { Audio2.init(); startQuiz(true); });
    }
    var btnWrongList = $('btnWrongList');
    if (btnWrongList) {
      btnWrongList.addEventListener('click', function () { renderWrong(); showView('wrong'); });
    }
    // legacy whole-strip fallback (if old markup still present)
    var btnWrongHome = $('btnWrongHome');
    if (btnWrongHome && btnWrongHome.tagName === 'BUTTON') {
      btnWrongHome.addEventListener('click', function () { Audio2.init(); startQuiz(true); });
    }
    $('btnDrillWrong').addEventListener('click', function () { Audio2.init(); startQuiz(true); });
    $('btnClearWrong').addEventListener('click', function () {
      var wcount = validWrongIds().length;
      if (!wcount) { state.stats.wrong = []; persistStats(); return; }
      if (!confirm('把错题本里的 ' + wcount + ' 道题全部移出？之后的抽题不再优先它们。')) return;
      state.stats.wrong = [];
      persistStats();
      renderWrong(); renderHome();
      toast('错题本已清空');
    });
    $('wrongList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-remove]');
      if (!b) return;
      var id = b.dataset.remove;
      var k = state.stats.wrong.indexOf(id);
      if (k >= 0) state.stats.wrong.splice(k, 1);
      persistStats();
      renderWrong(); renderHome();
      toast('已移出错题本');
    });

    // 答题
    $('btnAction').addEventListener('click', function () {
      if (this.dataset.act === 'next') nextQuestion();
      else submitAnswer();
    });
    // 整卷（退出统一走顶栏 brandHome / 系统返回，不再放脚部退出钮）
    $('btnPaperSubmit').addEventListener('click', function () {
      if (this.dataset.act === 'result') paperToResult();
      else submitPaper(false);
    });

    // 结算
    $('btnAgain').addEventListener('click', function () { startQuiz(!!state.lastOnlyWrong); });
    $('btnOnlyWrong').addEventListener('click', function () { startQuiz(true); });
    $('btnBackHome').addEventListener('click', function () { showView('home'); renderHome(); });

    // 顶栏左侧返回：答题/整卷进行中唯一退出（确认文案统一）
    $('btnHdrBack').addEventListener('click', function () {
      Audio2.click();
      leaveViaHdrBack();
    });
    // 品牌标：答题中弱化且不可点；Tab/其他页点 Logo 回首页（不是「退出」钮）
    $('brandHome').addEventListener('click', function () {
      var name = document.body.getAttribute('data-view') || '';
      if (SESSION_VIEWS.indexOf(name) >= 0) return; // 进行中只走左侧返回
      state.quiz = null;
      state.paper = null;
      showView('home'); renderHome();
    });
    $('btnBank').addEventListener('click', function () { renderBankPage(); showView('bank'); });
    // 首页「题库」格：顶栏书本已藏，由此进题库页
    var tsBank = document.querySelector('.ts-bank');
    if (tsBank) {
      tsBank.setAttribute('role', 'button');
      tsBank.tabIndex = 0;
      tsBank.setAttribute('aria-label', '打开题库');
      tsBank.style.cursor = 'pointer';
      tsBank.addEventListener('click', function () { renderBankPage(); showView('bank'); });
      tsBank.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); renderBankPage(); showView('bank'); }
      });
    }

    // ---- 底部导航 ----
    $('tabbar').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (!b) return;
      Audio2.click();
      var tab = b.dataset.tab;
      if (tab === 'home') { renderHome(); showView('home'); }
      else if (tab === 'wrong') { renderWrong(); showView('wrong'); }
      else if (tab === 'data') { showView('data'); }
      else if (tab === 'settings') { renderSettings(); showView('settings'); }
    });

    // ---- 本机档案 ----
    $('btnUser').addEventListener('click', function (e) { e.stopPropagation(); openProfileSheet(); });
    $('profClose').addEventListener('click', closeProfileSheet);
    $('profWrap').addEventListener('click', function (e) { if (e.target === this) closeProfileSheet(); });
    $('btnProfCreate').addEventListener('click', function () {
      var err = createProfile($('profName').value);
      var msg = $('profMsg');
      if (err) { msg.className = 'sheet-note'; msg.textContent = err; return; }
      $('profName').value = '';
      msg.className = 'sheet-note ok';
      msg.textContent = '建好了，已经切到新档案';
      closeProfileSheet();
      toast('新档案已建好');
    });
    $('profName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('btnProfCreate').click(); }
    });
    $('profList').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) {
        var n = del.dataset.del;
        if (!confirm('删除档案「' + n + '」？它的错题本和成绩会一起删掉，删了就找不回来。')) return;
        deleteProfile(n);
        toast('档案已删除');
        return;
      }
      var pick = e.target.closest('[data-prof]');
      if (!pick) return;
      var name = pick.dataset.prof;
      if (name === '__guest__') {
        if (state.user) { useGuest(); toast('已切到游客'); }
      } else if (name !== state.user) {
        switchProfile(name);
        toast('已切到「' + name + '」');
      }
      closeProfileSheet();
    });

    // 题库页
    function pickFile() { $('fileInput').click(); }
    $('btnPickFile').addEventListener('click', pickFile);
    $('dropZone').addEventListener('click', pickFile);
    $('dropZone').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFile(); }
    });
    $('fileInput').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (f) handleFile(f);
      this.value = '';
    });

    // 拖拽导入
    ['dragenter', 'dragover'].forEach(function (ev) {
      $('dropZone').addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        $('dropZone').classList.add('hot');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      $('dropZone').addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        $('dropZone').classList.remove('hot');
      });
    });
    $('dropZone').addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    $('btnPasteImport').addEventListener('click', function () {
      var v = $('pasteBox').value.trim();
      if (!v) { toast('先粘贴点内容'); return; }
      previewFromText(v, '粘贴导入', '粘贴的文本');
    });

    $('importPreview').addEventListener('click', function (e) {
      var b = e.target.closest('[data-import]');
      if (!b) return;
      applyImport(b.dataset.import);
    });

    $('btnExportBank').addEventListener('click', exportBank);

    $('btnRestoreBank').addEventListener('click', function () {
      if (!window.__BANK__) { toast('没有内置题库'); return; }
      if (!confirm('恢复为内置题库？当前导入的题库会被替换。')) return;
      localStorage.removeItem(LS.bank);
      var kept = carryProgress(window.__BANK__.questions || []);
      state.bank = window.__BANK__;
      state.pendingImport = null;
      renderPreview();
      renderBankPage(); renderHome();
      $('importMsg').className = 'msg ok';
      $('importMsg').textContent = '已恢复内置题库：' + state.bank.questions.length + ' 题'
        + (kept ? '，沿用 ' + kept + ' 道题的练习记录' : '');
    });
    $('btnReset').addEventListener('click', function () {
      if (!confirm('清空所有答题记录、错题本、练题标记和设置？题库会保留。')) return;
      localStorage.removeItem(LS.stats);
      localStorage.removeItem(LS.seen);
      localStorage.removeItem(LS.prog);
      localStorage.removeItem(LS.set);
      state.stats = defaultStats();
      state.settings = Object.assign({}, DEFAULT_SET);
      state.prog = {};
      Audio2.on = state.settings.sound;
      applyTheme();
      renderHome(); renderSettings(); renderWrong();
      toast('已清空');
    });

    // 键盘
    document.addEventListener('keydown', function (e) {
      if (e.isComposing || e.keyCode === 229) return; // 中文输入法选词中，不抢按键
      var tag = e.target && e.target.tagName;
      var typing = tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' ||
        (e.target && e.target.isContentEditable);
      var homeActive = $('view-home').classList.contains('is-active');
      var quizActive = $('view-quiz').classList.contains('is-active');

      // 首页按钮/可聚焦卡片自己有默认行为，Enter 不该被抢去直接开局
      if (homeActive && e.key === 'Enter' && !typing && tag !== 'BUTTON' &&
          !(e.target && e.target.closest && e.target.closest('[role="button"]'))) {
        e.preventDefault(); startQuiz(false); return;
      }
      if (!quizActive || !state.quiz) return;
      if (tag === 'TEXTAREA') return; // 简答框里 Enter 换行、方向键走光标

      if (e.key === 'Enter') {
        e.preventDefault();
        if ($('btnAction').dataset.act === 'next') nextQuestion(); else submitAnswer();
        return;
      }
      if (typing) return; // 填空/简答输入框里方向键、数字、字母都要留给输入
      var q = state.quiz.list[state.quiz.idx];
      var rec = state.quiz.records[state.quiz.idx];
      if (rec.submitted) return;
      if (/^[1-9]$/.test(e.key)) {
        var n = +e.key - 1;
        if (q.type === 'judge') { if (n === 0) pickJudge(true); else if (n === 1) pickJudge(false); }
        else if (q.type === 'single' || q.type === 'multiple') {
          var L = String.fromCharCode(65 + n);
          if (q.options[n]) pickOption(L);
        }
      } else if (/^[a-hA-H]$/.test(e.key) && (q.type === 'single' || q.type === 'multiple')) {
        var L2 = e.key.toUpperCase();
        if (q.options[L2.charCodeAt(0) - 65]) pickOption(L2);
      } else if (e.key === 'ArrowLeft' && state.quiz.idx > 0) {
        e.preventDefault();
        state.quiz.idx--; renderQuestion();
      } else if (e.key === 'ArrowRight' && state.quiz.idx < state.quiz.list.length - 1) {
        e.preventDefault();
        state.quiz.idx++; renderQuestion();
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  // 调试入口：便于自测/排查导入问题（不影响正常使用）
  window.__XZ = {
    state: state,
    readXlsx: readXlsx,
    rowsToRaw: rowsToRaw,
    analyzeBank: analyzeBank,
    handleFile: handleFile,
    previewFromText: previewFromText,
    applyImport: applyImport,
    carryProgress: carryProgress,
    createProfile: createProfile,
    switchProfile: switchProfile,
    useGuest: useGuest,
    deleteProfile: deleteProfile,
    renderSettings: renderSettings,
    shuffleOptions: shuffleOptions,
    medalsOf: medalsOf,
    stickerSvg: stickerSvg,
    applyMascot: applyMascot,
    applyTheme: applyTheme,
    skinSvg: skinSvg,
    buildPool: buildPool,
    filtersName: filtersName,
    // 以下仅供回归套件调用（只暴露引用，不改变产品行为）
    colIndex: colIndex,
    parseSharedStrings: parseSharedStrings,
    sheetToRows: sheetToRows,
    submitPaper: submitPaper,
    loadAll: loadAll,
    persistSet: persistSet,
    parseDelimited: parseDelimited,
    mapHeaderRow: mapHeaderRow,
    parseCSV: parseCSV,
    effectiveStreak: effectiveStreak,
    validWrongIds: validWrongIds,
    grade: grade,
    finishQuiz: finishQuiz,
    renderHome: renderHome,
    renderWrong: renderWrong,
    importBackup: importBackup,
    abandonActiveSessions: abandonActiveSessions
  };

  function boot() {
    state.user = sessionName();
    if (state.user && !profiles()[state.user]) state.user = null; // 档案被删了，回游客
    setUserKeys(state.user);
    loadAll();
    Audio2.on = !!state.settings.sound;
    bind();
    renderUser();
    applyMascot();
    try {
      var _pq = new URLSearchParams(location.search);
      var _pv = _pq.get('view');
      if (_pv === 'settings') { renderSettings(); showView('settings'); }
      else if (_pv === 'data') { showView('data'); }
      else if (_pv === 'wrong') { renderWrong(); showView('wrong'); }
      if (_pq.get('focus') === 'skin') {
        var _sk = $('skinGrid');
        if (_sk) { try { _sk.scrollIntoView({block:'center'}); } catch (e) {} }
      }
      if (_pq.get('open') === 'checkin') {
        var _ck = $('checkinCard');
        if (_ck) { _ck.open = true; try { _ck.scrollIntoView({block:'center'}); } catch (e) {} }
      }
      if (_pq.get('theme') === 'dark' || _pq.get('theme') === 'light') {
        state.settings.theme = _pq.get('theme');
        applyTheme();
      }
      if (_pq.get('skin') && skinList()[_pq.get('skin')]) {
        state.settings.mascot = _pq.get('skin');
        applyMascot();
        if (_pv === 'settings') renderSettings();
      }
    } catch (e) {}
    applyTheme();
    if (_themeMql) {
      if (_themeMql.addEventListener) _themeMql.addEventListener('change', onSystemTheme);
      else if (_themeMql.addListener) _themeMql.addListener(onSystemTheme);
    }
    renderHome();
    renderSettings();
    try {
      if (!new URLSearchParams(location.search).get('view')) showView('home');
    } catch (e) { showView('home'); }

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

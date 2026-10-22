/*
 * Translations for the browser version (English, Chinese, Spanish).
 *
 * The game engines keep producing the original English text, because the tests compare it
 * with the Python games. The page translates that text just before showing it: exact
 * strings through EXACT, strings with numbers in them through PATTERNS. Numbers are never
 * translated or reformatted: showing Python's raw float values is the point of the game.
 *
 * translate(lang, text) returns null when there is no translation, so the page can fall
 * back to English and tests/i18n_check.js can list what is missing.
 */
(function (root) {
  "use strict";

  var LANGUAGES = [
    { code: "en", name: "English", html: "en" },
    { code: "zh", name: "中文", html: "zh-Hans" },
    { code: "es", name: "Español", html: "es" },
  ];

  // English text: [Chinese, Spanish]
  var EXACT = {
    // page
    "floating point inaccuracy simulator": ["浮点数误差模拟器", "simulador de imprecisión de coma flotante"],
    "floating point inaccuracy simulator (demo)": ["浮点数误差模拟器（试玩版）", "simulador de imprecisión de coma flotante (demo)"],
    "main": ["主页", "inicio"],
    "upgrades": ["升级", "mejoras"],
    "prestige": ["声望", "prestigio"],
    "increment": ["增加", "incrementar"],
    "go to upgrade menu": ["前往升级菜单", "ir al menú de mejoras"],
    "upgrade clicking": ["升级点击", "mejorar clic"],
    "upgrade score per second": ["升级每秒分数", "mejorar puntos por segundo"],
    "cost:": ["价格：", "coste:"],
    "save game": ["保存游戏", "guardar partida"],
    "go to prestige menu": ["前往声望菜单", "ir al menú de prestigio"],
    "go to main menu": ["返回主页", "volver al inicio"],
    "export save": ["导出存档", "exportar partida"],
    "import save": ["导入存档", "importar partida"],
    "reset": ["重置", "reiniciar"],
    "language": ["语言", "idioma"],
    "space: increment · 1 / 2 / 3: menus · progress saves automatically in this browser": [
      "空格：增加 · 1 / 2 / 3：切换菜单 · 进度会自动保存在此浏览器中",
      "espacio: incrementar · 1 / 2 / 3: menús · el progreso se guarda solo en este navegador"],

    // prestige upgrades
    "all upgrades 10% cheaper": ["所有升级便宜 10%", "todas las mejoras un 10% más baratas"],
    "all upgrades 5% cheaper": ["所有升级便宜 5%", "todas las mejoras un 5% más baratas"],
    "gain 25% of current score": ["获得当前分数的 25%", "gana un 25% de tus puntos actuales"],
    "gain 10 minutes of\npassive income instantly": ["立即获得\n10 分钟的被动收入", "gana al instante\n10 minutos de\ningresos pasivos"],
    "gain 3 minutes of\npassive income instantly": ["立即获得\n3 分钟的被动收入", "gana al instante\n3 minutos de\ningresos pasivos"],
    "+1% passive income\nper prestige point\nper level": ["每级每个声望点\n+1% 被动收入", "+1% de ingresos pasivos\npor punto de prestigio\npor nivel"],

    // labels without numbers
    "get 10^63 (one vigintillion) score to win": ["获得 10^63 分即可获胜", "consigue 10^63 puntos para ganar"],
    "get 1000 score to win": ["获得 1000 分即可获胜", "consigue 1000 puntos para ganar"],
    "u already won": ["你已经赢了", "ya ganaste"],

    // pop-ups from the game
    "OK": ["好", "vale"],
    "Error": ["出错了", "error"],
    "achievement unlocked!": ["成就解锁！", "¡logro desbloqueado!"],
    "secret achievement unlocked!": ["隐藏成就解锁！", "¡logro secreto desbloqueado!"],
    "wow u actually did it congrats on wasting years of your life on this": [
      "哇你真的做到了，恭喜你在这上面浪费了好几年的人生",
      "guau, lo lograste de verdad. felicidades por desperdiciar años de tu vida en esto"],
    "yay u completed the demo of floating point inaccuracy simulator!": [
      "耶，你通关了浮点数误差模拟器的试玩版！",
      "¡bien! completaste la demo del simulador de imprecisión de coma flotante"],
    "you do not have enough prestige points for that.": ["你的声望点不够。", "no tienes suficientes puntos de prestigio para eso."],
    "you do not have enough score for this.": ["你的分数不够。", "no tienes suficientes puntos para esto."],

    // achievements: titles
    "the name of the game": ["名副其实", "el nombre lo dice todo"],
    "alert the staff": ["快叫工作人员", "avisen al personal"],
    "go touch grass": ["出去摸摸草吧", "sal a tocar pasto"],
    "making progress": ["有所进展", "progresando"],
    "carpal tunnel syndrome": ["腕管综合征", "síndrome del túnel carpiano"],
    "hoarder": ["囤积狂", "acaparador"],
    "beginning of the end": ["终结的开始", "el principio del fin"],
    "time wasters: wasters of time": ["浪费时间的人：时间的浪费者", "perdedores de tiempo: los que pierden el tiempo"],
    "lol": ["哈哈", "jaja"],
    "i got you a gift!": ["我给你准备了礼物！", "¡te traje un regalo!"],
    "stop.": ["停下。", "para."],
    "it's too late...": ["太迟了……", "ya es demasiado tarde..."],
    "retirement fees": ["养老金", "pensión de jubilación"],
    "autoclicker": ["连点器", "autoclicker"],
    "cheater!": ["作弊者！", "¡tramposo!"],
    "bankruptcy": ["破产", "bancarrota"],
    "need a loan?": ["需要贷款吗？", "¿necesitas un préstamo?"],
    "100 percenting floating point inaccuracy simulator any % speedrun": [
      "浮点数误差模拟器 全成就 any% 速通",
      "speedrun any% al 100% del simulador de imprecisión de coma flotante"],
    "100 percenting floating point inaccuracy simulator (demo) any % speedrun": [
      "浮点数误差模拟器（试玩版）全成就 any% 速通",
      "speedrun any% al 100% del simulador de imprecisión de coma flotante (demo)"],
    "halfway there!": ["已经过半了！", "¡a mitad de camino!"],
    "free sample": ["免费试吃", "muestra gratis"],
    "filler text": ["凑字数", "texto de relleno"],
    "why?": ["为什么？", "¿por qué?"],
    "alright, i give up, you win": ["好吧，我认输，你赢了", "vale, me rindo, tú ganas"],
    "take a break.": ["休息一下。", "tómate un descanso."],
    "the average costco:": ["好市多日常：", "el costco promedio:"],
    "lazy.": ["懒。", "vago."],

    // achievements: descriptions
    "find out that computers aren't good at floating-point arithmetic": [
      "发现电脑并不擅长浮点运算",
      "descubre que los ordenadores no son buenos con la aritmética de coma flotante"],
    "somehow get negative score???": ["不知怎么分数变成负数了???", "de alguna forma tener puntos negativos???"],
    "play for 24 hours": ["玩 24 小时", "juega 24 horas"],
    "10% of the way there": ["已经走完 10% 的路了", "llevas el 10% del camino"],
    "click for the first time. you will do this many, many more times.": [
      "第一次点击。你还会点很多很多很多次。",
      "haz clic por primera vez. lo harás muchas, muchísimas veces más."],
    "get to 1000 score without prestiging": ["不进行声望重置就达到 1000 分", "llega a 1000 puntos sin usar el prestigio"],
    "get to 200 score without prestiging": ["不进行声望重置就达到 200 分", "llega a 200 puntos sin usar el prestigio"],
    "you have officially been permanently locked out of an achievement. we wont tell you what.": [
      "你已经正式永久错过了一个成就。我们不会告诉你是哪个。",
      "oficialmente te quedaste sin un logro para siempre. no te diremos cuál."],
    "a small gift, just for you =)": ["一份小礼物，专门给你的 =)", "un pequeño regalo, solo para ti =)"],
    "playing this game is dangerous, you can still leave.": [
      "玩这个游戏很危险，你现在还能离开。",
      "jugar a este juego es peligroso, todavía puedes irte."],
    "you've been at this for a year now. you can'nt stop anymore, so might as well help you out.": [
      "你已经玩了一整年了。你已经停不下来了，那就帮你一把吧。",
      "ya llevas un año con esto. ya no puedes parar, así que mejor te ayudamos."],
    "A DECADE??": ["十年??", "¿¿UNA DÉCADA??"],
    "click 1 million times": ["点击 100 万次", "haz clic 1 millón de veces"],
    "hey. i know youre using an autoclicker. stop it.": [
      "喂。我知道你在用连点器。别用了。",
      "oye. sé que estás usando un autoclicker. para ya."],
    "get every achievement (besides this one)": ["获得所有成就（这个除外）", "consigue todos los logros (menos este)"],
    "get 1000 milestones\ni dont think this is possible.": [
      "达成 1000 个里程碑\n我觉得这不可能。",
      "consigue 1000 hitos\nno creo que esto sea posible."],
    "get 50% progress": ["进度达到 50%", "llega al 50% de progreso"],
    "buy an upgrade for free": ["免费买到一个升级", "compra una mejora gratis"],
    "im bored so heres a gift": ["我好无聊，所以送你个礼物", "estoy aburrido así que toma un regalo"],
    "prestige with less than 10 score and reset all your progress for nothing": [
      "在分数不到 10 时进行声望重置，白白清空所有进度",
      "usa el prestigio con menos de 10 puntos y reinicia todo tu progreso para nada"],
    "this achievement shouldn't be possible to get. if you did, you have exceeded my estimated play time tenfold.\n        i am so sorry for ruining your life.": [
      "这个成就本不应该能拿到。如果你拿到了，说明你的游戏时间是我预估的十倍以上。\n我很抱歉毁了你的人生。",
      "este logro no debería poder conseguirse. si lo conseguiste, jugaste diez veces más de lo que calculé.\nsiento mucho haberte arruinado la vida."],
    "go outside. drink some water. touch grass. whatever. just take a break.": [
      "出去走走。喝点水。摸摸草。随便干嘛。休息一下就好。",
      "sal afuera. bebe agua. toca pasto. lo que sea. solo tómate un descanso."],
    "prestige with at least 10 score without paying for a single upgrade": [
      "在至少 10 分、一个升级都没花钱买的情况下进行声望重置",
      "usa el prestigio con al menos 10 puntos sin haber pagado ni una mejora"],
    "prestige (with more than 10 score) without clicking the increment button at all": [
      "完全不点「增加」按钮就进行声望重置（分数超过 10）",
      "usa el prestigio (con más de 10 puntos) sin pulsar nunca el botón de incrementar"],

    // page dialogs and status messages
    "This is your whole save. Copy it somewhere safe, or download it as a file.": [
      "这是你的完整存档。把它复制到安全的地方，或者下载成文件。",
      "esta es tu partida completa. cópiala en un lugar seguro o descárgala como archivo."],
    "copy": ["复制", "copiar"],
    "copied": ["已复制", "copiado"],
    "download": ["下载", "descargar"],
    "close": ["关闭", "cerrar"],
    "Paste a save exported from this page, or the save.json written by the desktop (Python) version.": [
      "粘贴从本页面导出的存档，或桌面（Python）版写出的 save.json。",
      "pega una partida exportada desde esta página o el save.json de la versión de escritorio (Python)."],
    "Paste a save exported from this page.": ["粘贴从本页面导出的存档。", "pega una partida exportada desde esta página."],
    "This replaces your current game.": ["这会替换你当前的游戏。", "esto reemplaza tu partida actual."],
    "load": ["载入", "cargar"],
    "choose file": ["选择文件", "elegir archivo"],
    "cancel": ["取消", "cancelar"],
    "That text is not a save for this game. Nothing was changed.": [
      "这段文字不是本游戏的存档。没有做任何更改。",
      "ese texto no es una partida de este juego. no se cambió nada."],
    "reset everything?": ["全部重置？", "¿reiniciar todo?"],
    "This deletes your score, upgrades, prestige points and achievements. Export your save first if you might want it back.": [
      "这会删除你的分数、升级、声望点和成就。如果以后可能还想要，请先导出存档。",
      "esto borra tus puntos, mejoras, puntos de prestigio y logros. exporta tu partida antes si quizá la quieres recuperar."],
    "delete my progress": ["删除我的进度", "borrar mi progreso"],
    "saved": ["已保存", "guardado"],
    "save imported": ["存档已导入", "partida importada"],
    "new game started": ["已开始新游戏", "nueva partida empezada"],
    "Download is blocked here; copy the text instead.": ["这里无法下载，请改为复制文字。", "aquí no se puede descargar; copia el texto."],
    "Your saved game could not be read, so a new game was started.": [
      "无法读取你的存档，所以开始了新游戏。",
      "no se pudo leer tu partida guardada, así que empezó una nueva."],
    "This browser blocks storage for this page, so progress is lost on reload. Use \"export save\" to keep it.": [
      "此浏览器禁止本页面存储数据，刷新后进度会丢失。请用「导出存档」保留进度。",
      "este navegador no deja guardar datos en esta página, así que el progreso se pierde al recargar. usa \"exportar partida\" para conservarlo."],
  };

  var MILESTONE = {
    score: ["分数", "de puntos"],
    upgrade: ["升级", "de mejoras"],
    prestige: ["声望", "de prestigio"],
  };
  var INCOME = {
    click: ["点击收入", "los ingresos por clic"],
    sps: ["每秒收入", "los ingresos por segundo"],
    all: ["所有收入", "todos los ingresos"],
  };

  // [pattern, Chinese, Spanish]; each translation is a replacement string or a function
  // (match, translate) returning the text.
  var PATTERNS = [
    [/^score: (.*)$/, "分数：$1", "puntos: $1"],
    [/^click power: (.*)$/, "点击力量：$1", "poder de clic: $1"],
    [/^score per second: (.*)$/, "每秒分数：$1", "puntos por segundo: $1"],
    [/^progress: (.*)%$/, "进度：$1%", "progreso: $1%"],
    [/^reset all other progress for (.*) prestige points$/,
      "重置其他所有进度，换取 $1 个声望点", "reinicia todo lo demás a cambio de $1 puntos de prestigio"],
    [/^prestige points: (.*)$/, "声望点：$1", "puntos de prestigio: $1"],
    [/^you have achieved (score|upgrade|prestige) milestone #(\d+)\. (click|sps|all) income increased by 1%\.$/,
      function (m) { return "你达成了" + MILESTONE[m[1]][0] + "里程碑 #" + m[2] + "。" + INCOME[m[3]][0] + "增加 1%。"; },
      function (m) { return "alcanzaste el hito " + MILESTONE[m[1]][1] + " n.º " + m[2] + ". " + INCOME[m[3]][1] + " aumentan un 1%."; }],
    // An achievement pop-up: description, then the rewards line.
    [/^([\s\S]*)\n\nrewards: (.*) score, (.*)% boost to clicking income, (.*)% boost to passive income, (.*)% boost to all income, (.*) prestige points\.$/,
      function (m, tr) {
        var d = tr(m[1]);
        return d === null ? null : d + "\n\n奖励：" + m[2] + " 分，点击收入加成 " + m[3] + "%，被动收入加成 " +
          m[4] + "%，全部收入加成 " + m[5] + "%，" + m[6] + " 个声望点。";
      },
      function (m, tr) {
        var d = tr(m[1]);
        return d === null ? null : d + "\n\nrecompensas: " + m[2] + " puntos, " + m[3] +
          "% de bonificación a los ingresos por clic, " + m[4] + "% de bonificación a los ingresos pasivos, " +
          m[5] + "% de bonificación a todos los ingresos, " + m[6] + " puntos de prestigio.";
      }],
    [/^click (\d+) times$/, "点击 $1 次", "haz clic $1 veces"],
    [/^have at least (\d+) prestige points at a time$/, "同时拥有至少 $1 个声望点", "ten al menos $1 puntos de prestigio a la vez"],
    [/^click (\d+) upgrades without being able to afford them$/,
      "在买不起的情况下点击升级 $1 次", "haz clic $1 veces en mejoras que no puedes pagar"],
    [/^milestone milestone (\d+)$/, "里程碑的里程碑 $1", "hito de hitos $1"],
    [/^get (\d+) milestones$/, "达成 $1 个里程碑", "consigue $1 hitos"],
    [/^Saving failed \((.*)\)\. Use "export save" to keep your progress\.$/,
      "保存失败（$1）。请用「导出存档」保留进度。", "no se pudo guardar ($1). usa \"exportar partida\" para conservar tu progreso."],
  ];

  var INDEX = { zh: 0, es: 1 };

  function translate(lang, text) {
    if (lang === "en" || text === null || text === undefined) return text;
    var i = INDEX[lang];
    if (i === undefined) return null;
    if (Object.prototype.hasOwnProperty.call(EXACT, text)) return EXACT[text][i];
    if (!/[a-z]/i.test(text.replace(/e[+-]\d|inf|nan/g, ""))) return text; // a bare number
    var tr = function (s) { return translate(lang, s); };
    for (var p = 0; p < PATTERNS.length; p++) {
      var m = PATTERNS[p][0].exec(text);
      if (!m) continue;
      var out = PATTERNS[p][1 + i];
      return typeof out === "function" ? out(m, tr) : text.replace(PATTERNS[p][0], out);
    }
    return null;
  }

  var api = { LANGUAGES: LANGUAGES, translate: translate, EXACT: EXACT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof self !== "undefined" ? self : this);

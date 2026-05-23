//@ts-nocheck

(function(Scratch) {
    'use strict';
  
    if (!Scratch.extensions.unsandboxed) {
      throw new Error('This extension requires unsandboxed mode / Это расширение требует запуска без песочницы!');
    }
  
    // Автоматическое определение локали самого TurboWarp
    const currentLocale = Scratch.extensions.getLocale ? Scratch.extensions.getLocale() : 'ru';
  
    // Базовый встроенный словарь (Русский + Английский как резерв)
    const i18n = {
      ru: {
        name: 'Google Змейка: 1005 Режимов', board: 'Текст игрового поля', init: 'Начать: Ширина [W] Высота [H] Режим [MODE]',
        settings: 'Настройка: Скорость (мс) [SPD] Старт Длина [LEN]', skins: 'Эмодзи: ПолеА [A] ПолеБ [B] Яблоко [APL] Голова [HD] Тело [BD] БезЩита [SHD]',
        control: 'Действие игры: [ACTION]', changeDir: 'Повернуть змейку: [DIR]', score: 'Текущие очки',
        m1: '📦 Режимы: Классика [MODE]', m2: '🌌 Режимы: Пространство [MODE]', m3: '⚙️ Режимы: Управление [MODE]',
        m4: '💀 Режимы: Выживание [MODE]', m5: '🕹️ Режимы: Аркада [MODE]', m6: '🧮 Режимы: Математика [MODE]',
        over: '❌ ИГРА ОКОНЧЕНА! Очки: ', reset: '.\nНажмите Сброс.', start_msg: 'Нажмите СТАРТ'
      },
      en: {
        name: 'Google Snake: 1005 Modes', board: 'Game Board Text', init: 'Start: Width [W] Height [H] Mode [MODE]',
        settings: 'Setup: Speed (ms) [SPD] Start Length [LEN]', skins: 'Skins: GridA [A] GridB [B] Apple [APL] Head [HD] Body [BD] BrokenShield [SHD]',
        control: 'Game Action: [ACTION]', changeDir: 'Turn Snake: [DIR]', score: 'Current Score',
        m1: '📦 Modes: Classic [MODE]', m2: '🌌 Modes: Space [MODE]', m3: '⚙️ Modes: Control [MODE]',
        m4: '💀 Modes: Survival [MODE]', m5: '🕹️ Modes: Arcade [MODE]', m6: '🧮 Modes: Math [MODE]',
        over: '❌ GAME OVER! Score: ', reset: '.\nPress Reset.', start_msg: 'Press START'
      }
    };
  
    // Функция-переводчик: если язык не ru/en, она оставляет английский текст, защищая блоки от пустоты
    function getMsg(key) {
      const lang = currentLocale.startsWith('ru') ? 'ru' : 'en';
      return i18n[lang][key];
    }
  
    // Системные переменные ядра игры
    let width = 12; let height = 10; let snake = [];
    let direction = {x: 1, y: 0}; let nextDirection = {x: 1, y: 0};
    let apple = {x: -1, y: -1}; let score = 0;
    let isGameOver = false; let isPaused = true;
    let gameMode = 'classic'; let tickSpeed = 200; let initialSize = 3;  
  
    // Текстурирование элементов (эмодзи)
    let skinEmptyA = '🟩'; let skinEmptyB = '🟫'; let skinApple  = '🍎'; 
    let skinHead   = '👀'; let skinBody   = '🟢'; let skinNoShieldHead = '💀'; let savedDefaultHead = '👀';
  
    // Флаги физических состояний
    let invertedControls = false; let shieldActive = false; let flyCounter = 0; let modeTimer = 0;
    let wallsArray = []; let portalA = {x: -1, y: -1}; let portalB = {x: -1, y: -1};
    let minesArray = []; let dynamicObstacles = []; let gameInterval = null;
  
    // Изолированные флаги текстовых миксов
    let isWalllessEnabled = false; let isInfiniteGrowth = false; let isBlindEnabled = false;
    let isTwinEnabled = false; let isDrunkEnabled = false; let isGhostBodyEnabled = false;
    let isWallBuilderEnabled = false; let isPoisonEnabled = false; let isShieldEnabled = false;
    let isFlyingFruitEnabled = false; let isPortalJumpEnabled = false;
  
    function generateFood() {
      const freeCells = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const isOccupied = snake.some(s => s.x === x && s.y === y) ||
                             (x === portalA.x && y === portalA.y) || (x === portalB.x && y === portalB.y) ||
                             wallsArray.some(w => w.x === x && w.y === y) ||
                             minesArray.some(m => m.x === x && m.y === y) || dynamicObstacles.some(d => d.x === x && d.y === y);
          if (!isOccupied) freeCells.push({x, y});
        }
      }
      if (freeCells.length === 0) return {x: -1, y: -1};
      return freeCells[Math.floor(Math.random() * freeCells.length)];
    }
  
    function resetGame() {
      let startY = Math.floor(height / 2); let startX = Math.floor(width / 3);
      snake = [];
      for (let i = 0; i < initialSize; i++) snake.push({x: startX - i, y: startY});
      direction = {x: 1, y: 0}; nextDirection = {x: 1, y: 0};
      score = 0; isGameOver = false; shieldActive = false; skinHead = savedDefaultHead;
      flyCounter = 0; modeTimer = 0; wallsArray = []; minesArray = []; dynamicObstacles = [];
  
      let modeId = gameMode.startsWith('m') ? parseInt(gameMode.slice(1)) || 0 : 0;
      const hasPortals = ['portal', 'm3', 'm40', 'm71', 'm111'].includes(gameMode) || (modeId > 0 && modeId % 13 === 0);
      if (hasPortals || portalA.x !== -1) { portalA = {x: 1, y: 1}; portalB = {x: width - 2, y: height - 2}; }
      apple = generateFood();
    }
  
    function gameTick() {
      if (isGameOver || isPaused) return;
      modeTimer++;
      let modeId = gameMode.startsWith('m') ? parseInt(gameMode.slice(1)) || 0 : 0;
  
      if (gameMode === 'fly' || gameMode === 'm15' || gameMode === 'm54' || isFlyingFruitEnabled || (modeId > 0 && modeId % 19 === 0)) {
        flyCounter++; if (flyCounter >= ((gameMode === 'm54') ? 5 : 12)) { apple = generateFood(); flyCounter = 0; }
      }
      if (['drunk', 'm7', 'm18', 'm63', 'm23'].includes(gameMode) || isDrunkEnabled || (modeId > 0 && modeId % 14 === 0)) {
        if (Math.random() < 0.07) {
          const dirs = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}]; let rd = dirs[Math.floor(Math.random() * 4)];
          if (!(rd.x === -direction.x && rd.y === -direction.y)) nextDirection = rd;
        }
      }
  
      direction = nextDirection; const head = snake[0]; if (!head) return;
      let newHead = { x: head.x + direction.x, y: head.y + direction.y };
  
      const crossBorderModes = ['wallless', 'portal', 'infinite', 'cheese', 'banana', 'fly', 'm111'];
      const isBorderless = crossBorderModes.includes(gameMode) || (modeId > 0 && modeId % 2 === 0) || isWalllessEnabled;
  
      if (isBorderless) {
        if (newHead.x < 0) newHead.x = width - 1; if (newHead.x >= width) newHead.x = 0;
        if (newHead.y < 0) newHead.y = height - 1; if (newHead.y >= height) newHead.y = 0;
      } else {
        if (newHead.x < 0 || newHead.x >= width || newHead.y < 0 || newHead.y >= height) {
          if (gameMode.includes('shield') || gameMode.includes('12') || isShieldEnabled) {
            if (!shieldActive) { shieldActive = true; skinHead = skinNoShieldHead; return; } else { isGameOver = true; return; }
          }
          isGameOver = true; return;
        }
      }
  
      const hasActivePortals = ['portal', 'm3', 'm40', 'm71', 'm111'].includes(gameMode) || (modeId > 0 && modeId % 13 === 0) || (portalA.x !== -1);
      if (hasActivePortals) {
        let teleported = false;
        if (newHead.x === portalA.x && newHead.y === portalA.y) { newHead = { x: portalB.x + direction.x, y: portalB.y + direction.y }; teleported = true; }
        else if (newHead.x === portalB.x && newHead.y === portalB.y) { newHead = { x: portalA.x + direction.x, y: portalA.y + direction.y }; teleported = true; }
        if (teleported) {
          if (newHead.x < 0) newHead.x = width - 1; if (newHead.x >= width) newHead.x = 0;
          if (newHead.y < 0) newHead.y = height - 1; if (newHead.y >= height) newHead.y = 0;
          if (isPortalJumpEnabled) { portalA = generateFood(); portalB = generateFood(); }
        }
      }
  
      if (wallsArray.some(w => w.x === newHead.x && w.y === newHead.y) || minesArray.some(m => m.x === newHead.x && m.y === newHead.y)) {
        if (gameMode.includes('shield') || gameMode.includes('12') || isShieldEnabled) {
          if (!shieldActive) { shieldActive = true; skinHead = skinNoShieldHead; return; } else { isGameOver = true; return; }
        }
        isGameOver = true; return;
      }
  
      let checkBody = ['cheese', 'm8', 'm16', 'm20', 'm55', 'm72', 'm99'].includes(gameMode) || isGhostBodyEnabled ? [] : snake.slice(0, -1);
      if (checkBody.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        if (gameMode.includes('shield') || gameMode.includes('12') || isShieldEnabled) {
          if (!shieldActive) { shieldActive = true; skinHead = skinNoShieldHead; return; } else { isGameOver = true; return; }
        }
        isGameOver = true; return;
      }
  
      snake.unshift(newHead);
  
      if (newHead.x === apple.x && newHead.y === apple.y) {
        score++;
        if (['poison', 'm11'].includes(gameMode) || isPoisonEnabled) score -= 2;
        if (['wallmode', 'm10'].includes(gameMode) || isWallBuilderEnabled) wallsArray.push({x: head.x, y: head.y});
        if (['twin', 'm5'].includes(gameMode) || isTwinEnabled) {
          snake.reverse(); let nextHead = snake[0]; let nextNeck = snake[1] || nextHead;
          direction = { x: Math.sign(nextHead.x - nextNeck.x), y: Math.sign(nextHead.y - nextNeck.y) };
          if (direction.x === 0 && direction.y === 0) direction = {x: 1, y: 0};
          nextDirection = direction;
        }
        if (gameMode === 'm71' || gameMode === 'm111' || gameMode.includes('71') || gameMode.includes('111')) {
          portalA = { x: Math.floor(Math.random() * (width - 2)) + 1, y: Math.floor(Math.random() * (height - 2)) + 1 };
          portalB = { x: Math.floor(Math.random() * (width - 2)) + 1, y: Math.floor(Math.random() * (height - 2)) + 1 };
        }
        apple = generateFood();
      } else {
        if (!['infinite', 'm4'].includes(gameMode) && !isInfiniteGrowth) snake.pop();
      }
    }
  
    function startLoop() {
      if (gameInterval !== null) clearInterval(gameInterval);
      gameInterval = setInterval(() => { gameTick(); if (Scratch?.vm?.runtime) Scratch.vm.runtime.requestRedraw(); }, tickSpeed);
    }
  
    function renderGridToString() {
      if (isGameOver) return getMsg('over') + score + getMsg('reset');
      if (isPaused && score === 0 && snake.length === 0) return getMsg('start_msg');
      
      let board = [];
      for (let y = 0; y < height; y++) {
        let row = [];
        for (let x = 0; x < width; x++) {
          if (gameMode === 'blind' || gameMode.includes('blind') || isBlindEnabled) {
            let isVisible = false;
            if (snake.length > 0) {
              let distHead = Math.max(Math.abs(snake[0].x - x), Math.abs(snake[0].y - y));
              if (distHead <= 2) isVisible = true;
            }
            let distApple = Math.max(Math.abs(apple.x - x), Math.abs(apple.y - y));
            if (distApple <= 1) isVisible = true;
            if (!isVisible) { row.push('⬛'); continue; }
          }
          row.push((x + y) % 2 === 0 ? skinEmptyA : skinEmptyB);
        }
        board.push(row);
      }
  
      let currentFruit = skinApple;
      if (gameMode === 'banana' || gameMode.includes('banana')) currentFruit = '🍌';
  
      minesArray.forEach(m => { if(board[m.y]) board[m.y][m.x] = '💣'; });
      wallsArray.forEach(w => { if(board[w.y]) board[w.y][w.x] = '🧱'; });
      
      const hasPortalsOnBoard = ['portal', 'm3', 'm40', 'm71', 'm111'].includes(gameMode) || (modeId > 0 && modeId % 13 === 0) || gameMode.includes('3');
      if (hasPortalsOnBoard) {
        if (portalA.x >= 0 && board[portalA.y]) board[portalA.y][portalA.x] = '🌀';
        if (portalB.x >= 0 && board[portalB.y]) board[portalB.y][portalB.x] = '🌌';
      }
  
      if (apple.x >= 0 && apple.x < width && board[apple.y]) board[apple.y][apple.x] = currentFruit;
  
      snake.forEach((segment, index) => {
        if (segment.x >= 0 && segment.x < width && segment.y >= 0 && segment.y < height && board[segment.y]) {
          if ((gameMode === 'blind' || gameMode.includes('blind') || isBlindEnabled) && board[segment.y][segment.x] === '⬛' && index > 0) return;
          board[segment.y][segment.x] = index === 0 ? skinHead : skinBody;
        }
      });
  
      return board.map(row => row.join('')).join('\n');
    }
  
    class UltimateSnake1005Extension {
      getInfo() {
        // Прямой, отказоустойчивый словарь локализации
        const menuTitles = {
          ru: { b: "Текст игрового поля", i: "Начать: Ширина [W] Высота [H] Режим [MODE]", s: "Настройка: Скорость (мс) [SPD] Старт Длина [LEN]", k: "Эмодзи: ПолеА [A] ПолеБ [B] Яблоко [APL] Голова [HD] Тело [BD] БезЩита [SHD]", c: "Действие игры: [ACTION]", d: "Повернуть змейку: [DIR]", sc: "Текущие очки", m1: "📦 Режимы: Классика [MODE]", m2: "🌌 Режимы: Пространство [MODE]", m3: "⚙️ Режимы: Управление [MODE]", m4: "💀 Режимы: Выживание [MODE]", m5: "🕹️ Режимы: Аркада [MODE]", m6: "🧮 Режимы: Математика [MODE]" },
          en: { b: "Game Board Text", i: "Start: Width [W] Height [H] Mode [MODE]", s: "Setup: Speed (ms) [SPD] Start Length [LEN]", k: "Skins: GridA [A] GridB [B] Apple [APL] Head [HD] Body [BD] BrokenShield [SHD]", c: "Game Action: [ACTION]", d: "Turn Snake: [DIR]", sc: "Current Score", m1: "📦 Modes: Classic [MODE]", m2: "🌌 Modes: Space [MODE]", m3: "⚙️ Modes: Control [MODE]", m4: "💀 Modes: Survival [MODE]", m5: "🕹️ Modes: Arcade [MODE]", m6: "🧮 Modes: Math [MODE]" }
        };
  
        let currentLang = 'ru';
        if (typeof Scratch !== 'undefined' && Scratch.translate && typeof Scratch.translate.getLang === 'function') {
          currentLang = Scratch.translate.getLang();
        } else if (typeof window !== 'undefined' && window.navigator) {
          currentLang = window.navigator.language || window.navigator.userLanguage || 'ru';
        }

        let userLang = 'ru';
        if (!currentLang.startsWith('ru')) {
          userLang = 'en';
        }
        
        const m = menuTitles[userLang];
  
        return {
          id: 'ultimateSnake1005Engine',
          name: userLang === 'ru' ? 'Google Змейка: 1005 Режимов' : 'Google Snake: 1005 Modes',
          color1: '#4285F4', 
          blocks: [
            { opcode: 'getBoardText', blockType: Scratch.BlockType.REPORTER, text: m.b },
            '---',
            { 
              opcode: 'initGame', 
              blockType: Scratch.BlockType.COMMAND, 
              text: m.i,
              arguments: {
                W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 12 },
                H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 10 },
                MODE: { type: Scratch.ArgumentType.STRING, defaultValue: 'classic' }
              }
            },
            { 
              opcode: 'setSettings', 
              blockType: Scratch.BlockType.COMMAND, 
              text: m.s,
              arguments: {
                SPD: { type: Scratch.ArgumentType.NUMBER, defaultValue: 200 },
                LEN: { type: Scratch.ArgumentType.NUMBER, defaultValue: 3 }
              }
            },
            { 
              opcode: 'setSkins', 
              blockType: Scratch.BlockType.COMMAND, 
              text: m.k,
              arguments: {
                A: { type: Scratch.ArgumentType.STRING, defaultValue: '🟩' },
                B: { type: Scratch.ArgumentType.STRING, defaultValue: '🟫' },
                APL: { type: Scratch.ArgumentType.STRING, defaultValue: '🍎' },
                HD: { type: Scratch.ArgumentType.STRING, defaultValue: '👀' },
                BD: { type: Scratch.ArgumentType.STRING, defaultValue: '🟢' },
                SHD: { type: Scratch.ArgumentType.STRING, defaultValue: '💀' }
              }
            },
            { 
              opcode: 'controlGame', 
              blockType: Scratch.BlockType.COMMAND, 
              text: m.c,
              arguments: {
                ACTION: { type: Scratch.ArgumentType.STRING, menu: 'actionsMenu', defaultValue: 'start' }
              }
            },
            { 
              opcode: 'changeDirection', 
              blockType: Scratch.BlockType.COMMAND, 
              text: m.d,
              arguments: {
                DIR: { type: Scratch.ArgumentType.STRING, menu: 'directionsMenu', defaultValue: 'right' }
              }
            },
            '---',
            { opcode: 'getScore', blockType: Scratch.BlockType.REPORTER, text: m.sc },
            '---',
            { opcode: 'menuClassic', blockType: Scratch.BlockType.REPORTER, text: m.m1, arguments: { MODE: { type: Scratch.ArgumentType.STRING, menu: 'menuClassicList', defaultValue: 'classic' } } },
            { opcode: 'menuSpace', blockType: Scratch.BlockType.REPORTER, text: m.m2, arguments: { MODE: { type: Scratch.ArgumentType.STRING, menu: 'menuSpaceList', defaultValue: 'm16' } } },
            { opcode: 'menuControl', blockType: Scratch.BlockType.REPORTER, text: m.m3, arguments: { MODE: { type: Scratch.ArgumentType.STRING, menu: 'menuControlList', defaultValue: 'm36' } } },
            { opcode: 'menuSurvival', blockType: Scratch.BlockType.REPORTER, text: m.m4, arguments: { MODE: { type: Scratch.ArgumentType.STRING, menu: 'menuSurvivalList', defaultValue: 'm56' } } },
            { opcode: 'menuArcade', blockType: Scratch.BlockType.REPORTER, text: m.m5, arguments: { MODE: { type: Scratch.ArgumentType.STRING, menu: 'menuArcadeList', defaultValue: '16' } } },
            { opcode: 'menuMathGenerator', blockType: Scratch.BlockType.REPORTER, text: m.m6, arguments: { MODE: { type: Scratch.ArgumentType.STRING, menu: 'menuMathGeneratorList', defaultValue: 'm260' } } }
          ],
          menus: {
            actionsMenu: { 
              acceptReporters: false, 
              items: userLang === 'ru' ? ['старт', 'пауза', 'reset'] : ['start', 'pause', 'reset']
            },
            directionsMenu: { 
              acceptReporters: false, 
              items: userLang === 'ru' ? ['вверх', 'вниз', 'влево', 'вправо'] : ['up', 'down', 'left', 'right']
            },
            menuClassicList: {
              acceptReporters: false,
              items: userLang === 'ru' ? [
                { text: '1. Классика (Стены)', value: 'classic' }, { text: '2. Без стен (Сквозь экран)', value: 'wallless' }, { text: '3. Порталы', value: 'portal' },
                { text: '4. Бесконечный рост', value: 'infinite' }, { text: '5. Двойная голова (Twin)', value: 'twin' }, { text: '6. Зеркальное управление', value: 'mirror' },
                { text: '7. Пьяная змейка (Хаос)', value: 'drunk' }, { text: '8. Режим Сыр (Сквозь тело)', value: 'cheese' }, { text: '9. Минное Поле', value: 'minesweeper' },
                { text: '10. Растущие Стены', value: 'wallmode' }, { text: '11. Ядовитые Яблоки', value: 'poison' }, { text: '12. Щит (1 спасение)', value: 'shield' },
                { text: '13. Ночной режим (Слепота)', value: 'blind' }, { text: '14. Быстрый банан', value: 'banana' }, { text: '15. Летающие фрукты', value: 'fly' }
              ] : [
                { text: '1. Classic', value: 'classic' }, { text: '2. Wallless', value: 'wallless' }, { text: '3. Portals', value: 'portal' },
                { text: '4. Infinite Growth', value: 'infinite' }, { text: '5. Twin Head', value: 'twin' }, { text: '6. Mirror Control', value: 'mirror' },
                { text: '7. Drunk Snake', value: 'drunk' }, { text: '8. Cheese Mode', value: 'cheese' }, { text: '9. Minesweeper', value: 'minesweeper' },
                { text: '10. Growing Walls', value: 'wallmode' }, { text: '11. Poison Apples', value: 'poison' }, { text: '12. Shield (1 Save)', value: 'shield' },
                { text: '13. Solar Eclipse', value: 'blind' }, { text: '14. Fast Banana', value: 'banana' }, { text: '15. Flying Fruits', value: 'fly' }
              ]
            },
            menuSpaceList: {
              acceptReporters: false,
              items: userLang === 'ru' ? [
                { text: '16. Микромир 5х5', value: 'm16' }, { text: '17. Массивный рост', value: 'm17' }, { text: '18. Скользкий лед', value: 'm18' },
                { text: '20. Режим Призрак', value: 'm20' }, { text: '21. Головоломка Сокобан', value: 'm21' }, { text: '22. Мир Инь-Янь', value: 'm22' },
                { text: '24. Космический вакуум', value: 'm24' }, { text: '25. Горизонтальное метро', value: 'm25' }, { text: '26. Вертикальный лифт', value: 'm26' },
                { text: '27. Квадратный коридор', value: 'm27' }, { text: '28. Замкнутая комната', value: 'm28' }, { text: '29. Четыре коридора', value: 'm29' },
                { text: '30. Остров сокровищ', value: 'm30' }, { text: '34. Пещера ужасов', value: 'm34' }, { text: '35. Каменный Лабиринт', value: 'm35' }
              ] : [
                { text: '16. Micro Field 5x5', value: 'm16' }, { text: '17. Massive Growth', value: 'm17' }, { text: '18. Slippery Ice', value: 'm18' },
                { text: '20. Ghost Mode', value: 'm20' }, { text: '21. Sokoban Puzzle', value: 'm21' }, { text: '22. Yin-Yang World', value: 'm22' },
                { text: '24. Space Vacuum', value: 'm24' }, { text: '25. Horizontal Subway', value: 'm25' }, { text: '26. Vertical Elevator', value: 'm26' },
                { text: '27. Square Corridor', value: 'm27' }, { text: '28. Locked Room', value: 'm28' }, { text: '29. Four Corridors', value: 'm29' },
                { text: '30. Treasure Island', value: 'm30' }, { text: '34. Cave of Horrors', value: 'm34' }, { text: '35. Stone Labyrinth', value: 'm35' }
              ]
            },
            menuControlList: {
              acceptReporters: false,
              items: userLang === 'ru' ? [
                { text: '36. Реверс по кнопке', value: 'm36' }, { text: '37. Турбо-ускорение x3', value: 'm37' }, { text: '38. Черепаший шаг', value: 'm38' },
                { text: '41. Дрожь земли', value: 'm41' }, { text: '42. Внезапный разворот змеи', value: 'm42' }, { text: '43. Залипающие клавиши', value: 'm43' },
                { text: '44. Космическая невесомость', value: 'm44' }, { text: '46. Отраженный мир', value: 'm46' }, { text: '47. Медленный старт', value: 'm47' }
              ] : [
                { text: '36. Button Reverse', value: 'm36' }, { text: '37. Turbo Speed x3', value: 'm37' }, { text: '38. Turtle Pace', value: 'm38' },
                { text: '41. Earth Tremor', value: 'm41' }, { text: '42. Sudden Turn', value: 'm42' }, { text: '43. Sticky Keys', value: 'm43' },
                { text: '44. Anti-Gravity Space', value: 'm44' }, { text: '46. Reflected World', value: 'm46' }, { text: '47. Slow Start', value: 'm47' }
            ]
          },
          menuSurvivalList: {
            acceptReporters: false,
            items: userLang === 'ru' ? [
              { text: '56. Таймер смерти (10 сек)', value: 'm56' }, { text: '57. Лазерный обстрел', value: 'm57' }, { text: '58. Кислотный дождь', value: 'm58' },
              { text: '59. Голодание (Потеря хвоста)', value: 'm59' }, { text: '60. Скорость без тормозов', value: 'm60' }, { text: '65. Полная слепота', value: 'm65' },
              { text: '67. Радиоактивная зона', value: 'm67' }, { text: '68. Скоростная паника', value: 'm68' }, { text: '69. Цунами сетки', value: 'm69' },
              { text: '73. Падающие камни', value: 'm73' }, { text: '75. Хрупкий стеклянный пол', value: 'm75' }, { text: '76. Огненные блоки следа', value: 'm76' },
              { text: '82. Болотная грязь', value: 'm82' }, { text: '84. Песчаная буря', value: 'm84' }, { text: '85. Ураганный ветер', value: 'm85' }
            ] : [
              { text: '56. 10 Sec Death Timer', value: 'm56' }, { text: '57. Laser Strike', value: 'm57' }, { text: '58. Acid Rain', value: 'm58' },
              { text: '59. Starvation Mode', value: 'm59' }, { text: '60. No Brakes Speed', value: 'm60' }, { text: '65. Pitch Black Blindness', value: 'm65' },
              { text: '67. Radioactive Zone', value: 'm67' }, { text: '68. Speed Panic Growth', value: 'm68' }, { text: '69. Grid Tsunami Shift', value: 'm69' },
              { text: '73. Falling Rocks', value: 'm73' }, { text: '75. Glass Floor Break', value: 'm75' }, { text: '76. Fiery Trail Blocks', value: 'm76' },
              { text: '82. Swamp Mud Slowdown', value: 'm82' }, { text: '84. Blinding Sandstorm', value: 'm84' }, { text: '85. Hurricane Wind Push', value: 'm85' }
            ]
          },
          menuArcadeList: {
            acceptReporters: false,
            items: userLang === 'ru' ? [
              { text: '16. Прыгающие порталы (При выходе)', value: '16' }, 
              { text: '86. Внезапная смерть', value: 'm86' }, { text: '87. Симулятор слизня', value: 'm87' }, { text: '89. Циклический хаос', value: 'm89' },
              { text: '90. Скоростной туннель', value: 'm90' }, { text: '91. Зеркальная иллюзия', value: 'm91' }, { text: '93. Возврат бумеранга', value: 'm93' },
              { text: '95. Колебание матрицы', value: 'm95' }, { text: '96. Квантовая запутанность', value: 'm96' }, { text: '98. Электрошок хвоста', value: 'm98' },
              { text: '100. Гравитационное поле', value: 'm100' }, { text: '104. Забывчивая змея', value: 'm104' }, { text: '106. Метеоритный дождь', value: 'm106' },
              { text: '110. Нестабильное ядро', value: 'm110' }, { text: '111. Портал в ад', value: 'm111' }, { text: '115. Финал: Абсолютный Бог', value: 'm115' }
            ] : [
              { text: '16. Jumping Portals (On exit)', value: '16' }, 
              { text: '86. Sudden Death', value: 'm86' }, { text: '87. Slime Simulator', value: 'm87' }, { text: '89. Cyclic Chaos Loop', value: 'm89' },
              { text: '90. Highspeed Tunnel', value: 'm90' }, { text: '91. Mirror Room Illusion', value: 'm91' }, { text: '93. Boomerang Return', value: 'm93' },
              { text: '95. Matrix Grid Wobble', value: 'm95' }, { text: '96. Quantum Entanglement', value: 'm96' }, { text: '98. Electric Shock Shaver', value: 'm98' },
              { text: '100. Gravity Field Drag', value: 'm100' }, { text: '104. Forgetful Snake Memory', value: 'm104' }, { text: '106. Meteor Shower Rain', value: 'm106' },
              { text: '110. Unstable Nuclear Core', value: 'm110' }, { text: '111. Portal to Hell', value: 'm111' }, { text: '115. Final: Absolute God', value: 'm115' }
            ]
          },
          menuMathGeneratorList: {
            acceptReporters: false,
            items: userLang === 'ru' ? [
              { text: 'Генератор: Червоточины (x13)', value: 'm260' }, { text: 'Генератор: Минные поля (x17)', value: 'm340' },
              { text: 'Генератор: Летающие фрукты (x19)', value: 'm380' }, { text: 'Генератор: Квантовый призрак (x23)', value: 'm460' },
              { text: 'Генератор: Туман и слепота (x27)', value: 'm540' }, { text: 'Генератор: Сбои управления (x31)', value: 'm620' },
              { text: 'Генератор: Рост преград (x37)', value: 'm740' }, { text: 'Генератор: Бесконечная петля (x39)', value: 'm780' },
              { text: 'Генератор: Инверсия структуры (x41)', value: 'm820' }, { text: 'Генератор: Метеорный шторм (x43)', value: 'm860' },
              { text: 'Генератор: Кислотные ягоды (x47)', value: 'm940' }, { text: 'Генератор: Золотой Джекпот (x53)', value: 'm954' },
              { text: 'Генератор: Сверхзвуковая паника (x100)', value: 'm1000' },
              { text: 'Генератор: Прыгающие порталы при выходе (x16)', value: '16' },
              { text: 'Генератор: Абсолютный Апокалипсис (x1005)', value: 'm1005' }
            ] : [
              { text: 'Generator: Wormholes (x13)', value: 'm260' }, { text: 'Generator: Mines fields (x17)', value: 'm340' },
              { text: 'Generator: Flying Fruits (x19)', value: 'm380' }, { text: 'Generator: Quantum Ghost (x23)', value: 'm460' },
              { text: 'Generator: Mist Blindness (x27)', value: 'm540' }, { text: 'Generator: Control Glitch (x31)', value: 'm620' },
              { text: 'Generator: Obstacle Growth (x37)', value: 'm740' }, { text: 'Generator: Infinite Loop (x39)', value: 'm780' },
              { text: 'Generator: Inverse Bones (x41)', value: 'm820' }, { text: 'Generator: Meteor Storm (x43)', value: 'm860' },
              { text: 'Generator: Acid Berries (x47)', value: 'm940' }, { text: 'Generator: Golden Jackpot (x53)', value: 'm954' },
              { text: 'Generator: Supersonic Panic (x100)', value: 'm1000' },
              { text: 'Generator: Jumping Portals (x16)', value: '16' },
              { text: 'Generator: Ultimate Apocalypse (x1005)', value: 'm1005' }
            ]
          }
        }
      };
    }

    menuClassic(args) { return args.MODE; }
    menuSpace(args) { return args.MODE; }
    menuControl(args) { return args.MODE; }
    menuSurvival(args) { return args.MODE; }
    menuArcade(args) { return args.MODE; }
    menuMathGenerator(args) { return args.MODE; }
    getBoardText() { return renderGridToString(); }

    initGame(args) {
      if (gameInterval !== null) { clearInterval(gameInterval); gameInterval = null; }
      wallsArray = []; minesArray = []; dynamicObstacles = [];
      invertedControls = false; shieldActive = false; flyCounter = 0; modeTimer = 0;
      isWalllessEnabled = false; isInfiniteGrowth = false; isBlindEnabled = false;
      isTwinEnabled = false; isDrunkEnabled = false; isGhostBodyEnabled = false;
      isWallBuilderEnabled = false; isPoisonEnabled = false; isShieldEnabled = false;
      isFlyingFruitEnabled = false; isPortalJumpEnabled = false;

      width = Math.max(5, parseInt(args.W) || 12);
      height = Math.max(5, parseInt(args.H) || 10);
      
      let rawMode = String(args.MODE || 'classic').toLowerCase().trim();
      gameMode = rawMode;

      let activeModes = rawMode.split('+').map(s => s.trim().replace('m', ''));
      isPaused = true;
      
      if (activeModes.includes('2') || rawMode.includes('wallless')) isWalllessEnabled = true;
      if (activeModes.includes('3') || rawMode.includes('portal')) { portalA = {x: 1, y: 1}; portalB = {x: width - 2, y: height - 2}; }
      if (activeModes.includes('4') || rawMode.includes('infinite')) isInfiniteGrowth = true;
      if (activeModes.includes('5') || rawMode.includes('twin')) isTwinEnabled = true;
      if (activeModes.includes('6') || rawMode.includes('mirror')) invertedControls = true;
      if (activeModes.includes('7') || rawMode.includes('drunk')) isDrunkEnabled = true;
      if (activeModes.includes('8') || rawMode.includes('cheese')) isGhostBodyEnabled = true;
      
      if (activeModes.includes('9') || rawMode.includes('minesweeper')) {
        let maxMines = Math.floor((width * height) * 0.08) + 1;
        for(let i = 0; i < maxMines; i++) {
          let mx = (i * 3 + 2) % width; let my = (i * 2 + 3) % height;
          if (mx !== Math.floor(width/3) && my !== Math.floor(height/2)) minesArray.push({x: mx, y: my});
        }
      }
      if (activeModes.includes('10') || rawMode.includes('wallmode')) isWallBuilderEnabled = true;
      if (activeModes.includes('11') || rawMode.includes('poison')) isPoisonEnabled = true;
      if (activeModes.includes('12') || rawMode.includes('shield')) isShieldEnabled = true;
      if (activeModes.includes('13') || rawMode.includes('blind')) isBlindEnabled = true;
      if (activeModes.includes('15') || rawMode.includes('fly')) isFlyingFruitEnabled = true;
      if (activeModes.includes('16') || rawMode.includes('jump')) isPortalJumpEnabled = true;

      if (rawMode.includes('1005')) {
        isWalllessEnabled = true; isInfiniteGrowth = true; isBlindEnabled = true; isDrunkEnabled = true;
        isGhostBodyEnabled = true; isFlyingFruitEnabled = true; isPortalJumpEnabled = true;
        let maxMines = Math.floor((width * height) * 0.12);
        for(let i = 0; i < maxMines; i++) minesArray.push({x: (i * 3 + 2) % width, y: (i * 2 + 3) % height});
        portalA = {x: 1, y: 1}; portalB = {x: width - 2, y: height - 2};
      }

      resetGame();

      let modeId = gameMode.startsWith('m') ? parseInt(gameMode.slice(1)) || 0 : 0;
      const isFastMode = activeModes.includes('14') || rawMode.includes('banana') || rawMode.includes('60') || rawMode.includes('1005') || (modeId > 0 && modeId % 100 === 0);
      if (isFastMode) { tickSpeed = Math.max(25, Math.floor(tickSpeed / 2.5)); }
      
      startLoop();
    }
    setSettings(args) { 
        tickSpeed = Math.max(25, parseInt(args.SPD) || 200); 
        initialSize = Math.max(1, parseInt(args.LEN) || 3); 
      }
  
      setSkins(args) {
        skinEmptyA = args.A || '🟩'; 
        skinEmptyB = args.B || '🟫'; 
        skinApple = args.APL || '🍎'; 
        skinBody = args.BD || '🟢';
        savedDefaultHead = args.HD || '👀'; 
        skinNoShieldHead = args.SHD || '💀';
        if (!shieldActive) skinHead = savedDefaultHead;
      }
  
      controlGame(args) {
        const act = String(args.ACTION).toLowerCase().trim();
        if (act === 'start' || act === 'старт') isPaused = false;
        if (act === 'pause' || act === 'пауза') isPaused = true;
        if (act === 'reset') { isPaused = true; resetGame(); }
      }
  
      changeDirection(args) {
        let dir = String(args.DIR).toLowerCase().trim();
        if (dir === 'вверх' || dir === 'up') dir = 'up'; 
        if (dir === 'вниз' || dir === 'down') dir = 'down'; 
        if (dir === 'влево' || dir === 'left') dir = 'left'; 
        if (dir === 'вправо' || dir === 'right') dir = 'right';
        
        if (invertedControls) {
          if (dir === 'up') dir = 'down'; 
          else if (dir === 'down') dir = 'up'; 
          else if (dir === 'left') dir = 'right'; 
          else if (dir === 'right') dir = 'left';
        }
        
        if (dir === 'up' && direction.y !== 1) nextDirection = { x: 0, y: -1 };
        if (dir === 'down' && direction.y !== -1) nextDirection = { x: 0, y: 1 };
        if (dir === 'left' && direction.x !== 1) nextDirection = { x: -1, y: 0 };
        if (dir === 'right' && direction.x !== -1) nextDirection = { x: 1, y: 0 };
      }
  
      getScore() { return score; }
    }
  
    Scratch.extensions.register(new UltimateSnake1005Extension());
  })(Scratch);

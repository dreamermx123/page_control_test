const { app, BrowserWindow } = require('electron');
const puppeteer = require('puppeteer');

// Конфигурации для мониторинга
const MONITOR_INTERVAL = 5000; // Интервал проверки в миллисекундах
const MEMORY_LIMIT_BYTES = 1_073_741_820; // Лимит памяти в байтах (1 ГБ)

let browser; // Puppeteer-браузер
let page; // Puppeteer-страница
let mainWindow; // Окно Electron
let url = "https://www.ivi.ru/movies";

/**
 * Функция для запуска Puppeteer
 */
async function startBrowser() {
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--window-size=1920,1080',
                '--ignore-certificate-errors',
                '--start-fullscreen',
            ],
        });
        page = await browser.newPage();
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
        });
        await page.goto(url);
        console.log('Браузер Puppeteer запущен и вкладка открыта');
    } catch (error) {
        console.error('Ошибка при запуске Puppeteer:', error);
        app.quit(); // Завершаем приложение Electron при критической ошибке
    }
}

/**
 * Функция для мониторинга страницы
 */
async function monitorTab() {
    try {
        if (!page || page.isClosed()) {
            console.log('Вкладка Puppeteer закрыта. Перезапуск...');
            await restartTab();
            return;
        }

        const metrics = await page.metrics();
        const usedMemory = metrics.JSHeapUsedSize;

        console.log(`Используемая память Puppeteer: ${usedMemory} байт`);

        if (usedMemory > MEMORY_LIMIT_BYTES) {
            console.log(
                `Память превышена (${usedMemory} байт > ${MEMORY_LIMIT_BYTES} байт). Перезапуск вкладки...`
            );
            await restartTab();
        }
    } catch (error) {
        console.error('Ошибка при мониторинге Puppeteer:', error);
        console.log('Перезапуск Puppeteer...');
        await restartBrowser();
    }
}

/**
 * Функция для перезапуска вкладки
 */
async function restartTab() {
    try {
        if (page && !page.isClosed()) {
            await page.close();
        }
        page = await browser.newPage();
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
        });
        await page.goto(url);
        console.log('Вкладка Puppeteer перезапущена');
    } catch (error) {
        console.error('Ошибка при перезапуске вкладки Puppeteer:', error);
        await restartBrowser();
    }
}

/**
 * Функция для перезапуска браузера
 */
async function restartBrowser() {
    try {
        if (browser) {
            await browser.close();
        }
        await startBrowser();
    } catch (error) {
        console.error('Критическая ошибка при перезапуске Puppeteer:', error);
        app.quit();
    }
}

/**
 * Функция для очистки ресурсов при завершении программы
 */
async function cleanUpAndExit() {
    console.log('\nЗавершение программы...');
    if (browser) {
        await browser.close();
    }
    if (mainWindow) {
        mainWindow.close();
    }
    console.log('Все ресурсы закрыты, приложение завершено.');
    app.quit();
}

// Обработка сигналов для завершения (например, Ctrl + C)
process.on('SIGINT', cleanUpAndExit);
process.on('SIGTERM', cleanUpAndExit);

/**
 * Создание окна Electron
 */
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true, // Разрешаем использование Node.js в рендерере
            contextIsolation: false,
        },
    });

    mainWindow.loadFile('index.html'); // Загружаем HTML (можно оставить пустым)
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Запуск Puppeteer
    await startBrowser();

    // Запуск мониторинга Puppeteer
    setInterval(async () => {
        await monitorTab();
    }, MONITOR_INTERVAL);
}

// Создание окна Electron при запуске приложения
app.whenReady().then(createWindow);

// Закрытие приложения, если все окна закрыты
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Перезапуск окна для macOS
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
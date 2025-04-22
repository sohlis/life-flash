// Canvas setup
const gameCanvas = document.getElementById('gameCanvas');
const gameCtx = gameCanvas.getContext('2d');
const countdownElement = document.getElementById('countdown');
console.log('Canvas setup complete:', { gameCanvas, gameCtx, countdownElement });

// Game state
let isRunning = false;
let currentGrid = [];
let nextGrid = [];
let cellSize = 2;
let gridWidth = 0;
let gridHeight = 0;
let threshold = 45; // 1-100, where 1 is most sensitive to darkness, 100 is least sensitive
console.log('Initial game state:', { isRunning, cellSize, gridWidth, gridHeight, threshold });

// Initialize grids
function initGrids() {
    console.log('Initializing grids with dimensions:', { gridWidth, gridHeight });
    currentGrid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(0));
    nextGrid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(0));
    console.log('Grids initialized:', { currentGrid, nextGrid });
}

// Set canvas sizes to full screen
function resizeCanvas() {
    console.log('Resizing canvas, window dimensions:', { 
        width: window.innerWidth, 
        height: window.innerHeight 
    });
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;
    gridWidth = Math.floor(gameCanvas.width / cellSize);
    gridHeight = Math.floor(gameCanvas.height / cellSize);
    console.log('New canvas and grid dimensions:', { 
        canvasWidth: gameCanvas.width, 
        canvasHeight: gameCanvas.height,
        gridWidth,
        gridHeight
    });
    initGrids();
}

// Webcam setup
let stream = null;
let video = null;
let countdownActive = false;

async function setupWebcam() {
    console.log('Setting up webcam...');
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia is not supported in this browser');
        }
        
        console.log('Requesting webcam access...');
        const constraints = {
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'user'  // Explicitly request front camera
            }
        };
        console.log('Using constraints:', constraints);
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Webcam access granted, stream:', stream);
        
        video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = stream;
        console.log('Created video element:', video);
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                console.log('Video metadata loaded:', {
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                });
                resolve();
            };
        });
        
        console.log('Starting video playback');
        await video.play();
        console.log('Video playback started');
        
        // Ensure grid is initialized before starting preview
        resizeCanvas();
        drawLivePreview();
        setTimeout(startCountdown, 1000);
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert(`Error accessing webcam: ${err.message}\nPlease make sure your webcam is connected and you've granted permission.`);
    }
}

// Countdown function
function startCountdown() {
    console.log('Starting countdown');
    if (countdownActive) {
        console.log('Countdown already active, returning');
        return;
    }
    countdownActive = true;
    
    let count = 3;
    countdownElement.textContent = count;
    countdownElement.classList.add('visible');
    console.log('Countdown started:', count);
    
    const countdownInterval = setInterval(() => {
        count--;
        countdownElement.textContent = count;
        console.log('Countdown tick:', count);
        
        if (count <= 0) {
            console.log('Countdown finished, starting game');
            clearInterval(countdownInterval);
            countdownElement.classList.remove('visible');
            countdownActive = false;
            isRunning = true;
            gameLoop();
        }
    }, 1000);
}

// Draw live preview with dithering
function drawLivePreview() {
    if (!video) {
        console.log('No video element available for preview');
        return;
    }
    
    if (!currentGrid.length || !currentGrid[0].length) {
        console.log('Grid not initialized, skipping preview');
        return;
    }
    
    console.log('Drawing live preview');
    // Draw the video frame
    gameCtx.drawImage(video, 0, 0, gameCanvas.width, gameCanvas.height);
    
    // Get the image data
    const imageData = gameCtx.getImageData(0, 0, gameCanvas.width, gameCanvas.height);
    const pixels = imageData.data;
    console.log('Got image data:', { 
        width: imageData.width, 
        height: imageData.height,
        dataLength: pixels.length 
    });
    
    // Clear the canvas
    gameCtx.fillStyle = '#000';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Draw dithered cells
    gameCtx.fillStyle = '#fff';
    let liveCells = 0;
    
    // Convert threshold (1-100) to brightness value (0-255)
    const brightnessThreshold = Math.floor((threshold / 100) * 255);
    
    for (let y = 0; y < gameCanvas.height; y += cellSize) {
        for (let x = 0; x < gameCanvas.width; x += cellSize) {
            let total = 0;
            let count = 0;
            
            // Average the pixels in the cell
            for (let dy = 0; dy < cellSize; dy++) {
                for (let dx = 0; dx < cellSize; dx++) {
                    const idx = ((y + dy) * gameCanvas.width + (x + dx)) * 4;
                    if (idx < pixels.length) {
                        const r = pixels[idx];
                        const g = pixels[idx + 1];
                        const b = pixels[idx + 2];
                        total += (r + g + b) / 3;
                        count++;
                    }
                }
            }
            
            const avg = total / count;
            const gridX = Math.floor(x / cellSize);
            const gridY = Math.floor(y / cellSize);
            
            // Update grid and draw cell using the converted threshold
            if (gridY < currentGrid.length && gridX < currentGrid[0].length) {
                currentGrid[gridY][gridX] = avg < brightnessThreshold ? 1 : 0;
                if (currentGrid[gridY][gridX] === 1) {
                    gameCtx.fillRect(x, y, cellSize, cellSize);
                    liveCells++;
                }
            }
        }
    }
    console.log('Preview drawn, live cells:', liveCells);
    
    if (!isRunning) {
        requestAnimationFrame(drawLivePreview);
    }
}

// Conway's Game of Life rules
function updateGame() {
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            let neighbors = 0;
            
            // Count neighbors
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const newX = (x + dx + gridWidth) % gridWidth;
                    const newY = (y + dy + gridHeight) % gridHeight;
                    neighbors += currentGrid[newY][newX];
                }
            }
            
            // Apply rules
            if (currentGrid[y][x] === 1) {
                nextGrid[y][x] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
            } else {
                nextGrid[y][x] = (neighbors === 3) ? 1 : 0;
            }
        }
    }
    
    // Swap grids
    [currentGrid, nextGrid] = [nextGrid, currentGrid];
    drawGame();
}

// Draw the game grid
function drawGame() {
    gameCtx.fillStyle = '#000';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    gameCtx.fillStyle = '#fff';
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (currentGrid[y][x] === 1) {
                gameCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
}

// Game loop
function gameLoop() {
    if (isRunning) {
        updateGame();
        setTimeout(gameLoop, 100);
    }
}

// Mouse interaction state
let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Handle mouse events
function handleMouseDown(e) {
    isMouseDown = true;
    toggleCell(e);
}

function handleMouseUp() {
    isMouseDown = false;
}

function handleMouseMove(e) {
    if (isMouseDown) {
        toggleCell(e);
    }
}

function toggleCell(e) {
    const rect = gameCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    
    if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        currentGrid[y][x] = currentGrid[y][x] ? 0 : 1;
        drawGame();
    }
}

// Initialize
console.log('Starting initialization...');
resizeCanvas();

// Add mouse event listeners
gameCanvas.addEventListener('mousedown', handleMouseDown);
gameCanvas.addEventListener('mouseup', handleMouseUp);
gameCanvas.addEventListener('mousemove', handleMouseMove);
gameCanvas.addEventListener('mouseleave', handleMouseUp);

window.addEventListener('resize', () => {
    console.log('Window resized');
    resizeCanvas();
});

// Ensure webcam setup is called after DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, setting up webcam');
    setupWebcam();
});

console.log('Initialization complete'); 
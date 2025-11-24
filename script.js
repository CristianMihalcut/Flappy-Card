class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playJump() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playScore() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playCrash() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Audio
        this.audio = new SoundManager();

        // Game State
        this.isRunning = false;
        this.isGameOver = false;
        this.score = 0;
        this.bestScore = localStorage.getItem('flappyCardBest') || 0;
        this.frames = 0;
        this.speed = 3; // Initial scroll speed

        // Entities
        this.card = null;
        this.obstacles = [];
        this.particles = [];

        // Bindings
        this.loop = this.loop.bind(this);
        this.resize = this.resize.bind(this);
        this.handleInput = this.handleInput.bind(this);

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', this.resize);

        // Input handling
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.handleInput();
        });
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInput();
        });
        this.canvas.addEventListener('mousedown', this.handleInput);

        // UI Buttons
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('restart-btn').addEventListener('click', () => this.reset());

        document.getElementById('best-score').innerText = this.bestScore;
    }

    resize() {
        const container = document.getElementById('game-container');
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.width = this.canvas.width;
            this.height = this.canvas.height;
        }
    }

    start() {
        document.getElementById('start-screen').classList.remove('active');
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('score-display').style.display = 'block';

        this.resetGameEntities();
        this.isRunning = true;
        this.isGameOver = false;
        this.loop();
    }

    reset() {
        document.getElementById('game-over-screen').classList.remove('active');
        document.getElementById('game-over-screen').classList.add('hidden');
        this.start();
    }

    resetGameEntities() {
        this.score = 0;
        document.getElementById('score-display').innerText = this.score;
        this.frames = 0;
        this.speed = 2.2;
        this.obstacles = [];
        this.particles = [];

        // Create Player
        this.card = {
            x: 50,
            y: this.height / 2,
            width: 40,
            height: 56,
            velocity: 0,
            gravity: 0.2,
            jumpStrength: -4.5,
            rotation: 0,
            rank: 'A',
            suit: '♥',
            isFaceUp: true,
            backVariant: 0 // 0: Blue, 1: Red, 2: Black
        };
    }

    handleInput() {
        if (!this.isRunning) return;
        this.card.velocity = this.card.jumpStrength;
        this.audio.playJump();
    }

    update() {
        this.frames++;

        // Card Physics
        this.card.velocity += this.card.gravity;
        this.card.y += this.card.velocity;

        // Rotation based on velocity
        this.card.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.card.velocity * 0.1)));

        // Ground/Ceiling collision
        if (this.card.y + this.card.height >= this.height || this.card.y < 0) {
            this.gameOver();
        }

        // Obstacles
        if (this.frames % 120 === 0) { // Spawn rate
            this.spawnObstacle();
        }

        this.obstacles.forEach((obs, index) => {
            obs.x -= this.speed;

            // Collision Detection
            if (this.checkCollision(this.card, obs)) {
                this.gameOver();
            }

            // Score & Card Change
            if (!obs.passed && this.card.x > obs.x + obs.width) {
                obs.passed = true;
                this.score++;
                document.getElementById('score-display').innerText = this.score;
                this.audio.playScore();
                this.changeCardSuit();
                // Increase speed slightly
                if (this.score % 5 === 0) this.speed += 0.1;
            }

            // Remove off-screen
            if (obs.x + obs.width < 0) {
                this.obstacles.splice(index, 1);
            }
        });
    }

    spawnObstacle() {
        const gapHeight = 170;
        const minHeight = 80;
        const maxTopHeight = this.height - gapHeight - minHeight;
        const topHeight = Math.floor(Math.random() * (maxTopHeight - minHeight + 1)) + minHeight;

        const obstacle = {
            x: this.width,
            width: 60,
            topHeight: topHeight,
            gap: gapHeight,
            passed: false,
            hasRabbit: Math.random() > 0.7 // 30% chance
        };
        this.obstacles.push(obstacle);
    }

    checkCollision(card, obs) {
        // Simple AABB for now, can refine
        // Top Pipe (Hat inverted)
        const hitTop = (
            card.x < obs.x + obs.width &&
            card.x + card.width > obs.x &&
            card.y < obs.topHeight
        );

        // Bottom Pipe (Hat upright)
        const hitBottom = (
            card.x < obs.x + obs.width &&
            card.x + card.width > obs.x &&
            card.y + card.height > obs.topHeight + obs.gap
        );

        return hitTop || hitBottom;
    }

    changeCardSuit() {
        const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
        const suits = ['♥', '♠', '♦', '♣'];

        // 30% chance to show card back, 70% chance to show a new face card
        if (Math.random() < 0.3) {
            this.card.isFaceUp = false;
            this.card.backVariant = Math.floor(Math.random() * 3);
        } else {
            this.card.isFaceUp = true;
            this.card.rank = ranks[Math.floor(Math.random() * ranks.length)];
            this.card.suit = suits[Math.floor(Math.random() * suits.length)];
        }
    }

    gameOver() {
        this.isRunning = false;
        this.isGameOver = true;
        this.audio.playCrash();

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('flappyCardBest', this.bestScore);
        }

        document.getElementById('final-score').innerText = this.score;
        document.getElementById('best-score').innerText = this.bestScore;
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('game-over-screen').classList.add('active');
        document.getElementById('score-display').style.display = 'none';
    }

    draw() {
        // Clear
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Background
        this.drawBackground();

        // Obstacles
        this.obstacles.forEach(obs => {
            const poleWidth = 12;
            const poleColor = '#000'; // Black wand
            const poleTipColor = '#fff'; // White tip

            // Hat dimensions
            const hatAspectRatio = 1.2; // Width / Height
            const hatWidth = obs.width;
            const hatHeight = hatWidth / hatAspectRatio;

            // Draw Poles (Wands)
            // Top Pole
            const topPoleHeight = obs.topHeight - hatHeight;
            if (topPoleHeight > 0) {
                this.ctx.fillStyle = poleColor;
                this.ctx.fillRect(obs.x + obs.width / 2 - poleWidth / 2, 0, poleWidth, topPoleHeight);
                // Tip
                this.ctx.fillStyle = poleTipColor;
                this.ctx.fillRect(obs.x + obs.width / 2 - poleWidth / 2, topPoleHeight - 10, poleWidth, 10);
            }

            // Bottom Pole
            const bottomPoleY = obs.topHeight + obs.gap + hatHeight;
            const bottomPoleHeight = this.height - bottomPoleY;
            if (bottomPoleHeight > 0) {
                this.ctx.fillStyle = poleColor;
                this.ctx.fillRect(obs.x + obs.width / 2 - poleWidth / 2, bottomPoleY, poleWidth, bottomPoleHeight);
                // Tip
                this.ctx.fillStyle = poleTipColor;
                this.ctx.fillRect(obs.x + obs.width / 2 - poleWidth / 2, bottomPoleY, poleWidth, 10);
            }

            // Top Hat (Upright - Brim at bottom, towards the gap)
            this.drawHat(obs.x, obs.topHeight - hatHeight, hatWidth, hatHeight);

            // Bottom Hat (Inverted - Brim at top, towards the gap)
            this.ctx.save();
            this.ctx.translate(obs.x + obs.width / 2, obs.topHeight + obs.gap);
            this.ctx.scale(1, -1); // Flip vertically
            // After flip, we draw the hat. 
            // We want the Brim (which is at y+h in drawHat) to be at 0 (gap_end).
            // So we draw at y = -hatHeight.
            // Brim is at -h + h = 0.
            this.drawHat(-hatWidth / 2, -hatHeight, hatWidth, hatHeight);
            this.ctx.restore();

            // Rabbit
            if (obs.hasRabbit) {
                // Static peek
                const peekHeight = 30;
                this.drawRabbit(obs.x + 10, obs.topHeight + obs.gap - peekHeight, obs.width - 20, peekHeight + 10);
            }
        });

        // Player
        this.ctx.save();
        this.ctx.translate(this.card.x + this.card.width / 2, this.card.y + this.card.height / 2);
        this.ctx.rotate(this.card.rotation);
        this.drawCard(-this.card.width / 2, -this.card.height / 2, this.card.width, this.card.height, this.card);
        this.ctx.restore();
    }

    drawCard(x, y, w, h, card) {
        if (!card.isFaceUp) {
            this.drawCardBack(x, y, w, h, card.backVariant);
            return;
        }

        // Card Face
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;

        // Rounded rect for card
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(x, y, w, h, 4);
        } else {
            this.ctx.rect(x, y, w, h); // Fallback
        }
        this.ctx.fill();
        this.ctx.stroke();

        const isRed = card.suit === '♥' || card.suit === '♦';
        this.ctx.fillStyle = isRed ? '#d32f2f' : '#000';

        // Top Left
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(card.rank, x + 10, y + 16);
        this.ctx.font = '12px Arial';
        this.ctx.fillText(card.suit, x + 10, y + 28);

        // Bottom Right (Rotated)
        this.ctx.save();
        this.ctx.translate(x + w - 10, y + h - 16);
        this.ctx.rotate(Math.PI);
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(card.rank, 0, 0);
        this.ctx.font = '12px Arial';
        this.ctx.fillText(card.suit, 0, 12);
        this.ctx.restore();

        // Center Art
        this.ctx.font = '20px Arial';
        this.ctx.fillText(card.suit, x + w / 2, y + h / 2 + 8);
    }

    drawCardBack(x, y, w, h, variant) {
        this.ctx.save();
        // Card Base
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(x, y, w, h, 4);
        } else {
            this.ctx.rect(x, y, w, h);
        }
        this.ctx.fill();
        this.ctx.stroke();

        // Inner Pattern Area
        const pad = 4;
        this.ctx.beginPath();
        this.ctx.rect(x + pad, y + pad, w - pad * 2, h - pad * 2);
        this.ctx.clip();

        if (variant === 0) {
            // Blue Crosshatch
            this.ctx.fillStyle = '#1565c0';
            this.ctx.fillRect(x, y, w, h);
            this.ctx.strokeStyle = '#42a5f5';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            for (let i = 0; i < w + h; i += 6) {
                this.ctx.moveTo(x + i - h, y);
                this.ctx.lineTo(x + i, y + h);
            }
            this.ctx.stroke();
        } else if (variant === 1) {
            // Red Diamonds
            this.ctx.fillStyle = '#b71c1c';
            this.ctx.fillRect(x, y, w, h);
            this.ctx.fillStyle = '#d32f2f';
            for (let i = 0; i < w; i += 10) {
                for (let j = 0; j < h; j += 10) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(x + i + 5, y + j);
                    this.ctx.lineTo(x + i + 10, y + j + 5);
                    this.ctx.lineTo(x + i + 5, y + j + 10);
                    this.ctx.lineTo(x + i, y + j + 5);
                    this.ctx.fill();
                }
            }
        } else {
            // Black Luxury
            this.ctx.fillStyle = '#212121';
            this.ctx.fillRect(x, y, w, h);
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(x + w / 2, y + h / 2, 10, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.arc(x + w / 2, y + h / 2, 20, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Gold Border
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
        this.ctx.restore();
    }

    drawBackground() {
        // Gradient Sky
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#1a0b2e');
        gradient.addColorStop(1, '#4a2b7e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Spotlight
        const spotGradient = this.ctx.createRadialGradient(this.width / 2, this.height / 2, 50, this.width / 2, this.height / 2, 400);
        spotGradient.addColorStop(0, 'rgba(255, 255, 200, 0.1)');
        spotGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = spotGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Floor
        this.ctx.fillStyle = '#3e2723';
        this.ctx.fillRect(0, this.height - 50, this.width, 50);
        this.ctx.fillStyle = '#5d4037'; // Floor detail
        this.ctx.fillRect(0, this.height - 50, this.width, 5);

        // Curtains (Simple Red Shapes)
        this.ctx.fillStyle = '#b71c1c';

        // Side Curtains (Main)
        // Left
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.quadraticCurveTo(120, this.height / 2, 0, this.height);
        this.ctx.fill();
        // Right
        this.ctx.beginPath();
        this.ctx.moveTo(this.width, 0);
        this.ctx.quadraticCurveTo(this.width - 120, this.height / 2, this.width, this.height);
        this.ctx.fill();

        // Side Curtains (Inner Layer - Darker)
        this.ctx.fillStyle = '#880e4f';
        // Left Inner
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.quadraticCurveTo(80, this.height / 3, 0, this.height * 0.8);
        this.ctx.fill();
        // Right Inner
        this.ctx.beginPath();
        this.ctx.moveTo(this.width, 0);
        this.ctx.quadraticCurveTo(this.width - 80, this.height / 3, this.width, this.height * 0.8);
        this.ctx.fill();

        // Corner Swags (Decorative folds)
        this.ctx.fillStyle = '#7f0000'; // Deep shadow red

        // Left Swag
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.quadraticCurveTo(this.width * 0.25, this.height * 0.15, 0, this.height * 0.4);
        this.ctx.fill();

        // Right Swag
        this.ctx.beginPath();
        this.ctx.moveTo(this.width, 0);
        this.ctx.quadraticCurveTo(this.width * 0.75, this.height * 0.15, this.width, this.height * 0.4);
        this.ctx.fill();

        // Gold Ropes (Tie-backs)
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;

        // Left Rope
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height * 0.25);
        this.ctx.quadraticCurveTo(this.width * 0.1, this.height * 0.3, 0, this.height * 0.35);
        this.ctx.stroke();

        // Right Rope
        this.ctx.beginPath();
        this.ctx.moveTo(this.width, this.height * 0.25);
        this.ctx.quadraticCurveTo(this.width * 0.9, this.height * 0.3, this.width, this.height * 0.35);
        this.ctx.stroke();

        // Top Valance (The frilly part at the top)
        this.ctx.fillStyle = '#d32f2f';
        const scallopCount = 7;
        const scallopWidth = this.width / scallopCount;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        for (let i = 0; i < scallopCount; i++) {
            this.ctx.quadraticCurveTo(
                i * scallopWidth + scallopWidth / 2, 60,
                (i + 1) * scallopWidth, 0
            );
        }
        this.ctx.lineTo(this.width, 0);
        this.ctx.lineTo(0, 0);
        this.ctx.fill();

        // Valance Gold Trim
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        for (let i = 0; i < scallopCount; i++) {
            this.ctx.quadraticCurveTo(
                i * scallopWidth + scallopWidth / 2, 60,
                (i + 1) * scallopWidth, 0
            );
        }
        this.ctx.stroke();
    }

    drawHat(x, y, w, h) {
        // Hat Cup (Trapezoid)
        // Made slimmer by increasing inset
        const inset = w * 0.25;
        const topFlare = 5; // Slight flare at top

        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.beginPath();
        this.ctx.moveTo(x + inset, y + h * 0.8);
        this.ctx.lineTo(x + w - inset, y + h * 0.8);
        this.ctx.lineTo(x + w - inset + topFlare, y);
        this.ctx.lineTo(x + inset - topFlare, y);
        this.ctx.closePath();
        this.ctx.fill();

        // Red Band
        this.ctx.fillStyle = '#d32f2f';
        this.ctx.fillRect(x + inset, y + h * 0.5, w - inset * 2, h * 0.2);

        // Brim (Outer)
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.beginPath();
        this.ctx.ellipse(x + w / 2, y + h * 0.8, w * 0.7, h * 0.2, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Brim (Inner Hole)
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.ellipse(x + w / 2, y + h * 0.8, w * 0.3, h * 0.08, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawRabbit(x, y, w, h) {
        // Ears
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.ellipse(x + w * 0.3, y, w * 0.15, h * 0.4, -0.2, 0, Math.PI * 2);
        this.ctx.ellipse(x + w * 0.7, y, w * 0.15, h * 0.4, 0.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Inner Ears
        this.ctx.fillStyle = '#f8bbd0';
        this.ctx.beginPath();
        this.ctx.ellipse(x + w * 0.3, y, w * 0.08, h * 0.25, -0.2, 0, Math.PI * 2);
        this.ctx.ellipse(x + w * 0.7, y, w * 0.08, h * 0.25, 0.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Head
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(x + w / 2, y + h * 0.6, w * 0.35, 0, Math.PI * 2);
        this.ctx.fill();

        // Eyes
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(x + w * 0.35, y + h * 0.55, 2, 0, Math.PI * 2);
        this.ctx.arc(x + w * 0.65, y + h * 0.55, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Nose
        this.ctx.fillStyle = '#f48fb1';
        this.ctx.beginPath();
        this.ctx.arc(x + w / 2, y + h * 0.65, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }

    loop() {
        if (this.isRunning) {
            this.update();
            this.draw();
            requestAnimationFrame(this.loop);
        }
    }
}

// Start Game
window.onload = () => {
    const game = new Game();
};

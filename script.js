const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// Game states
let gameState = 'intro'; 
let introTimer = 0;
let loadingTimer = 0;
let creditsTimer = 0;

const player = { x: 180, y: 500, width: 40, height: 40, speed: 5, baseSpeed: 5 };
let bullets = [];
let enemies = [];
let bossBullets = [];
let boss = null;
let explosions = [];
let particles = [];
let kills = 0;
let score = 0;
let gameOver = false;
const keys = {};
let lastAutoShot = 0;
const autoShootInterval = 200;

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

scoreElement.style.display = 'none';

// Mouse position for restart button
let mouseX = 0;
let mouseY = 0;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (gameState === 'playing' && gameOver && 
        x >= canvas.width/2 - 60 && x <= canvas.width/2 + 60 &&
        y >= canvas.height/2 + 10 && y <= canvas.height/2 + 50) {
        restartGame();
    }
});

class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 12;
        this.speed = 8;
    }
    update() { this.y -= this.speed; }
    draw() {
        const gradient = ctx.createRadialGradient(this.x + 2, this.y + 3, 0, this.x + 2, this.y + 3, 8);
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(0.5, '#0ff');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);
    }
}

class Enemy {
    constructor() {
        this.x = Math.random() * (canvas.width - 40);
        this.y = -40;
        this.width = 35;
        this.height = 35;
        this.baseSpeed = 2;
        this.speed = this.baseSpeed + (kills > 50 ? 0.5 : 0) + (kills / 200);
        this.rotation = 0;
    }
    update() { 
        this.y += this.speed; 
        this.rotation += 0.1;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x + 18, this.y + 18);
        ctx.rotate(this.rotation);
        ctx.shadowColor = '#f00';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff6666';
        ctx.beginPath();
        ctx.arc(0, -8, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

class Boss {
    constructor() {
        this.x = canvas.width / 2 - 75;
        this.y = -100;
        this.width = 150;
        this.height = 80;
        this.speed = 1;
        this.health = 20;
        this.maxHealth = 20;
        this.lastShot = 0;
        this.shootInterval = 1200; // Slower shooting
        this.rotation = 0;
        this.isActive = false; // NEW: Boss activation flag
    }
    update() {
        if (this.y < 50) {
            this.y += this.speed;
        } else {
            this.isActive = true; // Activate shooting when boss reaches position
            this.rotation += 0.03; // Faster rotation
            this.x += Math.sin(this.rotation * 0.4) * 1.2; // INCREASED side movement (0.5 → 1.2)
            // Keep boss on screen
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
        }
    }
    draw() {
        ctx.save();
        ctx.shadowColor = '#ff0';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(this.x - 10, this.y - 10, this.width + 20, this.height + 20);
        ctx.fillStyle = '#ff4400';
        ctx.fillRect(this.x + 20, this.y - 15, 15, 25);
        ctx.fillRect(this.x + this.width - 35, this.y - 15, 15, 25);
        const barWidth = 120;
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x + 15, this.y - 35, barWidth, 8);
        ctx.fillStyle = healthPercent > 0.5 ? '#0f0' : healthPercent > 0.25 ? '#ff0' : '#f00';
        ctx.fillRect(this.x + 15, this.y - 35, barWidth * healthPercent, 8);
        ctx.restore();
    }
    shoot() {
        const currentTime = Date.now();
        // Only shoot when fully active (reached position)
        if (this.isActive && currentTime - this.lastShot > this.shootInterval) {
            // ONE BULLET from center only
            bossBullets.push(new BossBullet(this.x + this.width / 2 - 3, this.y + this.height));
            this.lastShot = currentTime;
        }
    }
}

class BossBullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 6;
        this.height = 14;
        this.speed = 4;
    }
    update() { this.y += this.speed; }
    draw() {
        ctx.fillStyle = '#ff4400';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 3;
        this.maxRadius = 25;
        this.life = 25;
        this.color = `hsl(${Math.random() * 60 + 10}, 100%, 50%)`;
    }
    update() {
        this.radius += 1.2;
        this.life--;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / 25;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 30;
        this.maxLife = 30;
        this.color = `hsl(${Math.random() * 60 + 200}, 70%, 60%)`;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2;
        this.life--;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function shoot() {
    bullets.push(new Bullet(player.x + player.width / 2 - 2, player.y));
}

function spawnBoss() {
    if (kills >= 100 && !boss) {
        boss = new Boss();
    }
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function createPlayerExplosion() {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(player.x + 20, player.y + 20));
    }
}

function restartGame() {
    gameState = 'playing';
    player.x = 180;
    player.y = 500;
    bullets = [];
    enemies = [];
    bossBullets = [];
    boss = null;
    explosions = [];
    particles = [];
    kills = 0;
    score = 0;
    gameOver = false;
    lastAutoShot = 0;
}

function drawIntro() {
    ctx.fillStyle = 'rgba(0, 0, 20, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    const pulse = Math.sin(introTimer * 0.1) * 0.1 + 1;
    ctx.font = `bold ${45 * pulse}px Arial`;
    ctx.fillStyle = '#ff44ff';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 30;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPACE SHOOTER', 0, 0);
    ctx.restore();
    
    introTimer++;
}

function drawLoading() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOADING...', 0, -20);
    
    const barWidth = 200;
    const progress = Math.min(loadingTimer / 60, 1);
    ctx.fillStyle = '#333';
    ctx.fillRect(-barWidth/2, 0, barWidth, 20);
    ctx.fillStyle = '#0ff';
    ctx.fillRect(-barWidth/2, 0, barWidth * progress, 20);
    
    ctx.restore();
    
    loadingTimer++;
}

function drawCredits() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 20;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BY', 0, -50);
    
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 30;
    ctx.fillText('Abduldinh', 0, 0);
    
    ctx.restore();
    
    creditsTimer++;
}

function drawReady() {
    ctx.fillStyle = 'rgba(0, 0, 20, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 15;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CLICK TO START GAME', 0, 0);
    
    ctx.restore();
}

function gameLoop() {
    if (gameState === 'playing') {
        ctx.fillStyle = 'rgba(0, 0, 20, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const currentTime = Date.now();

    if (gameState === 'intro') {
        drawIntro();
        if (introTimer > 120) gameState = 'loading';
    } 
    else if (gameState === 'loading') {
        drawLoading();
        if (loadingTimer > 90) gameState = 'credits';
    }
    else if (gameState === 'credits') {
        drawCredits();
        if (creditsTimer > 120) gameState = 'ready';
    }
    else if (gameState === 'ready') {
        drawReady();
        canvas.addEventListener('click', startGame);
    }
    else if (gameState === 'playing' && !gameOver) {
        scoreElement.style.display = 'block';
        scoreElement.textContent = `Kills: ${kills} | Score: ${score}`;
        
        player.speed = kills >= 50 ? player.baseSpeed + 2 : player.baseSpeed;

        if (keys['ArrowLeft'] && player.x > 0) player.x -= player.speed;
        if (keys['ArrowRight'] && player.x < canvas.width - player.width) player.x += player.speed;
        if (keys['ArrowUp'] && player.y > 0) player.y -= player.speed;
        if (keys['ArrowDown'] && player.y < canvas.height - player.height) player.y += player.speed;

        if (currentTime - lastAutoShot > autoShootInterval) {
            shoot();
            lastAutoShot = currentTime;
        }
        if (keys['Space']) shoot();

        ctx.save();
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 20;
        ctx.fillStyle = kills >= 50 ? '#00ffaa' : '#00ff00';
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y);
        ctx.lineTo(player.x + 5, player.y + player.height - 5);
        ctx.lineTo(player.x + 15, player.y + player.height);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height - 8);
        ctx.lineTo(player.x + player.width - 15, player.y + player.height);
        ctx.lineTo(player.x + player.width - 5, player.y + player.height - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        bullets = bullets.filter(b => {
            b.update();
            b.draw();
            return b.y > -b.height;
        });

        if (Math.random() < 0.02) enemies.push(new Enemy());
        spawnBoss();

        if (boss) {
            boss.update();
            boss.draw();
            boss.shoot(); // FIXED: Only 1 bullet when active

            bossBullets = bossBullets.filter(bb => {
                bb.update();
                bb.draw();
                if (checkCollision(player, bb)) {
                    createPlayerExplosion();
                    gameOver = true;
                    scoreElement.textContent = `Final Kills: ${kills} | Final Score: ${score}`;
                }
                return bb.y < canvas.height;
            });

            for (let j = bullets.length - 1; j >= 0; j--) {
                const b = bullets[j];
                if (checkCollision(b, boss)) {
                    explosions.push(new Explosion(b.x, b.y));
                    bullets.splice(j, 1);
                    boss.health--;
                    score += 5;
                    if (boss.health <= 0) {
                        explosions.push(new Explosion(boss.x + 75, boss.y + 40));
                        boss = null;
                        kills += 10;
                        score += 50;
                    }
                    break;
                }
            }
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.update();
            e.draw();

            for (let j = bullets.length - 1; j >= 0; j--) {
                const b = bullets[j];
                if (checkCollision(b, e)) {
                    explosions.push(new Explosion(e.x + 18, e.y + 18));
                    enemies.splice(i, 1);
                    bullets.splice(j, 1);
                    kills++;
                    score += 10;
                    break;
                }
            }

            if (checkCollision(player, e)) {
                createPlayerExplosion();
                gameOver = true;
                scoreElement.textContent = `Final Kills: ${kills} | Final Score: ${score}`;
            }
        }

        explosions = explosions.filter(exp => {
            exp.update();
            exp.draw();
            return exp.life > 0;
        });

        particles = particles.filter(p => {
            p.update();
            p.draw();
            return p.life > 0;
        });
    }
    else if (gameState === 'playing' && gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60);
        
        ctx.font = '24px Arial';
        ctx.fillStyle = '#ff0';
        ctx.fillText(`Kills: ${kills} | Score: ${score}`, canvas.width / 2, canvas.height / 2 - 25);
        
        const buttonX = canvas.width / 2;
        const buttonY = canvas.height / 2 + 10;
        const buttonWidth = 120;
        const buttonHeight = 40;
        
        ctx.fillStyle = '#0f0';
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 15;
        ctx.fillRect(buttonX - buttonWidth/2, buttonY, buttonWidth, buttonHeight);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RESTART', buttonX, buttonY + buttonHeight/2);
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.fillText('Click RESTART', canvas.width / 2, canvas.height / 2 + 70);
        
        ctx.textAlign = 'left';
    }

    requestAnimationFrame(gameLoop);
}

function startGame() {
    if (gameState === 'ready') {
        gameState = 'playing';
        canvas.removeEventListener('click', startGame);
        player.x = 180;
        player.y = 500;
        bullets = [];
        enemies = [];
        bossBullets = [];
        boss = null;
        explosions = [];
        particles = [];
        kills = 0;
        score = 0;
        gameOver = false;
    }
}

gameLoop();

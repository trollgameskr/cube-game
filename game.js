// 3x3 Cube Puzzle Game - Interactive 2D representation
class CubePuzzleGame {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.cube = this.createSolvedCube();
        this.rotation = { x: -0.5, y: 0.8 };
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.animating = false;
        this.selectedFace = null;
        this.swipeStart = null;
        this.swipeThreshold = 30;
        
        this.colors = {
            0: '#FF0000', // Red - Front
            1: '#FF8800', // Orange - Back
            2: '#00FF00', // Green - Left
            3: '#0000FF', // Blue - Right
            4: '#FFFF00', // Yellow - Top
            5: '#FFFFFF'  // White - Bottom
        };
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupControls();
        this.scrambleCube();
        this.animate();
    }

    setupCanvas() {
        const container = document.getElementById('canvas-container');
        this.canvas = document.createElement('canvas');
        
        const size = Math.min(window.innerWidth, window.innerHeight * 0.8);
        this.canvas.width = size;
        this.canvas.height = size;
        
        this.ctx = this.canvas.getContext('2d');
        container.appendChild(this.canvas);
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    createSolvedCube() {
        // Create a 3x3x3 cube where each face is a single color
        // Each face is represented as a 3x3 array
        return {
            front: Array(9).fill(0),  // Red
            back: Array(9).fill(1),   // Orange
            left: Array(9).fill(2),   // Green
            right: Array(9).fill(3),  // Blue
            top: Array(9).fill(4),    // Yellow
            bottom: Array(9).fill(5)  // White
        };
    }

    setupControls() {
        let swipeStartPos = null;
        let clickedFace = null;

        const onPointerDown = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            swipeStartPos = {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
            
            clickedFace = this.getFaceAtPosition(swipeStartPos.x, swipeStartPos.y);
        };

        const onPointerMove = (e) => {
            if (!swipeStartPos) return;
            
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const currentPos = {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
            
            const deltaX = currentPos.x - swipeStartPos.x;
            const deltaY = currentPos.y - swipeStartPos.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (distance > this.swipeThreshold && clickedFace) {
                // Determine swipe direction
                const angle = Math.atan2(deltaY, deltaX);
                const direction = this.getSwipeDirection(angle);
                
                this.handleSwipe(clickedFace, direction);
                swipeStartPos = null;
                clickedFace = null;
            }
        };

        const onPointerUp = (e) => {
            if (swipeStartPos && clickedFace) {
                // Tap without swipe - highlight face
                this.highlightFace(clickedFace);
            }
            swipeStartPos = null;
            clickedFace = null;
        };

        this.canvas.addEventListener('mousedown', onPointerDown);
        this.canvas.addEventListener('mousemove', onPointerMove);
        this.canvas.addEventListener('mouseup', onPointerUp);
        this.canvas.addEventListener('mouseleave', onPointerUp);

        this.canvas.addEventListener('touchstart', onPointerDown, { passive: false });
        this.canvas.addEventListener('touchmove', onPointerMove, { passive: false });
        this.canvas.addEventListener('touchend', onPointerUp);
        this.canvas.addEventListener('touchcancel', onPointerUp);

        document.getElementById('reset-btn').addEventListener('click', () => this.resetCube());
        document.getElementById('hint-btn').addEventListener('click', () => this.showHint());
    }

    getFaceAtPosition(x, y) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const faceSize = Math.min(this.canvas.width, this.canvas.height) / 5;
        
        const faces = [
            { name: 'top', x: centerX - faceSize / 2, y: centerY - faceSize * 2, w: faceSize, h: faceSize },
            { name: 'left', x: centerX - faceSize * 1.5, y: centerY - faceSize / 2, w: faceSize, h: faceSize },
            { name: 'front', x: centerX - faceSize / 2, y: centerY - faceSize / 2, w: faceSize, h: faceSize },
            { name: 'right', x: centerX + faceSize / 2, y: centerY - faceSize / 2, w: faceSize, h: faceSize },
            { name: 'bottom', x: centerX - faceSize / 2, y: centerY + faceSize / 2, w: faceSize, h: faceSize },
            { name: 'back', x: centerX - faceSize / 2, y: centerY + faceSize * 1.5, w: faceSize, h: faceSize }
        ];
        
        for (let face of faces) {
            if (x >= face.x && x <= face.x + face.w &&
                y >= face.y && y <= face.y + face.h) {
                return face.name;
            }
        }
        return null;
    }

    getSwipeDirection(angle) {
        // Convert angle to direction: right, left, up, down
        const deg = angle * 180 / Math.PI;
        if (deg > -45 && deg <= 45) return 'right';
        if (deg > 45 && deg <= 135) return 'down';
        if (deg > 135 || deg <= -135) return 'left';
        return 'up';
    }

    handleSwipe(face, direction) {
        // Map face and swipe direction to cube rotations
        const moves = {
            'front': { 'up': 'F', 'down': 'Fi', 'left': 'F', 'right': 'Fi' },
            'back': { 'up': 'B', 'down': 'Bi', 'left': 'B', 'right': 'Bi' },
            'top': { 'up': 'U', 'down': 'Ui', 'left': 'U', 'right': 'Ui' },
            'bottom': { 'up': 'D', 'down': 'Di', 'left': 'D', 'right': 'Di' },
            'left': { 'up': 'L', 'down': 'Li', 'left': 'L', 'right': 'Li' },
            'right': { 'up': 'R', 'down': 'Ri', 'left': 'R', 'right': 'Ri' }
        };
        
        if (moves[face] && moves[face][direction]) {
            this.executeMove(moves[face][direction]);
            this.showMoveIndicator(face, direction);
        }
    }

    highlightFace(faceName) {
        this.selectedFace = faceName;
        setTimeout(() => {
            this.selectedFace = null;
        }, 300);
    }

    showMoveIndicator(face, direction) {
        const message = document.getElementById('message');
        const arrows = { 'up': '↑', 'down': '↓', 'left': '←', 'right': '→' };
        message.textContent = `${face.toUpperCase()} ${arrows[direction]}`;
        message.classList.remove('hidden');
        
        setTimeout(() => {
            message.classList.add('hidden');
        }, 500);
    }

    scrambleCube() {
        const moves = ['U', 'D', 'L', 'R', 'F', 'B'];
        const scrambleMoves = 20;
        
        for (let i = 0; i < scrambleMoves; i++) {
            const move = moves[Math.floor(Math.random() * moves.length)];
            this.executeMove(move);
        }
    }

    executeMove(move) {
        switch(move) {
            case 'U': this.rotateTop(true); break;
            case 'Ui': this.rotateTop(false); break;
            case 'D': this.rotateBottom(true); break;
            case 'Di': this.rotateBottom(false); break;
            case 'L': this.rotateLeft(true); break;
            case 'Li': this.rotateLeft(false); break;
            case 'R': this.rotateRight(true); break;
            case 'Ri': this.rotateRight(false); break;
            case 'F': this.rotateFront(true); break;
            case 'Fi': this.rotateFront(false); break;
            case 'B': this.rotateBack(true); break;
            case 'Bi': this.rotateBack(false); break;
        }
    }

    rotateFace(face, clockwise = true) {
        const temp = [...face];
        if (clockwise) {
            face[0] = temp[6]; face[1] = temp[3]; face[2] = temp[0];
            face[3] = temp[7]; face[4] = temp[4]; face[5] = temp[1];
            face[6] = temp[8]; face[7] = temp[5]; face[8] = temp[2];
        } else {
            face[0] = temp[2]; face[1] = temp[5]; face[2] = temp[8];
            face[3] = temp[1]; face[4] = temp[4]; face[5] = temp[7];
            face[6] = temp[0]; face[7] = temp[3]; face[8] = temp[6];
        }
    }

    rotateTop(clockwise = true) {
        this.rotateFace(this.cube.top, clockwise);
        const temp = [this.cube.front[0], this.cube.front[1], this.cube.front[2]];
        if (clockwise) {
            this.cube.front[0] = this.cube.right[0];
            this.cube.front[1] = this.cube.right[1];
            this.cube.front[2] = this.cube.right[2];
            
            this.cube.right[0] = this.cube.back[0];
            this.cube.right[1] = this.cube.back[1];
            this.cube.right[2] = this.cube.back[2];
            
            this.cube.back[0] = this.cube.left[0];
            this.cube.back[1] = this.cube.left[1];
            this.cube.back[2] = this.cube.left[2];
            
            this.cube.left[0] = temp[0];
            this.cube.left[1] = temp[1];
            this.cube.left[2] = temp[2];
        } else {
            this.cube.front[0] = this.cube.left[0];
            this.cube.front[1] = this.cube.left[1];
            this.cube.front[2] = this.cube.left[2];
            
            this.cube.left[0] = this.cube.back[0];
            this.cube.left[1] = this.cube.back[1];
            this.cube.left[2] = this.cube.back[2];
            
            this.cube.back[0] = this.cube.right[0];
            this.cube.back[1] = this.cube.right[1];
            this.cube.back[2] = this.cube.right[2];
            
            this.cube.right[0] = temp[0];
            this.cube.right[1] = temp[1];
            this.cube.right[2] = temp[2];
        }
    }

    rotateBottom(clockwise = true) {
        this.rotateFace(this.cube.bottom, clockwise);
        const temp = [this.cube.front[6], this.cube.front[7], this.cube.front[8]];
        if (clockwise) {
            this.cube.front[6] = this.cube.left[6];
            this.cube.front[7] = this.cube.left[7];
            this.cube.front[8] = this.cube.left[8];
            
            this.cube.left[6] = this.cube.back[6];
            this.cube.left[7] = this.cube.back[7];
            this.cube.left[8] = this.cube.back[8];
            
            this.cube.back[6] = this.cube.right[6];
            this.cube.back[7] = this.cube.right[7];
            this.cube.back[8] = this.cube.right[8];
            
            this.cube.right[6] = temp[0];
            this.cube.right[7] = temp[1];
            this.cube.right[8] = temp[2];
        } else {
            this.cube.front[6] = this.cube.right[6];
            this.cube.front[7] = this.cube.right[7];
            this.cube.front[8] = this.cube.right[8];
            
            this.cube.right[6] = this.cube.back[6];
            this.cube.right[7] = this.cube.back[7];
            this.cube.right[8] = this.cube.back[8];
            
            this.cube.back[6] = this.cube.left[6];
            this.cube.back[7] = this.cube.left[7];
            this.cube.back[8] = this.cube.left[8];
            
            this.cube.left[6] = temp[0];
            this.cube.left[7] = temp[1];
            this.cube.left[8] = temp[2];
        }
    }

    rotateFront(clockwise = true) {
        this.rotateFace(this.cube.front, clockwise);
        const temp = [this.cube.top[6], this.cube.top[7], this.cube.top[8]];
        if (clockwise) {
            this.cube.top[6] = this.cube.left[8];
            this.cube.top[7] = this.cube.left[5];
            this.cube.top[8] = this.cube.left[2];
            
            this.cube.left[2] = this.cube.bottom[0];
            this.cube.left[5] = this.cube.bottom[1];
            this.cube.left[8] = this.cube.bottom[2];
            
            this.cube.bottom[0] = this.cube.right[6];
            this.cube.bottom[1] = this.cube.right[3];
            this.cube.bottom[2] = this.cube.right[0];
            
            this.cube.right[0] = temp[0];
            this.cube.right[3] = temp[1];
            this.cube.right[6] = temp[2];
        } else {
            this.cube.top[6] = this.cube.right[0];
            this.cube.top[7] = this.cube.right[3];
            this.cube.top[8] = this.cube.right[6];
            
            this.cube.right[0] = this.cube.bottom[2];
            this.cube.right[3] = this.cube.bottom[1];
            this.cube.right[6] = this.cube.bottom[0];
            
            this.cube.bottom[0] = this.cube.left[2];
            this.cube.bottom[1] = this.cube.left[5];
            this.cube.bottom[2] = this.cube.left[8];
            
            this.cube.left[2] = temp[8];
            this.cube.left[5] = temp[7];
            this.cube.left[8] = temp[6];
        }
    }

    rotateBack(clockwise = true) {
        this.rotateFace(this.cube.back, clockwise);
        const temp = [this.cube.top[0], this.cube.top[1], this.cube.top[2]];
        if (clockwise) {
            this.cube.top[0] = this.cube.right[2];
            this.cube.top[1] = this.cube.right[5];
            this.cube.top[2] = this.cube.right[8];
            
            this.cube.right[2] = this.cube.bottom[8];
            this.cube.right[5] = this.cube.bottom[7];
            this.cube.right[8] = this.cube.bottom[6];
            
            this.cube.bottom[6] = this.cube.left[0];
            this.cube.bottom[7] = this.cube.left[3];
            this.cube.bottom[8] = this.cube.left[6];
            
            this.cube.left[0] = temp[2];
            this.cube.left[3] = temp[1];
            this.cube.left[6] = temp[0];
        } else {
            this.cube.top[0] = this.cube.left[6];
            this.cube.top[1] = this.cube.left[3];
            this.cube.top[2] = this.cube.left[0];
            
            this.cube.left[0] = this.cube.bottom[6];
            this.cube.left[3] = this.cube.bottom[7];
            this.cube.left[6] = this.cube.bottom[8];
            
            this.cube.bottom[6] = this.cube.right[8];
            this.cube.bottom[7] = this.cube.right[5];
            this.cube.bottom[8] = this.cube.right[2];
            
            this.cube.right[2] = temp[0];
            this.cube.right[5] = temp[1];
            this.cube.right[8] = temp[2];
        }
    }

    rotateLeft(clockwise = true) {
        this.rotateFace(this.cube.left, clockwise);
        const temp = [this.cube.top[0], this.cube.top[3], this.cube.top[6]];
        if (clockwise) {
            this.cube.top[0] = this.cube.back[8];
            this.cube.top[3] = this.cube.back[5];
            this.cube.top[6] = this.cube.back[2];
            
            this.cube.back[2] = this.cube.bottom[6];
            this.cube.back[5] = this.cube.bottom[3];
            this.cube.back[8] = this.cube.bottom[0];
            
            this.cube.bottom[0] = this.cube.front[0];
            this.cube.bottom[3] = this.cube.front[3];
            this.cube.bottom[6] = this.cube.front[6];
            
            this.cube.front[0] = temp[0];
            this.cube.front[3] = temp[1];
            this.cube.front[6] = temp[2];
        } else {
            this.cube.top[0] = this.cube.front[0];
            this.cube.top[3] = this.cube.front[3];
            this.cube.top[6] = this.cube.front[6];
            
            this.cube.front[0] = this.cube.bottom[0];
            this.cube.front[3] = this.cube.bottom[3];
            this.cube.front[6] = this.cube.bottom[6];
            
            this.cube.bottom[0] = this.cube.back[8];
            this.cube.bottom[3] = this.cube.back[5];
            this.cube.bottom[6] = this.cube.back[2];
            
            this.cube.back[2] = temp[6];
            this.cube.back[5] = temp[3];
            this.cube.back[8] = temp[0];
        }
    }

    rotateRight(clockwise = true) {
        this.rotateFace(this.cube.right, clockwise);
        const temp = [this.cube.top[2], this.cube.top[5], this.cube.top[8]];
        if (clockwise) {
            this.cube.top[2] = this.cube.front[2];
            this.cube.top[5] = this.cube.front[5];
            this.cube.top[8] = this.cube.front[8];
            
            this.cube.front[2] = this.cube.bottom[2];
            this.cube.front[5] = this.cube.bottom[5];
            this.cube.front[8] = this.cube.bottom[8];
            
            this.cube.bottom[2] = this.cube.back[6];
            this.cube.bottom[5] = this.cube.back[3];
            this.cube.bottom[8] = this.cube.back[0];
            
            this.cube.back[0] = temp[8];
            this.cube.back[3] = temp[5];
            this.cube.back[6] = temp[2];
        } else {
            this.cube.top[2] = this.cube.back[6];
            this.cube.top[5] = this.cube.back[3];
            this.cube.top[8] = this.cube.back[0];
            
            this.cube.back[0] = this.cube.bottom[8];
            this.cube.back[3] = this.cube.bottom[5];
            this.cube.back[6] = this.cube.bottom[2];
            
            this.cube.bottom[2] = this.cube.front[2];
            this.cube.bottom[5] = this.cube.front[5];
            this.cube.bottom[8] = this.cube.front[8];
            
            this.cube.front[2] = temp[0];
            this.cube.front[5] = temp[1];
            this.cube.front[8] = temp[2];
        }
    }

    drawFace(face, x, y, size, faceName) {
        const cellSize = size / 3;
        const gap = 2;
        
        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;
            
            this.ctx.fillStyle = this.colors[face[i]];
            
            // Highlight if selected
            if (this.selectedFace === faceName) {
                this.ctx.shadowColor = '#ffffff';
                this.ctx.shadowBlur = 15;
            }
            
            this.ctx.fillRect(
                x + col * cellSize + gap,
                y + row * cellSize + gap,
                cellSize - gap * 2,
                cellSize - gap * 2
            );
            
            this.ctx.shadowBlur = 0;
            
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(
                x + col * cellSize + gap,
                y + row * cellSize + gap,
                cellSize - gap * 2,
                cellSize - gap * 2
            );
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const faceSize = Math.min(this.canvas.width, this.canvas.height) / 5;
        
        // Draw cube faces in an unfolded pattern
        const layout = [
            { face: 'top', x: centerX - faceSize / 2, y: centerY - faceSize * 2 },
            { face: 'left', x: centerX - faceSize * 1.5, y: centerY - faceSize / 2 },
            { face: 'front', x: centerX - faceSize / 2, y: centerY - faceSize / 2 },
            { face: 'right', x: centerX + faceSize / 2, y: centerY - faceSize / 2 },
            { face: 'bottom', x: centerX - faceSize / 2, y: centerY + faceSize / 2 },
            { face: 'back', x: centerX - faceSize / 2, y: centerY + faceSize * 1.5 }
        ];
        
        layout.forEach(({ face, x, y }) => {
            this.drawFace(this.cube[face], x, y, faceSize, face);
        });
    }

    checkWinCondition() {
        const isSolved = Object.values(this.cube).every(face => {
            const firstColor = face[0];
            return face.every(cell => cell === firstColor);
        });
        
        if (isSolved) {
            this.onWin();
        }
    }

    onWin() {
        const message = document.getElementById('message');
        message.textContent = '🎉 축하합니다! 퍼즐을 완성했습니다! 🎉';
        message.classList.remove('hidden');
        message.classList.add('celebrating');
        
        setTimeout(() => {
            message.classList.remove('celebrating');
        }, 3000);
    }

    showHint() {
        const message = document.getElementById('message');
        message.textContent = '💡 힌트: 한 면씩 맞춰보세요!';
        message.classList.remove('hidden');
        
        setTimeout(() => {
            message.classList.add('hidden');
        }, 2000);
    }

    resetCube() {
        this.cube = this.createSolvedCube();
        document.getElementById('message').classList.add('hidden');
        setTimeout(() => this.scrambleCube(), 100);
    }

    onWindowResize() {
        const size = Math.min(window.innerWidth, window.innerHeight * 0.8);
        this.canvas.width = size;
        this.canvas.height = size;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.draw();
        
        // Check win condition periodically
        if (Math.random() < 0.01) {
            this.checkWinCondition();
        }
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new CubePuzzleGame();
});

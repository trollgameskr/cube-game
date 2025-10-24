// 3x3 Cube Puzzle Game - Interactive 3D representation using CSS 3D Transforms
class CubePuzzleGame {
    constructor() {
        this.container = null;
        this.cube = this.createSolvedCube();
        this.cubeElement = null;
        this.cubies = []; // Individual 3x3x3 = 27 small cubes
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.rotation = { x: -30, y: -45 };
        this.moveCount = 0;
        
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
        this.setupScene();
        this.setupCube();
        this.setupControls();
        this.scrambleCube();
        this.updateCubeRotation();
    }

    setupScene() {
        this.container = document.getElementById('canvas-container');
        this.container.style.perspective = '1000px';
        this.container.style.perspectiveOrigin = '50% 50%';
        
        this.cubeElement = document.createElement('div');
        this.cubeElement.className = 'cube-3d';
        this.cubeElement.style.cssText = `
            position: relative;
            width: 300px;
            height: 300px;
            transform-style: preserve-3d;
            margin: 0 auto;
        `;
        
        this.container.appendChild(this.cubeElement);
    }

    setupCube() {
        this.cubies = [];
        const cubieSize = 95; // Size of each small cube
        const gap = 5;
        
        // Create 27 small cubes (3x3x3)
        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                for (let z = 0; z < 3; z++) {
                    const cubie = this.createCubie(x, y, z, cubieSize, gap);
                    this.cubies.push(cubie);
                    this.cubeElement.appendChild(cubie.element);
                }
            }
        }
        
        this.updateCubieColors();
    }

    createCubie(x, y, z, size, gap) {
        const cubie = document.createElement('div');
        cubie.className = 'cubie';
        
        const offset = (size + gap) - (size + gap) * 1.5;
        const posX = x * (size + gap) + offset;
        const posY = -y * (size + gap) - offset;
        const posZ = z * (size + gap) + offset;
        
        cubie.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            transform-style: preserve-3d;
            transform: translate3d(${posX}px, ${posY}px, ${posZ}px);
        `;
        
        // Create 6 faces for each cubie
        const faces = [
            { name: 'front', rotation: 'rotateY(0deg)', translate: `0, 0, ${size/2}px` },
            { name: 'back', rotation: 'rotateY(180deg)', translate: `0, 0, ${size/2}px` },
            { name: 'right', rotation: 'rotateY(90deg)', translate: `0, 0, ${size/2}px` },
            { name: 'left', rotation: 'rotateY(-90deg)', translate: `0, 0, ${size/2}px` },
            { name: 'top', rotation: 'rotateX(90deg)', translate: `0, 0, ${size/2}px` },
            { name: 'bottom', rotation: 'rotateX(-90deg)', translate: `0, 0, ${size/2}px` }
        ];
        
        const faceElements = {};
        faces.forEach(face => {
            const faceEl = document.createElement('div');
            faceEl.className = `face face-${face.name}`;
            faceEl.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                background: #000;
                border: 2px solid #222;
                transform: ${face.rotation} translate3d(${face.translate});
                backface-visibility: hidden;
            `;
            cubie.appendChild(faceEl);
            faceElements[face.name] = faceEl;
        });
        
        return {
            element: cubie,
            faces: faceElements,
            position: { x, y, z }
        };
    }

    updateCubieColors() {
        const faceMapping = {
            front: { axis: 'z', value: 2 },
            back: { axis: 'z', value: 0 },
            left: { axis: 'x', value: 0 },
            right: { axis: 'x', value: 2 },
            top: { axis: 'y', value: 0 },
            bottom: { axis: 'y', value: 2 }
        };
        
        Object.keys(faceMapping).forEach(faceName => {
            const face = this.cube[faceName];
            const mapping = faceMapping[faceName];
            
            // Get cubies on this face
            const faceCubies = this.cubies.filter(cubie => 
                cubie.position[mapping.axis] === mapping.value
            );
            
            // Sort cubies to match the face array order
            faceCubies.sort((a, b) => {
                if (mapping.axis === 'z') {
                    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
                    return a.position.x - b.position.x;
                } else if (mapping.axis === 'y') {
                    if (a.position.z !== b.position.z) return a.position.z - b.position.z;
                    return a.position.x - b.position.x;
                } else { // x axis
                    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
                    if (mapping.value === 2) return a.position.z - b.position.z;
                    return b.position.z - a.position.z;
                }
            });
            
            // Update colors
            faceCubies.forEach((cubie, index) => {
                const colorIndex = face[index];
                const faceEl = cubie.faces[faceName];
                if (faceEl) {
                    faceEl.style.background = this.colors[colorIndex];
                }
            });
        });
    }

    updateCubeRotation() {
        this.cubeElement.style.transform = `rotateX(${this.rotation.x}deg) rotateY(${this.rotation.y}deg)`;
    }

    setupControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        
        const onPointerDown = (e) => {
            isDragging = true;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            previousMousePosition = { x: clientX, y: clientY };
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const deltaX = clientX - previousMousePosition.x;
            const deltaY = clientY - previousMousePosition.y;
            
            this.rotation.y += deltaX * 0.5;
            this.rotation.x += deltaY * 0.5;
            
            this.updateCubeRotation();
            
            previousMousePosition = { x: clientX, y: clientY };
        };

        const onPointerUp = () => {
            isDragging = false;
        };

        this.container.addEventListener('mousedown', onPointerDown);
        this.container.addEventListener('mousemove', onPointerMove);
        this.container.addEventListener('mouseup', onPointerUp);
        this.container.addEventListener('mouseleave', onPointerUp);

        this.container.addEventListener('touchstart', onPointerDown, { passive: false });
        this.container.addEventListener('touchmove', onPointerMove, { passive: false });
        this.container.addEventListener('touchend', onPointerUp);
        this.container.addEventListener('touchcancel', onPointerUp);

        document.getElementById('reset-btn').addEventListener('click', () => this.resetCube());
        document.getElementById('hint-btn').addEventListener('click', () => this.showHint());
        
        // Add rotation buttons
        this.addRotationButtons();
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    addRotationButtons() {
        const controls = document.getElementById('controls');
        const rotationControls = document.createElement('div');
        rotationControls.id = 'rotation-controls';
        rotationControls.style.cssText = 'display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap; justify-content: center;';
        
        const moves = [
            { label: 'U', move: 'U' }, { label: 'U\'', move: 'Ui' },
            { label: 'D', move: 'D' }, { label: 'D\'', move: 'Di' },
            { label: 'L', move: 'L' }, { label: 'L\'', move: 'Li' },
            { label: 'R', move: 'R' }, { label: 'R\'', move: 'Ri' },
            { label: 'F', move: 'F' }, { label: 'F\'', move: 'Fi' },
            { label: 'B', move: 'B' }, { label: 'B\'', move: 'Bi' }
        ];
        
        moves.forEach(({ label, move }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.className = 'btn-small';
            btn.addEventListener('click', () => this.executeMove(move, true));
            rotationControls.appendChild(btn);
        });
        
        controls.appendChild(rotationControls);
    }

    createSolvedCube() {
        return {
            front: Array(9).fill(0),  // Red
            back: Array(9).fill(1),   // Orange
            left: Array(9).fill(2),   // Green
            right: Array(9).fill(3),  // Blue
            top: Array(9).fill(4),    // Yellow
            bottom: Array(9).fill(5)  // White
        };
    }

    scrambleCube() {
        const moves = ['U', 'D', 'L', 'R', 'F', 'B'];
        const scrambleMoves = 20;
        
        for (let i = 0; i < scrambleMoves; i++) {
            const move = moves[Math.floor(Math.random() * moves.length)];
            this.executeMove(move, false);
        }
    }

    executeMove(move, countMove = false) {
        if (countMove) {
            this.moveCount++;
            document.getElementById('moves').textContent = this.moveCount;
        }
        
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
        
        this.updateCubieColors();
        
        if (countMove) {
            this.checkWinCondition();
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
        message.textContent = `🎉 축하합니다! ${this.moveCount}번 만에 퍼즐을 완성했습니다! 🎉`;
        message.classList.remove('hidden');
        message.classList.add('celebrating');
        
        setTimeout(() => {
            message.classList.remove('celebrating');
        }, 3000);
    }

    showHint() {
        const message = document.getElementById('message');
        message.textContent = '💡 힌트: 드래그로 큐브를 회전하고, 버튼으로 면을 돌리세요!';
        message.classList.remove('hidden');
        
        setTimeout(() => {
            message.classList.add('hidden');
        }, 2000);
    }

    resetCube() {
        this.cube = this.createSolvedCube();
        this.moveCount = 0;
        document.getElementById('moves').textContent = '0';
        document.getElementById('message').classList.add('hidden');
        this.updateCubieColors();
        setTimeout(() => this.scrambleCube(), 100);
    }

    onWindowResize() {
        // Adjust cube size if needed based on viewport
        const size = Math.min(window.innerWidth * 0.8, 300);
        this.cubeElement.style.width = size + 'px';
        this.cubeElement.style.height = size + 'px';
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new CubePuzzleGame();
});
